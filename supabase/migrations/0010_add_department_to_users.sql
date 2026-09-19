-- Add department column to user_profiles
alter table public.user_profiles
add column if not exists department text;

-- Add department column to users table for consistency
alter table public.users
add column if not exists department text;

-- Create index for department filtering
create index if not exists user_profiles_department_idx on public.user_profiles (department);
create index if not exists users_department_idx on public.users (department);