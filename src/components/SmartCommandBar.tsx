'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Task, PriorityLevel, TimeBlock } from '@/types';
import { Send, Sparkles, Lightbulb, AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, parseISO, isToday, isTomorrow } from 'date-fns';

interface ParsedTask {
  title: string;
  originalInput: string;
  duration: number; // minutes
  priority: PriorityLevel;
  scheduleDate?: string;
  scheduleTime?: string;
  endTime?: string;
  confidence: 'high' | 'medium' | 'low';
  suggestion?: string;
  error?: string;
  normalizedTitle: string;
}

interface SmartCommandBarProps {
  prompt: string;
  setPrompt: (p: string) => void;
}

// Common meal references for smart parsing
const MEAL_REFERENCES: Record<string, string> = {
  'breakfast': 'breakfast',
  'brunch': 'brunch',
  'lunch': 'lunch',
  'lunchtime': 'lunch',
  'dinner': 'dinner',
  'supper': 'dinner',
  'din': 'dinner',
  'eve': 'evening',
  'mtg': 'meeting',
  'appt': 'appointment',
  'doc': 'doctor',
  'gym': 'gym',
  'study': 'study session',
  'hw': 'homework',
  'class': 'class',
  'work': 'work',
  'wrk': 'work',
};

// Day abbreviations
const DAY_ABBREVS: Record<string, number> = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 4, 'friday': 4,
  'sat': 5, 'saturday': 5,
};

// Hard constraints - protected time ranges
const PROTECTED_BLOCKS = ['sleep', 'office', 'work'];

