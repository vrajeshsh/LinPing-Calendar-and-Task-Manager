import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DaySchedule, TimeBlock, Task, ScheduleTemplate } from '@/types';

interface ScheduleState {
  tasks: Task[];
  templates: ScheduleTemplate[];
  schedules: Record<string, DaySchedule>; // Keyed by YYYY-MM-DD
  
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  saveSchedule: (date: string, schedule: DaySchedule) => void;
  updateBlockStatus: (date: string, blockId: string, status: TimeBlock['status']) => void;
  
  // Base initialization for a day
  initializeDayFromTemplate: (date: string, templateId: string) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      tasks: [],
      templates: [],
      schedules: {},
      
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
      })),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id)
      })),
      
      saveSchedule: (date, schedule) => set((state) => ({
        schedules: { ...state.schedules, [date]: schedule }
      })),
      updateBlockStatus: (date, blockId, status) => set((state) => {
        const schedule = state.schedules[date];
        if (!schedule) return state;
        
        return {
          schedules: {
            ...state.schedules,
            [date]: {
              ...schedule,
              blocks: schedule.blocks.map(b => b.id === blockId ? { ...b, status } : b)
            }
          }
        };
      }),
      
      initializeDayFromTemplate: (date, templateId) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) return;
        
        // Deep copy blocks so we don't mutate template directly
        const blocks: TimeBlock[] = template.blocks.map(b => ({
          ...b,
          id: crypto.randomUUID(), // Generate new unique ID for the day's instance
          status: 'pending' // Default status
        }));
        
        set((state) => ({
          schedules: {
            ...state.schedules,
            [date]: {
              date,
              blocks,
              adherenceScore: 0
            }
          }
        }));
      }
    }),
    {
      name: 'linping-schedule-storage',
    }
  )
);
