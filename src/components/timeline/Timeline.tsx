'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { DaySchedule, TimeBlock } from '@/types';
import { TimelineBlock } from './TimelineBlock';
import { parseTime, formatTime12h, formatMinutes, getCurrentTimeInTimezone, parseTimeInTimezone } from '@/lib/scheduleHelpers';
import { differenceInMinutes, format } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn } from '@/lib/utils';
import { GripVertical, Sunrise, Sunset } from 'lucide-react';
import { getSunTimes, formatTime12h as formatSunTime, getDefaultLocation } from '@/services/locationService';

const FIXED_TITLES = ['sleep', 'office', 'gym'];
function isFixed(b: TimeBlock) {
  return b.type === 'fixed' || FIXED_TITLES.some(t => b.title.toLowerCase().includes(t));
}

export function Timeline({ schedule }: { schedule: DaySchedule }) {
  const [now, setNow] = useState(new Date());
  const reorderBlocks = useScheduleStore(s => s.reorderBlocks);
  const user = useScheduleStore(s => s.user);
  const currentLocation = useScheduleStore(s => s.currentLocation);
  const locationPermission = useScheduleStore(s => s.locationPermission);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Check if we're viewing today - only today gets progress tracking
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodaySchedule = schedule.date === todayStr;
  
  // Get sunrise/sunset times based on location
  const location = currentLocation || getDefaultLocation();
  const sunTimes = useMemo(() => {
    return getSunTimes(new Date(), location.latitude, location.longitude);
  }, [location, schedule.date]);
  
  // Show sunrise/sunset only when we have location permission
  const showSunMarkers = locationPermission === 'granted' && isTodaySchedule;

  useEffect(() => {
    const t = setInterval(() => {
      setNow(user?.timezone ? getCurrentTimeInTimezone(user.timezone) : new Date());
    }, 10_000);
    return () => clearInterval(t);
  }, [user?.timezone]);

  // Sort: Sleep always last, rest chronological
  const sortedBlocks = useMemo(() => {
    return [...schedule.blocks].sort((a, b) => {
      if (a.title.toLowerCase() === 'sleep') return 1;
      if (b.title.toLowerCase() === 'sleep') return -1;
      return parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime();
    });
  }, [schedule.blocks]);

  // Build items with free-time gap labels (excluding sleep blocks)
  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'block' | 'free' | 'sleep-message'; block?: TimeBlock; start?: string; end?: string; mins?: number; message?: string }> = [];
    
    // Find sleep block first - we'll show it as a message at start or end
    const sleepBlock = sortedBlocks.find(b => b.title.toLowerCase() === 'sleep');
    const nonSleepBlocks = sortedBlocks.filter(b => b.title.toLowerCase() !== 'sleep');
    
    // Add sleep message at start (if sleep starts before 10am) or end of day
    if (sleepBlock) {
      const sleepStart = parseTime(sleepBlock.startTime);
      const sleepHour = sleepStart.getHours();
      
      // If sleep starts after midnight and before 10am, show wake up message at start
      if (sleepHour >= 0 && sleepHour < 10) {
        items.push({ 
          type: 'sleep-message', 
          start: sleepBlock.startTime,
          message: 'Wake up'
        });
      } else {
        // Show sleep message at end of day
        items.push({ 
          type: 'sleep-message', 
          start: sleepBlock.endTime,
          message: 'Sleep'
        });
      }
    }
    
    for (let i = 0; i < nonSleepBlocks.length; i++) {
      const block = nonSleepBlocks[i];
      items.push({ type: 'block', block });
      const next = nonSleepBlocks[i + 1];
      if (next) {
        const gap = differenceInMinutes(parseTime(next.startTime), parseTime(block.endTime));
        if (gap > 0 && gap < 90) {
          items.push({ type: 'free', start: block.endTime, end: next.startTime, mins: gap });
        }
      }
    }
    
    // Add sleep message at end if not already added (for late night sleep)
    if (sleepBlock) {
      const existingSleepMessage = items.find(i => i.type === 'sleep-message');
      if (!existingSleepMessage) {
        items.push({ 
          type: 'sleep-message', 
          start: sleepBlock.endTime,
          message: 'Sleep'
        });
      }
    }
    
    return items;
  }, [sortedBlocks]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, idx: number, blockId: string) => {
    dragIndexRef.current = idx;
    setDraggingId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image offset for better feel
    const target = e.target as HTMLElement;
    e.dataTransfer.setDragImage(target, 0, 20);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const dragIdx = dragIndexRef.current;
    if (dragIdx === null || dragIdx === dropIdx) return;

    const dragged = sortedBlocks[dragIdx];
    // All blocks are now movable - remove fixed block restriction
    // Smart rebalancing: calculate new times based on drop position
    const newBlocks = [...sortedBlocks];
    newBlocks.splice(dragIdx, 1);
    newBlocks.splice(dropIdx, 0, dragged);

    // Rebalance all blocks to have proper, non-overlapping times
    const newBlocksWithTimes = rebalanceBlocks(newBlocks);

    reorderBlocks(schedule.date, newBlocksWithTimes);
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };

  // Rebalance blocks - ensures no overlaps and maintains sensible spacing
  const rebalanceBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
    if (blocks.length === 0) return [];

    // Filter out sleep for rebalancing purposes
    const nonSleepBlocks = blocks.filter(b => b.title.toLowerCase() !== 'sleep');
    const sleepBlock = blocks.find(b => b.title.toLowerCase() === 'sleep');

    // Sort by start time
    nonSleepBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let currentTime = '06:00'; // Start day at 6am

    const balanced = nonSleepBlocks.map(block => {
      const duration = getBlockDuration(block);
      const startTime = currentTime;
      const endTime = addMinutesToTime(currentTime, duration);

      currentTime = endTime;

      return {
        ...block,
        startTime,
        endTime
      };
    });

    // Add sleep block back at the end
    if (sleepBlock) {
      balanced.push({
        ...sleepBlock,
        startTime: currentTime,
        endTime: '23:00'
      });
    }

    return balanced;
  };

  // Get duration in minutes from block
  const getBlockDuration = (block: TimeBlock): number => {
    const [startH, startM] = block.startTime.split(':').map(Number);
    const [endH, endM] = block.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return endMins - startMins;
  };

  // Add minutes to time string
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, blockId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (blockId) {
      setDragOverId(blockId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  return (
    <div className="relative pt-6 pb-24">
      {/* Refined vertical timeline guide */}
      <div className="absolute left-[76px] top-8 bottom-12 w-px bg-gradient-to-b from-border/40 via-border/20 to-border/40 z-0 hidden md:block" />

      {/* Subtle daylight band - very low opacity tint between sunrise and sunset */}
      {showSunMarkers && (
        <div 
          className="absolute left-[104px] right-4 top-8 bottom-12 pointer-events-none z-0 hidden md:block"
          style={{
            background: 'linear-gradient(to bottom, oklch(0.98 0.003 45 / 0.15) 0%, oklch(0.97 0.002 60 / 0.08) 50%, oklch(0.98 0.003 45 / 0.15) 100%)',
          }}
        />
      )}

      {/* Sunrise marker - subtle dot and time to the left of timeline */}
      {showSunMarkers && (
        <div className="absolute left-[52px] z-5 hidden md:flex items-center" style={{ top: '40px' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300/30" />
          <span className="ml-2 text-[9px] font-medium text-amber-400/40 uppercase tracking-wide">
            {formatSunTime(sunTimes.sunriseTime)}
          </span>
        </div>
      )}

      {/* Sunset marker - subtle dot and time to the left of timeline */}
      {showSunMarkers && (
        <div className="absolute left-[52px] z-5 hidden md:flex items-center" style={{ bottom: '60px' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-orange-300/30" />
          <span className="ml-2 text-[9px] font-medium text-orange-400/40 uppercase tracking-wide">
            {formatSunTime(sunTimes.sunsetTime)}
          </span>
        </div>
      )}

      {/* Subtle time markers - only show for today's schedule */}
      {isTodaySchedule && (
        <div className="absolute left-[76px] top-8 bottom-12 z-0 hidden md:block">
          {sortedBlocks.map((block, idx) => {
            const start = user?.timezone ? parseTimeInTimezone(block.startTime, user.timezone) : parseTime(block.startTime);
            const isActive = now >= start && now < (user?.timezone ? parseTimeInTimezone(block.endTime, user.timezone) : parseTime(block.endTime));
            return (
              <div
                key={`marker-${block.id}`}
                className={cn(
                  "absolute w-2 h-2 rounded-full -translate-x-1/2 transition-all duration-300",
                  isActive ? "bg-primary shadow-sm scale-125" : "bg-border/40"
                )}
                style={{ top: `${(idx * 80) + 20}px` }}
              />
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-6 md:gap-8">
        {timelineItems.map((item, idx) => {
          if (item.type === 'free') {
            return (
              <div key={`free-${idx}`} className="flex items-center pl-0 md:pl-[104px] relative">
                {/* Subtle connector for free time */}
                <div className="hidden md:block absolute left-[76px] w-px h-full bg-border/10 -translate-x-1/2" />
                <div className="flex-1 flex items-center gap-3">
                  <div className="h-px flex-1 border-t border-dashed border-border/30" />
                  <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/50 whitespace-nowrap px-3 py-1 rounded-full bg-muted/30 border border-border/20">
                    {formatMinutes(item.mins!)} free · {formatTime12h(item.start!)} – {formatTime12h(item.end!)}
                  </span>
                  <div className="h-px flex-1 border-t border-dashed border-border/30" />
                </div>
              </div>
            );
          }
          
          // Sleep message - lightweight inline indicator
          if (item.type === 'sleep-message') {
            const isSleep = item.message === 'Sleep';
            return (
              <div key={`sleep-${idx}`} className="flex items-center pl-0 md:pl-[104px] relative">
                {/* Time column */}
                <div className="w-14 md:w-20 shrink-0 text-right flex flex-col items-end pr-3">
                  <span className="text-[13px] font-semibold text-muted-foreground/40 tabular-nums tracking-tight">
                    {formatTime12h(item.start!)}
                  </span>
                </div>
                {/* Node dot */}
                <div className="hidden md:flex flex-col items-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-300/40" />
                </div>
                {/* Message */}
                <div className="flex-1 ml-4">
                  <span className={cn(
                    "text-[11px] font-medium tracking-wide",
                    isSleep ? "text-indigo-400/60" : "text-amber-400/60"
                  )}>
                    {isSleep ? '🌙' : '☀️'} {item.message} at {formatTime12h(item.start!)}
                  </span>
                </div>
              </div>
            );
          }

          const block = item.block!;
          // Find block index in sortedBlocks for drag
          const blockIdx = sortedBlocks.findIndex(b => b.id === block.id);
          const start = user?.timezone ? parseTimeInTimezone(block.startTime, user.timezone) : parseTime(block.startTime);
          let end = user?.timezone ? parseTimeInTimezone(block.endTime, user.timezone) : parseTime(block.endTime);
          if (end < start) {
            end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            if (now.getHours() < 12 && start.getHours() >= 12) {
              start.setTime(start.getTime() - 24 * 60 * 60 * 1000);
              end.setTime(end.getTime() - 24 * 60 * 60 * 1000);
            }
          }
          // Only calculate active/past for TODAY's schedule
          const isActive = isTodaySchedule && now >= start && now < end;
          const isPast = isTodaySchedule && now >= end;
          const canDrag = !isFixed(block);

          return (
            <div
              key={block.id}
              draggable={canDrag}
              onDragStart={canDrag ? (e) => handleDragStart(e, blockIdx, block.id) : undefined}
              onDragOver={(e) => handleDragOver(e, block.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, blockIdx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group/drag relative transition-all duration-300 ease-out",
                canDrag ? "cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-md" : "",
                draggingId === block.id && "opacity-40 scale-95 rotate-1 shadow-lg",
                dragOverId === block.id && draggingId && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background scale-[1.01]"
              )}
            >
              {/* Enhanced drag handle hint */}
              {canDrag && (
                <div className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/drag:opacity-80 transition-all duration-300 z-20">
                  <div className="p-1.5 rounded-md bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg transform group-hover/drag:scale-110">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground group-hover/drag:text-primary transition-colors duration-200" />
                  </div>
                </div>
              )}

              {/* Block container with refined spacing */}
              <div className="relative pl-0 md:pl-[104px]">
                <TimelineBlock
                  block={block}
                  isActive={isActive}
                  isPast={isPast}
                  now={now}
                  date={schedule.date}
                  isTodaySchedule={isTodaySchedule}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
