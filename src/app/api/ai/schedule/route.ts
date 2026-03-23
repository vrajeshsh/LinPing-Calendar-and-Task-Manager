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

export async function POST(req: Request) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key is not configured in .env.local' }, { status: 500 });
    }

    const body = await req.json() as AIRequestPayload;

    const systemPrompt = `You are a highly intelligent Personal Schedule Assistant.
Your goal is to optimize the user's daily schedule based on their prompt.
You strictly return a valid JSON object. Do NOT wrap it in markdown block quotes.

The user provides their current schedule blocks, task inbox, current time, and a prompt.

Respond with exactly this JSON format:
{
  "updatedBlocks": [ /* array of complete TimeBlock objects matching the interface */ ],
  "explanation": "Brief reasoning for your changes",
  "risks": ["Any conflicts or risks of burnout found, array of strings"]
}

TimeBlock Interface reference:
{
  "id": "string",
  "title": "string",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "type": "fixed" | "flexible",
  "status": "completed" | "skipped" | "delayed" | "partial" | "pending",
  "taskId": "optional string"
}

Rules:
1. Try not to overlap blocks unless fundamentally impossible. Find clear slots.
2. Try to maintain 'fixed' blocks at their times. 'flexible' blocks can be moved or shortened.
3. Ensure times are strictly in HH:mm 24-hour format.
4. Keep the returned block IDs identical to original if modifying them. Generate new unique string IDs for new blocks.
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
