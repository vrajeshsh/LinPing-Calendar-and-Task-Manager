'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, differenceInMinutes, addDays, subDays } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Timeline } from '@/components/timeline/Timeline';
import { calculateAdherenceScore, parseTime, formatTime12h, formatMinutes, getCurrentTimeInTimezone, parseTimeInTimezone } from '@/lib/scheduleHelpers';
import { AlertTriangle, TrendingDown, ChevronLeft, ChevronRight, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { schedules, loading, user, selectedDate, templates, setSelectedDate, needsOnboarding } = useScheduleStore();
  const displayDate = selectedDate; // Use selectedDate from store

  // If no templates exist, redirect to onboarding
  useEffect(() => {
    if (mounted && needsOnboarding) {
      router.push('/onboarding');
    }
  }, [mounted, needsOnboarding, router]);

  const displaySchedule = schedules[displayDate] || null;

  useEffect(() => {
    setMounted(true);
    if (!mounted) return;

    const ensureScheduleExists = async () => {
      const state = useScheduleStore.getState();

      // CRITICAL: If no templates exist, user must complete onboarding first
      // Do NOT silently create or apply any default schedule
      if (state.templates.length === 0) {
        console.log('No templates found - redirecting to onboarding');
        return;
      }

      // Only initialize day if we have templates and no schedule for this date
      if (!state.schedules[displayDate]) {
        try {
          await state.initializeDayFromTemplate(displayDate, state.templates[0].id);
        } catch (err) {
          console.error('Failed to initialize schedule:', err);
        }
      }

      // Only do rollover/purge if we're looking at today
      if (displayDate === format(new Date(), 'yyyy-MM-dd')) {
        try {
          await state.rolloverIncompleteTasks();
          await state.purgeOldArchived();
        } catch (err) {
          console.error('Error during rollover/purge:', err);
        }
      }
    };

    ensureScheduleExists();
  }, [displayDate, mounted, templates, needsOnboarding]);

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

  // Show empty state if no templates exist - force onboarding
  if (templates.length === 0 || needsOnboarding) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/40">
          <header className="px-5 md:px-8 pt-8 pb-6 md:pt-10">
            <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
            <p className="text-muted-foreground text-[15px] font-medium mt-2">
              Setting up your schedule...
            </p>
          </header>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold">Let&apos;s build your daily schedule</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              So your day is ready instantly.
            </p>
            <Button onClick={() => router.push('/onboarding')} className="mt-4">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handlePreviousDay = () => {
    // Parse displayDate as local date (YYYY-MM-DD format)
    const [year, month, day] = displayDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    const prevDate = subDays(currentDate, 1);
    const newDate = format(prevDate, 'yyyy-MM-dd');
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    // Parse displayDate as local date (YYYY-MM-DD format)
    const [year, month, day] = displayDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    const nextDate = addDays(currentDate, 1);
    const newDate = format(nextDate, 'yyyy-MM-dd');
    setSelectedDate(newDate);
  };

  const now = user?.timezone ? getCurrentTimeInTimezone(user.timezone) : new Date();
  const timeStr = formatTime12h(format(now, 'HH:mm'));
  const isViewingToday = displayDate === format(new Date(), 'yyyy-MM-dd');
  // Parse date string as local date, not UTC (prevents timezone offset issues)
  const [year, month, day] = displayDate.split('-').map(Number);
  const displayDateObj = new Date(year, month - 1, day);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header Section with Card-like Background */}
      <div className="bg-card/50 backdrop-blur-sm border-b border-border/40">
        <header className="px-5 md:px-8 pt-8 pb-6 md:pt-10 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">{isViewingToday ? 'Today' : 'Schedule'}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePreviousDay}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <p className="text-muted-foreground text-[15px] font-medium min-w-max">
                {format(displayDateObj, 'EEEE, MMMM do')} {isViewingToday && `· ${timeStr}`}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextDay}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
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
      </div>

      {/* Soft Section Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent mx-5 md:mx-8" />

      {/* Alerts Section with Breathing Room */}
      <div className="px-5 md:px-8 py-4 space-y-3">
        {timeDeptMinutes > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
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
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive">A fixed block was skipped — your day may be off-track</p>
          </div>
        )}
      </div>

      {/* Main Content Area with Card Grouping */}
      <div className="flex-1 px-5 md:px-8 py-6">
        <div className="max-w-4xl w-full mx-auto">
          {/* Schedule Section Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground/90 tracking-tight">
              {isViewingToday ? 'Your Schedule' : 'Daily Schedule'}
            </h2>

          </div>

          {/* Timeline Card */}
          <div className="bg-card/30 backdrop-blur-sm border border-border/40 rounded-2xl p-6 shadow-sm">
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
      </div>
    </div>
  );
}
