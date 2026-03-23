'use client';

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';

export function AICommandBar() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const store = useScheduleStore.getState();
      const schedule = store.schedules[today];
      const tasks = store.tasks;
      
      const res = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          schedule,
          tasks,
          currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }
      
      if (data.updatedBlocks && Array.isArray(data.updatedBlocks)) {
         store.saveSchedule(today, { ...schedule, blocks: data.updatedBlocks });
         // Ideally use a toast for this, but standard alert for MVP
         alert(`Schedule updated by AI:\n${data.explanation}`);
      }
    } catch (err: any) {
      alert(`AI Request Failed: ${err.message}`);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-10 left-4 right-4 md:left-auto md:right-auto md:w-[700px] z-50 md:left-1/2 md:-translate-x-1/2">
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-center bg-card/95 backdrop-blur-3xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-2xl p-2.5 transition-all duration-300 focus-within:ring-4 focus-within:ring-primary/20 focus-within:border-primary/50 hover:border-border/80"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-[14px] bg-primary/10 text-primary mr-3 shrink-0 animate-in fade-in zoom-in duration-500">
          <Sparkles className="w-[22px] h-[22px]" />
        </div>
        <input 
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Add 30 min walk after dinner..."
          className="flex-1 bg-transparent border-none focus:outline-none text-[17px] font-medium placeholder:text-muted-foreground/50 placeholder:font-normal h-full w-full"
          disabled={loading}
          autoFocus
        />
        <div className="hidden md:flex items-center justify-center px-2 mr-2 text-[11px] font-bold text-muted-foreground bg-muted/50 rounded-md border border-border/50">
          ⌘ K
        </div>
        <button 
          type="submit" 
          disabled={!prompt.trim() || loading}
          className="w-12 h-12 flex items-center justify-center rounded-[14px] bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:brightness-110 active:scale-95 shrink-0 shadow-sm"
        >
          {loading ? (
             <div className="w-[22px] h-[22px] rounded-full border-[3px] border-primary-foreground/30 border-t-primary-foreground animate-spin" />
          ) : (
             <Send className="w-[20px] h-[20px] ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}
