import { createClient } from '@/utils/supabase/client';
import { DaySchedule, Task, TimeBlock } from '@/types';

const supabase = createClient();

export const supabaseService = {
  // Profiles
  async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return data;
  },

  // Tasks
  async getTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async getArchivedTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .order('deleted_at', { ascending: false });
    return data || [];
  },

  async createTask(task: Partial<Task>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...task, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTask(id: string, updates: Partial<Task>) {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async archiveTask(id: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_archived: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // Schedules
  async getDaySchedule(date: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: schedule } = await supabase
      .from('day_schedules')
      .select('*, day_blocks(*)')
      .eq('user_id', user.id)
      .eq('date', date)
      .single();
    return schedule;
  },

  async saveDaySchedule(date: string, blocks: any[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Ensure day_schedule exists
    const { data: schedule, error: sError } = await supabase
      .from('day_schedules')
      .upsert({ user_id: user.id, date }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (sError) throw sError;

    // 2. Delete existing blocks
    await supabase.from('day_blocks').delete().eq('day_schedule_id', schedule.id);

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
    if (bError) throw bError;
    
    return schedule;
  },

  async getTemplates() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('schedule_templates')
      .select('*, template_blocks(*)')
      .eq('user_id', user.id);
    return data || [];
  }
};
