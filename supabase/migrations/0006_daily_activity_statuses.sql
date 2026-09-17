-- Status Daily Activity yang digunakan oleh form dan sinkronisasi permintaan.

update public.daily_activities
set status = case lower(trim(status))
  when 'done' then '✅ Done (Selesai)'
  when 'progress' then '⚡ In Progress (Dalam Proses)'
  when 'in progress' then '⚡ In Progress (Dalam Proses)'
  when 'revision' then '🔄 Revisi (Revisi Pengerjaan)'
  when 'revisi' then '🔄 Revisi (Revisi Pengerjaan)'
  when 'pending' then '⏸️ Pending (Tertunda)'
  when 'waiting' then '⏳ Waiting (Menunggu)'
  when 'to do' then '⏳ Waiting (Menunggu)'
  else '⏳ Waiting (Menunggu)'
end;

alter table public.daily_activities
  drop constraint if exists daily_activities_status_check;

alter table public.daily_activities
  add constraint daily_activities_status_check
  check (status in (
    '⏳ Waiting (Menunggu)',
    '⚡ In Progress (Dalam Proses)',
    '🔄 Revisi (Revisi Pengerjaan)',
    '⏸️ Pending (Tertunda)',
    '✅ Done (Selesai)'
  ));

notify pgrst, 'reload schema';