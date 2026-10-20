-- 022 の修正: choreocore_project_members は phase0 で role（default なし, owner/editor/viewer）付きで作成済みのため、
-- 参加時に role を明示し、編集権限は owner / editor に限定する。

create or replace function public.choreocore_can_access_project(pid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.choreocore_projects p
      where p.id = pid and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.choreocore_project_members m
      where m.project_id = pid
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  );
$$;

create or replace function public.choreocore_join_project(t text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  pid bigint;
  owner uuid;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;
  if t is null or t = '' then
    raise exception 'invalid_token';
  end if;
  select p.id, p.user_id into pid, owner
  from public.choreocore_projects p
  where p.edit_token = t
  limit 1;
  if pid is null then
    raise exception 'invalid_token';
  end if;
  if owner <> auth.uid() then
    insert into public.choreocore_project_members as m (project_id, user_id, role)
    values (pid, auth.uid(), 'editor')
    on conflict (project_id, user_id) do update
      set role = 'editor'
      where m.role = 'viewer';
  end if;
  return pid;
end;
$$;

revoke all on function public.choreocore_join_project(text) from public;
grant execute on function public.choreocore_join_project(text) to authenticated;
