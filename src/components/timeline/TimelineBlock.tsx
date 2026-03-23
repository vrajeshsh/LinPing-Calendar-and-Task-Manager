'use client';

import { TimeBlock } from '@/types';
import { cn } from '@/lib/utils';
import { parseTime } from '@/lib/scheduleHelpers';
import { CheckCircle2, Circle, Clock, MoreHorizontal, Play, Lock, Unlock, XCircle, ArrowRightCircle } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { useScheduleStore } from '@/store/useScheduleStore';

interface Props {
  block: TimeBlock;
  isActive: boolean;
  isPast: boolean;
  now: Date;
  date: string;
}

export function TimelineBlock({ block, isActive, isPast, now, date }: Props) {
  const updateBlockStatus = useScheduleStore(state => state.updateBlockStatus);
  
  const start = parseTime(block.startTime);
  let end = parseTime(block.endTime);
  if (end < start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    if (now.getHours() < 12 && start.getHours() >= 12) {
      start.setTime(start.getTime() - 24 * 60 * 60 * 1000);
      end.setTime(end.getTime() - 24 * 60 * 60 * 1000);
    }
  }
  
  const duration = differenceInMinutes(end, start);
  const elapsed = isActive ? differenceInMinutes(now, start) : (isPast ? duration : 0);
  const progressPercent = Math.min(100, Math.max(0, (elapsed / duration) * 100));

  const handleStatusChange = (status: TimeBlock['status']) => {
    updateBlockStatus(date, block.id, status);
  };

  const isCompleted = block.status === 'completed';

  return (
    <div className={cn(
      "relative z-10 flex gap-4 md:gap-6 group transition-all duration-500 ease-out",
      isActive ? "opacity-100 scale-[1.02] transform-gpu" : (isPast ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100")
    )}>
      
      {/* Time Column (Left) */}
      <div className="w-16 md:w-20 pt-1.5 shrink-0 text-right flex flex-col items-end">
        <span className={cn(
          "text-[15px] font-semibold tracking-tight transition-colors",
          isActive ? "text-primary" : "text-foreground"
        )}>{block.startTime}</span>
        <span className="text-xs text-muted-foreground font-medium mt-0.5">{block.endTime}</span>
        {isActive && (
          <div className="mt-2 text-[10px] font-bold tracking-wider uppercase text-primary animate-pulse">
            Now
          </div>
        )}
      </div>

      {/* Node / Timeline connector */}
      <div className="hidden md:flex flex-col items-center mt-2.5 shrink-0">
        <div className={cn(
          "w-3 h-3 rounded-full border-[2px] z-10 bg-background transition-all duration-300",
          isActive ? "border-primary ring-4 ring-primary/20 scale-125 shadow-sm" : 
           (isCompleted ? "border-primary bg-primary" :
            (isPast ? "border-muted-foreground/30 bg-muted/50" : "border-muted-foreground"))
        )} />
      </div>

      {/* Main Card */}
      <div className={cn(
        "flex-1 rounded-[20px] border transition-all duration-300 overflow-hidden",
        isActive ? "bg-card border-primary/20 shadow-xl shadow-primary/5" : 
         (isPast ? "bg-muted/30 border-transparent shadow-sm" : "bg-card/50 border-border/40 hover:border-border shadow-sm")
      )}>
        <div className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className={cn(
                  "font-semibold text-[17px] tracking-tight transition-colors",
                  isActive ? "text-foreground" : (isCompleted ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")
                )}>
                  {block.title}
                </h3>
                {block.type === 'fixed' ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                )}
              </div>
              <p className="text-[13px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {duration} min
                <span className="text-border mx-1">•</span>
                <span className="capitalize">{block.type}</span>
              </p>
            </div>
            
            {/* Actions Menu */}
            <div className={cn("flex gap-1.5 transition-opacity duration-300", isActive || isPast ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
               <button 
                 onClick={() => handleStatusChange(isCompleted ? 'pending' : 'completed')} 
                 className={cn("w-9 h-9 flex items-center justify-center rounded-full transition-colors", isCompleted ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary")}
               >
                  <CheckCircle2 className="w-5 h-5" />
               </button>
               {!isCompleted && isActive && (
                 <>
                   <button onClick={() => handleStatusChange('delayed')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors">
                     <ArrowRightCircle className="w-5 h-5" />
                   </button>
                   <button onClick={() => handleStatusChange('skipped')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                     <XCircle className="w-5 h-5" />
                   </button>
                 </>
               )}
            </div>
          </div>

          {/* Progress Bar (Active only) */}
          {isActive && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-primary/70 tracking-wider uppercase">
                <span>{Math.floor(elapsed)}m done</span>
                <span>{duration - Math.floor(elapsed)}m left</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
