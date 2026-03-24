'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { DaySchedule, TimeBlock } from '@/types';
import { TimelineBlock } from './TimelineBlock';
import { parseTime, formatTime12h, formatMinutes, getCurrentTimeInTimezone, parseTimeInTimezone } from '@/lib/scheduleHelpers';
import { differenceInMinutes } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

const FIXED_TITLES = ['sleep', 'office', 'gym'];
function isFixed(b: TimeBlock) {
  return b.type === 'fixed' || FIXED_TITLES.some(t => b.title.toLowerCase().includes(t));
}

export function Timeline({ schedule }: { schedule: DaySchedule }) {
  const [now, setNow] = useState(new Date());
  const reorderBlocks = useScheduleStore(s => s.reorderBlocks);
  const user = useScheduleStore(s => s.user);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  // Build items with free-time gap labels
  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'block' | 'free'; block?: TimeBlock; start?: string; end?: string; mins?: number }> = [];
    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      items.push({ type: 'block', block });
      const next = sortedBlocks[i + 1];
      if (next && block.title.toLowerCase() !== 'sleep') {
        const gap = differenceInMinutes(parseTime(next.startTime), parseTime(block.endTime));
        if (gap > 0 && gap < 90) {
          items.push({ type: 'free', start: block.endTime, end: next.startTime, mins: gap });
        }
      }
    }
    return items;
  }, [sortedBlocks]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, idx: number, blockId: string) => {
    dragIndexRef.current = idx;
    setDraggingId(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const dragIdx = dragIndexRef.current;
    if (dragIdx === null || dragIdx === dropIdx) return;

    const dragged = sortedBlocks[dragIdx];
    const target = sortedBlocks[dropIdx];

    // Prevent dragging/dropping onto fixed blocks
    if (isFixed(dragged) || isFixed(target)) return;

    const newBlocks = [...sortedBlocks];
    newBlocks.splice(dragIdx, 1);
    newBlocks.splice(dropIdx, 0, dragged);

    // Reflow times: keep dragged block duration, shift everything to not overlap
    // Simple approach: swap start/end times between the two blocks
    const newBlocksWithTimes = [...newBlocks];
    const origDraggedTime = { startTime: dragged.startTime, endTime: dragged.endTime };
    const origTargetTime = { startTime: target.startTime, endTime: target.endTime };
    const draggedInNew = newBlocksWithTimes.find(b => b.id === dragged.id)!;
    const targetInNew = newBlocksWithTimes.find(b => b.id === target.id)!;
    draggedInNew.startTime = origTargetTime.startTime;
    draggedInNew.endTime = origTargetTime.endTime;
    targetInNew.startTime = origDraggedTime.startTime;
    targetInNew.endTime = origDraggedTime.endTime;

    reorderBlocks(schedule.date, newBlocksWithTimes);
    dragIndexRef.current = null;
    setDraggingId(null);
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

      {/* Subtle time markers */}
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
          const isActive = now >= start && now < end;
          const isPast = now >= end;
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
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
