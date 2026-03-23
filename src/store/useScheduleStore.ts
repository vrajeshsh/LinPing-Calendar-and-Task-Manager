import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DaySchedule, TimeBlock, Task, ArchivedTask, ScheduleTemplate } from '@/types';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';

interface ScheduleState {
  tasks: Task[];
  archivedTasks: ArchivedTask[];
  templates: ScheduleTemplate[];
  schedules: Record<string, DaySchedule>;
  lastRolloverDate: string; // YYYY-MM-DD

  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  purgeOldArchived: () => void;

  saveSchedule: (date: string, schedule: DaySchedule) => void;
  updateBlockStatus: (date: string, blockId: string, status: TimeBlock['status']) => void;
  updateBlock: (date: string, blockId: string, updates: Partial<TimeBlock>) => void;
  reorderBlocks: (date: string, blocks: TimeBlock[]) => void;
  addBlockToSchedule: (date: string, block: TimeBlock) => void;

  initializeDayFromTemplate: (date: string, templateId: string) => void;

  /** Roll incomplete tasks from yesterday into today's inbox */
  rolloverIncompleteTasks: () => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      tasks: [],
      archivedTasks: [],
      templates: [],
      schedules: {},
      lastRolloverDate: '',

      addTask: (task) => set(s => ({ tasks: [...s.tasks, task] })),

      updateTask: (id, updates) => set(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
      })),

      deleteTask: (id) => set(s => {
        const task = s.tasks.find(t => t.id === id);
        if (!task) return s;
        const archived: ArchivedTask = { ...task, deletedAt: new Date().toISOString() };
        return {
          tasks: s.tasks.filter(t => t.id !== id),
          archivedTasks: [archived, ...s.archivedTasks],
        };
      }),

      restoreTask: (id) => set(s => {
        const archived = s.archivedTasks.find(t => t.id === id);
        if (!archived) return s;
        const { deletedAt, completedOn, ...task } = archived;
        return {
          tasks: [...s.tasks, task],
          archivedTasks: s.archivedTasks.filter(t => t.id !== id),
        };
      }),

      purgeOldArchived: () => set(s => ({
        archivedTasks: s.archivedTasks.filter(t => {
          const daysOld = differenceInDays(new Date(), parseISO(t.deletedAt));
          return daysOld < 7;
        })
      })),

      saveSchedule: (date, schedule) => set(s => ({
        schedules: { ...s.schedules, [date]: schedule }
      })),

      updateBlockStatus: (date, blockId, status) => set(s => {
        const schedule = s.schedules[date];
        if (!schedule) return s;
        return {
          schedules: {
            ...s.schedules,
            [date]: {
              ...schedule,
              blocks: schedule.blocks.map(b => b.id === blockId ? { ...b, status } : b)
            }
          }
        };
      }),

      updateBlock: (date, blockId, updates) => set(s => {
        const schedule = s.schedules[date];
        if (!schedule) return s;
        return {
          schedules: {
            ...s.schedules,
            [date]: {
              ...schedule,
              blocks: schedule.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
            }
          }
        };
      }),

      reorderBlocks: (date, blocks) => set(s => {
        const schedule = s.schedules[date];
        if (!schedule) return s;
        return { schedules: { ...s.schedules, [date]: { ...schedule, blocks } } };
      }),

      addBlockToSchedule: (date, block) => set(s => {
        const schedule = s.schedules[date];
        if (!schedule) {
          return { schedules: { ...s.schedules, [date]: { date, blocks: [block] } } };
        }
        return {
          schedules: { ...s.schedules, [date]: { ...schedule, blocks: [...schedule.blocks, block] } }
        };
      }),

      initializeDayFromTemplate: (date, templateId) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) return;
        const blocks: TimeBlock[] = template.blocks.map(b => ({
          ...b,
          id: crypto.randomUUID(),
          status: 'pending' as const,
        }));
        set(s => ({
          schedules: { ...s.schedules, [date]: { date, blocks, adherenceScore: 0 } }
        }));
      },

      rolloverIncompleteTasks: () => {
        const state = get();
        const today = format(new Date(), 'yyyy-MM-dd');

        // Only run once per day
        if (state.lastRolloverDate === today) return;

        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        const yesterdaySchedule = state.schedules[yesterday];

        if (yesterdaySchedule) {
          // Find incomplete flexible blocks linked to tasks
          const incompleteTasks = yesterdaySchedule.blocks.filter(b =>
            b.taskId &&
            b.type === 'flexible' &&
            b.status !== 'completed' &&
            b.status !== 'skipped'
          );

          incompleteTasks.forEach(block => {
            const task = state.tasks.find(t => t.id === block.taskId);
            if (!task) return;
            // Only add to today if not already there
            const alreadyInToday = state.schedules[today]?.blocks.some(
              b => b.taskId === task.id
            );
            if (!alreadyInToday) {
              get().addBlockToSchedule(today, {
                id: crypto.randomUUID(),
                title: `↩ ${block.title}`,
                startTime: '17:00',
                endTime: '18:00',
                type: 'flexible',
                status: 'pending',
                taskId: task.id,
              });
            }
          });
        }

        set({ lastRolloverDate: today });
      },
    }),
    { name: 'linping-schedule-storage-v2' }
  )
);
