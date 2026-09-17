-- Skema tabel program_kerja untuk mencatat agenda program kerja divisi per tahun & quartal
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

create table if not exists public.program_kerja (
  id              uuid primary key default gen_random_uuid(),
  year            integer not null default extract(year from now())::integer,
  division        text not null default 'Design & Multimedia',
  quartal         text not null,
  quartal_fokus   text default '',
  program_kerja   text not null,
  tujuan          text default '',
  realisasi       text default '',
  realisasi_aktual text default '',
  status          text not null default 'Planned',
  progress        numeric not null default 0,
  pic             text default '',
  deadline        text default '',
  risiko_kendala  text default '',
  keterangan      text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index untuk performa query per tahun, quartal, status, dan PIC
create index if not exists program_kerja_year_idx on public.program_kerja (year);
create index if not exists program_kerja_quartal_idx on public.program_kerja (quartal);
create index if not exists program_kerja_status_idx on public.program_kerja (status);
create index if not exists program_kerja_pic_idx on public.program_kerja (pic);

-- Trigger untuk update updated_at otomatis
create or replace function public.set_program_kerja_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists program_kerja_set_updated_at on public.program_kerja;
create trigger program_kerja_set_updated_at
  before update on public.program_kerja
  for each row execute function public.set_program_kerja_updated_at();

-- Aktifkan RLS
alter table public.program_kerja enable row level security;

-- Policy agar user authenticated dapat membaca data program kerja
drop policy if exists "program_kerja authenticated read" on public.program_kerja;
create policy "program_kerja authenticated read"
  on public.program_kerja for select to authenticated
  using (true);

-- Policy agar user authenticated dapat menambah data program kerja
drop policy if exists "program_kerja authenticated insert" on public.program_kerja;
create policy "program_kerja authenticated insert"
  on public.program_kerja for insert to authenticated
  with check (true);

-- Policy agar user authenticated dapat mengubah data program kerja
drop policy if exists "program_kerja authenticated update" on public.program_kerja;
create policy "program_kerja authenticated update"
  on public.program_kerja for update to authenticated
  using (true)
  with check (true);

-- Policy agar user authenticated dapat menghapus data program kerja
drop policy if exists "program_kerja authenticated delete" on public.program_kerja;
create policy "program_kerja authenticated delete"
  on public.program_kerja for delete to authenticated
  using (true);

-- Notifikasi reload schema ke PostgREST
notify pgrst, 'reload schema';
