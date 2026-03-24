import { create } from 'zustand';
import { DaySchedule, TimeBlock, Task, ArchivedTask, ScheduleTemplate, User } from '@/types';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { supabaseService } from '@/services/supabaseService';
import { getCurrentLocation, requestLocationPermission, getTimezoneFromLocation, UserLocation, LocationPermissionStatus } from '@/services/locationService';

interface ScheduleState {
  tasks: Task[];
  archivedTasks: ArchivedTask[];
  templates: ScheduleTemplate[];
  schedules: Record<string, DaySchedule>;
  lastRolloverDate: string;
  loading: boolean;
  user: { id: string; timezone: string } | null;
  selectedDate: string; // YYYY-MM-DD format
  needsOnboarding: boolean; // True if user has no schedule template

  // Location-based settings
  currentLocation: UserLocation | null;
  locationPermission: LocationPermissionStatus;

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
  setSelectedDate: (date: string) => void;
  completeOnboarding: () => Promise<void>;
  
  // Location actions
  setLocation: (location: UserLocation | null) => void;
  setLocationPermission: (status: LocationPermissionStatus) => void;
  requestLocationAccess: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  tasks: [],
  archivedTasks: [],
  templates: [],
  schedules: {},
  lastRolloverDate: '',
  loading: false,
  user: null,
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  needsOnboarding: true, // Start assuming onboarding is needed until proven otherwise
  
  // Location-based settings - defaults
  currentLocation: null,
  locationPermission: 'prompt',
  
  fetchInitialData: async () => {
    set({ loading: true });
    try {
      const [tasks, archived, rawTemplates, profile] = await Promise.all([
        supabaseService.getTasks(),
        supabaseService.getArchivedTasks(),
        supabaseService.getTemplates(),
        supabaseService.getProfile(),
      ]);
      // Transform archived tasks to match ArchivedTask type
      const transformedArchived: ArchivedTask[] = archived.map(task => ({
        ...task,
        deletedAt: task.deleted_at || new Date().toISOString(), // Fallback for tasks without deleted_at
      }));
      
      // Transform templates from Supabase format to internal format
      // Supabase returns template_blocks with start_time/end_time, we need startTime/endTime and status
      const templates: ScheduleTemplate[] = rawTemplates.map(template => ({
        id: template.id,
        name: template.name,
        blocks: (template.template_blocks || [])
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((block: any) => ({
            id: block.id,
            title: block.title,
            startTime: block.start_time,
            endTime: block.end_time,
            type: block.type as 'fixed' | 'flexible',
            status: 'pending' as const,
          }))
      }));
      
      // CRITICAL: Determine if user needs onboarding based on whether they have templates
      // If templates array is empty, user MUST complete onboarding
      const hasExistingTemplate = templates.length > 0;
      
      set({ 
        tasks, 
        archivedTasks: transformedArchived, 
        templates,
        user: profile ? { id: profile.id, timezone: profile.timezone || 'America/New_York' } : null,
        needsOnboarding: !hasExistingTemplate
      });
    } catch (error) {
      console.error('Error fetching initial data:', error);
      // On error, assume onboarding is needed to be safe
      set({ needsOnboarding: true });
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
      if (!t.deletedAt) return true; // Keep tasks without deletedAt
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
    if (!template || !template.blocks) {
      console.warn(`Template ${templateId} not found or has no blocks`);
      return;
    }
    
    try {
      const blocks: TimeBlock[] = template.blocks.map(b => ({
        ...b,
        id: crypto.randomUUID(),
        status: 'pending' as const,
      }));
      await supabaseService.saveDaySchedule(date, blocks);
      set(s => ({
        schedules: { ...s.schedules, [date]: { date, blocks, adherenceScore: 0 } }
      }));
    } catch (error) {
      console.error(`Error initializing day ${date}:`, error);
      throw error;
    }
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

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  completeOnboarding: async () => {
    // After onboarding is complete, re-fetch data to get the new templates
    // This ensures needsOnboarding is set to false before any navigation
    await get().fetchInitialData();
    
    // Try to get location after onboarding
    try {
      const location = await getCurrentLocation();
      if (location) {
        set({ currentLocation: location, locationPermission: 'granted' });
      }
    } catch (e) {
      console.warn('Could not get location:', e);
    }
  },
  
  // Location actions
  setLocation: async (location: UserLocation | null) => {
    set({ currentLocation: location });
  },
  
  setLocationPermission: (status: LocationPermissionStatus) => {
    set({ locationPermission: status });
  },
  
  requestLocationAccess: async () => {
    const status = await requestLocationPermission();
    set({ locationPermission: status });
    
    if (status === 'granted') {
      const location = await getCurrentLocation();
      set({ currentLocation: location });
    }
  },
}));
