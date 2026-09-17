-- Fondasi database DesignDesk.
-- Jalankan sebelum 0001_articles.sql dan 0002_permintaan.sql.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'user'
              check (role in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'user'
              check (role in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set email = new.email,
      name = new.name,
      role = new.role,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create or replace function public.prevent_user_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not exists (
       select 1 from public.user_profiles up
       where up.id = auth.uid() and up.role = 'admin'
     ) then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end;
$$;

drop trigger if exists users_sync_user_profile on public.users;
create trigger users_sync_user_profile
after update of email, name, role on public.users
for each row execute function public.sync_user_profile();

drop trigger if exists users_prevent_role_escalation on public.users;
create trigger users_prevent_role_escalation
before update of role on public.users
for each row execute function public.prevent_user_role_escalation();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

insert into public.users (id, email)
select id, email
from auth.users
on conflict (id) do update set email = excluded.email;

insert into public.user_profiles (id, email)
select id, email
from auth.users
on conflict (id) do update set email = excluded.email;

alter table public.users enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "users authenticated read" on public.users;
create policy "users authenticated read"
  on public.users for select to authenticated
  using (true);

drop policy if exists "users update own or admin" on public.users;
create policy "users update own or admin"
  on public.users for update to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "user profiles authenticated read" on public.user_profiles;
create policy "user profiles authenticated read"
  on public.user_profiles for select to authenticated
  using (true);

