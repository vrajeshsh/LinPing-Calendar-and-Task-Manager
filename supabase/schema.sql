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
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
