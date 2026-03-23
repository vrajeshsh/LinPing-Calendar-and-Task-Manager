'use client';

import { useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Task, PriorityLevel } from '@/types';
import { Send, Sparkles, Trash2, Pencil, Plus, X, Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Priority meta — new 4-tier system
const PRIORITY_META: Record<PriorityLevel, { label: string; bar: string; badge: string; desc: string }> = {
  critical:  { label: 'Critical',  bar: 'bg-rose-500',         badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',        desc: 'Must happen urgently' },
  important: { label: 'Important', bar: 'bg-orange-500',       badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',   desc: 'Before all else' },
  medium:    { label: 'Medium',    bar: 'bg-sky-500',          badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',            desc: 'Should happen today' },
  low:       { label: 'Low',       bar: 'bg-muted-foreground/30', badge: 'bg-muted/50 text-muted-foreground',                    desc: 'Nice to have' },
};

// ─── AI Command Bar ──────────────────────────────────────────────────────────
function AICommandBar() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { schedules, tasks, saveSchedule } = useScheduleStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const schedule = schedules[today];
      const res = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, schedule, tasks, currentTime: format(new Date(), 'HH:mm') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');
      if (data.updatedBlocks) saveSchedule(today, { ...schedule, blocks: data.updatedBlocks });
      if (data.warning) alert(`⚠ ${data.warning}`);
      else if (data.explanation) alert(`✓ ${data.explanation}`);
    } catch (err: any) {
      alert(`AI Error: ${err.message}`);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit}
        className="flex items-center bg-card border border-border rounded-2xl p-2.5 transition-all focus-within:ring-4 focus-within:ring-primary/15 focus-within:border-primary/40 hover:border-border/70 shadow-sm"
      >
        <div className="w-11 h-11 rounded-[14px] bg-primary/10 text-primary flex items-center justify-center mr-3 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder='Try: "Add 45 min grocery run at 5:30 PM" or "Move study to 9 PM"'
          className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-medium placeholder:text-muted-foreground/45"
          disabled={loading}
        />
        <button type="submit" disabled={!prompt.trim() || loading}
          className="w-11 h-11 flex items-center justify-center rounded-[14px] bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:brightness-110 active:scale-95 shrink-0"
        >
          {loading
            ? <div className="w-5 h-5 rounded-full border-[2.5px] border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            : <Send className="w-[18px] h-[18px] ml-0.5" />}
        </button>
      </form>
      <p className="text-[10px] text-muted-foreground/50 font-medium mt-2 px-1">
        AI respects fixed blocks (Sleep, Office, Gym) · Changes apply to today&apos;s timeline
      </p>
    </div>
  );
}

// ─── Follow-up / Add Modal ───────────────────────────────────────────────────
function TaskModal({ initialTitle = '', initialPriority = 'medium' as PriorityLevel, onSave, onClose, editingId }: {
  initialTitle?: string;
  initialPriority?: PriorityLevel;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
  editingId?: string;
}) {
  const { addBlockToSchedule } = useScheduleStore();
  const [title, setTitle] = useState(initialTitle);
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<PriorityLevel>(initialPriority);
  const [scheduleIt, setScheduleIt] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('17:00');

  const handleSave = () => {
    if (!title.trim()) return;
    const mins = parseInt(duration) || 30;
    const taskData = { title, duration: mins, priority };

    onSave(editingId ? { ...taskData, id: editingId } : taskData);

    if (scheduleIt && !editingId) {
      const [h, m] = scheduleTime.split(':').map(Number);
      const totalMins = h * 60 + m + mins;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      addBlockToSchedule(scheduleDate, {
        id: crypto.randomUUID(),
        title,
        startTime: scheduleTime,
        endTime: `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`,
        type: 'flexible',
        status: 'pending',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <input autoFocus
            className="w-full px-4 py-3 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 text-[15px] font-medium transition-all"
            placeholder="Task name..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          {/* Duration */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Duration</p>
            <div className="grid grid-cols-4 gap-1.5">
              {['15','30','45','60'].map(m => (
                <button key={m} onClick={() => setDuration(m)}
                  className={cn("py-2 rounded-xl text-[12px] font-bold border transition-colors",
                    duration === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  )}>{m}m</button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Priority</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(PRIORITY_META) as [PriorityLevel, typeof PRIORITY_META[PriorityLevel]][]).map(([p, meta]) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={cn("py-2.5 px-3 rounded-xl text-[12px] font-bold border transition-all text-left flex flex-col gap-0.5",
                    priority === p
                      ? `${meta.badge} border-current shadow-sm`
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span>{meta.label}</span>
                  <span className="text-[9px] font-medium opacity-70">{meta.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule toggle (only for new tasks) */}
          {!editingId && (
            <div>
              <button onClick={() => setScheduleIt(s => !s)}
                className={cn("flex items-center gap-2 text-[12px] font-semibold transition-colors rounded-xl px-3 py-2 w-full",
                  scheduleIt ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                {scheduleIt ? 'Remove from calendar' : 'Add to calendar'}
              </button>
              {scheduleIt && (
                <div className="flex gap-2 mt-2">
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-[13px] font-medium" />
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-28 px-3 py-2 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-[13px] font-medium tabular-nums" />
                </div>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={!title.trim()}
            className="w-full h-12 bg-foreground text-background rounded-xl font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {editingId ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { tasks, archivedTasks, deleteTask, addTask, updateTask, restoreTask } = useScheduleStore();
  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'followup'; task?: Task } | null>(null);
  const [filter, setFilter] = useState<'all' | PriorityLevel>('all');
  const [showArchive, setShowArchive] = useState(false);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.priority === filter);

  const handleSave = (data: Omit<Task, 'id'> & { id?: string }) => {
    if (data.id) {
      updateTask(data.id, { title: data.title, duration: data.duration, priority: data.priority });
    } else {
      addTask({ ...data, id: crypto.randomUUID() });
    }
  };

  const daysUntilPurge = (deletedAt: string) => {
    const diff = 7 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000);
    return Math.max(0, diff);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">
            {tasks.length ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} in inbox` : 'Use the AI bar to add tasks'}
          </p>
        </div>
        <button onClick={() => setModal({ type: 'new' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-3xl w-full mx-auto pb-16 flex flex-col">
        <AICommandBar />

        {/* Priority filter chips */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setFilter('all')} className={cn("px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all", filter === 'all' ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>All</button>
          {(Object.entries(PRIORITY_META) as [PriorityLevel, typeof PRIORITY_META[PriorityLevel]][]).map(([p, meta]) => (
            <button key={p} onClick={() => setFilter(p)}
              className={cn("px-3 py-1.5 rounded-xl text-[12px] font-bold capitalize transition-all", filter === p ? meta.badge + " shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
            >{meta.label}</button>
          ))}
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
            <Sparkles className="w-10 h-10 opacity-20" />
            <p className="font-medium text-sm">No tasks — ask the AI or tap &quot;New Task&quot;.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(task => {
              const meta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
              const dLabel = task.duration >= 60
                ? `${Math.floor(task.duration / 60)}h${task.duration % 60 > 0 ? ` ${task.duration % 60}m` : ''}`
                : `${task.duration}m`;
              return (
                <div key={task.id}
                  className="flex items-center gap-3 px-4 py-4 bg-card border border-border/25 rounded-2xl hover:border-border/50 hover:shadow-sm transition-all group"
                >
                  <div className={cn("w-1.5 h-10 rounded-full shrink-0", meta.bar)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", meta.badge)}>{meta.label}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{dLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ type: 'followup', task })} title="Create follow-up"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Follow-up
                    </button>
                    <button onClick={() => setModal({ type: 'edit', task })} title="Edit task"
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTask(task.id)} title="Delete task (kept 7 days)"
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Done / Archive ─────────────────────────────── */}
        {archivedTasks.length > 0 && (
          <div className="mt-10">
            <button onClick={() => setShowArchive(v => !v)}
              className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-4"
            >
              <span className={cn("transition-transform duration-200", showArchive ? "rotate-90" : "")}>▶</span>
              Done / Archive · {archivedTasks.length} task{archivedTasks.length !== 1 ? 's' : ''} · kept for 7 days
            </button>

            {showArchive && (
              <div className="flex flex-col gap-2">
                {archivedTasks.map(task => {
                  const remaining = daysUntilPurge(task.deletedAt);
                  const meta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
                  return (
                    <div key={task.id}
                      className="flex items-center gap-3 px-4 py-3 bg-muted/20 border border-border/15 rounded-2xl opacity-60 group hover:opacity-90 transition-opacity"
                    >
                      <div className={cn("w-1 h-8 rounded-full shrink-0 opacity-50", meta.bar)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[14px] text-muted-foreground truncate line-through">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">
                          Purges in {remaining} day{remaining !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button onClick={() => restoreTask(task.id)} title="Restore task"
                        className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-muted text-muted-foreground hover:bg-card hover:text-foreground transition-all"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'new' && <TaskModal onSave={handleSave} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && modal.task && (
        <TaskModal
          initialTitle={modal.task.title}
          initialPriority={modal.task.priority}
          editingId={modal.task.id}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'followup' && modal.task && (
        <TaskModal
          initialTitle={`Follow-up: ${modal.task.title}`}
          initialPriority={modal.task.priority}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
