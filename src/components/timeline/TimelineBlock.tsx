'use client';

import { useState } from 'react';
import { TimeBlock } from '@/types';
import { cn } from '@/lib/utils';
import { parseTime, formatTime12h, formatMinutes, getBlockColor } from '@/lib/scheduleHelpers';
import { CheckCircle2, XCircle, Timer, Clock, Play, Pencil, X, Check } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { RescheduleExplanation } from './RescheduleExplanation';

// ─── Proportional Height Configuration ──────────────────────────────────────
const MIN_BLOCK_HEIGHT = 60;   // Minimum height for very short blocks (15-30 min)
const BASE_DURATION = 30;       // Base duration for scaling (30 min)
const BASE_HEIGHT = 60;         // Height for 30 min block
const MAX_BLOCK_HEIGHT = 200;   // Maximum height cap for very long blocks
const HEIGHT_SCALE_FACTOR = 1.6; // Scale factor for duration → height conversion

/**
 * Calculate proportional height based on duration
 * Uses a softened scaling curve for very long blocks
 */
function calculateBlockHeight(durationMinutes: number): number {
  // Softened scaling: use square root for larger durations
  const baseHeight = (durationMinutes / BASE_DURATION) * BASE_HEIGHT;
  
  // Apply softened scaling for blocks longer than 60 min
  if (durationMinutes > 60) {
    // Gradually reduce scale factor as duration increases
    const softFactor = 1 + (HEIGHT_SCALE_FACTOR - 1) * Math.pow(60 / durationMinutes, 0.3);
    const softHeight = baseHeight * softFactor;
    return Math.min(Math.max(softHeight, MIN_BLOCK_HEIGHT), MAX_BLOCK_HEIGHT);
  }
  
  return Math.max(baseHeight, MIN_BLOCK_HEIGHT);
}

interface Props {
  block: TimeBlock;
  isActive: boolean;
  isPast: boolean;
  now: Date;
  date: string;
  isTodaySchedule?: boolean;
}

