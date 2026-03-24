import { TimeBlock } from '@/types';
import { parse, isBefore, isAfter } from 'date-fns';
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

/** Convert "HH:mm" 24h → "h:mm AM/PM" */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export function parseTime(time: string): Date {
  return parse(time, 'HH:mm', new Date());
}

export function parseTimeInTimezone(time: string, timezone: string): Date {
  const utcDate = parse(time, 'HH:mm', new Date());
  return fromZonedTime(utcDate, timezone);
}

export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function formatTimeInTimezone(date: Date, timezone: string, formatStr: string = 'HH:mm'): string {
  return format(toZonedTime(date, timezone), formatStr, { timeZone: timezone });
}

/** Get subtle background color for block types */
export function getBlockColor(block: TimeBlock, isActive: boolean = false): string {
  if (isActive) return 'var(--block-active)';

  const title = block.title.toLowerCase();

  // Sleep blocks
  if (title.includes('sleep')) return 'var(--block-sleep)';

  // Work/Office blocks
  if (title.includes('work') || title.includes('office') || title.includes('meeting')) return 'var(--block-work)';

  // Workout/Gym blocks
  if (title.includes('workout') || title.includes('gym') || title.includes('exercise') || title.includes('run')) return 'var(--block-workout)';

  // Meal blocks
  if (title.includes('lunch') || title.includes('dinner') || title.includes('breakfast') || title.includes('meal')) return 'var(--block-meal)';

  // Personal time blocks
  if (title.includes('personal') || title.includes('free') || title.includes('break')) return 'var(--block-personal)';

  // Default to flexible
  return 'var(--block-flexible)';
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} M`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} H`;
  }
  return `${hours} H ${mins} M`;
}

export function isOverlap(block1: TimeBlock, block2: TimeBlock): boolean {
  const b1Start = parseTime(block1.startTime);
  let b1End = parseTime(block1.endTime);
  if (isBefore(b1End, b1Start)) b1End = new Date(b1End.getTime() + 24 * 60 * 60 * 1000);

  const b2Start = parseTime(block2.startTime);
  let b2End = parseTime(block2.endTime);
  if (isBefore(b2End, b2Start)) b2End = new Date(b2End.getTime() + 24 * 60 * 60 * 1000);

  // Return true if ranges overlap
  return isBefore(b1Start, b2End) && isAfter(b1End, b2Start);
}

export function calculateAdherenceScore(blocks: TimeBlock[]): number {
  if (blocks.length === 0) return 0;
  
  let score = 0;
  blocks.forEach(block => {
    if (block.status === 'completed') score += 1;
    if (block.status === 'partial') score += 0.5;
    if (block.status === 'delayed') score += 0.8;
  });
  
  return Math.round((score / blocks.length) * 100);
}
