-- Create a table for public profiles using Supabase's standard pattern
create table public.profiles (
  id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text default 'surveyor' check (role in ('admin', 'surveyor')),
  created_at timestamptz default now(),
  primary key (id)
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'surveyor'); -- Default role is always 'surveyor'
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: If you want to make your EXISTING users have profiles, run this manually once:
-- insert into public.profiles (id, email)
-- select id, email from auth.users
-- on conflict do nothing;
