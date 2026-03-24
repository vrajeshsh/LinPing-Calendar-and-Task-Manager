# LinPing AI Calendar

An AI-powered minimalist schedule system that helps you build and maintain a productive daily rhythm. LinPing combines intelligent scheduling with a clean, focused interface to help you stay on track.

## About LinPing

LinPing is a personal productivity tool that transforms how you plan and execute your daily schedule. Instead of starting each day with a blank slate, LinPing helps you build consistent routines that become automatic over time.

### Key Features

- **AI-Powered Scheduling**: Natural language task input with intelligent schedule optimization
- **Daily Rhythm**: Create templates for your ideal day and track adherence
- **Timeline View**: Visual timeline of your day with real-time progress tracking
- **Task Management**: Add, organize, and prioritize tasks with smart suggestions
- **Insights & Analytics**: Understand your productivity patterns over time
- **Calendar View**: Monthly overview with adherence scores
- **Flexible Blocks**: Fixed commitments and flexible time that adapts to your day
- **Dark/Light Mode**: Comfortable viewing in any lighting condition

### Architecture

- **Frontend**: Next.js 14+ with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand for client-side state
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **AI**: OpenRouter API for intelligent scheduling

### Database Schema

LinPing uses Supabase with the following tables:

- `profiles` - User profiles with timezone and onboarding status
- `tasks` - User tasks with priority, duration, and archiving
- `schedule_templates` - User-defined daily schedule templates
- `template_blocks` - Time blocks within templates (sleep, work, meals, etc.)
- `day_schedules` - Generated daily schedules
- `day_blocks` - Time blocks for each day with completion status

---

## Local Development

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- A Supabase project (free tier works)

### Setup Steps

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd LinPing-Calendar-and-Task-Manager
npm install
```

2. **Create a Supabase project**

   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for the database to be provisioned
   - In the SQL Editor, run the schema from `supabase/schema.sql`

3. **Configure environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter for AI features (optional - app works without it)
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_MODEL=openai/gpt-4o-mini
```

4. **Get your Supabase keys**

   - Go to Project Settings → API
   - Copy the `Project URL` as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the `anon public` key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. **Run the development server**

```bash
npm run dev
```

6. **Open the app**

Navigate to [http://localhost:3000](http://localhost:3000)

### Troubleshooting

**Supabase connection errors**
- Verify your URL and anon key are correct
- Check that Row Level Security policies allow anonymous access to required tables
- Ensure your Supabase project is not paused

**AI features not working**
- Add `OPENROUTER_API_KEY` to your `.env.local`
- Check that you have credits in your OpenRouter account

---

## Vercel Deployment

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=<your-repo-url>)

### Manual Deployment

1. **Push to GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/LinPing-Calendar-and-Task-Manager.git
git push -u origin main
```

2. **Import to Vercel**

   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add Environment Variables**

   In Vercel project settings → Environment Variables:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `OPENROUTER_API_KEY` | Your OpenRouter API key (optional) |

4. **Deploy**

   Click "Deploy" - Vercel will build and deploy automatically

### Post-Deployment Setup

1. Update your Supabase project's allowed domains to include your Vercel URL
2. Test authentication by signing up/logging in
3. Complete the onboarding flow to create your first schedule

---

## Project Structure

```
src/
├── app/
│   ├── app/                    # Main app pages (authenticated)
│   │   ├── calendar/           # Monthly calendar view
│   │   ├── insights/          # Analytics dashboard
│   │   ├── scheduler/         # Daily timeline view
│   │   ├── settings/          # User preferences
│   │   ├── tasks/             # Task management
│   │   └── templates/         # Schedule templates
│   ├── api/                   # API routes
│   │   ├── ai/schedule/       # AI scheduling endpoint
│   │   └── onboarding/        # Onboarding completion
│   ├── auth/                  # Auth actions
│   ├── login/                 # Login page
│   ├── onboarding/            # Onboarding flow
│   └── signup/                # Signup page
├── components/
│   ├── layout/                # Sidebar, MobileNav
│   ├── onboarding/            # Onboarding components
│   ├── timeline/              # Timeline and blocks
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── scheduleHelpers.ts     # Time/block utilities
│   └── utils.ts              # General utilities
├── services/
│   └── supabaseService.ts     # Database operations
├── store/
│   └── useScheduleStore.ts    # Zustand store
└── types/
    └── index.ts               # TypeScript types
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| State | Zustand |
| Database | Supabase |
| Auth | Supabase Auth |
| AI | OpenRouter API |
| Deployment | Vercel |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key for AI features |
| `AI_MODEL` | No | AI model to use (defaults to `openai/gpt-4o-mini`) |

---

## License

MIT
