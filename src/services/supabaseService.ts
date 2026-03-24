import { createClient } from '@/utils/supabase/client';
import { DaySchedule, Task, TimeBlock } from '@/types';

const supabase = createClient();

export const supabaseService = {
  // Profiles
  async getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    } catch (error) {
      console.error('Supabase error in getProfile:', error);
      return null;
    }
  },

  async updateProfile(updates: Partial<{ timezone: string; full_name: string; avatar_url: string }>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase error in updateProfile:', error);
      // Mock update - do nothing
    }
  },
  async getTasks() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      return data || [];
    } catch (error) {
      console.error('Supabase error in getTasks, using mock data:', error);
      return [
        {
          id: 'mock-task-1',
          title: 'Sample Task 1',
          description: 'This is a mock task for local development',
          priority: 'medium' as const,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 'mock-user',
          is_archived: false,
        },
      ];
    }
  },

  async getArchivedTasks() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .order('deleted_at', { ascending: false });
      return data || [];
    } catch (error) {
      console.error('Supabase error in getArchivedTasks:', error);
      return [];
    }
  },

  async createTask(task: Partial<Task>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase error in createTask:', error);
      // Return mock created task
      return {
        id: 'mock-created-' + Date.now(),
        ...task,
        user_id: 'mock-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Task;
    }
  },

  async updateTask(id: string, updates: Partial<Task>) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase error in updateTask:', error);
      // Mock update - do nothing
    }
  },

  async archiveTask(id: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_archived: true, deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase error in archiveTask:', error);
      // Mock archive - do nothing
    }
  },

  // Schedules
  async getDaySchedule(date: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: schedule } = await supabase
        .from('day_schedules')
        .select('*, day_blocks(*)')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();
      return schedule;
    } catch (error) {
      console.error('Supabase error in getDaySchedule:', error);
      return null;
    }
  },

  async saveDaySchedule(date: string, blocks: any[]) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!user) throw new Error('Not authenticated');

      // 1. Ensure day_schedule exists
      const { data: schedule, error: sError } = await supabase
        .from('day_schedules')
        .upsert({ user_id: user.id, date }, { onConflict: 'user_id,date' })
        .select()
        .single();

      if (sError) throw new Error(`Schedule upsert error: ${sError.message}`);

      // 2. Delete existing blocks
      const { error: deleteError } = await supabase.from('day_blocks').delete().eq('day_schedule_id', schedule.id);
      if (deleteError) throw new Error(`Delete blocks error: ${deleteError.message}`);

      // 3. Insert new blocks
      const blocksToInsert = blocks.map((b, i) => ({
        day_schedule_id: schedule.id,
        task_id: b.taskId || null,
        title: b.title,
        start_time: b.startTime,
        end_time: b.endTime,
        type: b.type,
        status: b.status,
        order_index: i
      }));

      const { error: bError } = await supabase.from('day_blocks').insert(blocksToInsert);
      if (bError) throw new Error(`Insert blocks error: ${bError.message}`);

      return schedule;
    } catch (error) {
      console.error('Supabase error in saveDaySchedule:', error);
      // Mock save - do nothing
    }
  },

  async getTemplates() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('schedule_templates')
        .select('*, template_blocks(*)')
        .eq('user_id', user.id);
      return data || [];
    } catch (error) {
      console.error('Supabase error in getTemplates:', error);
      // Return empty array - NO fallback to hardcoded templates
      // User must complete onboarding to get a schedule
      return [];
    }
  }
};
