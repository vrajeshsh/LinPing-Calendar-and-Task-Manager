'use client';

import { useState, useEffect } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const schedules = useScheduleStore(state => state.schedules);

  useEffect(() => {
    setMounted(true);
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  if (!mounted) return <div className="p-8">Loading calendar...</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">
            Track your schedule adherence
          </p>
        </div>
      </header>
      
      <div className="flex-1 px-4 md:px-8 max-w-5xl mx-auto w-full pb-32">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-8 bg-card/60 backdrop-blur border rounded-2xl p-4 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {/* Pad start of month */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 md:h-32 rounded-2xl bg-muted/10 border border-transparent" />
          ))}

          {daysInMonth.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const schedule = schedules[dateStr];
            const score = schedule ? calculateAdherenceScore(schedule.blocks) : null;
            
            return (
              <div 
                key={dateStr} 
                className={cn(
                  "h-24 md:h-32 rounded-2xl border p-2 md:p-3 flex flex-col transition-all duration-300",
                  isToday(date) ? "ring-2 ring-primary border-transparent bg-primary/5" : "bg-card/50 hover:border-border hover:shadow-md shadow-sm",
                  !isSameMonth(date, currentDate) && "opacity-50"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full", 
                    isToday(date) ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"
                  )}>
                    {format(date, 'd')}
                  </span>
                </div>
                
                <div className="mt-auto flex justify-end">
                  {score !== null ? (
                     <div className={cn(
                       "px-2.5 py-1 flex items-center justify-center rounded-lg text-[11px] font-bold tracking-wide",
                       score >= 80 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                       score >= 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                       "bg-destructive/15 text-destructive"
                     )}>
                       {score}%
                     </div>
                  ) : (
                     <div className="w-1.5 h-1.5 rounded-full bg-border/50 mt-auto mr-1 mb-1" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
