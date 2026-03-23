'use client';

import { useEffect, useState, useMemo } from 'react';
import { DaySchedule } from '@/types';
import { TimelineBlock } from './TimelineBlock';
import { parseTime } from '@/lib/scheduleHelpers';

export function Timeline({ schedule }: { schedule: DaySchedule }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update current time every 10 seconds to keep progress smooth
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Sort blocks chronologically
  const sortedBlocks = useMemo(() => {
    return [...schedule.blocks].sort((a, b) => {
      // Very basic sort. Cross-midnight blocks are harder to sort by string,
      // but assuming standard linear schedule for now.
      const aTime = parseTime(a.startTime).getTime();
      const bTime = parseTime(b.startTime).getTime();
      return aTime - bTime;
    });
  }, [schedule.blocks]);

  return (
    <div className="relative pt-6 pb-24 flex flex-col gap-6 md:gap-8">
      {/* Vertical subtle line connecting blocks (desktop/tablet) */}
      <div className="absolute left-[81px] top-10 bottom-10 w-px bg-border/40 z-0 hidden md:block" />
      
      {sortedBlocks.map((block) => {
        const start = parseTime(block.startTime);
        let end = parseTime(block.endTime);
        // Handle midnight crossing
        if (end < start) {
          end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          // If now is also early morning, shift start/end to match 'now' day
          if (now.getHours() < 12 && start.getHours() >= 12) {
            start.setTime(start.getTime() - 24 * 60 * 60 * 1000);
            end.setTime(end.getTime() - 24 * 60 * 60 * 1000);
          }
        }
        
        const isActive = (now >= start) && (now < end);
        const isPast = now >= end;

        return (
          <TimelineBlock 
            key={block.id} 
            block={block} 
            isActive={isActive} 
            isPast={isPast} 
            now={now}
            date={schedule.date}
          />
        );
      })}
    </div>
  );
}
