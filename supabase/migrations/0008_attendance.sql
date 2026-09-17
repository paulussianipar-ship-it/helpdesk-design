-- Skema tabel attendance untuk mencatat data presensi karyawan per bulan
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  no_seq          integer,
  period_month    text not null default to_char(now(), 'YYYY-MM'),
  employee_no     text not null,
  name            text not null,
  date_text       text not null,
  shift           text,
  start_time      text default '-',
  end_time        text default '-',
  status          text not null,
  overtime        numeric default 0,
  overtime_index  text default '0',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Pastikan kolom period_month tersedia jika tabel sudah pernah dibuat sebelumnya
alter table public.attendance 
  add column if not exists period_month text not null default to_char(now(), 'YYYY-MM');

-- Index untuk performa pencarian, filter, dan grouping per bulan
create index if not exists attendance_period_month_idx on public.attendance (period_month);
create index if not exists attendance_employee_no_idx on public.attendance (employee_no);
create index if not exists attendance_name_idx on public.attendance (name);
create index if not exists attendance_date_text_idx on public.attendance (date_text);
create index if not exists attendance_status_idx on public.attendance (status);

-- Trigger untuk update updated_at otomatis
create or replace function public.set_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_attendance_updated_at();

-- Aktifkan RLS
alter table public.attendance enable row level security;

-- Policy agar user authenticated dapat membaca data presensi
drop policy if exists "attendance authenticated read" on public.attendance;
create policy "attendance authenticated read"
  on public.attendance for select to authenticated
  using (true);

-- Policy agar user authenticated dapat menambah data presensi
drop policy if exists "attendance authenticated insert" on public.attendance;
create policy "attendance authenticated insert"
  on public.attendance for insert to authenticated
  with check (true);

-- Policy agar user authenticated dapat mengubah data presensi
drop policy if exists "attendance authenticated update" on public.attendance;
create policy "attendance authenticated update"
  on public.attendance for update to authenticated
  using (true)
  with check (true);

-- Policy agar user authenticated dapat menghapus data presensi
drop policy if exists "attendance authenticated delete" on public.attendance;
create policy "attendance authenticated delete"
  on public.attendance for delete to authenticated
  using (true);

-- Notifikasi reload schema ke PostgREST
notify pgrst, 'reload schema';
