-- Permintaan desain, komentar, dan lampiran.
-- Jalankan migration ini di Supabase SQL Editor atau melalui Supabase CLI.

create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'user'
              check (role in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.user_profiles (id, email)
select id, email
from auth.users
on conflict (id) do update set email = excluded.email;

alter table public.user_profiles enable row level security;

drop policy if exists "user profiles authenticated read" on public.user_profiles;
create policy "user profiles authenticated read"
  on public.user_profiles for select to authenticated
  using (true);

create table if not exists public.permintaan (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  due_date    timestamptz not null,
  judul       text not null,
  deskripsi   text not null,
  project     text not null,
  departemen  text not null,
  status      text not null default 'TO DO'
              check (status in ('TO DO', 'PROGRESS', 'REVIEW', 'REVISION', 'DONE')),
  requester   uuid not null references auth.users(id) on delete cascade,
  admin       uuid references auth.users(id) on delete set null,
  files       jsonb not null default '[]'::jsonb,
  rating      integer check (rating is null or rating between 1 and 10),
  review      text
);

create index if not exists permintaan_requester_idx on public.permintaan (requester);
create index if not exists permintaan_admin_idx on public.permintaan (admin);
create index if not exists permintaan_status_idx on public.permintaan (status);
create index if not exists permintaan_created_at_idx on public.permintaan (created_at desc);

create or replace function public.get_dashboard_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rataRataRating', coalesce(avg(rating), 0)
  )
  from public.permintaan;
$$;

grant execute on function public.get_dashboard_stats() to authenticated;

create or replace function public.get_daily_request_trend(days_limit integer default 30)
returns table (request_date date, total bigint)
language sql
security definer
set search_path = public
as $$
  select dates.request_date::date,
         count(p.id)::bigint as total
  from generate_series(
    current_date - greatest(days_limit, 1) + 1,
    current_date,
    interval '1 day'
  ) as dates(request_date)
  left join public.permintaan p
    on p.created_at >= dates.request_date
   and p.created_at < dates.request_date + interval '1 day'
  group by dates.request_date
  order by dates.request_date;
$$;

grant execute on function public.get_daily_request_trend(integer) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists permintaan_set_updated_at on public.permintaan;
create trigger permintaan_set_updated_at
  before update on public.permintaan
  for each row execute function public.set_updated_at();

alter table public.permintaan enable row level security;

drop policy if exists "permintaan users read own" on public.permintaan;
create policy "permintaan users read own"
  on public.permintaan for select to authenticated
  using (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "permintaan users create own" on public.permintaan;
create policy "permintaan users create own"
  on public.permintaan for insert to authenticated
  with check (requester = auth.uid());

drop policy if exists "permintaan users update related" on public.permintaan;
create policy "permintaan users update related"
  on public.permintaan for update to authenticated
  using (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    requester = auth.uid()
    or admin = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "permintaan users delete own" on public.permintaan;
create policy "permintaan users delete own"
  on public.permintaan for delete to authenticated
  using (requester = auth.uid());

create table if not exists public.komentar (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  permintaan_id  uuid not null references public.permintaan(id) on delete cascade,
  user_id        uuid not null references public.user_profiles(id) on delete cascade,
  message        text not null
);

create index if not exists komentar_permintaan_idx
  on public.komentar (permintaan_id, created_at);

alter table public.komentar enable row level security;

drop policy if exists "komentar users read related" on public.komentar;
create policy "komentar users read related"
  on public.komentar for select to authenticated
  using (
    exists (
      select 1 from public.permintaan p
      where p.id = permintaan_id
        and (
          p.requester = auth.uid()
          or p.admin = auth.uid()
          or exists (
            select 1 from public.user_profiles up
            where up.id = auth.uid() and up.role = 'admin'
          )
        )
    )
  );

drop policy if exists "komentar users create own" on public.komentar;
create policy "komentar users create own"
  on public.komentar for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.permintaan p
      where p.id = permintaan_id
        and (
          p.requester = auth.uid()
          or p.admin = auth.uid()
          or exists (
            select 1 from public.user_profiles up
            where up.id = auth.uid() and up.role = 'admin'
          )
        )
    )
  );

drop policy if exists "komentar users delete own" on public.komentar;
create policy "komentar users delete own"
  on public.komentar for delete to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('permintaan', 'permintaan', true)
on conflict (id) do nothing;

drop policy if exists "permintaan files public read" on storage.objects;
create policy "permintaan files public read"
  on storage.objects for select
  using (bucket_id = 'permintaan');

drop policy if exists "permintaan files authenticated write" on storage.objects;
create policy "permintaan files authenticated write"
  on storage.objects for all to authenticated
  using (bucket_id = 'permintaan' and owner_id = (select auth.uid()::text))
  with check (bucket_id = 'permintaan' and owner_id = (select auth.uid()::text));