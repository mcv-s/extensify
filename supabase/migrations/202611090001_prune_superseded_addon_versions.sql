create or replace function public.prune_superseded_addon_versions()
returns table(addons_processed bigint, versions_deleted bigint, file_bytes_deleted bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  with owned_addons as materialized (
    select a.id,
           a.current_version_id,
           a.draft_version_id,
           (select max(latest.created_at)
            from public.addon_versions latest
            where latest.addon_id = a.id
              and latest.published) as latest_published_at
    from public.addons a
    join public.addon_versions current_version
      on current_version.id = a.current_version_id
      and current_version.addon_id = a.id
      and current_version.published
    where a.owner_id = auth.uid()
      and a.published
      and auth.uid() is not null
  ),
  candidates as materialized (
    select v.id, v.addon_id
    from public.addon_versions v
    join owned_addons a on a.id = v.addon_id
    where v.published
      and v.created_at < a.latest_published_at
      and v.id is distinct from a.current_version_id
      and v.id is distinct from a.draft_version_id
      and not exists (
        select 1
          from public.addons referencing_addon
          where referencing_addon.current_version_id = v.id
            or referencing_addon.draft_version_id = v.id
      )
  ),
  file_totals as materialized (
    select f.version_id, sum(f.byte_size)::bigint as file_bytes
    from public.addon_files f
    join candidates c on c.id = f.version_id
    group by f.version_id
  ),
  deleted_versions as (
    delete from public.addon_versions v
    using candidates c
    where v.id = c.id
    returning v.id, v.addon_id
  )
  select count(distinct deleted_versions.addon_id),
         count(deleted_versions.id),
         coalesce(sum(file_totals.file_bytes), 0)::bigint
  from deleted_versions
  left join file_totals on file_totals.version_id = deleted_versions.id;
$$;

revoke all on function public.prune_superseded_addon_versions() from public, anon;
grant execute on function public.prune_superseded_addon_versions() to authenticated;