// Smart title normalization patterns
function normalizeTitle(input: string): string {
  let title = input.trim();
  
  // Remove common filler words at the start
  const fillers = /^(please\s+|can\s+you\s+|i\s+need\s+to\s+|i\s+should\s+|add\s+|create\s+|make\s+|schedule\s+)/i;
  title = title.replace(fillers, '');
  
  // Expand common abbreviations
  const abbrevs: Record<string, string> = {
    '\\bdin\\b': 'dinner',
    '\\bmtg\\b': 'meeting',
    '\\bappt\\b': 'appointment',
    '\\bwrk\\b': 'work',
    '\\bmsg\\b': 'message',
    '\\bre\\b': 'reply to',
    '\\btmr\\b': 'tomorrow',
    '\\b2day\\b': 'today',
    '\\b2moro\\b': 'tomorrow',
  };
  
  for (const [pattern, replacement] of Object.entries(abbrevs)) {
    title = title.replace(new RegExp(pattern, 'gi'), replacement);
  }
  
  // Expand meal references
  for (const [ref, full] of Object.entries(MEAL_REFERENCES)) {
    const regex = new RegExp(`\\b${ref}\\b`, 'gi');
    if (ref !== full) {
      title = title.replace(regex, full);
    }
  }
  
  // Convert "after dinner" → "after dinner" (keep natural phrasing)
  // But capitalize properly
  title = title
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, idx, arr) => {
      // Don't capitalize small words in middle of phrase
      const smallWords = ['a', 'an', 'the', 'at', 'in', 'on', 'to', 'for', 'of', 'and', 'or', 'but', 'with', 'after', 'before', 'during', 'between'];
      if (idx > 0 && smallWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  // Clean up spacing
  title = title.replace(/\s+/g, ' ').trim();
  
  return title;
}

// Validate if the input is meaningful
function validateInput(input: string): { valid: boolean; reason?: string } {
  const cleaned = input.trim().toLowerCase();
  
  // Too short
  if (cleaned.length < 2) {
    return { valid: false, reason: 'Try adding more details' };
  }
  
  // Random keyboard smash patterns
  if (/^[asdfghjklzxcvbnm]{3,}$/i.test(cleaned)) {
    return { valid: false, reason: 'I couldn\'t understand that. Try adding a task name' };
  }
  
  // Only numbers or symbols
  if (/^[0-9\s\-\+\*\/\.\,\:]+$/.test(cleaned)) {
    return { valid: false, reason: 'Try adding a task or activity name' };
  }
  
  // Single random letters
  if (/^[a-z]$/i.test(cleaned) && cleaned.length <= 2) {
    return { valid: false, reason: 'Try adding more details' };
  }
  
  return { valid: true };
}

// Check if title contains protected/blocked content
function containsProtectedContent(title: string): boolean {
  const lower = title.toLowerCase();
  return PROTECTED_BLOCKS.some(block => {
    const regex = new RegExp(`\\b${block}\\b`, 'i');
    return regex.test(lower);
  });
}

// Parse day of week from shorthand
function parseDayOfWeek(input: string): { dayOffset: number; matched: boolean } {
  const lower = input.toLowerCase();
  
  for (const [day, offset] of Object.entries(DAY_ABBREVS)) {
    if (lower.includes(day)) {
      const today = new Date();
      const currentDay = today.getDay();
      let dayOffset = offset - currentDay;
      
      // If day is in the past this week, assume next week
      if (dayOffset < 0) dayOffset += 7;
      
      return { dayOffset, matched: true };
    }
  }
  
  return { dayOffset: 0, matched: false };
}

// Smart task parsing
function parseTaskInput(input: string): ParsedTask | null {
  const validation = validateInput(input);
  if (!validation.valid) {
    return {
      title: input.trim(),
      originalInput: input,
      duration: 30,
      priority: 'medium',
      confidence: 'low',
      error: validation.reason,
      normalizedTitle: '',
    };
  }
  
  let workingInput = input;
  let title = input.trim();
  let duration = 30; // default 30 minutes
  let priority: PriorityLevel = 'medium';
  let scheduleDate: string | undefined;
  let scheduleTime: string | undefined;
  let endTime: string | undefined;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let suggestion: string | undefined;
  let error: string | undefined;
  
  // Extract and normalize duration FIRST
  const durationPatterns = [
    /(\d+)\s*(hours?|h)\s*(?:and\s*)?(\d+)?\s*(minutes?|mins?|m)?/i,
    /(\d+)\s*(minutes?|mins?|m)\b/i,
    /(\d+)\s*h(?:our)?s?/i,
    /(\d+)m(?:in)?s?/i,
  ];
  
  for (const pattern of durationPatterns) {
    const match = workingInput.match(pattern);
    if (match) {
      if (pattern.source.includes('hours') || pattern.source.includes('h')) {
        const hours = parseInt(match[1]);
        const mins = match[3] ? parseInt(match[3]) : 0;
        duration = hours * 60 + mins;
      } else {
        duration = parseInt(match[1]);
      }
      workingInput = workingInput.replace(match[0], '').trim();
      title = title.replace(match[0], '').trim();
      break;
    }
  }
  
  // Infer duration from context
  if (duration === 30) {
    const lower = workingInput.toLowerCase();
    if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
      duration = 60;
    } else if (lower.includes('study') || lower.includes('homework')) {
      duration = 45;
    } else if (lower.includes('meeting') || lower.includes('call')) {
      duration = 30;
    } else if (lower.includes('doctor') || lower.includes('dentist') || lower.includes('appointment')) {
      duration = 60;
    }
  }
  
  // Extract time
  const timePatterns = [
    /\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/,
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i,
    /\b(\d{1,2})\s*(am|pm|AM|PM)\b/,
  ];
  
  for (const pattern of timePatterns) {
    const match = workingInput.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      const ampm = match[3]?.toLowerCase();
      
      // Handle 12-hour format
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      if (!ampm && hour < 6) hour += 12; // Assume PM for single digit hours after morning context
      
      scheduleTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      workingInput = workingInput.replace(match[0], '').trim();
      title = title.replace(match[0], '').trim();
      break;
    }
  }
  
  // Extract relative dates
  const lower = workingInput.toLowerCase();
  
  if (/\btom(?:orrow)?\b|\btmr\b|\b2moro\b/i.test(lower)) {
    const tomorrow = addDays(new Date(), 1);
    scheduleDate = format(tomorrow, 'yyyy-MM-dd');
    workingInput = workingInput.replace(/\btom(?:orrow)?\b|\btmr\b|\b2moro\b/gi, '').trim();
    title = title.replace(/\btom(?:orrow)?\b|\btmr\b|\b2moro\b/gi, '').trim();
  } else if (/\btoday\b|\b2day\b/i.test(lower)) {
    scheduleDate = format(new Date(), 'yyyy-MM-dd');
    workingInput = workingInput.replace(/\btoday\b|\b2day\b/gi, '').trim();
    title = title.replace(/\btoday\b|\b2day\b/gi, '').trim();
  } else if (/\btonight\b/i.test(lower)) {
    scheduleDate = format(new Date(), 'yyyy-MM-dd');
    // Assume evening time if not specified
    if (!scheduleTime) scheduleTime = '18:00';
    workingInput = workingInput.replace(/\btonight\b/gi, '').trim();
    title = title.replace(/\btonight\b/gi, '').trim();
  } else if (/\b(morning|afternoon|evening)\b/i.test(lower)) {
    const timeOfDay = lower.match(/\b(morning|afternoon|evening)\b/)?.[1];
    if (!scheduleTime) {
      if (timeOfDay === 'morning') scheduleTime = '09:00';
      else if (timeOfDay === 'afternoon') scheduleTime = '14:00';
      else if (timeOfDay === 'evening') scheduleTime = '18:00';
    }
    workingInput = workingInput.replace(/\b(morning|afternoon|evening)\b/gi, '').trim();
    title = title.replace(/\b(morning|afternoon|evening)\b/gi, '').trim();
  }
  
  // Check for day of week
  const { dayOffset, matched } = parseDayOfWeek(workingInput);
  if (matched) {
    const targetDate = addDays(new Date(), dayOffset);
    scheduleDate = format(targetDate, 'yyyy-MM-dd');
    // Remove the day name from title
    for (const dayName of Object.keys(DAY_ABBREVS)) {
      title = title.replace(new RegExp(`\\b${dayName}\\b`, 'gi'), '').trim();
      workingInput = workingInput.replace(new RegExp(`\\b${dayName}\\b`, 'gi'), '').trim();
    }
  }
  
  // Infer "after [meal]" timing
  const afterMeal = lower.match(/after\s+(breakfast|lunch|dinner|brunch)/i);
  if (afterMeal && !scheduleTime) {
    const meal = afterMeal[1].toLowerCase();
    if (meal === 'breakfast') scheduleTime = '09:00';
    else if (meal === 'lunch') scheduleTime = '13:00';
    else if (meal === 'dinner' || meal === 'brunch') scheduleTime = '19:00';
    
    // If today, set the date
    if (!scheduleDate && isToday(new Date())) {
      scheduleDate = format(new Date(), 'yyyy-MM-dd');
    } else if (!scheduleDate && isTomorrow(new Date())) {
      scheduleDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    }
  }
  
  // Extract priority
  const priorityPatterns: Record<string, PriorityLevel> = {
    'urgent': 'critical',
    'critical': 'critical',
    'asap': 'critical',
    'important': 'important',
    'priority': 'important',
    'vital': 'important',
    'low': 'low',
    'optional': 'low',
    'whenever': 'low',
    'nice to have': 'low',
  };
  
  for (const [keyword, level] of Object.entries(priorityPatterns)) {
    if (lower.includes(keyword)) {
      priority = level;
      title = title.replace(new RegExp(keyword, 'gi'), '').trim();
      break;
    }
  }
  
  // Smart title cleaning
  // Remove common prefixes
  title = title
    .replace(/^(?:add|create|schedule|plan|do|get|have|go|make)\s+/i, '')
    .trim();
  
  // Clean up remaining words
  title = title
    .replace(/^(?:for|to|at|on|in)\s+/i, '')
    .replace(/\s+(?:for|to|at|on|in)$/i, '')
    .trim();
  
  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  // Calculate end time if we have start time and duration
  if (scheduleTime && duration) {
    const [startHour, startMin] = scheduleTime.split(':').map(Number);
    const totalMinutes = startHour * 60 + startMin + duration;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMin = totalMinutes % 60;
    endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
  }
  
  // Normalize the title for display
  const normalizedTitle = normalizeTitle(title);
  
  // Check for protected content
  if (containsProtectedContent(title)) {
    error = 'Protected time blocks cannot be modified';
    confidence = 'low';
  }
  
  // Determine confidence level
  if (normalizedTitle.length < 3) {
    confidence = 'low';
    suggestion = 'Try adding a specific task name';
  } else if (normalizedTitle.length > 5 && (scheduleTime || scheduleDate)) {
    confidence = 'high';
  } else if (normalizedTitle.length > 3) {
    confidence = 'medium';
    if (!scheduleTime && !scheduleDate) {
      suggestion = `Add "${normalizedTitle}" to your schedule`;
    }
  } else {
    confidence = 'low';
    suggestion = 'Try adding more details like a time or duration';
  }
  
  return {
    title: normalizedTitle || title,
    originalInput: input,
    duration,
    priority,
    scheduleDate,
    scheduleTime,
    endTime,
    confidence,
    suggestion,
    error,
    normalizedTitle,
  };
}

