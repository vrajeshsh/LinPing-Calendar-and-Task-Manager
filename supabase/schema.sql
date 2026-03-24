-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  onboarded boolean default false,
  timezone text default 'America/New_York',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create tasks table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  duration integer not null, -- in minutes
  priority text check (priority in ('critical', 'important', 'medium', 'low')) not null,
  notes text,
  is_recurring boolean default false,
  is_archived boolean default false,
  deleted_at timestamp with time zone,
  completed_on date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.tasks enable row level security;

create policy "Users can manage their own tasks" on public.tasks
  for all using (auth.uid() = user_id);

-- Create schedule templates
create table public.schedule_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.schedule_templates enable row level security;

create policy "Users can manage their own templates" on public.schedule_templates
  for all using (auth.uid() = user_id);

-- Create template blocks
create table public.template_blocks (
  id uuid default gen_random_uuid() primary key,
  template_id uuid references public.schedule_templates on delete cascade not null,
  title text not null,
  start_time text not null, -- HH:mm
  end_time text not null, -- HH:mm
  type text check (type in ('fixed', 'flexible')) not null,
  order_index integer not null
);

alter table public.template_blocks enable row level security;

create policy "Users can manage blocks through templates" on public.template_blocks
  for all using (
    exists (
      select 1 from public.schedule_templates
      where id = template_id and user_id = auth.uid()
    )
  );

-- Create day schedules
create table public.day_schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  adherence_score integer default 0,
  reflection text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, date)
);

alter table public.day_schedules enable row level security;

create policy "Users can manage their own day schedules" on public.day_schedules
  for all using (auth.uid() = user_id);

-- Create day blocks
create table public.day_blocks (
  id uuid default gen_random_uuid() primary key,
  day_schedule_id uuid references public.day_schedules on delete cascade not null,
  task_id uuid references public.tasks on delete set null,
  title text not null,
  start_time text not null,
  end_time text not null,
  type text check (type in ('fixed', 'flexible')) not null,
  status text check (status in ('completed', 'skipped', 'delayed', 'partial', 'pending')) not null,
  order_index integer not null
);

alter table public.day_blocks enable row level security;

create policy "Users can manage blocks through day schedules" on public.day_blocks
  for all using (
    exists (
      select 1 from public.day_schedules
      where id = day_schedule_id and user_id = auth.uid()
    )
  );

-- Handle profile creation on signup
create function public.handle_new_user()
returns trigger as $
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- PERSONALIZATION TABLES
-- =============================================

-- User personalization settings
create table public.user_personalization (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  adaptive_learning_enabled boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.user_personalization enable row level security;

create policy "Users can manage their own personalization" on public.user_personalization
  for all using (auth.uid() = user_id);

-- Learned task patterns (input -> normalized output mappings)
create table public.task_patterns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  raw_input text not null,
  normalized_title text not null,
  preferred_time_window text, -- e.g., 'after_dinner', 'morning', 'evening'
  preferred_time text, -- e.g., '19:00'
  average_duration integer, -- in minutes
  acceptance_count integer default 1,
  rejection_count integer default 0,
  last_seen timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, raw_input)
);

alter table public.task_patterns enable row level security;

create policy "Users can manage their own patterns" on public.task_patterns
  for all using (auth.uid() = user_id);

-- Preferred time windows by task type
create table public.preferred_time_windows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_category text not null, -- e.g., 'exercise', 'study', 'journal'
  preferred_day_part text not null, -- e.g., 'morning', 'afternoon', 'evening', 'after_dinner'
  preferred_time text, -- specific time like '07:00', '19:30'
  occurrence_count integer default 1,
  last_used timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, task_category)
);

alter table public.preferred_time_windows enable row level security;

create policy "Users can manage their own time windows" on public.preferred_time_windows
  for all using (auth.uid() = user_id);

-- Task duration preferences
create table public.preferred_durations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  task_title_pattern text not null, -- pattern to match task titles
  average_duration integer not null, -- in minutes
  sample_count integer default 1,
  last_used timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, task_title_pattern)
);

alter table public.preferred_durations enable row level security;

create policy "Users can manage their own durations" on public.preferred_durations
  for all using (auth.uid() = user_id);

-- Learning events log (for tracking what the system learns)
create table public.learning_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  event_type text not null, -- 'accepted', 'rejected', 'edited', 'rescheduled'
  raw_input text,
  ai_suggestion text,
  user_action text,
  confidence_before float,
  confidence_after float,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.learning_events enable row level security;

create policy "Users can view their own learning events" on public.learning_events
  for select using (auth.uid() = user_id);
