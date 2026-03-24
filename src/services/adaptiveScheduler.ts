import { DaySchedule, TimeBlock, PriorityLevel } from '@/types';
import { format, parseISO, addDays, isWeekend, differenceInMinutes, parse } from 'date-fns';

// Priority weights for scheduling decisions
const PRIORITY_WEIGHTS = {
  critical: 3,
  important: 2,
  medium: 1,
  low: 0
};

// Time windows for different priorities
const PRIORITY_TIME_WINDOWS = {
  critical: ['morning', 'afternoon', 'evening'], // Can fit anywhere
  important: ['morning', 'afternoon', 'evening'],
  medium: ['afternoon', 'evening', 'night'], // Prefer less critical times
  low: ['evening', 'night', 'weekend'] // Prefer low-pressure times
};

// Default weekend template (lighter schedule without office blocks)
const WEEKEND_DEFAULT_TEMPLATE: TimeBlock[] = [
  { id: 'sleep-wk', title: 'Sleep', startTime: '23:00', endTime: '06:00', type: 'fixed', status: 'pending' },
  { id: 'breakfast-wk', title: 'Breakfast', startTime: '08:00', endTime: '08:30', type: 'fixed', status: 'pending' },
  { id: 'lunch-wk', title: 'Lunch', startTime: '12:00', endTime: '12:30', type: 'fixed', status: 'pending' },
  { id: 'dinner-wk', title: 'Dinner', startTime: '18:00', endTime: '18:30', type: 'fixed', status: 'pending' },
];

export interface RescheduleAction {
  type: 'insert' | 'shift' | 'shorten' | 'defer' | 'move_to_weekend';
  blockId: string;
  blockTitle?: string; // Store the title for better explanations
  fromTime?: string;
  toTime?: string;
  toDate?: string;
  newDuration?: number;
  reason: string;
}

export interface SchedulingResult {
  success: boolean;
  scheduleDate: string;
  scheduleTime: string;
  endTime: string;
  actions: RescheduleAction[];
  explanation: string;
  needsPreview: boolean;
}

// Check if a time slot is available
function isSlotAvailable(blocks: TimeBlock[], startTime: string, endTime: string): boolean {
  const start = parseInt(startTime.replace(':', ''));
  const end = parseInt(endTime.replace(':', ''));
  
  for (const block of blocks) {
    // Skip sleep block - we'll handle it separately
    if (block.title.toLowerCase() === 'sleep') continue;
    
    const blockStart = parseInt(block.startTime.replace(':', ''));
    const blockEnd = parseInt(block.endTime.replace(':', ''));
    
    // Check for overlap
    if (!(end <= blockStart || start >= blockEnd)) {
      return false;
    }
  }
  return true;
}

// Get sleep boundaries from schedule
function getSleepBoundaries(blocks: TimeBlock[]): { sleepStart: string; sleepEnd: string } | null {
  const sleepBlock = blocks.find(b => b.title.toLowerCase() === 'sleep');
  if (!sleepBlock) return null;
  
  return {
    sleepStart: sleepBlock.startTime,
    sleepEnd: sleepBlock.endTime
  };
}

// Check if a time slot is within sleep hours
function isWithinSleepHours(time: string, sleepStart: string, sleepEnd: string): boolean {
  const timeInt = parseInt(time.replace(':', ''));
  const startInt = parseInt(sleepStart.replace(':', ''));
  const endInt = parseInt(sleepEnd.replace(':', ''));
  
  // Handle overnight sleep (e.g., 22:00 to 05:00)
  if (startInt > endInt) {
    // Sleep crosses midnight
    return timeInt >= startInt || timeInt < endInt;
  }
  
  return timeInt >= startInt && timeInt < endInt;
}

