'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { DEFAULT_TEMPLATE } from '@/lib/defaultData';
import { Timeline } from '@/components/timeline/Timeline';
import { calculateAdherenceScore, parseTime, formatTime12h } from '@/lib/scheduleHelpers';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { schedules, initializeDayFromTemplate, rolloverIncompleteTasks, purgeOldArchived, loading } = useScheduleStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySchedule = schedules[today];

  useEffect(() => {
    setMounted(true);
    if (!mounted) return;
    
    const checkSchedule = async () => {
      if (!useScheduleStore.getState().schedules[today]) {
        await initializeDayFromTemplate(today, DEFAULT_TEMPLATE.id);
      }
      await rolloverIncompleteTasks();
      await purgeOldArchived();
    };
    
    checkSchedule();
  }, [today, mounted, initializeDayFromTemplate, rolloverIncompleteTasks, purgeOldArchived]);

  const score = todaySchedule ? calculateAdherenceScore(todaySchedule.blocks) : 0;

  const timeDeptMinutes = useMemo(() => {
    if (!todaySchedule) return 0;
    const now = new Date();
    let debt = 0;
    todaySchedule.blocks.forEach(b => {
      if (b.status === 'delayed') {
        const end = parseTime(b.endTime);
        if (end < now) {
          debt += differenceInMinutes(parseTime(b.endTime), parseTime(b.startTime));
        }
      }
    });
    return debt;
  }, [todaySchedule]);

  if (!mounted) return (
    <div className="flex items-center justify-center h-screen text-muted-foreground font-medium text-sm">
      Loading schedule...
    </div>
  );

  const now = new Date();
  const timeStr = formatTime12h(format(now, 'HH:mm'));

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-5 md:px-8 pt-8 pb-4 md:pt-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">
            {format(now, 'EEEE, MMMM do')} · <span className="tabular-nums font-bold text-foreground">{timeStr}</span>
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
              {timeDeptMinutes}m behind schedule
            </p>
            <p className="text-[12px] text-amber-500/70 font-medium">Go to Tasks → AI bar to recover your day</p>
          </div>
        </div>
      )}

      {todaySchedule?.blocks.some(b => b.status === 'skipped' && b.type === 'fixed') && (
        <div className="mx-4 md:mx-8 mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm font-semibold text-destructive">A fixed block was skipped — your day may be off-track</p>
        </div>
      )}

      <div className="flex-1 px-3 md:px-8 relative max-w-4xl w-full mx-auto pb-16">
        {todaySchedule ? (
          <Timeline schedule={todaySchedule} />
        ) : (
          <div className="text-muted-foreground pt-4 pl-4 font-medium">Initializing today&apos;s schedule...</div>
        )}
      </div>
    </div>
  );
}
