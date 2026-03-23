'use client';

import { useScheduleStore } from '@/store/useScheduleStore';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function InsightsPage() {
  const schedules = useScheduleStore(state => state.schedules);

  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      const schedule = schedules[date];
      const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
      return { date, score };
    });
  }, [schedules]);

  const allScores = last30Days.filter(d => d.score !== null).map(d => d.score as number);
  const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const bestScore = allScores.length ? Math.max(...allScores) : 0;
  const daysTracked = allScores.length;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Insights</h1>
        <p className="text-muted-foreground mt-1 text-[15px] font-medium">Your performance over the last 30 days</p>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto pb-32">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Days Tracked', value: String(daysTracked) },
            { label: 'Avg Adherence', value: `${avgScore}%` },
            { label: 'Best Day', value: `${bestScore}%` },
          ].map(stat => (
            <div key={stat.label} className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
              <div className="text-3xl font-bold tracking-tighter text-foreground">{stat.value}</div>
              <div className="text-[12px] font-semibold tracking-wider uppercase text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 30-day Heatmap */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">30-Day Adherence Heatmap</h2>
          <div className="grid grid-cols-10 gap-2">
            {last30Days.map(({ date, score }) => (
              <div
                key={date}
                title={`${date}: ${score !== null ? score + '%' : 'No data'}`}
                className={cn(
                  "aspect-square rounded-lg transition-all",
                  score === null ? "bg-muted/30" :
                  score >= 80 ? "bg-emerald-500/80" :
                  score >= 50 ? "bg-amber-500/70" :
                  "bg-destructive/60"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted/30 inline-block" /> No data</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-destructive/60 inline-block" /> &lt;50%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/70 inline-block" /> 50-79%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/80 inline-block" /> 80%+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
