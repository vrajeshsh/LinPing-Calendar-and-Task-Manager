'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/useScheduleStore';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, startOfYear, endOfYear, isSameDay
} from 'date-fns';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { getHoliday } from '@/lib/holidays';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarDays, Grid2X2 } from 'lucide-react';

type CalView = 'month' | 'year';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalView>('month');
  const [mounted, setMounted] = useState(false);
  const { schedules, selectedDate, setSelectedDate, initializeDayFromTemplate, templates } = useScheduleStore();

  useEffect(() => setMounted(true), []);

  const handleDateClick = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);

    // Only auto-create schedule if it's TODAY
    const today = new Date();
    const isTodayDate = isSameDay(date, today);
    
    if (isTodayDate) {
      const state = useScheduleStore.getState();
      if (!state.schedules[dateStr] && state.templates.length > 0) {
        try {
          await initializeDayFromTemplate(dateStr, state.templates[0].id);
        } catch (err) {
          console.error('Failed to initialize day:', err);
        }
      }
    }

    // Navigate to the Scheduler view
    router.push('/app/scheduler');
  };

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

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full ring-1 ring-[var(--calendar-today-ring)]" /> Today</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-lg" style={{ backgroundColor: 'var(--calendar-selected-bg)' }} /> Selected</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--holiday-accent)' }} /> Holiday</span>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-6xl mx-auto w-full pb-16 overflow-auto">
        {view === 'month' ? (
          <MonthView daysInMonth={daysInMonth} monthStart={monthStart} schedules={schedules} onDateClick={handleDateClick} selectedDate={selectedDate} />
        ) : (
          <YearView daysInYear={daysInYear} schedules={schedules} year={currentDate.getFullYear()} onDateClick={handleDateClick} selectedDate={selectedDate} />
        )}
      </div>
    </div>
  );
}

function MonthView({ daysInMonth, monthStart, schedules, onDateClick, selectedDate }: {
  daysInMonth: Date[];
  monthStart: Date;
  schedules: Record<string, any>;
  onDateClick: (date: Date) => Promise<void>;
  selectedDate: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 py-2">
            {d}
          </div>
        ))}
        {/* Pad start */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`pad-${i}`} className="h-20 md:h-28 rounded-2xl bg-transparent" />
        ))}
        {daysInMonth.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const schedule = schedules[dateStr];
          const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
          const holiday = getHoliday(dateStr);
          const isSelected = dateStr === selectedDate;
          const isTodayDate = isToday(date);

          return (
            <button
              onClick={() => onDateClick(date)}
              key={dateStr}
              className={cn(
                "h-20 md:h-28 rounded-2xl p-2 flex flex-col transition-all duration-200 cursor-pointer",
                // Selected state (most important - warm beige fill)
                isSelected && !holiday && "bg-[var(--calendar-selected-bg)] ring-2 ring-[var(--calendar-selected-ring)] shadow-sm",
                // Selected + holiday (keep selected bg, add holiday dot)
                isSelected && holiday && "bg-[var(--calendar-selected-bg)] ring-2 ring-[var(--calendar-selected-ring)] shadow-sm",
                // Today only (subtle warm outline, no fill)
                !isSelected && isTodayDate && "ring-2 ring-[var(--calendar-today-ring)] bg-[var(--calendar-today-bg)]",
                // Normal days
                !isSelected && !isTodayDate && "bg-card/30 hover:bg-card/60 border border-transparent hover:border-border/40"
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn(
                  "text-[13px] font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                  isSelected && "text-[var(--calendar-selected-text)]",
                  isTodayDate && !isSelected && "ring-1 ring-[var(--calendar-today-ring)] text-foreground",
                  !isSelected && !isTodayDate && "text-foreground"
                )}>{format(date, 'd')}</span>
                {/* Holiday dot - muted terracotta */}
                {holiday && (
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: 'var(--holiday-accent)' }} title={holiday} />
                )}
              </div>
              {/* Holiday label */}
              {holiday && !isSelected && (
                <span className="text-[9px] font-semibold leading-tight mt-0.5 truncate hidden md:block" style={{ color: 'var(--holiday-label)' }}>{holiday}</span>
              )}
              {/* Adherence score - subtle badge at bottom */}
              <div className="mt-auto">
                {score !== null && !isSelected && (
                  <div 
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit"
                    style={{
                      backgroundColor: score >= 80 ? 'var(--calendar-high)' : score >= 50 ? 'var(--calendar-medium)' : 'var(--calendar-low)'
                    }}
                  >{score}%</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ daysInYear, schedules, year, onDateClick, selectedDate }: {
  daysInYear: Date[];
  schedules: Record<string, any>;
  year: number;
  onDateClick: (date: Date) => Promise<void>;
  selectedDate: string;
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Object.entries(months).map(([monthIdx, days]) => {
        const firstDay = days[0];
        const startDow = firstDay.getDay();
        return (
          <div key={monthIdx} className="bg-card/30 border border-border/20 rounded-2xl p-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{MONTH_NAMES[Number(monthIdx)]}</h3>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['S','M','T','W','T','F','S'].map((d,i) => (
                <div key={i} className="text-center text-[7px] font-bold text-muted-foreground/50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: startDow }).map((_, i) => <div key={`p${i}`} />)}
              {days.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const schedule = schedules[dateStr];
                const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
                const holiday = getHoliday(dateStr);
                const isSelected = dateStr === selectedDate;
                const isTodayDate = isToday(date);

                return (
                  <button
                    onClick={() => onDateClick(date)}
                    key={dateStr}
                    title={holiday ? `${format(date, 'MMM d')} — ${holiday}` : format(date, 'MMM d')}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center relative transition-all hover:bg-muted/40 active:scale-95 cursor-pointer",
                      // Selected state (most important)
                      isSelected && "bg-[var(--calendar-selected-bg)] ring-1 ring-[var(--calendar-selected-ring)]",
                      // Today only
                      !isSelected && isTodayDate && "ring-1 ring-[var(--calendar-today-ring)]",
                      // Normal days - no fill by default
                      !isSelected && !isTodayDate && "bg-transparent"
                    )}
                  >
                    <span className={cn(
                      "text-[7px] font-semibold",
                      isSelected && "text-[var(--calendar-selected-text)]",
                      isTodayDate && !isSelected && "text-foreground",
                      !isSelected && !isTodayDate && "text-foreground/70"
                    )}>{format(date, 'd')}</span>
                    {/* Holiday dot */}
                    {holiday && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--holiday-accent)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
