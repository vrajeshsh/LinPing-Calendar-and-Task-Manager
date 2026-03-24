import { createClient } from '@/utils/supabase/client';

export interface PersonalizationPattern {
  id: string;
  raw_input: string;
  normalized_title: string;
  preferred_time_window: string | null;
  preferred_time: string | null;
  average_duration: number | null;
  acceptance_count: number;
  rejection_count: number;
  confidence_boost: number;
}

export interface PreferredTimeWindow {
  task_category: string;
  preferred_day_part: string;
  preferred_time: string | null;
  occurrence_count: number;
}

export interface PreferredDuration {
  task_title_pattern: string;
  average_duration: number;
  sample_count: number;
}

export interface PersonalizationSettings {
  adaptive_learning_enabled: boolean;
}

const supabase = createClient();

// Minimum confirmations needed before applying personalization
const MIN_CONFIRMATIONS_THRESHOLD = 2;

// Calculate confidence boost based on acceptance ratio and count
function calculateConfidenceBoost(acceptanceCount: number, rejectionCount: number): number {
  const total = acceptanceCount + rejectionCount;
  if (total < MIN_CONFIRMATIONS_THRESHOLD) return 0;
  
  const acceptanceRatio = acceptanceCount / total;
  // Max boost of 0.25 for highly confirmed patterns
  return Math.min(0.25, (acceptanceRatio - 0.5) * 0.5 + (total / 20));
}

