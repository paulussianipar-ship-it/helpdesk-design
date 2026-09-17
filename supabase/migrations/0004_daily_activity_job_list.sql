-- Menyesuaikan Daily Activity dengan format Job List Today.
-- Jalankan setelah 0003_daily_activities.sql.

alter table public.daily_activities
  add column if not exists name text,
  add column if not exists task_description text,
  add column if not exists status text not null default 'Done',
  add column if not exists remarks text;

update public.daily_activities
set
  name = coalesce(nullif(name, ''), 'Unknown'),
  task_description = coalesce(nullif(task_description, ''), title),
  status = coalesce(nullif(status, ''), 'Done'),
  remarks = coalesce(remarks, description)
where name is null or task_description is null;

alter table public.daily_activities
  alter column name set not null,
  alter column task_description set not null;

create index if not exists daily_activities_status_idx
  on public.daily_activities (status);

notify pgrst, 'reload schema';