// Find the next available slot for a task
function findAvailableSlot(
  blocks: TimeBlock[],
  duration: number,
  priority: PriorityLevel,
  date: string,
  preferredStart?: string
): { startTime: string; endTime: string } | null {
  const isWeekendDay = isWeekend(parseISO(date));
  
  // Get sleep boundaries to avoid scheduling during sleep
  const sleepBoundaries = getSleepBoundaries(blocks);
  
  // Define search range based on priority
  let startHour = priority === 'critical' ? 7 : priority === 'low' ? 14 : 9;
  let endHour = priority === 'critical' ? 21 : priority === 'low' ? 22 : 20;
  
  // Adjust search range based on sleep boundaries
  if (sleepBoundaries) {
    const sleepStartHour = parseInt(sleepBoundaries.sleepStart.split(':')[0]);
    const sleepEndHour = parseInt(sleepBoundaries.sleepEnd.split(':')[0]);
    
    // Don't schedule before wake time
    startHour = Math.max(startHour, sleepEndHour);
    // Don't schedule after bedtime
    endHour = Math.min(endHour, sleepStartHour);
    
    // If sleep boundaries make the range invalid, return null
    if (startHour > endHour) return null;
  }
  
  // If preferred start provided, try that first (if not in sleep hours)
  if (preferredStart) {
    if (sleepBoundaries && isWithinSleepHours(preferredStart, sleepBoundaries.sleepStart, sleepBoundaries.sleepEnd)) {
      // Skip - in sleep hours
    } else {
      const preferredEnd = addMinutesToTime(preferredStart, duration);
      if (isSlotAvailable(blocks, preferredStart, preferredEnd)) {
        return { startTime: preferredStart, endTime: preferredEnd };
      }
    }
  }
  
  // Search for available slot
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Skip if within sleep hours
      if (sleepBoundaries && isWithinSleepHours(startTime, sleepBoundaries.sleepStart, sleepBoundaries.sleepEnd)) {
        continue;
      }
      
      const endTime = addMinutesToTime(startTime, duration);
      
      // Check if end time is still within awake hours
      if (sleepBoundaries && isWithinSleepHours(endTime, sleepBoundaries.sleepStart, sleepBoundaries.sleepEnd)) {
        continue;
      }
      
      const endHourInt = parseInt(endTime.split(':')[0]);
      if (endHourInt > endHour) continue;
      
      if (isSlotAvailable(blocks, startTime, endTime)) {
        return { startTime, endTime };
      }
    }
  }
  
  return null;
}

// Add minutes to time string
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

// Get priority numeric weight
function getPriorityWeight(priority: PriorityLevel): number {
  return PRIORITY_WEIGHTS[priority] || 1;
}

// Calculate how much space a task needs
function calculateTaskSpace(duration: number, priority: PriorityLevel): number {
  const baseSpace = duration;
  const priorityMultiplier = priority === 'critical' ? 1.5 : priority === 'low' ? 0.8 : 1;
  return baseSpace * priorityMultiplier;
}

// Check if day is too packed for a priority
function isDayTooPacked(blocks: TimeBlock[], priority: PriorityLevel): boolean {
  const totalMinutes = blocks.reduce((acc, block) => {
    const start = parseInt(block.startTime.replace(':', ''));
    const end = parseInt(block.endTime.replace(':', ''));
    return acc + (end - start);
  }, 0);
  
  // For low priority tasks, consider day packed if > 60% filled
  // For critical tasks, can fill up to 90%
  const threshold = priority === 'low' ? 600 : priority === 'critical' ? 900 : 750;
  return totalMinutes >= threshold;
}

