'use client';

import { useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Task, PriorityLevel, TimeBlock } from '@/types';
import { Send, Sparkles, Trash2, Pencil, Plus, X, Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { SmartCommandBar } from '@/components/SmartCommandBar';
import { DefaultBlocks } from '@/components/DefaultBlocks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Priority meta — 4-tier system
const PRIORITY_META: Record<PriorityLevel, { label: string; bar: string; badge: string; desc: string }> = {
  critical:  { label: 'Critical',  bar: 'bg-rose-500',         badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',        desc: 'Must happen urgently' },
  important: { label: 'Important', bar: 'bg-orange-500',       badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',   desc: 'Before all else' },
  medium:    { label: 'Medium',    bar: 'bg-sky-500',          badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',            desc: 'Should happen today' },
  low:       { label: 'Low',       bar: 'bg-muted-foreground/30', badge: 'bg-muted/50 text-muted-foreground',                    desc: 'Nice to have' },
};

// Task Modal for editing
function TaskModal({ 
  initialTitle = '', 
  initialPriority = 'medium' as PriorityLevel, 
  editingId,
  onSave,
  onClose 
}: { 
  initialTitle?: string; 
  initialPriority?: PriorityLevel;
  editingId?: string;
  onSave: (data: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<PriorityLevel>(initialPriority);
  const [duration, setDuration] = useState('30');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      id: editingId,
      title,
      duration: parseInt(duration) || 30,
      priority,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{editingId ? 'Edit Task' : 'Quick Add Task'}</DialogTitle>
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
              {(['low', 'medium', 'important', 'critical'] as PriorityLevel[]).map(p => (
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
            {editingId ? 'Save Changes' : 'Add to Task Inbox'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { tasks, archivedTasks, deleteTask, restoreTask, addTask, updateTask } = useScheduleStore();
  const [filter, setFilter] = useState<'all' | PriorityLevel>('all');
  const [showArchive, setShowArchive] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'followup'; task?: Task } | null>(null);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.priority === filter);

  const handleSave = (data: Omit<Task, 'id'> & { id?: string }) => {
    if (data.id) {
      updateTask(data.id, { title: data.title, duration: data.duration, priority: data.priority });
    } else {
      addTask({ ...data, id: crypto.randomUUID() } as Task);
    }
  };

  const daysUntilPurge = (deletedAt: string) => {
    const diff = 7 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000);
    return Math.max(0, diff);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground mt-1 text-[15px] font-medium">
              {tasks.length ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} in inbox` : 'Use the command bar to add tasks'}
            </p>
          </div>
          
          {/* Quick add button - alternative to command bar */}
          <button
            onClick={() => setModal({ type: 'new' })}
            className="md:hidden flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Quick Add
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-3xl w-full mx-auto pb-16 flex flex-col">
        {/* Smart Command Bar - Primary Task Creation */}
        <SmartCommandBar prompt={prompt} setPrompt={setPrompt} />
        
        {/* Show DefaultBlocks only on larger screens as supplementary */}
        <div className="hidden md:block">
          <DefaultBlocks />
        </div>

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
          <div className="flex flex-col items-center justify-center gap-6 text-muted-foreground py-16">
            <div className="flex flex-col items-center gap-3">
              <Sparkles className="w-12 h-12 opacity-30" />
              <div className="text-center">
                <p className="font-semibold text-base mb-1">Start building your task list</p>
                <p className="text-sm opacity-75">Try typing something like:</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 max-w-sm w-full">
              {[
                "Add 30 min walk after dinner",
                "Schedule meeting tomorrow at 3pm",
                "1 hour study session tonight"
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(example)}
                  className="text-left text-sm text-foreground/70 hover:text-foreground hover:bg-muted/50 p-3 rounded-xl border border-border/20 hover:border-border/40 transition-all duration-200"
                >
                  "{example}"
                </button>
              ))}
            </div>
            <p className="text-xs opacity-60 text-center max-w-xs">
              Start typing in the command bar above
            </p>
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
