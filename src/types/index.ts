export type BlockType = 'fixed' | 'flexible';
export type BlockStatus = 'completed' | 'skipped' | 'delayed' | 'partial' | 'pending';
export type PriorityLevel = 'critical' | 'important' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  duration: number; // in minutes
  priority: PriorityLevel;
  notes?: string;
  recurring?: boolean;
  is_archived?: boolean;
  deleted_at?: string | null;
}

export interface ArchivedTask extends Task {
  deletedAt: string; // ISO timestamp
  completedOn?: string; // YYYY-MM-DD if it was completed vs deleted
}

export interface TimeBlock {
  id: string;
  title: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  type: BlockType;
  status: BlockStatus;
  taskId?: string;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  blocks: TimeBlock[];
  adherenceScore?: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  blocks: TimeBlock[];
}

export interface User {
  id: string;
  name: string;
  preferences: {
    startOfDay: string;
    endOfDay: string;
  };
}
