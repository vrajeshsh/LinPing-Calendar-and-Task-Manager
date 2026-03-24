'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { DEFAULT_TEMPLATE } from '@/lib/defaultData';
import { Timeline } from '@/components/timeline/Timeline';
import { calculateAdherenceScore, parseTime, formatTime12h, formatMinutes, getCurrentTimeInTimezone, parseTimeInTimezone } from '@/lib/scheduleHelpers';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { schedules, initializeDayFromTemplate, rolloverIncompleteTasks, purgeOldArchived, loading, user, selectedDate, templates } = useScheduleStore();
  const displayDate = selectedDate; // Use selectedDate from store
  const displaySchedule = schedules[displayDate] || {
    date: displayDate,
    blocks: templates.length > 0 ? templates[0].blocks.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      status: 'pending' as const,
    })) : DEFAULT_TEMPLATE.blocks.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      status: 'pending' as const,
    })),
    adherenceScore: 0
  };

  useEffect(() => {
    setMounted(true);
    if (!mounted) return;

    const ensureScheduleExists = async () => {
      const state = useScheduleStore.getState();

      // Always ensure we have a schedule for the selected date
      if (!state.schedules[displayDate]) {
        if (state.templates.length > 0) {
          // Use existing template
          try {
            await initializeDayFromTemplate(displayDate, state.templates[0].id);
          } catch (err) {
            console.error('Failed to initialize schedule:', err);
          }
        } else {
          // No templates yet - this shouldn't happen after onboarding, but handle gracefully
          console.warn('No templates available for date:', displayDate);
        }
      }

      // Only do rollover/purge if we're looking at today
      if (displayDate === format(new Date(), 'yyyy-MM-dd')) {
        try {
          await rolloverIncompleteTasks();
          await purgeOldArchived();
        } catch (err) {
          console.error('Error during rollover/purge:', err);
        }
      }
    };

    ensureScheduleExists();
  }, [displayDate, mounted, initializeDayFromTemplate, rolloverIncompleteTasks, purgeOldArchived]);

  const score = displaySchedule ? calculateAdherenceScore(displaySchedule.blocks) : 0;

  const timeDeptMinutes = useMemo(() => {
    if (!displaySchedule) return 0;
    const now = user?.timezone ? getCurrentTimeInTimezone(user.timezone) : new Date();
    let debt = 0;
    displaySchedule.blocks.forEach(b => {
      if (b.status === 'delayed') {
        const end = user?.timezone ? parseTimeInTimezone(b.endTime, user.timezone) : parseTime(b.endTime);
        if (end < now) {
          const start = user?.timezone ? parseTimeInTimezone(b.startTime, user.timezone) : parseTime(b.startTime);
          debt += differenceInMinutes(end, start);
        }
      }
    });
    return debt;
  }, [displaySchedule, user?.timezone]);

  if (!mounted) return (
    <div className="flex items-center justify-center h-screen text-muted-foreground font-medium text-sm">
      Loading schedule...
    </div>
  );

  const now = user?.timezone ? getCurrentTimeInTimezone(user.timezone) : new Date();
  const timeStr = formatTime12h(format(now, 'HH:mm'));
  const isViewingToday = displayDate === format(new Date(), 'yyyy-MM-dd');
  // Parse date string as local date, not UTC (prevents timezone offset issues)
  const [year, month, day] = displayDate.split('-').map(Number);
  const displayDateObj = new Date(year, month - 1, day);

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-5 md:px-8 pt-8 pb-4 md:pt-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{isViewingToday ? 'Today' : 'Schedule'}</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">
            {format(displayDateObj, 'EEEE, MMMM do')} {isViewingToday && `· ${timeStr}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            "text-3xl font-bold tracking-tighter tabular-nums",
            score >= 80 ? "text-emerald-500" :
            score >= 50 ? "text-amber-500" :
            "text-destructive"
          )}>{score}%</div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Adherence</div>
        </div>
      </header>

      {timeDeptMinutes > 0 && (
        <div className="mx-4 md:mx-8 mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
          <TrendingDown className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {formatMinutes(timeDeptMinutes)} behind schedule
            </p>
            <p className="text-[12px] text-amber-500/70 font-medium">Go to Tasks → AI bar to recover your day</p>
          </div>
        </div>
      )}

      {displaySchedule?.blocks.some(b => b.status === 'skipped' && b.type === 'fixed') && (
        <div className="mx-4 md:mx-8 mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm font-semibold text-destructive">A fixed block was skipped — your day may be off-track</p>
        </div>
      )}

      <div className="flex-1 px-3 md:px-8 relative max-w-4xl w-full mx-auto pb-16">
        {displaySchedule ? (
          <Timeline schedule={displaySchedule} />
        ) : (
          <div className="space-y-4">
            {/* Skeleton loading state */}
            <div className="animate-pulse">
              <div className="h-16 bg-muted/50 rounded-xl mb-4"></div>
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted/30 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
