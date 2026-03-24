'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { createClient } from '@/utils/supabase/client';
import { Task, PriorityLevel, TimeBlock } from '@/types';
import { Send, Sparkles, Lightbulb, AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';
import { ReschedulePreview, GroupedRescheduleSummary } from '@/components/timeline/RescheduleExplanation';
import { cn } from '@/lib/utils';
import { format, addDays, parseISO, isToday, isTomorrow } from 'date-fns';
import { toast } from 'sonner';
import personalizationService, { PersonalizationPattern, PreferredTimeWindow, PreferredDuration } from '@/services/personalizationService';
import { scheduleWithPriority, getWeekendTemplate, needsWeekendTemplate, RescheduleAction } from '@/services/adaptiveScheduler';

interface ParsedTask {
  title: string;
  originalInput: string;
  duration: number; // minutes
  priority: PriorityLevel;
  scheduleDate?: string;
  scheduleTime?: string;
  endTime?: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0.0 to 1.0
  suggestion?: string;
  error?: string;
  normalizedTitle: string;
  alternatives?: Array<{
    title: string;
    scheduleTime?: string;
    scheduleDate?: string;
    reason: string;
  }>;
  reasoning?: string;
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

// Comprehensive spelling correction dictionary
const SPELLING_CORRECTIONS: Record<string, string> = {
  // Movement & exercise
  'wlk': 'walk',
  'wlak': 'walk',
  'wark': 'walk',
  'wokrout': 'work out',
  'wrkout': 'work out',
  'wrk out': 'work out',
  'excersize': 'exercise',
  'exersize': 'exercise',
  'exercize': 'exercise',
  'joging': 'jogging',
  'runing': 'running',
  'yoga': 'yoga',
  'gym': 'gym',
  
  // Study & work
  'studt': 'study',
  'studdy': 'study',
  'stduy': 'study',
  'hw': 'homework',
  'assignmnt': 'assignment',
  'prject': 'project',
  'prsentation': 'presentation',
  
  // Daily tasks
  'jounal': 'journal',
  'journl': 'journal',
  'meditate': 'meditate',
  'meditation': 'meditation',
  'read': 'read',
  'red': 'read',
  'cooking': 'cooking',
  'cook': 'cook',
  'cleaning': 'cleaning',
  'clen': 'clean',
  
  // Meals
  'brekfast': 'breakfast',
  'brekfest': 'breakfast',
  'lunch': 'lunch',
  'lnch': 'lunch',
  'dinner': 'dinner',
  'din': 'dinner',
  'dinr': 'dinner',
  'dinnr': 'dinner',
  'diner': 'dinner',
  
  // Communication
  'emial': 'email',
  'emal': 'email',
  'msg': 'message',
  'txt': 'text',
  'cal': 'call',
  
  // Time shorthand
  'tmr': 'tomorrow',
  'tmrw': 'tomorrow',
  '2moro': 'tomorrow',
  '2mrw': 'tomorrow',
  '2day': 'today',
  '2nite': 'tonight',
  'tonite': 'tonight',
  
  // Common typos
  'tal=ke': 'talk',
  'tal': 'talk',
  'tal k': 'talk',
  'tlk': 'talk',
  'mettting': 'meeting',
  'meting': 'meeting',
  'metting': 'meeting',
  'appntmnt': 'appointment',
  'appt': 'appointment',
  
  // Health
  'drink': 'drink',
  'water': 'water',
  'meds': 'medication',
  'medication': 'medication',
  'doc': 'doctor',
  'dentist': 'dentist',
  
  // Erratic input patterns that should be rejected
  'asdf': '',
  'qwerty': '',
  'zxcv': '',
};

// Time-of-day expansions
const TIME_EXPANSION: Record<string, string> = {
  'eve': 'evening',
  'ev': 'evening',
  'morn': 'morning',
  'mrng': 'morning',
  'aft': 'afternoon',
  'aftn': 'afternoon',
  'nite': 'night',
  'nt': 'night',
};

// Spelling correction function
function correctSpelling(input: string): { corrected: string; wasCorrected: boolean } {
  let result = input.toLowerCase().trim();
  let wasCorrected = false;
  
  // First pass: replace known misspellings and abbreviations
  for (const [wrong, correct] of Object.entries(SPELLING_CORRECTIONS)) {
    if (!correct) continue; // Skip patterns that should be rejected
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    if (regex.test(result)) {
      result = result.replace(regex, correct);
      wasCorrected = true;
    }
  }
  
  // Second pass: expand time references
  for (const [short, full] of Object.entries(TIME_EXPANSION)) {
    const regex = new RegExp(`\\b${short}\\b`, 'gi');
    if (regex.test(result)) {
      result = result.replace(regex, full);
      wasCorrected = true;
    }
  }
  
  return { corrected: result, wasCorrected };
}

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

// Grammar normalization: convert fragments to full action phrases
// This ensures saved tasks are always clean and grammatically correct
function applyGrammarNormalization(title: string): string {
  let normalized = title.trim();
  
  // Patterns that need "the" added
  const needThePattern = /^\s*(walk|run|jog|exercise|workout|read|write|cook|clean|wash|feed|walk|feed|let\s+out)\s+(?:the\s+)?(dog|cat|pet|car|room|bike|morning|evening|night|day|food)\s*/i;
  
  // Add "the" where needed
  if (needThePattern.test(normalized)) {
    normalized = normalized.replace(needThePattern, (match, verb, noun) => {
      return `${verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase()} the ${noun.toLowerCase()} `;
    });
  }
  
  // Add "your" for personal care tasks
  if (/^journal\s*$/i.test(normalized)) {
    normalized = 'Write your journal';
  }
  if (/^meditat(?:e|ion)\s*$/i.test(normalized)) {
    normalized = 'Meditate';
  }
  if (/^pray\s*$/i.test(normalized)) {
    normalized = 'Pray';
  }
  
  // Convert to "Go for a..." pattern for activities
  const goForWalkPattern = /^(walk|run|jog|swim|stretch)\s*(?:the\s+)?/i;
  if (goForWalkPattern.test(normalized) && !normalized.toLowerCase().startsWith('go for')) {
    normalized = normalized.replace(goForWalkPattern, 'Go for a ');
  }
  
  // Convert exercise/workout to "Go to the gym" or "Do a workout"
  if (/^gym\s*$/i.test(normalized)) {
    normalized = 'Go to the gym';
  }
  if (/^workout\s*$/i.test(normalized) || /^exercise\s*$/i.test(normalized)) {
    normalized = 'Work out';
  }
  
  // Convert "walk dog" to "Walk the dog"
  if (/^walk\s+dog/i.test(normalized) && !/walk the dog/i.test(normalized)) {
    normalized = normalized.replace(/^walk\s+dog/i, 'Walk the dog');
  }
  
  // Ensure proper capitalization and spacing
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
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

// Infer priority from task content
// If user explicitly specifies priority, use that; otherwise infer from keywords
function inferPriority(input: string, existingPriority?: PriorityLevel): PriorityLevel {
  // If user already specified priority, respect it
  if (existingPriority && existingPriority !== 'medium') {
    return existingPriority;
  }
  
  const lower = input.toLowerCase();
  
  // CRITICAL priority keywords
  const criticalKeywords = [
    'urgent', 'important', 'critical', 'asap', 'emergency',
    'interview', 'doctor', 'dentist', 'medical', 'appointment',
    'deadline', 'flight', 'travel', 'trip',
    'meeting with', 'presentation', 'exam', 'final',
    'client', 'boss', 'manager', 'director',
    'pitch', 'negotiation', 'contract'
  ];
  
  // LOW priority keywords
  const lowKeywords = [
    'sometime', 'someday', 'eventually', 'whenever',
    'optional', 'maybe', 'if time', 'light', 'casual',
    'browse', 'watch', 'read', 'relax', 'chill',
    'cleanup', 'organize', 'sort', 'declutter'
  ];
  
  // Check for critical priority
  for (const keyword of criticalKeywords) {
    if (lower.includes(keyword)) {
      return 'critical';
    }
  }
  
  // Check for low priority
  for (const keyword of lowKeywords) {
    if (lower.includes(keyword)) {
      return 'low';
    }
  }
  
  // Default to medium
  return 'medium';
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

// Smart task parsing with optional personalization
function parseTaskInput(
  input: string,
  personalization?: {
    pattern?: PersonalizationPattern | null;
    preferredTimeWindow?: PreferredTimeWindow | null;
    preferredDuration?: PreferredDuration | null;
    adaptiveEnabled: boolean;
  }
): ParsedTask | null {
  const validation = validateInput(input);
  if (!validation.valid) {
    return {
      title: input.trim(),
      originalInput: input,
      duration: 30,
      priority: 'medium',
      confidence: 'low',
      confidenceScore: 0.0,
      error: validation.reason,
      normalizedTitle: '',
    };
  }
  
  // Step 1: Apply spelling correction FIRST
  const { corrected: correctedInput, wasCorrected } = correctSpelling(input);
  
  // If spelling correction resulted in empty string, reject
  if (!correctedInput || correctedInput.length === 0) {
    return {
      title: input.trim(),
      originalInput: input,
      duration: 30,
      priority: 'medium',
      confidence: 'low',
      confidenceScore: 0.0,
      error: "I couldn't understand that. Try rephrasing it.",
      normalizedTitle: '',
    };
  }
  
  let workingInput = correctedInput;
  let title = correctedInput.trim();
  let duration = 30; // default 30 minutes
  // Infer priority from input keywords
  let priority: PriorityLevel = inferPriority(input);
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
  
  // Normalize the title for display and apply grammar normalization
  // Grammar normalization ensures saved tasks are always clean and grammatically correct
  let normalizedTitle = normalizeTitle(title);
  normalizedTitle = applyGrammarNormalization(normalizedTitle);
  
  // Track if spelling was corrected - this should BOOST confidence, not lower it
  // If we had to correct spelling, it means the intent was understood
  const spellingCorrection = correctSpelling(input);
  const wasSpellingCorrected = spellingCorrection.wasCorrected;
  
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
  
  // Calculate numeric confidence score (0.0 to 1.0)
  // STRICTER: Only allow high confidence when task is well understood
  let confidenceScore = 0.3; // Start lower
  const titleLength = normalizedTitle.length;
  const hasTime = !!scheduleTime;
  const hasDate = !!scheduleDate;
  const hasDuration = duration > 0 && duration !== 30;
  
  // Base score from title clarity - require meaningful length
  if (titleLength >= 4) confidenceScore += 0.15;
  if (titleLength >= 8) confidenceScore += 0.15;
  if (titleLength >= 12) confidenceScore += 0.1;
  
  // Boost for having time/date info (required for high confidence)
  if (hasTime) confidenceScore += 0.3;
  if (hasDate) confidenceScore += 0.15;
  
  // SPELLING CORRECTION BOOST: If we corrected spelling, it means intent was clear
  // This should BOOST confidence, not penalize
  if (wasSpellingCorrected) {
    confidenceScore += 0.15;
  }
  
  // PERSONALIZATION: Apply learned pattern boost
  const personaliztion = personalization?.adaptiveEnabled ? personalization : undefined;
  if (personaliztion?.pattern?.confidence_boost) {
    confidenceScore += personaliztion.pattern.confidence_boost;
  }
  
  // Use personalized time if available and no explicit time was given
  if (personaliztion?.pattern?.preferred_time && !scheduleTime) {
    scheduleTime = personaliztion.pattern.preferred_time;
    // Recalculate end time
    if (scheduleTime && duration) {
      const [startHour, startMin] = scheduleTime.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMin + duration;
      const endHour = Math.floor(totalMinutes / 60) % 24;
      const endMin = totalMinutes % 60;
      endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }
  }
  
  // Use personalized title if available
  if (personaliztion?.pattern?.normalized_title && personaliztion.pattern.normalized_title !== normalizedTitle) {
    // User has accepted this interpretation before - use their preferred wording
    // But only if they haven't specified explicit time/day that would override
  }
  
  // Use personalized duration if available and no explicit duration was given
  if (personaliztion?.preferredDuration?.average_duration && duration === 30) {
    duration = personaliztion.preferredDuration.average_duration;
    if (scheduleTime) {
      const [startHour, startMin] = scheduleTime.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMin + duration;
      const endHour = Math.floor(totalMinutes / 60) % 24;
      const endMin = totalMinutes % 60;
      endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }
  }
  
  // Apply personalized time window if we have one and no explicit time
  if (personaliztion?.preferredTimeWindow?.preferred_time && !scheduleTime && personaliztion.preferredTimeWindow.occurrence_count >= 2) {
    scheduleTime = personaliztion.preferredTimeWindow.preferred_time;
    if (scheduleTime && duration) {
      const [startHour, startMin] = scheduleTime.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMin + duration;
      const endHour = Math.floor(totalMinutes / 60) % 24;
      const endMin = totalMinutes % 60;
      endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }
  }
  
  // Penalize short or unclear inputs
  if (titleLength < 4) confidenceScore -= 0.2;
  if (input.length < 6) confidenceScore -= 0.15; // Too short raw input
  
  // Check for remaining ambiguity
  const lowerInput = input.toLowerCase();
  const ambiguousPatterns = ['eve', 'morn', 'aft', 'night', 'day'];
  const hasAmbiguity = ambiguousPatterns.some(p => 
    lowerInput.includes(p) && 
    !lowerInput.includes('morning') && 
    !lowerInput.includes('evening') &&
    !lowerInput.includes('afternoon')
  );
  if (hasAmbiguity) confidenceScore -= 0.25;
  
  // Cap the score
  confidenceScore = Math.min(1.0, Math.max(0.0, confidenceScore));
  
  // OVERRIDE: If spelling was corrected and we have a valid title, allow save
  // Don't reject messy input if the intent is clear
  if (wasSpellingCorrected && normalizedTitle.length >= 4) {
    if (confidence === 'low') {
      confidence = 'medium';
    }
  }
  
  // STRICTER thresholds: Require time for high confidence
  if (confidenceScore >= 0.80 && hasTime && titleLength >= 5) {
    confidence = 'high';
  } else if (confidenceScore >= 0.65) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  // Generate alternatives for medium confidence
  let alternatives: ParsedTask['alternatives'];
  if (confidence === 'medium' && !hasTime) {
    alternatives = [
      { title: normalizedTitle, scheduleTime: '09:00', scheduleDate: scheduleDate, reason: 'Morning' },
      { title: normalizedTitle, scheduleTime: '14:00', scheduleDate: scheduleDate, reason: 'Afternoon' },
      { title: normalizedTitle, scheduleTime: '18:00', scheduleDate: scheduleDate, reason: 'Evening' },
    ];
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
    confidenceScore,
    suggestion,
    error,
    normalizedTitle,
    alternatives,
    reasoning: `Score: ${confidenceScore.toFixed(2)} - Title: ${titleLength} chars, HasTime: ${hasTime}, HasDate: ${hasDate}`,
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
  const [pendingActions, setPendingActions] = useState<RescheduleAction[]>([]);
  const [showReschedulePreview, setShowReschedulePreview] = useState(false);
  const [personalization, setPersonalization] = useState<{
    pattern: PersonalizationPattern | null;
    preferredTimeWindow: PreferredTimeWindow | null;
    preferredDuration: PreferredDuration | null;
    adaptiveEnabled: boolean;
  } | null>(null);
  const { schedules, selectedDate, tasks, saveSchedule, addTask, addBlockToSchedule, templates, updateBlock } = useScheduleStore();
  
  // Fetch personalization data on mount
  useEffect(() => {
    const fetchPersonalization = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      try {
        const response = await fetch('/api/personalization');
        if (response.ok) {
          const data = await response.json();
          setPersonalization({
            pattern: data.pattern || null,
            preferredTimeWindow: data.preferredTimeWindow || null,
            preferredDuration: data.preferredDuration || null,
            adaptiveEnabled: data.adaptiveEnabled ?? true
          });
        }
      } catch (error) {
        console.error('Failed to fetch personalization:', error);
      }
    };
    
    fetchPersonalization();
  }, []);
  
  // Get current schedule blocks
  const currentBlocks = useMemo(() => {
    const schedule = schedules[selectedDate];
    return schedule?.blocks || [];
  }, [schedules, selectedDate]);
  
  // Parse input in real-time
  useEffect(() => {
    if (prompt.trim()) {
      const parsed = parseTaskInput(prompt, personalization ?? undefined);
      setParsedTask(parsed);
      setShowPreview(!!parsed && parsed.confidence !== 'low');
    } else {
      setParsedTask(null);
      setShowPreview(false);
    }
  }, [prompt, personalization]);
  
  // Check for schedule conflicts
  const conflictCheck = useMemo(() => {
    if (!parsedTask || !showPreview) return null;
    return checkScheduleConflict(parsedTask, currentBlocks);
  }, [parsedTask, currentBlocks, showPreview]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !parsedTask) return;
    
    // STRICT: Only allow high confidence to save
    // Medium and low confidence require user to add more details or time
    if (parsedTask.confidence !== 'high') {
      return; // Block save - show inline guidance
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
      
      // Use adaptive scheduling with priority-based rescheduling
      if (parsedTask.scheduleDate && parsedTask.scheduleTime) {
        const scheduleDate = parsedTask.scheduleDate || selectedDate;
        const currentSchedule = schedules[scheduleDate] || { date: scheduleDate, blocks: [] };
        
        // Use adaptive scheduler to find best slot and handle rescheduling
        const schedulingResult = await scheduleWithPriority(
          currentSchedule,
          parsedTask.title,
          parsedTask.duration,
          parsedTask.priority,
          scheduleDate,
          parsedTask.scheduleTime
        );
        
        // Apply the scheduling result
        await addBlockToSchedule(schedulingResult.scheduleDate, {
          id: crypto.randomUUID(),
          title: parsedTask.title,
          startTime: schedulingResult.scheduleTime,
          endTime: schedulingResult.endTime,
          type: 'flexible',
          status: 'pending',
          taskId: newTask.id,
        });
        
        // Update the scheduled time in result
        parsedTask.scheduleDate = schedulingResult.scheduleDate;
        parsedTask.scheduleTime = schedulingResult.scheduleTime;
        parsedTask.endTime = schedulingResult.endTime;
        
        // Store pending actions for preview if there are rescheduling actions
        if (schedulingResult.actions.length > 0) {
          setPendingActions(schedulingResult.actions);
          setShowReschedulePreview(true);
          return; // Wait for user confirmation
        }
        
        // Show post-change feedback for simple scheduling
        if (schedulingResult.explanation) {
          toast.info(schedulingResult.explanation, { duration: 5000 });
        }
      } else if (parsedTask.scheduleDate || parsedTask.scheduleTime) {
        // Handle partial scheduling info with adaptive scheduling
        const scheduleDate = parsedTask.scheduleDate || selectedDate;
        const currentSchedule = schedules[scheduleDate] || { date: scheduleDate, blocks: [] };
        
        const schedulingResult = await scheduleWithPriority(
          currentSchedule,
          parsedTask.title,
          parsedTask.duration,
          parsedTask.priority,
          scheduleDate,
          parsedTask.scheduleTime
        );
        
        await addBlockToSchedule(schedulingResult.scheduleDate, {
          id: crypto.randomUUID(),
          title: parsedTask.title,
          startTime: schedulingResult.scheduleTime,
          endTime: schedulingResult.endTime,
          type: 'flexible',
          status: 'pending',
          taskId: newTask.id,
        });
        
        parsedTask.scheduleDate = schedulingResult.scheduleDate;
        parsedTask.scheduleTime = schedulingResult.scheduleTime;
        parsedTask.endTime = schedulingResult.endTime;
        
        // Store pending actions for preview if there are rescheduling actions
        if (schedulingResult.actions.length > 0) {
          setPendingActions(schedulingResult.actions);
          setShowReschedulePreview(true);
          return; // Wait for user confirmation
        }
        
        // Show post-change feedback for simple scheduling
        if (schedulingResult.explanation) {
          toast.info(schedulingResult.explanation, { duration: 5000 });
        }
      }
      
      // Build success message
      const timeStr = parsedTask.scheduleTime ? ` at ${formatTimeDisplay(parsedTask.scheduleTime)}` : '';
      const dateStr = parsedTask.scheduleDate ? ` on ${getDateDisplay(parsedTask.scheduleDate)}` : '';
      
      // Show toast with undo
      toast.success(`Added: ${parsedTask.title}${timeStr}${dateStr}`, {
        duration: 4000,
      });
      
      // RECORD PERSONALIZATION: Learn from accepted task
      if (personalization?.adaptiveEnabled && parsedTask) {
        try {
          await personalizationService.recordAcceptance(
            prompt.trim(), // raw input
            parsedTask.title, // normalized title
            parsedTask.scheduleTime, // time used
            parsedTask.duration.toString() // duration used
          );
          
          // Update personalization state after recording
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const response = await fetch('/api/personalization');
            if (response.ok) {
              const data = await response.json();
              setPersonalization({
                pattern: data.pattern || null,
                preferredTimeWindow: data.preferredTimeWindow || null,
                preferredDuration: data.preferredDuration || null,
                adaptiveEnabled: data.adaptiveEnabled ?? true
              });
            }
          }
        } catch (error) {
          console.error('Failed to record personalization:', error);
        }
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
  
  // Helper function to apply rescheduling actions and update blocks with reschedule reasons
  const applyReschedulingActions = async (
    actions: RescheduleAction[],
    schedules: Record<string, any>,
    selectedDate: string,
    addBlockToSchedule: (date: string, block: any) => Promise<void>,
    updateBlock: (date: string, blockId: string, updates: any) => Promise<void>
  ) => {
    for (const action of actions) {
      if (action.type === 'shift' && action.blockId && action.fromTime && action.toTime) {
        // Update the existing block with new time and reason
        await updateBlock(selectedDate, action.blockId, {
          startTime: action.toTime,
          rescheduledFrom: action.fromTime,
          rescheduleReason: action.reason
        });
      } else if (action.type === 'shorten' && action.blockId && action.newDuration) {
        // Calculate new end time based on original start time and new duration
        const schedule = schedules[selectedDate];
        const block = schedule?.blocks.find((b: any) => b.id === action.blockId);
        if (block) {
          const [h, m] = block.startTime.split(':').map(Number);
          const totalMins = h * 60 + m + action.newDuration;
          const newEndH = Math.floor(totalMins / 60) % 24;
          const newEndM = totalMins % 60;
          const newEndTime = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;
          
          await updateBlock(selectedDate, action.blockId, {
            endTime: newEndTime,
            rescheduleReason: action.reason
          });
        }
      } else if (action.type === 'defer' || action.type === 'move_to_weekend') {
        // Handle defer to different date - add to that date
        if (action.toDate && action.blockId) {
          const schedule = schedules[selectedDate];
          const block = schedule?.blocks.find((b: any) => b.id === action.blockId);
          if (block) {
            // Move to new date
            await addBlockToSchedule(action.toDate, {
              ...block,
              originalDate: selectedDate,
              rescheduleReason: action.reason
            });
          }
        }
      }
    }
  };
  
  // STRICT: Only high confidence allows submission
  const canSubmit = parsedTask && 
                    parsedTask.confidence === 'high' && 
                    !parsedTask.error && 
                    !conflictCheck?.hasConflict;
  
  // Handle confirmation of rescheduling changes
  const handleConfirmReschedule = async () => {
    if (!pendingActions.length || !parsedTask) return;
    
    setLoading(true);
    try {
      // Apply rescheduling actions with reasons to affected blocks
      await applyReschedulingActions(pendingActions, schedules, selectedDate, addBlockToSchedule, updateBlock);
      
      // Show post-change feedback
      toast.info("Schedule updated. Tap any changed task to see why.", { 
        duration: 4000,
        id: 'reschedule-feedback'
      });
      
      // Build success message
      const scheduleDate = parsedTask.scheduleDate || selectedDate;
      const currentSchedule = schedules[scheduleDate] || { date: scheduleDate, blocks: [] };
      
      const schedulingResult = await scheduleWithPriority(
        currentSchedule,
        parsedTask.title,
        parsedTask.duration,
        parsedTask.priority,
        scheduleDate,
        parsedTask.scheduleTime
      );
      
      // Add the new block
      await addBlockToSchedule(schedulingResult.scheduleDate, {
        id: crypto.randomUUID(),
        title: parsedTask.title,
        startTime: schedulingResult.scheduleTime,
        endTime: schedulingResult.endTime,
        type: 'flexible',
        status: 'pending',
      });
      
      // Show success toast
      const timeStr = schedulingResult.scheduleTime ? ` at ${formatTimeDisplay(schedulingResult.scheduleTime)}` : '';
      const dateStr = schedulingResult.scheduleDate !== selectedDate ? ` on ${getDateDisplay(schedulingResult.scheduleDate)}` : '';
      toast.success(`Added: ${parsedTask.title}${timeStr}${dateStr}`, {
        duration: 4000,
      });
      
      // Clear inputs and state
      setPrompt('');
      setParsedTask(null);
      setShowPreview(false);
      setPendingActions([]);
      setShowReschedulePreview(false);
    } catch (err) {
      console.error('Reschedule confirmation error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle cancel of rescheduling changes
  const handleCancelReschedule = () => {
    setPendingActions([]);
    setShowReschedulePreview(false);
    setPrompt('');
    setParsedTask(null);
    setShowPreview(false);
  };
  
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
          {/* Did you mean preview */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-xl border transition-colors shadow-sm",
            parsedTask.confidence === 'high'
              ? "bg-emerald-500/8 border-emerald-500/20"
              : parsedTask.confidence === 'medium'
              ? "bg-amber-500/8 border-amber-500/20"
              : "bg-muted/50 border-border/50"
          )}>
            {parsedTask.confidence === 'high' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            ) : parsedTask.confidence === 'medium' ? (
              <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              {/* Did you mean header */}
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {parsedTask.confidence === 'high' ? 'Adding:' : 'Did you mean:'}
                </p>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  parsedTask.confidenceScore >= 0.85 ? "bg-emerald-500/15 text-emerald-600" :
                  parsedTask.confidenceScore >= 0.60 ? "bg-amber-500/15 text-amber-600" :
                  "bg-muted text-muted-foreground"
                )}>
                  {Math.round(parsedTask.confidenceScore * 100)}% confident
                </span>
              </div>
              
              {/* Parsed title */}
              <p className="font-semibold text-foreground">
                {parsedTask.title}
              </p>
              
              {/* Personalized indicator */}
              {personalization?.adaptiveEnabled && personalization?.pattern && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 mt-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Learned from your patterns</span>
                </div>
              )}
              
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
                  {parsedTask.suggestion}
                </p>
              )}
              
              {/* Conflict warning */}
              {conflictCheck?.hasConflict && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  {conflictCheck.message}
                </p>
              )}
            </div>
          </div>
          
          {/* Alternatives for medium confidence */}
          {parsedTask.confidence === 'medium' && parsedTask.alternatives && parsedTask.alternatives.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground px-1">Or choose a time:</p>
              <div className="flex flex-wrap gap-2">
                {parsedTask.alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(`${alt.title} at ${alt.scheduleTime}`);
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-muted/60 hover:bg-muted rounded-lg border border-border/30 hover:border-primary/30 transition-all"
                  >
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {formatTimeDisplay(alt.scheduleTime || '')}
                    <span className="text-muted-foreground/60">- {alt.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Quick suggestions for medium confidence without time */}
          {parsedTask.confidence === 'medium' && !parsedTask.scheduleTime && !parsedTask.alternatives && (
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
      
      {/* Reschedule Preview - shows affected tasks before applying */}
      {showReschedulePreview && pendingActions.length > 0 && (
        <ReschedulePreview
          changes={pendingActions.map(action => ({
            taskTitle: action.blockTitle || 'Task',
            action: action.type as 'move' | 'shift' | 'shorten',
            from: action.fromTime,
            to: action.toTime,
            reason: action.reason
          }))}
          onConfirm={handleConfirmReschedule}
          onCancel={handleCancelReschedule}
          className="mt-3"
        />
      )}
      
      <p className="text-[10px] text-muted-foreground/40 font-medium mt-2 px-1">
        Type naturally • I'll understand shorthand • Press Enter to add
      </p>
    </div>
  );
}
