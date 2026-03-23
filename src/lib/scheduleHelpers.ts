import { TimeBlock } from '@/types';
import { parse, isBefore, isAfter } from 'date-fns';

export function parseTime(time: string): Date {
  return parse(time, 'HH:mm', new Date());
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
