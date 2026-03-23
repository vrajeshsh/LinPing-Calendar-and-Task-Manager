'use client';

import { useState, useEffect, useMemo } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, startOfYear, endOfYear
} from 'date-fns';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { getHoliday } from '@/lib/holidays';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarDays, Grid2X2 } from 'lucide-react';

type CalView = 'month' | 'year';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalView>('month');
  const [mounted, setMounted] = useState(false);
  const schedules = useScheduleStore(state => state.schedules);

  useEffect(() => setMounted(true), []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);
  const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd });

  const prevPeriod = () =>
    view === 'month'
      ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
      : setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));

  const nextPeriod = () =>
    view === 'month'
      ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
      : setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));

  const goToday = () => setCurrentDate(new Date());

  if (!mounted) return <div className="p-8 text-muted-foreground font-medium">Loading calendar...</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1 text-[15px] font-medium">
              {view === 'month' ? format(currentDate, 'MMMM yyyy') : String(currentDate.getFullYear())}
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
              <button
                onClick={() => setView('month')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                  view === 'month' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Month
              </button>
              <button
                onClick={() => setView('year')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                  view === 'year' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid2X2 className="w-3.5 h-3.5" /> Year
              </button>
            </div>

            {/* Navigation */}
            <button onClick={prevPeriod} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-[13px] font-semibold rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              Today
            </button>
            <button onClick={nextPeriod} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Holiday legend */}
        <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Federal Holiday</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" /> High adherence</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500/70 inline-block" /> On track</span>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-6xl mx-auto w-full pb-16 overflow-auto">
        {view === 'month' ? (
          <MonthView daysInMonth={daysInMonth} monthStart={monthStart} schedules={schedules} />
        ) : (
          <YearView daysInYear={daysInYear} schedules={schedules} year={currentDate.getFullYear()} />
        )}
      </div>
    </div>
  );
}

function MonthView({ daysInMonth, monthStart, schedules }: {
  daysInMonth: Date[];
  monthStart: Date;
  schedules: Record<string, any>;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-2">
            {d}
          </div>
        ))}
        {/* Pad start */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`pad-${i}`} className="h-20 md:h-28 rounded-2xl bg-muted/10" />
        ))}
        {daysInMonth.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const schedule = schedules[dateStr];
          const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
          const holiday = getHoliday(dateStr);
          return (
            <div
              key={dateStr}
              className={cn(
                "h-20 md:h-28 rounded-2xl border p-2 flex flex-col transition-all duration-200 cursor-default",
                isToday(date)
                  ? "ring-2 ring-primary border-transparent bg-primary/5"
                  : "bg-card/50 border-border/20 hover:border-border/50 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn(
                  "text-[13px] font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                  isToday(date) ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>{format(date, 'd')}</span>
                {holiday && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1" title={holiday} />
                )}
              </div>
              {holiday && (
                <span className="text-[9px] font-bold text-rose-400 leading-tight mt-0.5 truncate hidden md:block">{holiday}</span>
              )}
              <div className="mt-auto">
                {score !== null && (
                  <div className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded-md w-fit",
                    score >= 80 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                    score >= 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                    "bg-destructive/15 text-destructive"
                  )}>{score}%</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ daysInYear, schedules, year }: {
  daysInYear: Date[];
  schedules: Record<string, any>;
  year: number;
}) {
  // Group days by month
  const months = useMemo(() => {
    const grouped: Record<number, Date[]> = {};
    daysInYear.forEach(d => {
      const m = d.getMonth();
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(d);
    });
    return grouped;
  }, [daysInYear]);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Object.entries(months).map(([monthIdx, days]) => {
        const firstDay = days[0];
        const startDow = firstDay.getDay();
        return (
          <div key={monthIdx} className="bg-card/50 border border-border/20 rounded-2xl p-4">
            <h3 className="text-[13px] font-bold text-foreground mb-3">{MONTH_NAMES[Number(monthIdx)]}</h3>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['S','M','T','W','T','F','S'].map((d,i) => (
                <div key={i} className="text-center text-[8px] font-bold text-muted-foreground/60">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: startDow }).map((_, i) => <div key={`p${i}`} />)}
              {days.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const schedule = schedules[dateStr];
                const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
                const holiday = getHoliday(dateStr);
                return (
                  <div
                    key={dateStr}
                    title={holiday ? `${format(date, 'MMM d')} — ${holiday}` : format(date, 'MMM d')}
                    className={cn(
                      "aspect-square rounded-sm flex items-center justify-center relative",
                      isToday(date) ? "ring-1 ring-primary rounded-full" : "",
                      holiday ? "bg-rose-400/20" :
                      score === null ? "bg-muted/20" :
                      score >= 80 ? "bg-emerald-500/70" :
                      score >= 50 ? "bg-amber-500/60" :
                      "bg-destructive/50"
                    )}
                  >
                    <span className={cn(
                      "text-[7px] font-bold",
                      isToday(date) ? "text-primary" : "text-foreground/60"
                    )}>{format(date, 'd')}</span>
                    {holiday && (
                      <span className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-rose-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
