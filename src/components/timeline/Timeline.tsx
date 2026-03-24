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
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  return (
    <div className="relative pt-4 pb-24 flex flex-col gap-5 md:gap-6">
      {/* Vertical connector line */}
      <div className="absolute left-[76px] top-8 bottom-12 w-px bg-border/20 z-0 hidden md:block" />

      {timelineItems.map((item, idx) => {
        if (item.type === 'free') {
          return (
            <div key={`free-${idx}`} className="flex items-center pl-0 md:pl-[104px]">
              <div className="flex-1 flex items-center gap-2">
                <div className="h-px flex-1 border-t border-dashed border-border/30" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/40 whitespace-nowrap px-2 py-0.5 rounded-full bg-muted/20">
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
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, blockIdx)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group/drag",
              canDrag ? "cursor-grab active:cursor-grabbing" : "",
              draggingId === block.id && "opacity-50"
            )}
          >
            {/* Drag handle hint */}
            {canDrag && (
              <div className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/drag:opacity-40 transition-opacity z-20">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="relative">
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
  );
}