// Main scheduling function
export async function scheduleWithPriority(
  currentSchedule: DaySchedule,
  taskTitle: string,
  taskDuration: number,
  priority: PriorityLevel,
  requestedDate?: string,
  requestedTime?: string
): Promise<SchedulingResult> {
  const targetDate = requestedDate || currentSchedule.date;
  const isTargetWeekend = isWeekend(parseISO(targetDate));
  const blocks = [...currentSchedule.blocks];
  
  const actions: RescheduleAction[] = [];
  let explanation = '';
  let scheduleTime = '';
  let endTime = '';
  
  // For low priority, first check if we should push to weekend
  if (priority === 'low' && !isTargetWeekend && !requestedDate) {
    // Try to find a slot, but if day is packed, suggest weekend
    const weekendDate = format(addDays(parseISO(targetDate), 2), 'yyyy-MM-dd'); // Next weekend
    
    if (isDayTooPacked(blocks, priority)) {
      actions.push({
        type: 'defer',
        blockId: '',
        toDate: weekendDate,
        reason: 'This looked low priority, so I scheduled it for the weekend'
      });
      explanation = `Added to weekend (${format(parseISO(weekendDate), 'EEEE')}) - your weekday was already full`;
      return {
        success: true,
        scheduleDate: weekendDate,
        scheduleTime: '10:00',
        endTime: addMinutesToTime('10:00', taskDuration),
        actions,
        explanation,
        needsPreview: true
      };
    }
  }
  
  // Find slot for the task
  const slot = findAvailableSlot(blocks, taskDuration, priority, targetDate, requestedTime);
  
  if (slot) {
    // Check if we need to shift other blocks
    const shifts = analyzeRequiredShifts(blocks, slot.startTime, slot.endTime, priority);
    
    if (shifts.length > 0) {
      actions.push(...shifts);
      explanation = generateExplanation(taskTitle, priority, shifts, slot.startTime);
    } else {
      explanation = `Added "${taskTitle}" at ${formatTimeDisplay(slot.startTime)}`;
    }
    
    scheduleTime = slot.startTime;
    endTime = slot.endTime;
  } else {
    // No slot found - need more aggressive rescheduling
    const rescheduleResult = rescheduleForTask(blocks, taskDuration, priority, targetDate);
    
    if (rescheduleResult.success) {
      actions.push(...rescheduleResult.actions);
      scheduleTime = rescheduleResult.newStartTime || '';
      endTime = rescheduleResult.newEndTime || '';
      explanation = rescheduleResult.explanation;
    } else {
      // Can't fit today - suggest next available day
      const nextDate = findNextAvailableDate(targetDate, taskDuration, priority);
      actions.push({
        type: 'defer',
        blockId: '',
        toDate: nextDate,
        reason: 'Could not fit in current day'
      });
      explanation = `Your day was full, so I moved "${taskTitle}" to ${format(parseISO(nextDate), 'EEEE')}`;
      return {
        success: true,
        scheduleDate: nextDate,
        scheduleTime: '09:00',
        endTime: addMinutesToTime('09:00', taskDuration),
        actions,
        explanation,
        needsPreview: true
      };
    }
  }
  
  const needsPreview = actions.some(a => a.type === 'shift' || a.type === 'shorten');
  
  return {
    success: true,
    scheduleDate: targetDate,
    scheduleTime,
    endTime,
    actions,
    explanation,
    needsPreview
  };
}

// Analyze what shifts are needed to fit a task
function analyzeRequiredShifts(
  blocks: TimeBlock[],
  newStart: string,
  newEnd: string,
  priority: PriorityLevel
): RescheduleAction[] {
  const actions: RescheduleAction[] = [];
  const newStartNum = parseInt(newStart.replace(':', ''));
  const newEndNum = parseInt(newEnd.replace(':', ''));
  
  for (const block of blocks) {
    if (block.type === 'fixed') continue; // Fixed blocks can still be shifted if needed
    
    const blockStart = parseInt(block.startTime.replace(':', ''));
    const blockEnd = parseInt(block.endTime.replace(':', ''));
    
    // Check if this block needs to move
    if (blockStart < newEndNum && blockEnd > newStartNum) {
      const blockPriority = getBlockPriority(block);
      
      // Only shift lower priority blocks
      if (blockPriority < getPriorityWeight(priority)) {
        const shiftAmount = newEndNum - blockStart;
        const newBlockStart = addMinutesToTime(block.startTime, shiftAmount);
        const newBlockEnd = addMinutesToTime(block.endTime, shiftAmount);
        
        actions.push({
          type: 'shift',
          blockId: block.id,
          blockTitle: block.title,
          fromTime: block.startTime,
          toTime: newBlockStart,
          reason: `Moved to make room for higher priority task`
        });
      }
    }
  }
  
  return actions;
}

// Get priority of an existing block (infer from title)
function getBlockPriority(block: TimeBlock): number {
  const lower = block.title.toLowerCase();
  if (lower.includes('work') || lower.includes('meeting') || lower.includes('deadline')) {
    return 2;
  }
  return 1;
}

