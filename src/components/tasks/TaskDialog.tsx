'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { PriorityLevel } from '@/types';
import { cn } from '@/lib/utils';

export function TaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const addTask = useScheduleStore(state => state.addTask);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    addTask({
      id: crypto.randomUUID(),
      title,
      duration: parseInt(duration) || 30,
      priority,
    });
    setOpen(false);
    setTitle('');
    setDuration('30');
    setPriority('medium');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="fixed bottom-36 md:bottom-28 right-6 md:right-10 w-14 h-14 bg-foreground text-background rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 focus:outline-none focus:ring-4 focus:ring-primary/20">
        <Plus className="w-6 h-6" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-xl">New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">What do you need to do?</label>
            <input 
              autoFocus
              className="w-full px-4 py-3 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all font-medium"
              placeholder="e.g., Review architecture docs"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Estimated Duration (mins)</label>
            <div className="flex gap-2">
              {['15', '30', '45', '60'].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setDuration(min)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium transition-colors border",
                    duration === min 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-transparent border-border hover:bg-muted"
                  )}
                >
                  {min}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as PriorityLevel[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium transition-colors border capitalize",
                    priority === p 
                      ? "bg-foreground text-background border-foreground" 
                      : "bg-transparent border-border hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={!title.trim()} className="w-full h-12 mt-4 bg-foreground text-background font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
            Add to Task Inbox
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
