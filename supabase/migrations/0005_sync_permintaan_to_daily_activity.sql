-- Sinkronisasi otomatis permintaan desain ke Daily Activity.
-- Jalankan setelah 0004_daily_activity_job_list.sql.

alter table public.daily_activities
  add column if not exists request_id uuid
  references public.permintaan(id) on delete cascade,
  add column if not exists request_title text,
  add column if not exists request_description text,
  add column if not exists project text,
  add column if not exists departemen text,
  add column if not exists due_date timestamptz,
  add column if not exists requester uuid,
  add column if not exists admin uuid,
  add column if not exists files jsonb;

create unique index if not exists daily_activities_request_id_uidx
  on public.daily_activities (request_id)
  where request_id is not null;

create index if not exists daily_activities_request_id_idx
  on public.daily_activities (request_id);

create or replace function public.sync_permintaan_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_remarks text;
begin
  activity_remarks := concat_ws(
    E'\n',
    'Project: ' || coalesce(new.project, '-'),
    'Departemen: ' || coalesce(new.departemen, '-'),
    'Due date: ' || coalesce(new.due_date::text, '-')
  );

  update public.daily_activities
  set user_id = new.requester,
      activity_date = new.created_at::date,
      name = 'Permintaan Desain',
      task_description = new.judul,
      title = new.judul,
      status = case new.status
        when 'TO DO' then '⏳ Waiting (Menunggu)'
        when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
        when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
        when 'REVIEW' then '⏸️ Pending (Tertunda)'
        when 'DONE' then '✅ Done (Selesai)'
        else '⏳ Waiting (Menunggu)'
      end,
      remarks = activity_remarks,
      request_title = new.judul,
      request_description = new.deskripsi,
      project = new.project,
      departemen = new.departemen,
      due_date = new.due_date,
      requester = new.requester,
      admin = new.admin,
      files = new.files,
      updated_at = now()
  where request_id = new.id;

  if not found then
    insert into public.daily_activities (
      request_id,
      user_id,
      activity_date,
      name,
      task_description,
      title,
      status,
      remarks,
      request_title,
      request_description,
      project,
      departemen,
      due_date,
      requester,
      admin,
      files
    ) values (
      new.id,
      new.requester,
      new.created_at::date,
      'Permintaan Desain',
      new.judul,
      new.judul,
      case new.status
        when 'TO DO' then '⏳ Waiting (Menunggu)'
        when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
        when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
        when 'REVIEW' then '⏸️ Pending (Tertunda)'
        when 'DONE' then '✅ Done (Selesai)'
        else '⏳ Waiting (Menunggu)'
      end,
      activity_remarks,
      new.judul,
      new.deskripsi,
      new.project,
      new.departemen,
      new.due_date,
      new.requester,
      new.admin,
      new.files
    );
  end if;

  return new;
end;
$$;

-- Backfill permintaan yang sudah ada sebelum trigger dibuat.
insert into public.daily_activities (
  request_id,
  user_id,
  activity_date,
  name,
  task_description,
  title,
  status,
  remarks,
  request_title,
  request_description,
  project,
  departemen,
  due_date,
  requester,
  admin,
  files
)
select
  p.id,
  p.requester,
  p.created_at::date,
  'Permintaan Desain',
  p.judul,
  p.judul,
  case p.status
    when 'TO DO' then '⏳ Waiting (Menunggu)'
    when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
    when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
    when 'REVIEW' then '⏸️ Pending (Tertunda)'
    when 'DONE' then '✅ Done (Selesai)'
    else '⏳ Waiting (Menunggu)'
  end,
  concat_ws(
    E'\n',
    'Project: ' || coalesce(p.project, '-'),
    'Departemen: ' || coalesce(p.departemen, '-'),
    'Due date: ' || coalesce(p.due_date::text, '-')
  ),
  p.judul,
  p.deskripsi,
  p.project,
  p.departemen,
  p.due_date,
  p.requester,
  p.admin,
  p.files
from public.permintaan p
where not exists (
  select 1
  from public.daily_activities da
  where da.request_id = p.id
);

drop trigger if exists permintaan_sync_daily_activity on public.permintaan;
create trigger permintaan_sync_daily_activity
after insert or update of requester, created_at, judul, deskripsi, project, departemen, due_date, status, admin, files
on public.permintaan
for each row execute function public.sync_permintaan_daily_activity();

notify pgrst, 'reload schema';