export const personalizationService = {
  // Get personalization settings
  async getSettings(): Promise<PersonalizationSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('user_personalization')
        .select('adaptive_learning_enabled')
        .eq('user_id', user.id)
        .single();

      return data ? { adaptive_learning_enabled: data.adaptive_learning_enabled } : { adaptive_learning_enabled: true };
    } catch (error) {
      console.error('Error fetching personalization settings:', error);
      return { adaptive_learning_enabled: true };
    }
  },

  // Update personalization settings
  async updateSettings(updates: Partial<PersonalizationSettings>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_personalization')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('user_personalization')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_personalization')
          .insert({ user_id: user.id, ...updates });
      }
    } catch (error) {
      console.error('Error updating personalization settings:', error);
    }
  },

  // Get learned pattern for specific input
  async getPattern(rawInput: string): Promise<PersonalizationPattern | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Normalize input for lookup
      const normalizedInput = rawInput.toLowerCase().trim();

      const { data } = await supabase
        .from('task_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('raw_input', normalizedInput)
        .single();

      if (data) {
        return {
          ...data,
          confidence_boost: calculateConfidenceBoost(data.acceptance_count, data.rejection_count),
        };
      }
      return null;
    } catch (error) {
      // No pattern found - this is fine
      return null;
    }
  },

  // Get all learned patterns (for debugging/analysis)
  async getAllPatterns(): Promise<PersonalizationPattern[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('task_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('last_seen', { ascending: false });

      return (data || []).map(p => ({
        ...p,
        confidence_boost: calculateConfidenceBoost(p.acceptance_count, p.rejection_count),
      }));
    } catch (error) {
      console.error('Error fetching patterns:', error);
      return [];
    }
  },

  // Record an accepted interpretation (user confirmed AI suggestion)
  async recordAcceptance(
    rawInput: string,
    normalizedTitle: string,
    scheduleTime?: string,
    scheduleDate?: string,
    duration?: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const normalizedInput = rawInput.toLowerCase().trim();
      
      // Determine time window
      let timeWindow: string | null = null;
      if (scheduleTime) {
        timeWindow = getTimeWindow(scheduleTime);
      }

      // Check if pattern already exists
      const { data: existing } = await supabase
        .from('task_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('raw_input', normalizedInput)
        .single();

      if (existing) {
        // Update existing pattern
        const newAcceptCount = existing.acceptance_count + 1;
        const newAvgDuration = existing.average_duration 
          ? Math.round((existing.average_duration * (newAcceptCount - 1) + (duration || 30)) / newAcceptCount)
          : duration || 30;

        await supabase
          .from('task_patterns')
          .update({
            normalized_title: normalizedTitle,
            preferred_time: scheduleTime || existing.preferred_time,
            preferred_time_window: timeWindow || existing.preferred_time_window,
            average_duration: newAvgDuration,
            acceptance_count: newAcceptCount,
            last_seen: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new pattern
        await supabase
          .from('task_patterns')
          .insert({
            user_id: user.id,
            raw_input: normalizedInput,
            normalized_title: normalizedTitle,
            preferred_time: scheduleTime,
            preferred_time_window: timeWindow,
            average_duration: duration || 30,
            acceptance_count: 1,
            rejection_count: 0,
          });
      }

      // Also update preferred time windows if we have a category
      if (scheduleTime) {
        await this.updatePreferredTimeWindow(normalizedTitle, scheduleTime);
      }

      // Log learning event
      await this.logLearningEvent('accepted', rawInput, normalizedTitle, normalizedTitle);
    } catch (error) {
      console.error('Error recording acceptance:', error);
    }
  },

  // Record a rejection (user rejected AI suggestion)
  async recordRejection(
    rawInput: string,
    aiSuggestion: string,
    userAction?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const normalizedInput = rawInput.toLowerCase().trim();

      // Check if pattern exists
      const { data: existing } = await supabase
        .from('task_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('raw_input', normalizedInput)
        .single();

      if (existing) {
        await supabase
          .from('task_patterns')
          .update({
            rejection_count: existing.rejection_count + 1,
            last_seen: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }

      // Log learning event
      await this.logLearningEvent('rejected', rawInput, aiSuggestion, userAction || 'rejected');
    } catch (error) {
      console.error('Error recording rejection:', error);
    }
  },

  // Record when user edits AI suggestion before saving
  async recordEdit(
    rawInput: string,
    aiSuggestion: string,
    userFinalInput: string
  ): Promise<void> {
    try {
      await this.logLearningEvent('edited', rawInput, aiSuggestion, userFinalInput);
    } catch (error) {
      console.error('Error recording edit:', error);
    }
  },

  // Record when user reschedules a task
  async recordReschedule(
    taskTitle: string,
    originalTime: string,
    newTime: string
  ): Promise<void> {
    try {
      await this.logLearningEvent('rescheduled', taskTitle, originalTime, newTime);
      
      // Update preferred time window based on new choice
      await this.updatePreferredTimeWindow(taskTitle, newTime);
    } catch (error) {
      console.error('Error recording reschedule:', error);
    }
  },

  // Update preferred time window for a task category
  async updatePreferredTimeWindow(taskTitle: string, scheduleTime: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const category = categorizeTask(taskTitle);
      const dayPart = getTimeWindow(scheduleTime);

      const { data: existing } = await supabase
        .from('preferred_time_windows')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_category', category)
        .single();

      if (existing) {
        await supabase
          .from('preferred_time_windows')
          .update({
            preferred_day_part: dayPart,
            preferred_time: scheduleTime,
            occurrence_count: existing.occurrence_count + 1,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('preferred_time_windows')
          .insert({
            user_id: user.id,
            task_category: category,
            preferred_day_part: dayPart,
            preferred_time: scheduleTime,
            occurrence_count: 1,
          });
      }
    } catch (error) {
      console.error('Error updating preferred time window:', error);
    }
  },

  // Get preferred time window for a task category
  async getPreferredTimeWindow(taskTitle: string): Promise<PreferredTimeWindow | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const category = categorizeTask(taskTitle);

      const { data } = await supabase
        .from('preferred_time_windows')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_category', category)
        .single();

      return data ? {
        task_category: data.task_category,
        preferred_day_part: data.preferred_day_part,
        preferred_time: data.preferred_time,
        occurrence_count: data.occurrence_count,
      } : null;
    } catch (error) {
      return null;
    }
  },

  // Update preferred duration for a task pattern
  async updatePreferredDuration(taskTitle: string, duration: number): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create a pattern key from the title
      const patternKey = createDurationPattern(taskTitle);

      const { data: existing } = await supabase
        .from('preferred_durations')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_title_pattern', patternKey)
        .single();

      if (existing) {
        const newCount = existing.sample_count + 1;
        const newAvg = Math.round((existing.average_duration * (newCount - 1) + duration) / newCount);
        
        await supabase
          .from('preferred_durations')
          .update({
            average_duration: newAvg,
            sample_count: newCount,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('preferred_durations')
          .insert({
            user_id: user.id,
            task_title_pattern: patternKey,
            average_duration: duration,
            sample_count: 1,
          });
      }
    } catch (error) {
      console.error('Error updating preferred duration:', error);
    }
  },

  // Get preferred duration for a task
  async getPreferredDuration(taskTitle: string): Promise<PreferredDuration | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const patternKey = createDurationPattern(taskTitle);

      const { data } = await supabase
        .from('preferred_durations')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_title_pattern', patternKey)
        .single();

      return data ? {
        task_title_pattern: data.task_title_pattern,
        average_duration: data.average_duration,
        sample_count: data.sample_count,
      } : null;
    } catch (error) {
      return null;
    }
  },

  // Log a learning event
  async logLearningEvent(
    eventType: string,
    rawInput?: string,
    aiSuggestion?: string,
    userAction?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('learning_events')
        .insert({
          user_id: user.id,
          event_type: eventType,
          raw_input: rawInput,
          ai_suggestion: aiSuggestion,
          user_action: userAction,
        });
    } catch (error) {
      console.error('Error logging learning event:', error);
    }
  },

  // Reset all personalization data for the user
  async resetPersonalization(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all personalization data
      await supabase.from('task_patterns').delete().eq('user_id', user.id);
      await supabase.from('preferred_time_windows').delete().eq('user_id', user.id);
      await supabase.from('preferred_durations').delete().eq('user_id', user.id);
      await supabase.from('learning_events').delete().eq('user_id', user.id);
      
      // Reset settings
      await supabase
        .from('user_personalization')
        .update({ adaptive_learning_enabled: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error resetting personalization:', error);
    }
  },
};

