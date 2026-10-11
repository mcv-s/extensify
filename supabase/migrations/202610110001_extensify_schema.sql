-- Extensify compact public catalog schema. Apply in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extensify_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_extensify_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.extensify_admins where user_id = auth.uid()) $$;
revoke all on function public.is_extensify_admin() from public;
grant execute on function public.is_extensify_admin() to authenticated, anon;

create table if not exists public.addons (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  author_name text not null,
  icon_path text,
  published boolean not null default false,
  current_version_id uuid,
  draft_version_id uuid,
  logo jsonb not null default '{"type":"icon","name":"PuzzlePiece","color":"#3ecf8e"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.addons add column if not exists logo jsonb not null default '{"type":"icon","name":"PuzzlePiece","color":"#3ecf8e"}'::jsonb;

create table if not exists public.addon_versions (
  id uuid primary key default gen_random_uuid(),
  addon_id text not null references public.addons(id) on delete cascade,
  version text not null check (version ~ '^[0-9]+[.][0-9]+[.][0-9]+(-[0-9A-Za-z.-]+)?$'),
  config jsonb not null,
  changelog text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.addons drop constraint if exists addons_current_version_fkey;
alter table public.addons add constraint addons_current_version_fkey foreign key (current_version_id) references public.addon_versions(id) on delete set null;
alter table public.addons drop constraint if exists addons_draft_version_fkey;
alter table public.addons add constraint addons_draft_version_fkey foreign key (draft_version_id) references public.addon_versions(id) on delete set null;

-- Backfill listing metadata from the published package config for existing catalogs.
update public.addons a
set logo = v.config->'logo'
from public.addon_versions v
where v.id = a.current_version_id
  and v.config ? 'logo';

create table if not exists public.addon_files (
  version_id uuid not null references public.addon_versions(id) on delete cascade,
  path text not null check (left(path, 1) <> '/' and position(chr(92) in path) = 0 and path !~ '(^|/)[.][.]?(/|$)'),
  content text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size between 0 and 2097152),
  sha256 text,
  primary key (version_id, path),
  check (octet_length(convert_to(content, 'UTF8')) = byte_size),
  check (path ~* '[.](html|css|js|json|md|txt|svg)$')
);

create index if not exists addons_published_title_idx on public.addons (title) where published = true;
create index if not exists addons_owner_idx on public.addons (owner_id);
create index if not exists versions_addon_created_idx on public.addon_versions (addon_id, created_at desc);
create index if not exists files_version_idx on public.addon_files (version_id);

create or replace function public.enforce_extensify_admin_publish()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (new.published is distinct from old.published and new.published = true
      or new.current_version_id is distinct from old.current_version_id)
     and not public.is_extensify_admin() then
    raise exception 'Only an Extensify admin can publish or select the current addon version';
  end if;
  return new;
end $$;
drop trigger if exists addons_admin_publish on public.addons;
create trigger addons_admin_publish before update on public.addons for each row execute function public.enforce_extensify_admin_publish();

create or replace function public.enforce_version_publish()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.published and not public.is_extensify_admin() then raise exception 'Only an Extensify admin can publish a version'; end if;
  return new;
end $$;
drop trigger if exists addon_versions_admin_publish on public.addon_versions;
create trigger addon_versions_admin_publish before insert or update on public.addon_versions for each row execute function public.enforce_version_publish();

alter table public.profiles enable row level security;
alter table public.extensify_admins enable row level security;
alter table public.addons enable row level security;
alter table public.addon_versions enable row level security;
alter table public.addon_files enable row level security;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_write_self on public.profiles;
create policy profiles_write_self on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists addons_public_or_owner_read on public.addons;
create policy addons_public_or_owner_read on public.addons for select to anon, authenticated using (published or owner_id = auth.uid() or public.is_extensify_admin());
drop policy if exists addons_owner_create on public.addons;
create policy addons_owner_create on public.addons for insert to authenticated with check (owner_id = auth.uid() and not published);
drop policy if exists addons_owner_update on public.addons;
create policy addons_owner_update on public.addons for update to authenticated using (owner_id = auth.uid() or public.is_extensify_admin()) with check (owner_id = auth.uid() or public.is_extensify_admin());
drop policy if exists addons_owner_delete on public.addons;
create policy addons_owner_delete on public.addons for delete to authenticated using (owner_id = auth.uid() or public.is_extensify_admin());

drop policy if exists versions_public_or_owner_read on public.addon_versions;
create policy versions_public_or_owner_read on public.addon_versions for select to anon, authenticated using (
  published or exists(select 1 from public.addons a where a.id = addon_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
);
drop policy if exists versions_owner_insert on public.addon_versions;
create policy versions_owner_insert on public.addon_versions for insert to authenticated with check (
  (not published and exists(select 1 from public.addons a where a.id = addon_id and a.owner_id = auth.uid()))
  or (public.is_extensify_admin() and exists(select 1 from public.addons a where a.id = addon_id and a.owner_id = auth.uid()))
);
drop policy if exists versions_owner_update on public.addon_versions;
create policy versions_owner_update on public.addon_versions for update to authenticated using (
  exists(select 1 from public.addons a where a.id = addon_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
) with check (exists(select 1 from public.addons a where a.id = addon_id and (a.owner_id = auth.uid() or public.is_extensify_admin())));
drop policy if exists versions_owner_delete on public.addon_versions;
create policy versions_owner_delete on public.addon_versions for delete to authenticated using (
  exists(select 1 from public.addons a where a.id = addon_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
);

drop policy if exists files_public_or_owner_read on public.addon_files;
create policy files_public_or_owner_read on public.addon_files for select to anon, authenticated using (
  exists(select 1 from public.addon_versions v join public.addons a on a.id = v.addon_id where v.id = version_id and (v.published or a.owner_id = auth.uid() or public.is_extensify_admin()))
);
drop policy if exists files_owner_insert on public.addon_files;
create policy files_owner_insert on public.addon_files for insert to authenticated with check (
  exists(select 1 from public.addon_versions v join public.addons a on a.id = v.addon_id where v.id = version_id and ((a.owner_id = auth.uid() and not v.published) or public.is_extensify_admin()))
);
drop policy if exists files_owner_update on public.addon_files;
create policy files_owner_update on public.addon_files for update to authenticated using (
  exists(select 1 from public.addon_versions v join public.addons a on a.id = v.addon_id where v.id = version_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
) with check (
  exists(select 1 from public.addon_versions v join public.addons a on a.id = v.addon_id where v.id = version_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
);
drop policy if exists files_owner_delete on public.addon_files;
create policy files_owner_delete on public.addon_files for delete to authenticated using (
  exists(select 1 from public.addon_versions v join public.addons a on a.id = v.addon_id where v.id = version_id and (a.owner_id = auth.uid() or public.is_extensify_admin()))
);

grant select on public.addons, public.addon_versions, public.addon_files to anon, authenticated;
grant insert, update, delete on public.addons, public.addon_versions, public.addon_files to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- After signing in once, add your Auth user UUID here using the SQL editor:
-- insert into public.extensify_admins (user_id) values ('YOUR-AUTH-USER-UUID');
