-- Menjamin kolom legacy tetap terisi untuk schema Daily Activity lama.

create or replace function public.sync_permintaan_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_remarks text;
  activity_status text;
begin
  activity_remarks := concat_ws(
    E'\n',
    'Project: ' || coalesce(new.project, '-'),
    'Departemen: ' || coalesce(new.departemen, '-'),
    'Due date: ' || coalesce(new.due_date::text, '-')
  );

  activity_status := case new.status
    when 'TO DO' then '⏳ Waiting (Menunggu)'
    when 'PROGRESS' then '⚡ In Progress (Dalam Proses)'
    when 'REVISION' then '🔄 Revisi (Revisi Pengerjaan)'
    when 'REVIEW' then '⏸️ Pending (Tertunda)'
    when 'DONE' then '✅ Done (Selesai)'
    else '⏳ Waiting (Menunggu)'
  end;

  update public.daily_activities
  set user_id = new.requester,
      activity_date = new.created_at::date,
      name = 'Permintaan Desain',
      task_description = new.judul,
      title = new.judul,
      description = new.deskripsi,
      status = activity_status,
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
      request_id, user_id, activity_date, name, task_description, title,
      description, status, remarks, request_title, request_description,
      project, departemen, due_date, requester, admin, files
    ) values (
      new.id, new.requester, new.created_at::date, 'Permintaan Desain',
      new.judul, new.judul, new.deskripsi, activity_status, activity_remarks,
      new.judul, new.deskripsi, new.project, new.departemen, new.due_date,
      new.requester, new.admin, new.files
    );
  end if;

  return new;
end;
$$;

drop trigger if exists permintaan_sync_daily_activity on public.permintaan;
create trigger permintaan_sync_daily_activity
after insert or update of requester, created_at, judul, deskripsi, project,
departemen, due_date, status, admin, files
on public.permintaan
for each row execute function public.sync_permintaan_daily_activity();

update public.daily_activities
set
  title = coalesce(title, task_description),
  description = coalesce(description, remarks)
where title is null;

notify pgrst, 'reload schema';