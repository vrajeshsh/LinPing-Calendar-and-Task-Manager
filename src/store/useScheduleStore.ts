import { create } from 'zustand';
import { DaySchedule, TimeBlock, Task, ArchivedTask, ScheduleTemplate } from '@/types';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { supabaseService } from '@/services/supabaseService';

interface ScheduleState {
  tasks: Task[];
  archivedTasks: ArchivedTask[];
  templates: ScheduleTemplate[];
  schedules: Record<string, DaySchedule>;
  lastRolloverDate: string;
  loading: boolean;

  fetchInitialData: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  purgeOldArchived: () => Promise<void>;

  saveSchedule: (date: string, schedule: DaySchedule) => Promise<void>;
  updateBlockStatus: (date: string, blockId: string, status: TimeBlock['status']) => Promise<void>;
  updateBlock: (date: string, blockId: string, updates: Partial<TimeBlock>) => Promise<void>;
  reorderBlocks: (date: string, blocks: TimeBlock[]) => Promise<void>;
  addBlockToSchedule: (date: string, block: TimeBlock) => Promise<void>;

  initializeDayFromTemplate: (date: string, templateId: string) => Promise<void>;
  rolloverIncompleteTasks: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  tasks: [],
  archivedTasks: [],
  templates: [],
  schedules: {},
  lastRolloverDate: '',
  loading: false,

  fetchInitialData: async () => {
    set({ loading: true });
    try {
      const [tasks, archived, templates] = await Promise.all([
        supabaseService.getTasks(),
        supabaseService.getArchivedTasks(),
        supabaseService.getTemplates(),
      ]);
      set({ tasks, archivedTasks: archived, templates });
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      set({ loading: false });
    }
  },

  addTask: async (task) => {
    const newTask = await supabaseService.createTask(task);
    set(s => ({ tasks: [...s.tasks, newTask] }));
  },

  updateTask: async (id, updates) => {
    await supabaseService.updateTask(id, updates);
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  },

  deleteTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;
    await supabaseService.archiveTask(id);
    const archived: ArchivedTask = { ...task, deletedAt: new Date().toISOString() };
    set(s => ({
      tasks: s.tasks.filter(t => t.id !== id),
      archivedTasks: [archived, ...s.archivedTasks],
    }));
  },

  restoreTask: async (id) => {
    const archived = get().archivedTasks.find(t => t.id === id);
    if (!archived) return;
    const { deletedAt, completedOn, ...task } = archived;
    await supabaseService.updateTask(id, { is_archived: false, deleted_at: null });
    set(s => ({
      tasks: [...s.tasks, task],
      archivedTasks: s.archivedTasks.filter(t => t.id !== id),
    }));
  },

  purgeOldArchived: async () => {
    // This could be a background job but keeping it here for simplicity
    const s = get();
    const toKeep = s.archivedTasks.filter(t => {
      const daysOld = differenceInDays(new Date(), parseISO(t.deletedAt));
      return daysOld < 7;
    });
    set({ archivedTasks: toKeep });
  },

  saveSchedule: async (date, schedule) => {
    await supabaseService.saveDaySchedule(date, schedule.blocks);
    set(s => ({
      schedules: { ...s.schedules, [date]: schedule }
    }));
  },

  updateBlockStatus: async (date, blockId, status) => {
    const schedule = get().schedules[date];
    if (!schedule) return;
    const updatedBlocks = schedule.blocks.map(b => b.id === blockId ? { ...b, status } : b);
    await supabaseService.saveDaySchedule(date, updatedBlocks);
    set(s => ({
      schedules: {
        ...s.schedules,
        [date]: { ...schedule, blocks: updatedBlocks }
      }
    }));
  },

  updateBlock: async (date, blockId, updates) => {
    const schedule = get().schedules[date];
    if (!schedule) return;
    const updatedBlocks = schedule.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
    await supabaseService.saveDaySchedule(date, updatedBlocks);
    set(s => ({
      schedules: {
        ...s.schedules,
        [date]: { ...schedule, blocks: updatedBlocks }
      }
    }));
  },

  reorderBlocks: async (date, blocks) => {
    await supabaseService.saveDaySchedule(date, blocks);
    set(s => ({
      schedules: { ...s.schedules, [date]: { ...s.schedules[date], blocks } }
    }));
  },

  addBlockToSchedule: async (date, block) => {
    const schedule = get().schedules[date] || { date, blocks: [] };
    const updatedBlocks = [...schedule.blocks, block];
    await supabaseService.saveDaySchedule(date, updatedBlocks);
    set(s => ({
      schedules: { ...s.schedules, [date]: { ...schedule, blocks: updatedBlocks } }
    }));
  },

  initializeDayFromTemplate: async (date, templateId) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return;
    const blocks: TimeBlock[] = template.blocks.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      status: 'pending' as const,
    }));
    await supabaseService.saveDaySchedule(date, blocks);
    set(s => ({
      schedules: { ...s.schedules, [date]: { date, blocks, adherenceScore: 0 } }
    }));
  },

  rolloverIncompleteTasks: async () => {
    const state = get();
    const today = format(new Date(), 'yyyy-MM-dd');
    if (state.lastRolloverDate === today) return;

    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const yesterdaySchedule = await supabaseService.getDaySchedule(yesterday);

    if (yesterdaySchedule && yesterdaySchedule.day_blocks) {
      // Map DB blocks to frontend blocks
      const normalizedBlocks = yesterdaySchedule.day_blocks.map((db: any) => ({
        id: db.id,
        title: db.title,
        startTime: db.start_time,
        endTime: db.end_time,
        type: db.type,
        status: db.status,
        taskId: db.task_id
      }));

      const incompleteTasks = normalizedBlocks.filter((b: any) =>
        b.taskId &&
        b.type === 'flexible' &&
        b.status !== 'completed' &&
        b.status !== 'skipped'
      );

      for (const block of incompleteTasks) {
        const task = state.tasks.find(t => t.id === block.taskId);
        if (!task) continue;
        
        const todaySchedule = state.schedules[today];
        const alreadyInToday = todaySchedule?.blocks.some(b => b.taskId === task.id);
        
        if (!alreadyInToday) {
          await get().addBlockToSchedule(today, {
            id: crypto.randomUUID(),
            title: `↩ ${block.title}`,
            startTime: '17:00',
            endTime: '18:00',
            type: 'flexible',
            status: 'pending',
            taskId: task.id,
          });
        }
      }
    }

    set({ lastRolloverDate: today });
  },
}));
