import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get personalization settings
    const { data: settings } = await supabase
      .from('user_personalization')
      .select('adaptive_learning_enabled')
      .eq('user_id', user.id)
      .single();

    // Get learned patterns
    const { data: patterns } = await supabase
      .from('task_patterns')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen', { ascending: false });

    // Get preferred time windows
    const { data: timeWindows } = await supabase
      .from('preferred_time_windows')
      .select('*')
      .eq('user_id', user.id)
      .order('occurrence_count', { ascending: false });

    // Get preferred durations
    const { data: durations } = await supabase
      .from('preferred_durations')
      .select('*')
      .eq('user_id', user.id)
      .order('sample_count', { ascending: false });

    return NextResponse.json({
      settings: settings ? { adaptive_learning_enabled: settings.adaptive_learning_enabled } : { adaptive_learning_enabled: true },
      patterns: patterns || [],
      time_windows: timeWindows || [],
      durations: durations || [],
    });
  } catch (error: any) {
    console.error('Personalization GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { adaptive_learning_enabled } = body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_personalization')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      await supabase
        .from('user_personalization')
        .update({ 
          adaptive_learning_enabled, 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_personalization')
        .insert({ 
          user_id: user.id, 
          adaptive_learning_enabled 
        });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Personalization PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all personalization data
    await supabase.from('task_patterns').delete().eq('user_id', user.id);
    await supabase.from('preferred_time_windows').delete().eq('user_id', user.id);
    await supabase.from('preferred_durations').delete().eq('user_id', user.id);
    await supabase.from('learning_events').delete().eq('user_id', user.id);

    // Reset settings to default
    await supabase
      .from('user_personalization')
      .update({ 
        adaptive_learning_enabled: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message: 'Personalization data reset' });
  } catch (error: any) {
    console.error('Personalization DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}