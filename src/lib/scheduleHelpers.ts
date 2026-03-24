import { TimeBlock } from '@/types';
import { parse, isBefore, isAfter } from 'date-fns';
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

/** Convert "HH:mm" 24h → "h:mm AM/PM" */
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeString(time: string | undefined | null): boolean {
  if (!time || typeof time !== 'string') return false;
  return TIME_REGEX.test(time.trim());
}

export function normalizeTimeString(time: string | undefined | null): string {
  const normalized = typeof time === 'string' ? time.trim() : '';
  if (!isValidTimeString(normalized)) {
    return '00:00';
  }
  return normalized;
}

export function toMinutes(time: string): number {
  const normalized = normalizeTimeString(time);
  const [hStr, mStr] = normalized.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) minutes = 0;
  const normalized = Math.floor(minutes % (24 * 60));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatTime12h(time: string): string {
  const normalized = normalizeTimeString(time);
  const [hStr, mStr] = normalized.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return '12:00 AM';
  }
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export function parseTime(time: string): Date {
  const normalized = normalizeTimeString(time);
  return parse(normalized, 'HH:mm', new Date());
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
