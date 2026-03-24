import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TimeBlock } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { blocks }: { blocks: TimeBlock[] } = await request.json();

    if (!blocks || !Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Invalid blocks data' }, { status: 400 });
    }

    // 1. Create default template
    const { data: template, error: tError } = await supabase
      .from('schedule_templates')
      .insert({
        user_id: user.id,
        name: 'My Daily Rhythm',
        is_default: true,
      })
      .select()
      .single();

    if (tError) {
      console.error('Template creation error:', tError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // 2. Create template blocks
    const templateBlocks = blocks.map((block, index) => ({
      template_id: template.id,
      title: block.title,
      start_time: block.startTime,
      end_time: block.endTime,
      type: block.type,
      order_index: index,
    }));

    const { error: bError } = await supabase
      .from('template_blocks')
      .insert(templateBlocks);

    if (bError) {
      console.error('Blocks creation error:', bError);
      return NextResponse.json({ error: 'Failed to create template blocks' }, { status: 500 });
    }

    // 3. Mark as onboarded
    const { error: pError } = await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', user.id);

    if (pError) {
      console.error('Profile update error:', pError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}