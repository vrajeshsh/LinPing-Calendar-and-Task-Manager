'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { DaySchedule, TimeBlock } from '@/types';
import { TimelineBlock } from './TimelineBlock';
import { parseTime, normalizeTimeString, fromMinutes, toMinutes, formatTime12h, formatMinutes, getCurrentTimeInTimezone, parseTimeInTimezone } from '@/lib/scheduleHelpers';
import { differenceInMinutes, format } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn } from '@/lib/utils';
import { GripVertical, Sparkles } from 'lucide-react';
import { getSunTimes, formatTime12h as formatSunTime, getDefaultLocation } from '@/services/locationService';

// ─── Placement Suggestion Types ────────────────────────────────────────────────
interface PlacementTarget {
  index: number;
  type: 'before' | 'after' | 'between' | 'gap' | 'end';
  blockId?: string;
  blockTitle?: string;
  label: string;
  timeRange?: string;
  isBestFit: boolean;
}

export function Timeline({ schedule }: { schedule: DaySchedule }) {
  const [now, setNow] = useState(new Date());
  const reorderBlocks = useScheduleStore(s => s.reorderBlocks);
  const user = useScheduleStore(s => s.user);
  const currentLocation = useScheduleStore(s => s.currentLocation);
  const locationPermission = useScheduleStore(s => s.locationPermission);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<{ index: number; type: 'insert' | 'replace' } | null>(null);
  const [movingBlockId, setMovingBlockId] = useState<string | null>(null);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null);
  const [movePreview, setMovePreview] = useState<{from: number; to: number; blocks: TimeBlock[]} | null>(null);

  // ─── NEW: Placement Suggestion State ─────────────────────────────────────────
  const [placementMode, setPlacementMode] = useState(false);
  const [placementTargets, setPlacementTargets] = useState<PlacementTarget[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<number | null>(null);
  const [bestFitTarget, setBestFitTarget] = useState<number | null>(null);
  const [dragPreviewBlocks, setDragPreviewBlocks] = useState<TimeBlock[] | null>(null);
  const [showHelperPanel, setShowHelperPanel] = useState(true);

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

  const normalizedBlocks = useMemo(() => {
    return schedule.blocks.map(block => {
      const startTime = normalizeTimeString(block.startTime);
      const endTime = normalizeTimeString(block.endTime);
      let duration = toMinutes(endTime) - toMinutes(startTime);
      if (duration <= 0) duration = 30;

      const sanitizedEnd = fromMinutes(toMinutes(startTime) + duration);
      return {
        ...block,
        startTime,
        endTime: sanitizedEnd
      };
    });
  }, [schedule.blocks]);

  // Sort: sleep boundaries separate from actionable blocks
  const sortedBlocks = useMemo(() => {
    return [...normalizedBlocks]
      .filter(b => b.title.toLowerCase() !== 'sleep')
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  }, [normalizedBlocks]);

  const sleepBlock = useMemo(() => {
    return normalizedBlocks.find(b => b.title.toLowerCase() === 'sleep');
  }, [normalizedBlocks]);

  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'block' | 'free' | 'sleep-boundary'; block?: TimeBlock; start?: string; end?: string; mins?: number; message?: string }> = [];

    const wakeUpTime = sleepBlock ? sleepBlock.endTime : '06:00';
    const sleepStartTime = sleepBlock ? sleepBlock.startTime : '23:00';

    if (sleepBlock) {
      const sleepStartMinutes = toMinutes(sleepBlock.startTime);
      // if sleep starts early morning, show wake up marker at top
      if (sleepStartMinutes < 10 * 60) {
        items.push({ type: 'sleep-boundary', start: wakeUpTime, message: `WAKE UP ${formatTime12h(wakeUpTime)}` });
      }
    }

    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      items.push({ type: 'block', block });
      const next = sortedBlocks[i + 1];
      if (next) {
        const gap = toMinutes(next.startTime) - toMinutes(block.endTime);
        if (gap > 0 && gap < 90) {
          items.push({ type: 'free', start: block.endTime, end: next.startTime, mins: gap });
        }
      }
    }

    if (sleepBlock) {
      const hasWakeUp = items.some(item => item.type === 'sleep-boundary' && item.message?.startsWith('WAKE UP'));
      if (!hasWakeUp) {
        items.push({ type: 'sleep-boundary', start: sleepStartTime, message: `SLEEP ${formatTime12h(sleepStartTime)}` });
      } else {
        if (toMinutes(sleepStartTime) > 0) {
          items.push({ type: 'sleep-boundary', start: sleepStartTime, message: `SLEEP ${formatTime12h(sleepStartTime)}` });
        }
      }
    }

    return items;
  }, [sortedBlocks, sleepBlock]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, idx: number, blockId: string) => {
    dragIndexRef.current = idx;
    setDraggingId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image offset for better feel
    const target = e.target as HTMLElement;
    e.dataTransfer.setDragImage(target, 0, 20);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number, type: 'insert' | 'replace' = 'insert') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
    setDropPreview({ index: targetIndex, type });
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
    setDropPreview(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, dropType: 'insert' | 'replace' = 'insert') => {
    e.preventDefault();
    const dragIdx = dragIndexRef.current;
    if (dragIdx === null) return;

    const draggedBlock = sortedBlocks[dragIdx];
    if (!draggedBlock) return;

    // Create new blocks array without the dragged block
    const newBlocks = sortedBlocks.filter((_, idx) => idx !== dragIdx);

    let finalBlocks: TimeBlock[];

    if (dropType === 'insert') {
      // Insert the block at the specified position and shift subsequent blocks
      newBlocks.splice(dropIndex, 0, draggedBlock);
      finalBlocks = shiftBlocksAfterInsertion(newBlocks, dropIndex);
    } else {
      // Replace: swap positions
      if (dropIndex < newBlocks.length) {
        newBlocks.splice(dropIndex, 0, draggedBlock);
        finalBlocks = shiftBlocksAfterInsertion(newBlocks, dropIndex);
      } else {
        finalBlocks = [...newBlocks, draggedBlock];
      }
    }

    // Add sleep block back if it exists
    if (sleepBlock) {
      finalBlocks.push(sleepBlock);
    }

    reorderBlocks(schedule.date, finalBlocks);
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
    setDropPreview(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
    setDropPreview(null);
    // Exit placement mode
    setPlacementMode(false);
    setPlacementTargets([]);
    setHoveredTarget(null);
    setBestFitTarget(null);
    setDragPreviewBlocks(null);
  };

  // ─── NEW: Placement Suggestion Functions ─────────────────────────────────────
  
  // Generate all possible placement targets when drag starts
  const generatePlacementTargets = useCallback((draggedBlock: TimeBlock, blocks: TimeBlock[]): PlacementTarget[] => {
    const targets: PlacementTarget[] = [];
    const draggedDuration = differenceInMinutes(
      parseTime(draggedBlock.endTime),
      parseTime(draggedBlock.startTime)
    ) || 30;

    // Generate targets for each position
    blocks.forEach((block, idx) => {
      // Skip if this is the block being dragged
      if (block.id === draggedBlock.id) return;

      // "Before" target
      targets.push({
        index: idx,
        type: 'before',
        blockId: block.id,
        blockTitle: block.title,
        label: `Before ${block.title}`,
        timeRange: `${formatTime12h(block.startTime)} - ${formatTime12h(block.endTime)}`,
        isBestFit: false
      });

      // "After" target
      targets.push({
        index: idx + 1,
        type: 'after',
        blockId: block.id,
        blockTitle: block.title,
        label: `After ${block.title}`,
        timeRange: `${formatTime12h(block.endTime)}`,
        isBestFit: false
      });
    });

    // Check for gaps between blocks
    blocks.forEach((block, idx) => {
      if (block.id === draggedBlock.id) return;
      const nextBlock = blocks[idx + 1];
      if (nextBlock && nextBlock.id !== draggedBlock.id) {
        const gapStart = toMinutes(block.endTime);
        const gapEnd = toMinutes(nextBlock.startTime);
        const gapSize = gapEnd - gapStart;
        
        if (gapSize >= draggedDuration && gapSize < 180) {
          // There's a suitable gap
          const existingIdx = targets.findIndex(t => t.type === 'gap' && t.index === idx + 1);
          if (existingIdx === -1) {
            targets.push({
              index: idx + 1,
              type: 'gap',
              blockId: block.id,
              blockTitle: `${block.title} → ${nextBlock.title}`,
              label: `In gap (${formatMinutes(gapSize)} free)`,
              timeRange: `${formatTime12h(block.endTime)} - ${formatTime12h(nextBlock.startTime)}`,
              isBestFit: false
            });
          }
        }
      }
    });

    // End of day target
    targets.push({
      index: blocks.length,
      type: 'end',
      label: 'End of day',
      timeRange: `After ${formatTime12h(blocks[blocks.length - 1]?.endTime || '23:00')}`,
      isBestFit: false
    });

    return targets;
  }, []);

  // Calculate best fit based on time of day, gap availability, and schedule flow
  const calculateBestFit = useCallback((draggedBlock: TimeBlock, blocks: TimeBlock[], targets: PlacementTarget[]): number => {
    if (targets.length === 0) return -1;

    const draggedDuration = differenceInMinutes(
      parseTime(draggedBlock.endTime),
      parseTime(draggedBlock.startTime)
    ) || 30;

    // Score each target (higher is better)
    const scoredTargets = targets.map((target, idx) => {
      let score = 0;

      // Factor 1: Time of day appropriateness
      const targetTime = target.timeRange ? toMinutes(target.timeRange.split(' - ')[0]) : (target.index * 60 + 360);
      const hour = Math.floor(targetTime / 60);
      
      // Morning (6-12): Good for important tasks
      if (hour >= 6 && hour < 12) score += 20;
      // Afternoon (12-17): Good for routine tasks  
      else if (hour >= 12 && hour < 17) score += 15;
      // Evening (17-21): Good for personal/flexible tasks
      else if (hour >= 17 && hour < 21) score += 10;
      // Night: less ideal
      else score -= 5;

      // Factor 2: Gap availability (for gap targets, prefer if duration fits well)
      if (target.type === 'gap' && target.timeRange) {
        const [gapStart, gapEnd] = target.timeRange.split(' - ').map(t => toMinutes(t));
        const gapSize = gapEnd - gapStart;
        const fitRatio = draggedDuration / gapSize;
        // Prefer gaps where block fills 50-80% of the gap
        if (fitRatio >= 0.5 && fitRatio <= 0.8) score += 25;
        else if (fitRatio > 0.8 && fitRatio <= 1.0) score += 15;
        else if (fitRatio < 0.5) score += 5;
      }

      // Factor 3: End of day gets penalty for most blocks
      if (target.type === 'end') score -= 10;

      // Factor 4: After important blocks (first few) gets bonus
      if (target.type === 'after' && target.index <= 2) score += 10;

      return { idx, score };
    });

    // Return index of best scoring target
    const best = scoredTargets.reduce((best, current) => 
      current.score > best.score ? current : best,
      { idx: -1, score: -Infinity }
    );

    return best.idx;
  }, []);

  // Enhanced drag start with placement mode
  const handleDragStartWithPlacement = (e: React.DragEvent, idx: number, blockId: string) => {
    dragIndexRef.current = idx;
    setDraggingId(blockId);
    setPlacementMode(true);
    
    // Generate placement targets
    const draggedBlock = sortedBlocks[idx];
    if (draggedBlock) {
      const targets = generatePlacementTargets(draggedBlock, sortedBlocks);
      const bestFit = calculateBestFit(draggedBlock, sortedBlocks, targets);
      
      // Mark best fit
      if (bestFit >= 0) {
        targets[bestFit].isBestFit = true;
      }
      
      setPlacementTargets(targets);
      setBestFitTarget(bestFit >= 0 ? bestFit : null);
    }
    
    e.dataTransfer.effectAllowed = 'move';
    const target = e.target as HTMLElement;
    e.dataTransfer.setDragImage(target, 0, 20);
  };

  const getWakeTime = (): string => sleepBlock?.endTime ?? '06:00';
  const getSleepTime = (): string => sleepBlock?.startTime ?? '23:00';

  const recalcSchedule = (blocks: TimeBlock[]): TimeBlock[] => {
    let currentTime = getWakeTime();
    const sleepCutoff = toMinutes(getSleepTime());

    const adjusted = blocks.map(block => {
      const startTime = normalizeTimeString(block.startTime);
      const endTime = normalizeTimeString(block.endTime);
      let duration = toMinutes(endTime) - toMinutes(startTime);
      if (duration <= 0 || !Number.isFinite(duration)) duration = 30;

      const recalculatedStart = currentTime;
      const recalculatedEnd = fromMinutes(toMinutes(recalculatedStart) + duration);

      currentTime = recalculatedEnd;

      return {
        ...block,
        startTime: recalculatedStart,
        endTime: recalculatedEnd
      };
    });

    // Prevent anything from extending into sleep
    if (sleepBlock) {
      return adjusted.map(block => {
        const blockEndMin = toMinutes(block.endTime);
        if (blockEndMin > sleepCutoff) {
          const blockStartMin = toMinutes(block.startTime);
          const cappedStart = Math.min(blockStartMin, sleepCutoff);
          const cappedEnd = Math.min(blockEndMin, sleepCutoff);
          return {
            ...block,
            startTime: fromMinutes(cappedStart),
            endTime: fromMinutes(cappedEnd)
          };
        }
        return block;
      });
    }

    return adjusted;
  };

  // Preview placement at a specific target
  const previewPlacementAtTarget = (targetIndex: number, draggedBlock: TimeBlock): TimeBlock[] => {
    const blocksWithoutDragged = sortedBlocks.filter(b => b.id !== draggedBlock.id);
    const sourceIdx = sortedBlocks.findIndex(b => b.id === draggedBlock.id);
    const adjustedTarget = sourceIdx < targetIndex ? targetIndex - 1 : targetIndex;
    const finalTarget = Math.max(0, Math.min(blocksWithoutDragged.length, adjustedTarget));
    
    const previewBlocks = [...blocksWithoutDragged];
    previewBlocks.splice(finalTarget, 0, draggedBlock);
    
    return recalcSchedule(previewBlocks);
  };

  const executeMove = (targetIndex: number) => {
    if (!movingBlockId) return;
    const sourceIndex = sortedBlocks.findIndex(b => b.id === movingBlockId);
    if (sourceIndex === -1) return;

    const movingBlock = sortedBlocks[sourceIndex];
    const blocksWithoutMovement = sortedBlocks.filter(b => b.id !== movingBlockId);

    let adjustedTarget = targetIndex;
    if (sourceIndex < targetIndex) adjustedTarget -= 1;
    adjustedTarget = Math.max(0, Math.min(blocksWithoutMovement.length, adjustedTarget));

    blocksWithoutMovement.splice(adjustedTarget, 0, movingBlock);
    const rebalanced = recalcSchedule(blocksWithoutMovement);
    const finalBlocks = sleepBlock ? [...rebalanced, sleepBlock] : rebalanced;

    reorderBlocks(schedule.date, finalBlocks);
    setMovingBlockId(null);
    setSelectedTargetIndex(null);
    setMovePreview(null);
  };

  const checkMoveTarget = (targetIndex: number) => {
    if (!movingBlockId) return;
    const sourceIndex = sortedBlocks.findIndex(b => b.id === movingBlockId);
    if (sourceIndex === -1) return;

    setSelectedTargetIndex(targetIndex);
    const previewBlocks = sortedBlocks.filter(b => b.id !== movingBlockId);
    const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    previewBlocks.splice(Math.max(0, Math.min(previewBlocks.length, adjustedTarget)), 0, sortedBlocks[sourceIndex]);
    setMovePreview({ from: sourceIndex, to: targetIndex, blocks: recalcSchedule(previewBlocks) });
  };

  // Smart shifting: when inserting a block, place it at the insertion point and shift subsequent blocks
  const shiftBlocksAfterInsertion = (blocks: TimeBlock[], insertIndex: number): TimeBlock[] => {
    if (insertIndex >= blocks.length - 1) return blocks; // Inserting at end, no shift needed

    const insertedBlock = blocks[insertIndex];
    const duration = differenceInMinutes(parseTime(insertedBlock.endTime), parseTime(insertedBlock.startTime));

    // For insertion, determine the correct start time based on position
    let newStartTime: string;
    if (insertIndex === 0) {
      // Inserting at the beginning - start at 6am or after sleep
      newStartTime = sleepBlock && sleepBlock.endTime < '12:00' ? sleepBlock.endTime : '06:00';
    } else {
      // Inserting after another block - start right after the previous block
      const prevBlock = blocks[insertIndex - 1];
      newStartTime = prevBlock.endTime;
    }

    // Update the inserted block's times
    const updatedInsertedBlock = {
      ...insertedBlock,
      startTime: newStartTime,
      endTime: addMinutesToTime(newStartTime, duration)
    };

    // Replace the inserted block with updated times
    const blocksWithUpdatedInsert = [...blocks];
    blocksWithUpdatedInsert[insertIndex] = updatedInsertedBlock;

    // Shift all blocks after the insertion point by the duration
    return blocksWithUpdatedInsert.map((block, idx) => {
      if (idx <= insertIndex) return block; // Don't shift the inserted block or earlier ones

      const blockStart = parseTime(block.startTime);
      const blockEnd = parseTime(block.endTime);
      const newStart = new Date(blockStart.getTime() + duration * 60 * 1000);
      const newEnd = new Date(blockEnd.getTime() + duration * 60 * 1000);

      return {
        ...block,
        startTime: formatTime(newStart),
        endTime: formatTime(newEnd)
      };
    });
  };

  // Helper to format time for blocks
  const formatTime = (date: Date): string => {
    return date.toTimeString().slice(0, 5);
  };

  // Add minutes to time string
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
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

      <div className="flex flex-col gap-6 md:gap-8 relative">
        {/* ─── NEW: Placement Mode Visual Indicators ─────────────────────────────── */}
        {placementMode && placementTargets.length > 0 && (
          <>
            {/* Helper Panel with Placement Options */}
            {showHelperPanel && draggingId && (
              <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
                <div className="bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl p-4 w-56">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-semibold text-foreground">Placement Suggestions</span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {placementTargets.filter(t => t.index <= sortedBlocks.length).map((target, idx) => (
                      <button
                        key={`target-${idx}`}
                        onClick={() => {
                          const draggedBlock = sortedBlocks[dragIndexRef.current!];
                          if (draggedBlock) {
                            const preview = previewPlacementAtTarget(target.index, draggedBlock);
                            setDragPreviewBlocks(preview);
                          }
                          setHoveredTarget(idx);
                        }}
                        onMouseEnter={() => {
                          const draggedBlock = sortedBlocks[dragIndexRef.current!];
                          if (draggedBlock) {
                            const preview = previewPlacementAtTarget(target.index, draggedBlock);
                            setDragPreviewBlocks(preview);
                          }
                          setHoveredTarget(idx);
                        }}
                        onMouseLeave={() => {
                          setHoveredTarget(null);
                          setDragPreviewBlocks(null);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all",
                          "border",
                          hoveredTarget === idx 
                            ? "bg-primary/10 border-primary/40 text-primary" 
                            : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border/30",
                          target.isBestFit && "ring-1 ring-amber-400/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("truncate", target.isBestFit && "text-amber-600 dark:text-amber-400")}>
                            {target.label}
                          </span>
                          {target.isBestFit && (
                            <span className="text-[9px] bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                              BEST FIT
                            </span>
                          )}
                        </div>
                        {target.timeRange && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {target.timeRange}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Hover Preview */}
                  {hoveredTarget !== null && dragPreviewBlocks && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="text-[10px] font-semibold text-muted-foreground mb-2">
                        Preview:
                      </div>
                      <div className="space-y-1">
                        {dragPreviewBlocks.slice(0, 4).map((block, i) => (
                          <div key={block.id} className="text-[10px] flex items-center gap-2">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              block.id === draggingId ? "bg-primary" : "bg-muted-foreground/40"
                            )} />
                            <span className="truncate text-muted-foreground">
                              {block.id === draggingId ? `${block.title}` : block.title}
                            </span>
                            <span className="ml-auto text-muted-foreground/60">
                              {formatTime12h(block.startTime)}
                            </span>
                          </div>
                        ))}
                        {dragPreviewBlocks.length > 4 && (
                          <div className="text-[9px] text-muted-foreground/60 pl-5">
                            +{dragPreviewBlocks.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile: Floating bottom sheet for placement options */}
            {showHelperPanel && draggingId && (
              <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
                <div className="bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl p-3 max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-semibold text-foreground">Where to place this block?</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {placementTargets.slice(0, 6).map((target, idx) => (
                      <button
                        key={`mobile-target-${idx}`}
                        onClick={() => {
                          const draggedBlock = sortedBlocks[dragIndexRef.current!];
                          if (draggedBlock) {
                            // Execute the drop
                            const newBlocks = sortedBlocks.filter((_, i) => i !== dragIndexRef.current);
                            newBlocks.splice(target.index, 0, draggedBlock);
                            const finalBlocks = shiftBlocksAfterInsertion(newBlocks, target.index);
                            const finalWithSleep = sleepBlock ? [...finalBlocks, sleepBlock] : finalBlocks;
                            reorderBlocks(schedule.date, finalWithSleep);
                            handleDragEnd();
                          }
                        }}
                        className={cn(
                          "flex-shrink-0 px-3 py-2 rounded-lg text-[10px] font-medium transition-all",
                          "border",
                          target.isBestFit 
                            ? "bg-amber-400/10 border-amber-400/40 text-amber-700 dark:text-amber-400" 
                            : "bg-muted/30 border-transparent hover:bg-muted/50",
                          target.type === 'gap' && "bg-emerald-400/10 border-emerald-400/30 text-emerald-700"
                        )}
                      >
                        {target.isBestFit && <Sparkles className="w-3 h-3 inline mr-1" />}
                        {target.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Render Timeline Items ───────────────────────────────────────────── */}
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
          
          // Sleep boundary - lightweight schedule boundary marker
          if (item.type === 'sleep-boundary') {
            const isWakeUp = item.message?.startsWith('WAKE UP');
            return (
              <div key={`sleep-boundary-${idx}`} className="flex items-center pl-0 md:pl-[104px] relative">
                {/* Time column */}
                <div className="w-14 md:w-20 shrink-0 text-right flex flex-col items-end pr-3">
                  <span className="text-[13px] font-semibold text-muted-foreground/40 tabular-nums tracking-tight">
                    {formatTime12h(item.start!)}
                  </span>
                </div>
                {/* Node dot */}
                <div className="hidden md:flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isWakeUp ? "bg-amber-300/40" : "bg-indigo-300/40"
                  )} />
                </div>
                {/* Boundary message */}
                <div className="flex-1 ml-4">
                  <span className={cn(
                    "text-[11px] font-medium tracking-wide uppercase",
                    isWakeUp ? "text-amber-400/60" : "text-indigo-400/60"
                  )}>
                    {isWakeUp ? '☀️' : '🌙'} {item.message}
                  </span>
                </div>
              </div>
            );
          }

          const block = item.block!;
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
          const isActive = isTodaySchedule && now >= start && now < end;
          const isPast = isTodaySchedule && now >= end;

          const isMovingThis = movingBlockId === block.id;

          // Find placement target for this position
          const beforeTargetIdx = placementTargets.findIndex(t => t.index === blockIdx && t.type === 'before');
          const afterTargetIdx = placementTargets.findIndex(t => t.index === blockIdx + 1 && (t.type === 'after' || t.type === 'gap'));
          const isHoveredBefore = hoveredTarget === beforeTargetIdx;
          const isHoveredAfter = hoveredTarget === afterTargetIdx;

          return (
            <div key={block.id} className="relative">
              {/* ─── NEW: Drop Zone Indicators ───────────────────────────────────── */}
              {placementMode && draggingId && draggingId !== block.id && (
                <>
                  {/* Before this block - insertion line */}
                  <div 
                    className={cn(
                      "absolute left-[104px] right-4 h-0.5 -top-3 z-30 transition-all duration-200 cursor-pointer",
                      isHoveredBefore 
                        ? "bg-primary/80 scale-y-150 shadow-sm" 
                        : "bg-primary/0 hover:bg-primary/30 hover:scale-y-100"
                    )}
                    onMouseEnter={() => {
                      const targetIdx = placementTargets.findIndex(t => t.index === blockIdx && t.type === 'before');
                      if (targetIdx >= 0) {
                        const draggedBlock = sortedBlocks[dragIndexRef.current!];
                        if (draggedBlock) {
                          const preview = previewPlacementAtTarget(blockIdx, draggedBlock);
                          setDragPreviewBlocks(preview);
                        }
                        setHoveredTarget(targetIdx);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredTarget(null);
                      setDragPreviewBlocks(null);
                    }}
                    onClick={() => {
                      const draggedBlock = sortedBlocks[dragIndexRef.current!];
                      if (draggedBlock) {
                        const newBlocks = sortedBlocks.filter((_, i) => i !== dragIndexRef.current);
                        newBlocks.splice(blockIdx, 0, draggedBlock);
                        const finalBlocks = shiftBlocksAfterInsertion(newBlocks, blockIdx);
                        const finalWithSleep = sleepBlock ? [...finalBlocks, sleepBlock] : finalBlocks;
                        reorderBlocks(schedule.date, finalWithSleep);
                        handleDragEnd();
                      }
                    }}
                  >
                    {/* Label appears on hover */}
                    {isHoveredBefore && (
                      <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg">
                        {placementTargets[beforeTargetIdx]?.label}
                      </div>
                    )}
                  </div>

                  {/* After this block - insertion line */}
                  <div 
                    className={cn(
                      "absolute left-[104px] right-4 h-0.5 -bottom-3 z-30 transition-all duration-200 cursor-pointer",
                      isHoveredAfter 
                        ? "bg-primary/80 scale-y-150 shadow-sm" 
                        : "bg-primary/0 hover:bg-primary/30 hover:scale-y-100"
                    )}
                    onMouseEnter={() => {
                      const targetIdx = placementTargets.findIndex(t => t.index === blockIdx + 1 && (t.type === 'after' || t.type === 'gap'));
                      if (targetIdx >= 0) {
                        const draggedBlock = sortedBlocks[dragIndexRef.current!];
                        if (draggedBlock) {
                          const preview = previewPlacementAtTarget(blockIdx + 1, draggedBlock);
                          setDragPreviewBlocks(preview);
                        }
                        setHoveredTarget(targetIdx);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredTarget(null);
                      setDragPreviewBlocks(null);
                    }}
                    onClick={() => {
                      const draggedBlock = sortedBlocks[dragIndexRef.current!];
                      if (draggedBlock) {
                        const newBlocks = sortedBlocks.filter((_, i) => i !== dragIndexRef.current);
                        newBlocks.splice(blockIdx + 1, 0, draggedBlock);
                        const finalBlocks = shiftBlocksAfterInsertion(newBlocks, blockIdx + 1);
                        const finalWithSleep = sleepBlock ? [...finalBlocks, sleepBlock] : finalBlocks;
                        reorderBlocks(schedule.date, finalWithSleep);
                        handleDragEnd();
                      }
                    }}
                  >
                    {isHoveredAfter && (
                      <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg">
                        {placementTargets[afterTargetIdx]?.label}
                      </div>
                    )}
                  </div>

                  {/* Best fit indicator */}
                  {bestFitTarget !== null && (
                    (beforeTargetIdx === bestFitTarget || afterTargetIdx === bestFitTarget) && (
                      <div className={cn(
                        "absolute left-[104px] w-2 h-2 rounded-full -translate-x-1/2 z-40 animate-pulse",
                        isHoveredBefore || isHoveredAfter ? "bg-amber-400 scale-150" : "bg-amber-400/60"
                      )} style={{ top: isHoveredBefore ? '-12px' : '100%' }} />
                    )
                  )}
                </>
              )}

              {/* Ghost preview block when hovering a target */}
              {hoveredTarget !== null && dragPreviewBlocks && (
                <div className="absolute left-[104px] right-4 top-0 bottom-0 pointer-events-none z-20">
                  {dragPreviewBlocks.filter(b => b.id === draggingId).map((previewBlock, i) => (
                    <div 
                      key={`ghost-${i}`}
                      className="absolute left-0 right-0 h-14 bg-primary/10 border-2 border-dashed border-primary/40 rounded-xl flex items-center px-4"
                      style={{ 
                        top: `${dragPreviewBlocks.findIndex(b => b.id === draggingId) * 80}px`,
                        animation: 'ghost-pulse 1.5s ease-in-out infinite'
                      }}
                    >
                      <span className="text-[12px] font-semibold text-primary/70">
                        {previewBlock.title} → {formatTime12h(previewBlock.startTime)} - {formatTime12h(previewBlock.endTime)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {movingBlockId && movingBlockId !== block.id && (
                <div
                  className={cn(
                    'p-2 cursor-pointer border border-dashed rounded-lg mb-2 transition-all',
                    selectedTargetIndex === blockIdx ? 'bg-primary/10 border-primary' : 'bg-background/50 hover:bg-primary/5'
                  )}
                  onMouseEnter={() => checkMoveTarget(blockIdx)}
                  onClick={() => executeMove(blockIdx)}
                >
                  <span className="text-[11px] font-semibold text-primary/80">Place here before "{block.title}"</span>
                </div>
              )}

              <div
                draggable={true}
                onClick={() => !draggingId && !placementMode && setMovingBlockId(block.id)}
                onDragStart={(e) => handleDragStartWithPlacement(e, blockIdx, block.id)}
                onDragOver={(e) => {
                  if (!placementMode) {
                    handleDragOver(e, blockIdx, 'replace');
                  }
                }}
                onDrop={(e) => {
                  if (!placementMode) {
                    handleDrop(e, blockIdx, 'replace');
                  }
                }}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group/drag relative transition-all duration-300 ease-out',
                  'cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-md',
                  isMovingThis && 'ring-2 ring-primary/60 shadow-lg',
                  placementMode && draggingId === block.id && 'opacity-30 scale-95 rotate-1 shadow-lg',
                  placementMode && draggingId !== block.id && 'hover:ring-2 hover:ring-primary/30',
                  dragOverIndex === blockIdx && dropPreview?.type === 'replace' && draggingId && !placementMode && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background scale-[1.01]'
                )}
              >
                <div className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/drag:opacity-80 transition-all duration-300 z-20">
                  <div className="p-1.5 rounded-md bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg transform group-hover/drag:scale-110">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground group-hover/drag:text-primary transition-colors duration-200" />
                  </div>
                </div>

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
            </div>
          );
        })}

        {movingBlockId && (
          <div
            className={cn(
              "p-2 cursor-pointer border border-dashed rounded-lg transition-all bg-background/50 hover:bg-primary/5",
              selectedTargetIndex === sortedBlocks.length && "bg-primary/10 border-primary"
            )}
            onMouseEnter={() => checkMoveTarget(sortedBlocks.length)}
            onClick={() => executeMove(sortedBlocks.length)}
          >
            <span className="text-[11px] font-semibold text-primary/80">Place here at end of day</span>
          </div>
        )}

        {/* ─── NEW: End of Day Drop Zone in Placement Mode ─────────────────────── */}
        {placementMode && draggingId && sortedBlocks.length > 0 && (
          <div 
            className={cn(
              "relative mx-[104px] md:mx-[104px] p-3 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer",
              "hover:border-primary/50 hover:bg-primary/5",
              hoveredTarget !== null && placementTargets[hoveredTarget]?.type === 'end' 
                ? "border-primary/80 bg-primary/10 scale-[1.02]" 
                : "border-border/30 bg-background/50"
            )}
            onMouseEnter={() => {
              const targetIdx = placementTargets.findIndex(t => t.type === 'end');
              if (targetIdx >= 0) {
                const draggedBlock = sortedBlocks[dragIndexRef.current!];
                if (draggedBlock) {
                  const preview = previewPlacementAtTarget(sortedBlocks.length, draggedBlock);
                  setDragPreviewBlocks(preview);
                }
                setHoveredTarget(targetIdx);
              }
            }}
            onMouseLeave={() => {
              setHoveredTarget(null);
              setDragPreviewBlocks(null);
            }}
            onClick={() => {
              const draggedBlock = sortedBlocks[dragIndexRef.current!];
              if (draggedBlock) {
                const newBlocks = sortedBlocks.filter((_, i) => i !== dragIndexRef.current);
                newBlocks.push(draggedBlock);
                const finalBlocks = recalcSchedule(newBlocks);
                const finalWithSleep = sleepBlock ? [...finalBlocks, sleepBlock] : finalBlocks;
                reorderBlocks(schedule.date, finalWithSleep);
                handleDragEnd();
              }
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/40" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Drop here to add at end of day
              </span>
              {bestFitTarget !== null && placementTargets[bestFitTarget]?.type === 'end' && (
                <span className="text-[9px] bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded font-semibold">
                  BEST FIT
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Global Styles for Ghost Animation ───────────────────────────────── */}
      <style jsx global>{`
        @keyframes ghost-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
