'use client';

import { useScheduleStore } from '@/store/useScheduleStore';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { useMemo, useState } from 'react';
import { format, subDays, eachDayOfInterval, startOfYear, endOfYear, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarDays, Grid2X2 } from 'lucide-react';

type InsightsView = '30days' | 'year';

export default function InsightsPage() {
  const schedules = useScheduleStore(state => state.schedules);
  const [view, setView] = useState<InsightsView>('30days');

  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      const schedule = schedules[date];
      const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
      return { date, score };
    });
  }, [schedules]);

  const lastYear = useMemo(() => {
    const today = new Date();
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);
    return eachDayOfInterval({ start: yearStart, end: yearEnd }).map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const schedule = schedules[dateStr];
      const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
      return { date: dateStr, score };
    });
  }, [schedules]);

  const getStats = (data: { score: number | null }[]) => {
    const allScores = data.filter(d => d.score !== null).map(d => d.score as number);
    const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    const bestScore = allScores.length ? Math.max(...allScores) : 0;
    const daysTracked = allScores.length;
    const perfectDays = allScores.filter(s => s === 100).length;
    return { avgScore, bestScore, daysTracked, perfectDays };
  };

  const stats30 = getStats(last30Days);
  const statsYear = getStats(lastYear);

  const currentStats = view === '30days' ? stats30 : statsYear;
  const currentData = view === '30days' ? last30Days : lastYear;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Insights</h1>
            <p className="text-muted-foreground mt-1 text-[15px] font-medium">
              {view === '30days' ? 'Your performance over the last 30 days' : `Your performance in ${new Date().getFullYear()}`}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
            <button
              onClick={() => setView('30days')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === '30days' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="w-4 h-4" />
              30 Days
            </button>
            <button
              onClick={() => setView('year')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === 'year' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid2X2 className="w-4 h-4" />
              Year
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto pb-32">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Days Tracked', value: String(currentStats.daysTracked) },
            { label: 'Avg Adherence', value: `${currentStats.avgScore}%` },
            { label: 'Best Day', value: `${currentStats.bestScore}%` },
            { label: 'Perfect Days', value: String(currentStats.perfectDays) },
          ].map(stat => (
            <div key={stat.label} className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
              <div className="text-3xl font-bold tracking-tighter text-foreground">{stat.value}</div>
              <div className="text-[12px] font-semibold tracking-wider uppercase text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">
            {view === '30days' ? '30-Day Adherence Heatmap' : `${new Date().getFullYear()} Yearly Overview`}
          </h2>
          <div className={cn("grid gap-2", view === '30days' ? "grid-cols-10" : "grid-cols-52")}>
            {currentData.map(({ date, score }) => (
              <div
                key={date}
                title={`${date}: ${score !== null ? score + '%' : 'No data'}`}
                className={cn(
                  "aspect-square rounded-lg transition-all",
                  view === '30days' ? "rounded-lg" : "rounded-sm",
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
