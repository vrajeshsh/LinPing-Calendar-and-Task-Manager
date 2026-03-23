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
    <div className="fixed bottom-20 md:bottom-8 left-4 right-4 md:left-auto md:right-8 lg:left-1/2 lg:-translate-x-1/2 md:w-[600px] z-50">
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-center bg-card/90 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl p-2 transition-all focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary/30"
      >
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary mr-2 shrink-0 animate-in fade-in duration-500">
          <Sparkles className="w-5 h-5" />
        </div>
        <input 
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ask AI to adjust schedule, add block..."
          className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-medium placeholder:text-muted-foreground/60 placeholder:font-normal h-full w-full"
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={!prompt.trim() || loading}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-colors shrink-0 ml-2"
        >
          {loading ? (
             <div className="w-5 h-5 rounded-full border-[2.5px] border-primary-foreground/30 border-t-primary-foreground animate-spin" />
          ) : (
             <Send className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}