// ─── Inline Block Edit Modal ────────────────────────────────────────────────
function BlockEditModal({ block, date, onClose }: { block: TimeBlock; date: string; onClose: () => void }) {
  const updateBlock = useScheduleStore(s => s.updateBlock);
  const [title, setTitle] = useState(block.title);
  const [start, setStart] = useState(block.startTime);
  const [end, setEnd] = useState(block.endTime);

  const handleSave = () => {
    updateBlock(date, block.id, { title, startTime: start, endTime: end });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Edit Block</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Block title"
            className="w-full px-4 py-3 bg-muted/30 rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 text-[15px] font-medium"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Start</label>
              <input
                type="time"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted/30 rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 text-[14px] font-medium tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">End</label>
              <input
                type="time"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted/30 rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 text-[14px] font-medium tabular-nums"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="w-full h-11 mt-1 bg-foreground text-background rounded-xl font-semibold text-[14px] hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TimelineBlock ──────────────────────────────────────────────────────────
export function TimelineBlock({ block, isActive, isPast, now, date, isTodaySchedule = true }: Props) {
  const updateBlockStatus = useScheduleStore(s => s.updateBlockStatus);
  const saveSchedule = useScheduleStore(s => s.saveSchedule);
  const schedules = useScheduleStore(s => s.schedules);
  const [editOpen, setEditOpen] = useState(false);

  const start = parseTime(block.startTime);
  let end = parseTime(block.endTime);
  if (end < start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    if (now.getHours() < 12 && start.getHours() >= 12) {
      start.setTime(start.getTime() - 24 * 60 * 60 * 1000);
      end.setTime(end.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  const rawDuration = differenceInMinutes(end, start);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 30;
  const elapsedRaw = isActive ? differenceInMinutes(now, start) : (isPast ? duration : 0);
  const elapsed = Number.isFinite(elapsedRaw) && elapsedRaw >= 0 ? Math.min(elapsedRaw, duration) : 0;
  const progress = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;

  const handleStatus = (status: TimeBlock['status']) => updateBlockStatus(date, block.id, status);

  const handleDelay = (minutes: number) => {
    const schedule = schedules[date];
    if (!schedule) return;
    const addMs = minutes * 60 * 1000;
    const updated = schedule.blocks.map(b => {
      const bStart = parseTime(b.startTime);
      if (b.id === block.id || bStart >= start) {
        const ns = new Date(parseTime(b.startTime).getTime() + addMs);
        const ne = new Date(parseTime(b.endTime).getTime() + addMs);
        const fmt = (d: Date) => d.toTimeString().slice(0, 5);
        return { ...b, status: 'delayed' as const, startTime: fmt(ns), endTime: fmt(ne) };
      }
      return b;
    });
    saveSchedule(date, { ...schedule, blocks: updated });
  };

  const isCompleted = block.status === 'completed';
  const isSkipped = block.status === 'skipped';
  const isDelayed = block.status === 'delayed';

  const durLabel = duration >= 60
    ? `${Math.floor(duration / 60)} H${duration % 60 > 0 ? ` ${duration % 60} M` : ''}`
    : `${duration} M`;

  // Calculate proportional height based on duration
  const blockHeight = calculateBlockHeight(duration);

  return (
    <>
      <div className={cn(
        "relative z-10 flex gap-3 md:gap-5 group transition-all duration-500",
        isActive ? "opacity-100" : (isPast ? "opacity-45 hover:opacity-75" : "opacity-90 hover:opacity-100")
      )}>
        {/* Time column */}
        <div className="w-14 md:w-20 shrink-0 text-right flex flex-col items-end" style={{ paddingTop: `${Math.min(blockHeight * 0.15, 16)}px` }}>
          <span className={cn(
            "text-[13px] font-semibold tracking-tight tabular-nums leading-tight",
            isActive ? "text-primary" : "text-foreground"
          )}>{formatTime12h(block.startTime)}</span>
          <span className="text-[10px] text-muted-foreground font-medium mt-0.5 tabular-nums">{formatTime12h(block.endTime)}</span>
          {isActive && <div className="mt-1.5 text-[8px] font-black tracking-widest uppercase text-primary animate-pulse">NOW</div>}
        </div>

        {/* Node dot - positioned based on block height */}
        <div className="hidden md:flex flex-col items-center shrink-0" style={{ paddingTop: `${Math.min(blockHeight * 0.15, 16)}px` }}>
          <div className={cn(
            "w-3 h-3 rounded-full border-[2px] z-10 bg-background transition-all duration-300",
            isActive ? "border-primary ring-4 ring-primary/20 scale-125 shadow-sm"
              : isCompleted ? "border-primary bg-primary"
              : isPast ? "border-muted-foreground/20 bg-muted/40"
              : "border-muted-foreground/50"
          )} />
        </div>

        {/* Card - with proportional height */}
        <div className={cn(
          "flex-1 rounded-[20px] border transition-all duration-300 overflow-hidden",
          isActive ? "bg-card border-primary/30 shadow-xl shadow-primary/5 ring-1 ring-primary/10"
            : isPast ? "bg-muted/15 border-transparent"
            : "bg-card/60 border-border/25 hover:border-border/50 hover:bg-card/80 hover:shadow-md"
        )} 
          style={{ 
            backgroundColor: isActive ? 'var(--block-active)' : getBlockColor(block),
            minHeight: `${blockHeight}px`
          }}
        >
          <div className="p-4 md:p-5 flex flex-col justify-between" style={{ minHeight: `${blockHeight - 2}px` }}>
            {/* Top section */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn(
                    "font-semibold text-[16px] tracking-tight truncate",
                    isCompleted ? "text-muted-foreground/50 line-through" : "text-foreground",
                    isSkipped && "text-muted-foreground/35 line-through"
                  )}>{block.title}</h3>
                  {isDelayed && (
                    <span className="text-[9px] font-black tracking-widest uppercase text-amber-500 px-1.5 py-0.5 bg-amber-500/10 rounded-md">Delayed</span>
                  )}
                  {block.title.startsWith('↩') && (
                    <span className="text-[9px] font-black tracking-widest uppercase text-sky-500 px-1.5 py-0.5 bg-sky-500/10 rounded-md">Rolled Over</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />{durLabel}
                </p>
                
                {/* Reschedule explanation - shows when task was moved by AI */}
                {(block.rescheduleReason || block.rescheduledFrom) && (
                  <RescheduleExplanation
                    reason={block.rescheduleReason || 'This task was adjusted by the scheduler'}
                    originalTime={block.rescheduledFrom}
                    newTime={block.startTime}
                    originalDate={block.originalDate}
                  />
                )}
              </div>

              {/* Actions */}
              <div className={cn(
                "flex items-center gap-1 shrink-0 transition-opacity",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                {/* Edit */}
                <button
                  onClick={() => setEditOpen(true)}
                  title="Edit block"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-110 active:scale-95"
                >
                  <Pencil className="w-[15px] h-[15px]" />
                </button>
                {/* Complete */}
                <button
                  onClick={() => handleStatus(isCompleted ? 'pending' : 'completed')}
                  title={isCompleted ? "Mark incomplete" : "Mark complete"}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-110 active:scale-95",
                    isCompleted ? "bg-primary/10 text-primary" : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500"
                  )}
                >
                  <CheckCircle2 className="w-[17px] h-[17px]" />
                </button>
                {/* Skip */}
                {!isCompleted && (
                  <button
                    onClick={() => handleStatus('skipped')}
                    title="Skip block"
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all hover:scale-110 active:scale-95"
                  >
                    <XCircle className="w-[17px] h-[17px]" />
                  </button>
                )}
              </div>
            </div>
            {/* End of top section */}

            {/* Progress (active block) */}
            {isActive && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-bg)' }}>
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: 'var(--progress-fill)' }} />
                </div>
                <span className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">
                  {formatMinutes(Math.floor(elapsed))} done · {formatMinutes(Math.floor(duration - elapsed))} left
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Timer className="w-3 h-3" />Delay:
                  </span>
                  {[5, 15, 30, 60].map(m => (
                    <button key={m} onClick={() => handleDelay(m)} title={`Delay ${m}M`}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all active:scale-95"
                    >{m < 60 ? `+${m}M` : '+1H'}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Start block hint */}
            {!isPast && !isActive && !isCompleted && (
              <div className="hidden group-hover:flex">
                <button title="Start this block" onClick={() => handleStatus('pending')}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/70 transition-colors"
                >
                  <Play className="w-3 h-3 fill-primary" />Start Block
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && <BlockEditModal block={block} date={date} onClose={() => setEditOpen(false)} />}
    </>
  );
}
