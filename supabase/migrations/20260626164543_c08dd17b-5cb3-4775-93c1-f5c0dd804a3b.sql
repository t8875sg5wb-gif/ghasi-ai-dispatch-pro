-- ============================================================
-- GHASI AI – Authentifizierung, Rollen & KI-Audit
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'disposition', 'finanz', 'fahrer');
  end if;
end$$;

-- Profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "Profile sind für angemeldete Nutzer lesbar" on public.profiles;
create policy "Profile sind für angemeldete Nutzer lesbar"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Nutzer pflegen ihr eigenes Profil" on public.profiles;
create policy "Nutzer pflegen ihr eigenes Profil"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Benutzerrollen (separate Tabelle)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "Nutzer sehen ihre eigenen Rollen" on public.user_roles;
create policy "Nutzer sehen ihre eigenen Rollen"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- Rollencheck (security definer, verhindert RLS-Rekursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.primary_role(_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = _user_id
  order by case role
    when 'admin' then 1
    when 'disposition' then 2
    when 'finanz' then 3
    when 'fahrer' then 4
  end
  limit 1;
$$;

drop policy if exists "Admins sehen alle Rollen" on public.user_roles;
create policy "Admins sehen alle Rollen"
  on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- KI-Audit-Protokoll
create table if not exists public.ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  rolle text,
  frage text not null,
  quellen jsonb,
  vorbereitete_aktionen jsonb,
  modell text,
  thread_id uuid,
  created_at timestamptz not null default now()
);

grant select on public.ai_audit_log to authenticated;
grant all on public.ai_audit_log to service_role;

alter table public.ai_audit_log enable row level security;

drop policy if exists "Admins lesen das KI-Audit" on public.ai_audit_log;
create policy "Admins lesen das KI-Audit"
  on public.ai_audit_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Profil + Erstrolle bei Registrierung
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ist_erster boolean;
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_roles) into ist_erster;

  insert into public.user_roles (user_id, role)
  values (new.id, case when ist_erster then 'admin'::public.app_role else 'disposition'::public.app_role end)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();