// Reschedule existing tasks to make room
function rescheduleForTask(
  blocks: TimeBlock[],
  duration: number,
  priority: PriorityLevel,
  date: string
): { success: boolean; actions: RescheduleAction[]; newStartTime?: string; newEndTime?: string; explanation: string } {
  // Sort blocks by priority
  const flexibleBlocks = blocks.filter(b => b.type === 'flexible').sort((a, b) => {
    return getBlockPriority(a) - getBlockPriority(b);
  });
  
  // Try to shorten some flexible tasks
  for (const block of flexibleBlocks) {
    if (block.type === 'fixed') continue;
    
    const blockDuration = getBlockDuration(block);
    if (blockDuration > 20) { // Can shorten
      const newDuration = Math.max(15, blockDuration - 15);
      const savedTime = blockDuration - newDuration;
      
      // Now try to fit
      const slot = findAvailableSlot(blocks, duration, priority, date);
      if (slot) {
        return {
          success: true,
          actions: [{
            type: 'shorten',
            blockId: block.id,
            blockTitle: block.title,
            newDuration,
            reason: 'Shortened to make room for new task'
          }],
          newStartTime: slot.startTime,
          newEndTime: slot.endTime,
          explanation: `Shortened "${block.title}" by ${savedTime} minutes to fit new task`
        };
      }
    }
  }
  
  return { success: false, actions: [], explanation: 'Could not find space' };
}

// Get duration in minutes from block
function getBlockDuration(block: TimeBlock): number {
  const [startH, startM] = block.startTime.split(':').map(Number);
  const [endH, endM] = block.endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

// Find next available date
function findNextAvailableDate(currentDate: string, duration: number, priority: PriorityLevel): string {
  const current = parseISO(currentDate);
  
  for (let i = 1; i <= 7; i++) {
    const nextDate = format(addDays(current, i), 'yyyy-MM-dd');
    // Simple check - assume available if weekend and low priority
    if (isWeekend(parseISO(nextDate)) && priority === 'low') {
      return nextDate;
    }
    if (i >= 2) return nextDate; // Within 2 days for medium/critical
  }
  
  return format(addDays(current, 1), 'yyyy-MM-dd');
}

// Generate human-readable explanation
function generateExplanation(taskTitle: string, priority: PriorityLevel, actions: RescheduleAction[], newTaskTime?: string): string {
  if (actions.length === 0) {
    return `Added "${taskTitle}" to your schedule`;
  }
  
  const shiftActions = actions.filter(a => a.type === 'shift');
  const shortenActions = actions.filter(a => a.type === 'shorten');
  const deferActions = actions.filter(a => a.type === 'defer' || a.type === 'move_to_weekend');
  
  // Build a detailed explanation
  const parts: string[] = [];
  
  // Describe shifts
  if (shiftActions.length > 0) {
    const movedTasks = shiftActions
      .filter(a => a.blockTitle)
      .map(a => `"${a.blockTitle}"`)
      .slice(0, 2); // Limit to 2 tasks
    
    if (movedTasks.length > 0) {
      parts.push(`moved ${movedTasks.join(', ')}`);
    } else {
      parts.push('moved some tasks');
    }
  }
  
  // Describe shortenings
  if (shortenActions.length > 0) {
    const shortenedTasks = shortenActions
      .filter(a => a.blockTitle)
      .map(a => `"${a.blockTitle}"`)
      .slice(0, 1);
    
    if (shortenedTasks.length > 0) {
      parts.push(`shortened ${shortenedTasks[0]}`);
    }
  }
  
  // Describe deferrals
  if (deferActions.length > 0) {
    const deferAction = deferActions[0];
    if (deferAction.toDate) {
      parts.push(`scheduled "${taskTitle}" for ${format(parseISO(deferAction.toDate), 'EEEE')}`);
    }
  }
  
  if (parts.length === 0) {
    return `Added "${taskTitle}" and adjusted your schedule`;
  }
  
  // Construct the final explanation
  return `To fit "${taskTitle}", I ${parts.join(', and ')}. Tap any changed task to see why.`;
}

// Format time for display
function formatTimeDisplay(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${mins.toString().padStart(2, '0')} ${period}`;
}

// Get weekend template
export function getWeekendTemplate(): TimeBlock[] {
  return [...WEEKEND_DEFAULT_TEMPLATE];
}

// Check if a date needs weekend template
export function needsWeekendTemplate(date: string): boolean {
  return isWeekend(parseISO(date));
}