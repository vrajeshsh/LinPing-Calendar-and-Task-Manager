import { NextResponse } from 'next/server';
import { DaySchedule, Task } from '@/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'; 

interface AIRequestPayload {
  prompt: string;
  schedule: DaySchedule;
  tasks: Task[];
  currentTime: string;
}

import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key is not configured' }, { status: 500 });
    }

    const body = await req.json() as AIRequestPayload;

    const systemPrompt = `You are LinPing, a highly intelligent Personal Schedule Assistant.
You strictly return a valid JSON object. Do NOT wrap it in markdown code blocks.

## HARD CONSTRAINTS (NEVER VIOLATE)
These blocks are IMMUTABLE. You must NEVER move, shorten, split, or overlap them:
- "Sleep" (21:30–04:00) — ABSOLUTE. No tasks can touch these hours.
- "Office" (08:00–17:00) — ABSOLUTE. No tasks can be inserted here.
- "Gym" (06:00–08:00) — FIXED. Only move with explicit user instruction.

## SOFT CONSTRAINTS (Flexible)
These blocks can be moved, shortened, or adjusted:
- Getting Ready, Lunch, Personal time, Dinner, Prep for next day, Office work, Habits + Journal

## BEHAVIOR
1. Parse the user's prompt and find the best available slot.
2. If the slot conflicts with a HARD block → return a warning and suggest the nearest available slot.
3. If the day is overloaded → protect HIGH priority tasks, suggest dropping LOW priority ones.
4. Do NOT silently create overlaps. Always return a clean schedule.
5. Times use HH:mm 24-hour format strictly.
6. Keep existing block IDs. New blocks need a unique string ID.

## RESPONSE FORMAT (strict JSON):
{
  "updatedBlocks": [ /* complete updated array of TimeBlock objects */ ],
  "explanation": "What changed and why",
  "warning": "Optional — if user's request conflicts with fixed constraints, explain here",
  "alternatives": ["Optional alternative slot or option 1", "Option 2"],
  "risks": ["Optional — burnout or conflict risks"]
}

TimeBlock interface:
{
  "id": "string",
  "title": "string",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "type": "fixed" | "flexible",
  "status": "completed" | "skipped" | "delayed" | "partial" | "pending"
}
`;

    const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Current Time: ${body.currentTime}\nSchedule Arrays: ${JSON.stringify(body.schedule?.blocks || [])}\nPrompt: ${body.prompt}` 
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!chatResponse.ok) {
        throw new Error(`OpenRouter API error: ${chatResponse.status}`);
    }

    const data = await chatResponse.json();
    let content = data.choices[0].message.content;
    
    // Safety fallback in case LLM wraps JSON in markdown block even with response_format
    if (content.startsWith('\`\`\`json')) {
      content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    }
    
    const result = JSON.parse(content);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
