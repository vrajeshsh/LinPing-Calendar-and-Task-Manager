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
  // Rescheduling transparency fields
  rescheduledFrom?: string; // Original start time if moved
  rescheduledTo?: string; // New start time if moved
  rescheduleReason?: string; // Human-readable reason for the change
  originalDate?: string; // Original date if moved to different day
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
  timezone: string;
  preferences: {
    startOfDay: string;
    endOfDay: string;
  };
  // Location-based settings
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  locationPermission?: 'granted' | 'denied' | 'prompt';
}