// Helper: Categorize task into a category for time window tracking
function categorizeTask(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes('walk') || lower.includes('run') || lower.includes('jog') || lower.includes('exercise') || lower.includes('gym') || lower.includes('workout') || lower.includes('yoga')) {
    return 'exercise';
  }
  if (lower.includes('study') || lower.includes('homework') || lower.includes('read') || lower.includes('learn')) {
    return 'study';
  }
  if (lower.includes('journal') || lower.includes('meditat') || lower.includes('reflect') || lower.includes('mindful')) {
    return 'self_care';
  }
  if (lower.includes('meal') || lower.includes('eat') || lower.includes('cook') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('breakfast')) {
    return 'meals';
  }
  if (lower.includes('work') || lower.includes('meeting') || lower.includes('call') || lower.includes('email')) {
    return 'work';
  }
  if (lower.includes('shop') || lower.includes('errand') || lower.includes('grocer')) {
    return 'errands';
  }
  
  return 'general';
}

// Helper: Get time window from schedule time
function getTimeWindow(time: string): string {
  const [hours] = time.split(':').map(Number);
  
  if (hours >= 5 && hours < 12) return 'morning';
  if (hours >= 12 && hours < 14) return 'midday';
  if (hours >= 14 && hours < 17) return 'afternoon';
  if (hours >= 17 && hours < 20) return 'evening';
  if (hours >= 20 && hours < 22) return 'after_dinner';
  return 'night';
}

// Helper: Create a pattern key for duration tracking
function createDurationPattern(title: string): string {
  // Simplify title to a pattern
  const words = title.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  // Take first 2-3 significant words
  return words.slice(0, 3).join('_');
}

export default personalizationService;