// Check if a task conflicts with schedule constraints
function checkScheduleConflict(
  parsedTask: ParsedTask,
  existingBlocks: TimeBlock[]
): { hasConflict: boolean; message?: string; alternative?: string } {
  if (!parsedTask.scheduleTime || !parsedTask.endTime) {
    return { hasConflict: false };
  }
  
  const taskStart = parsedTask.scheduleTime;
  const taskEnd = parsedTask.endTime;
  
  for (const block of existingBlocks) {
    // Skip flexible blocks
    if (block.type === 'flexible') continue;
    
    // Check for overlap
    const blockStart = block.startTime;
    const blockEnd = block.endTime;
    
    // Simple time comparison (assumes same day)
    if (taskStart < blockEnd && taskEnd > blockStart) {
      // There's an overlap
      if (PROTECTED_BLOCKS.includes(block.type)) {
        return {
          hasConflict: true,
          message: `Conflicts with ${block.type} (${blockStart}-${blockEnd})`,
          alternative: `Try a different time or make it flexible`,
        };
      }
    }
  }
  
  return { hasConflict: false };
}

export function SmartCommandBar({ prompt, setPrompt }: SmartCommandBarProps) {
  const [loading, setLoading] = useState(false);
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { schedules, selectedDate, tasks, saveSchedule, addTask, addBlockToSchedule, templates } = useScheduleStore();
  
  // Get current schedule blocks
  const currentBlocks = useMemo(() => {
    const schedule = schedules[selectedDate];
    return schedule?.blocks || [];
  }, [schedules, selectedDate]);
  
  // Parse input in real-time
  useEffect(() => {
    if (prompt.trim()) {
      const parsed = parseTaskInput(prompt);
      setParsedTask(parsed);
      setShowPreview(!!parsed && parsed.confidence !== 'low');
    } else {
      setParsedTask(null);
      setShowPreview(false);
    }
  }, [prompt]);
  
  // Check for schedule conflicts
  const conflictCheck = useMemo(() => {
    if (!parsedTask || !showPreview) return null;
    return checkScheduleConflict(parsedTask, currentBlocks);
  }, [parsedTask, currentBlocks, showPreview]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !parsedTask) return;
    
    // Block low confidence or invalid tasks
    if (parsedTask.confidence === 'low' || parsedTask.error) {
      return; // Just don't submit - inline feedback is shown
    }
    
    // Block if there's an unresolved conflict
    if (conflictCheck?.hasConflict) {
      return;
    }
    
    setLoading(true);
    try {
      // Create the task
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: parsedTask.title,
        duration: parsedTask.duration,
        priority: parsedTask.priority,
      };
      
      await addTask(newTask);
      
      // If scheduling info is provided, add to schedule
      if (parsedTask.scheduleDate && parsedTask.scheduleTime) {
        await addBlockToSchedule(parsedTask.scheduleDate, {
          id: crypto.randomUUID(),
          title: parsedTask.title,
          startTime: parsedTask.scheduleTime,
          endTime: parsedTask.endTime || parsedTask.scheduleTime,
          type: 'flexible',
          status: 'pending',
          taskId: newTask.id,
        });
      }
      
      // Clear the input
      setPrompt('');
      setParsedTask(null);
      setShowPreview(false);
    } catch (err: any) {
      console.error('Task creation error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const applySuggestion = (suggestedInput: string) => {
    setPrompt(suggestedInput);
    setShowPreview(false);
  };
  
  const quickAdd = (text: string) => {
    setPrompt(prompt ? `${prompt} ${text}` : text);
  };
  
  const formatDuration = (mins: number) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h} H ${m} M` : `${h} H`;
    }
    return `${mins} M`;
  };
  
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
  };
  
  const getDateDisplay = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
  };
  
  // Determine if we can submit
  const canSubmit = parsedTask && 
                    parsedTask.confidence !== 'low' && 
                    !parsedTask.error && 
                    !conflictCheck?.hasConflict;
  
  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit}
        className={cn(
          "flex items-center bg-card border rounded-2xl p-2.5 transition-all shadow-sm",
          "focus-within:ring-4 focus-within:border-primary/40",
          "hover:shadow-md",
          showPreview && canSubmit && "border-emerald-500/30 bg-emerald-500/5",
          parsedTask?.error || conflictCheck?.hasConflict ? "border-amber-500/30" : ""
        )}
        style={{
          '--tw-ring-color': 'var(--input-focus)',
        } as React.CSSProperties}
      >
        <div className={cn(
          "w-11 h-11 rounded-[14px] flex items-center justify-center mr-3 shrink-0 transition-colors",
          canSubmit ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"
        )}>
          {canSubmit ? <CheckCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </div>
        
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder='Try: "Walk after dinner" or "Meeting tomorrow 3 PM"'
          className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-medium placeholder:text-muted-foreground/45"
          disabled={loading}
        />
        
        <button 
          type="submit" 
          disabled={!canSubmit || loading}
          className={cn(
            "w-11 h-11 flex items-center justify-center rounded-[14px] transition-all hover:brightness-110 active:scale-95 shrink-0",
            canSubmit 
              ? "bg-emerald-500 text-white" 
              : "bg-primary text-primary-foreground disabled:opacity-40"
          )}
        >
          {loading
            ? <div className="w-5 h-5 rounded-full border-[2.5px] border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            : <Send className="w-[18px] h-[18px] ml-0.5" />}
        </button>
      </form>
      
      {/* Smart Preview - shows parsed task interpretation */}
      {showPreview && parsedTask && !parsedTask.error && (
        <div className="mt-3 space-y-2">
          {/* Main preview */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-xl border transition-colors",
            canSubmit 
              ? "bg-emerald-500/8 border-emerald-500/20" 
              : "bg-muted/50 border-border/50"
          )}>
            {canSubmit ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              {/* Parsed title */}
              <p className="font-semibold text-foreground">
                {parsedTask.title}
              </p>
              
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm">
                {/* Duration */}
                <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3" />
                  {formatDuration(parsedTask.duration)}
                </span>
                
                {/* Time */}
                {parsedTask.scheduleTime && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3" />
                    {formatTimeDisplay(parsedTask.scheduleTime)}
                    {parsedTask.endTime && ` - ${formatTimeDisplay(parsedTask.endTime)}`}
                  </span>
                )}
                
                {/* Date */}
                {parsedTask.scheduleDate && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <Calendar className="w-3 h-3" />
                    {getDateDisplay(parsedTask.scheduleDate)}
                  </span>
                )}
              </div>
              
              {/* Suggestion for medium confidence */}
              {parsedTask.suggestion && parsedTask.confidence === 'medium' && (
                <p className="text-xs text-muted-foreground/70 mt-2 italic">
                  💡 {parsedTask.suggestion}
                </p>
              )}
              
              {/* Conflict warning */}
              {conflictCheck?.hasConflict && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ {conflictCheck.message}
                </p>
              )}
            </div>
          </div>
          
          {/* Quick suggestions for low-medium confidence */}
          {parsedTask.confidence === 'medium' && !parsedTask.scheduleTime && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Quick add time:</span>
              <button
                onClick={() => quickAdd('at 9am')}
                className="text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                9 AM
              </button>
              <button
                onClick={() => quickAdd('at 12pm')}
                className="text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                12 PM
              </button>
              <button
                onClick={() => quickAdd('at 3pm')}
                className="text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                3 PM
              </button>
              <button
                onClick={() => quickAdd('at 6pm')}
                className="text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
              >
                6 PM
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Error state - invalid input */}
      {parsedTask?.error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              {parsedTask.error}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              Try something like "Walk at 6 PM" or "Meeting tomorrow at 3"
            </p>
          </div>
        </div>
      )}
      
      {/* Conflict warning */}
      {conflictCheck?.hasConflict && parsedTask && !parsedTask.error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              {conflictCheck.message}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {conflictCheck.alternative}
            </p>
          </div>
        </div>
      )}
      
      <p className="text-[10px] text-muted-foreground/40 font-medium mt-2 px-1">
        Type naturally • I'll understand shorthand • Press Enter to add
      </p>
    </div>
  );
}
