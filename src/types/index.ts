export type BlockType = 'fixed' | 'flexible';
export type BlockStatus = 'completed' | 'skipped' | 'delayed' | 'partial' | 'pending';
export type PriorityLevel = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  duration: number; // in minutes
  priority: PriorityLevel;
  notes?: string;
  recurring?: boolean;
}

export interface TimeBlock {
  id: string;
  title: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  type: BlockType;
  status: BlockStatus;
  taskId?: string; // Optional link to a specific task
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  blocks: TimeBlock[];
  adherenceScore?: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  blocks: TimeBlock[]; // Base blocks for the template
}

export interface User {
  id: string;
  name: string;
  preferences: {
    startOfDay: string; // HH:mm
    endOfDay: string; // HH:mm
  };
}
