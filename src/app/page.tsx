'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';
import { DEFAULT_TEMPLATE } from '@/lib/defaultData';
import { Timeline } from '@/components/timeline/Timeline';
import { AICommandBar } from '@/components/AICommandBar';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { calculateAdherenceScore } from '@/lib/scheduleHelpers';
import { Plus } from 'lucide-react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { schedules, templates, initializeDayFromTemplate } = useScheduleStore();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySchedule = schedules[today];

  useEffect(() => {
    setMounted(true);
    const store = useScheduleStore.getState();
    if (store.templates.length === 0) {
      useScheduleStore.setState({ templates: [DEFAULT_TEMPLATE] });
    }
    
    if (!useScheduleStore.getState().schedules[today]) {
       initializeDayFromTemplate(today, DEFAULT_TEMPLATE.id);
    }
  }, [today, initializeDayFromTemplate]);

  if (!mounted) return <div className="p-8">Loading schedule...</div>;

  const score = todaySchedule ? calculateAdherenceScore(todaySchedule.blocks) : 0;

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-5 md:px-8 py-8 md:py-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Today</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="text-3xl font-bold tracking-tighter text-primary">
            {score}%
          </div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
            Adherence
          </div>
        </div>
      </header>
      
      <div className="flex-1 px-3 md:px-8 relative max-w-4xl w-full mx-auto pb-32">
        {todaySchedule ? (
          <Timeline schedule={todaySchedule} />
        ) : (
          <div className="text-muted-foreground pt-4 pl-4 font-medium">Initializing today's schedule...</div>
        )}
      </div>

      <TaskDialog />
      <AICommandBar />
    </div>
  );
}
