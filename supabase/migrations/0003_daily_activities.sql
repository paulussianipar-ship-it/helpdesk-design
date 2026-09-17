-- Daily Activity: catatan aktivitas manual per user.
-- Jalankan setelah 0000_initial.sql.

create table if not exists public.daily_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  title         text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists daily_activities_user_date_idx
  on public.daily_activities (user_id, activity_date desc, created_at desc);

create or replace function public.set_daily_activity_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_activities_set_updated_at on public.daily_activities;
create trigger daily_activities_set_updated_at
  before update on public.daily_activities
  for each row execute function public.set_daily_activity_updated_at();

alter table public.daily_activities enable row level security;

drop policy if exists "daily activities users read own" on public.daily_activities;
create policy "daily activities users read own"
  on public.daily_activities for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "daily activities users create own" on public.daily_activities;
create policy "daily activities users create own"
  on public.daily_activities for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "daily activities users update own" on public.daily_activities;
create policy "daily activities users update own"
  on public.daily_activities for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "daily activities users delete own" on public.daily_activities;
create policy "daily activities users delete own"
  on public.daily_activities for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
