-- 共同編集: 編集用リンク（edit_token）で参加したアカウントが、作品の閲覧・上書き保存・リアルタイム同期をできるようにする。
-- 作品の削除と共有リンクの再発行は作成者のみ。

alter table public.choreocore_projects
  add column if not exists edit_token text unique;

create table if not exists public.choreocore_project_members (
  project_id bigint not null references public.choreocore_projects (id) on delete cascade,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  role       text   not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists choreocore_project_members_user_idx
  on public.choreocore_project_members (user_id);

alter table public.choreocore_project_members enable row level security;

-- RLS の相互参照で再帰しないよう、判定は SECURITY DEFINER 関数に寄せる
create or replace function public.choreocore_is_project_owner(pid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.choreocore_projects p
    where p.id = pid and p.user_id = auth.uid()
  );
$$;

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
      where m.project_id = pid and m.user_id = auth.uid()
    )
  );
$$;

revoke all on function public.choreocore_is_project_owner(bigint) from public;
revoke all on function public.choreocore_can_access_project(bigint) from public;
grant execute on function public.choreocore_is_project_owner(bigint) to authenticated;
grant execute on function public.choreocore_can_access_project(bigint) to authenticated;

drop policy if exists "choreocore_project_members select" on public.choreocore_project_members;
create policy "choreocore_project_members select" on public.choreocore_project_members
  for select to authenticated
  using (user_id = auth.uid() or public.choreocore_is_project_owner(project_id));

-- 参加は RPC（choreocore_join_project）のみ。抜ける／作成者が外すのは delete で可
drop policy if exists "choreocore_project_members delete" on public.choreocore_project_members;
create policy "choreocore_project_members delete" on public.choreocore_project_members
  for delete to authenticated
  using (user_id = auth.uid() or public.choreocore_is_project_owner(project_id));

-- 作品本体: 共同編集者も select / update できる
drop policy if exists "choreocore_projects select own" on public.choreocore_projects;
create policy "choreocore_projects select own" on public.choreocore_projects
  for select to authenticated
  using (auth.uid() = user_id or public.choreocore_can_access_project(id));

drop policy if exists "choreocore_projects update own" on public.choreocore_projects;
create policy "choreocore_projects update own" on public.choreocore_projects
  for update to authenticated
  using (auth.uid() = user_id or public.choreocore_can_access_project(id))
  with check (public.choreocore_can_access_project(id));

-- 共同編集者が所有者・共有トークンを書き換えられないようにする
create or replace function public.choreocore_projects_guard_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.user_id then
    new.user_id := old.user_id;
    new.share_token := old.share_token;
    new.edit_token := old.edit_token;
  end if;
  return new;
end;
$$;

drop trigger if exists choreocore_projects_guard_owner_fields on public.choreocore_projects;
create trigger choreocore_projects_guard_owner_fields
  before update on public.choreocore_projects
  for each row execute function public.choreocore_projects_guard_owner_fields();

-- 編集用リンクで参加（作成者本人なら何もせず ID を返す）
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

-- 音源（`{uid}/{projectId}/...`）: 共同編集者もその作品フォルダを読める・波形サイドカーを書ける
create or replace function public.choreocore_can_access_audio_path(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text := split_part(p_path, '/', 2);
begin
  if seg !~ '^[0-9]+$' then
    return false;
  end if;
  return public.choreocore_can_access_project(seg::bigint);
end;
$$;

revoke all on function public.choreocore_can_access_audio_path(text) from public;
grant execute on function public.choreocore_can_access_audio_path(text) to authenticated;

drop policy if exists "choreocore_audio select collaborators" on storage.objects;
create policy "choreocore_audio select collaborators"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'choreocore-audio'
    and public.choreocore_can_access_audio_path(objects.name)
  );

drop policy if exists "choreocore_audio insert collaborators" on storage.objects;
create policy "choreocore_audio insert collaborators"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'choreocore-audio'
    and public.choreocore_can_access_audio_path(name)
  );

drop policy if exists "choreocore_audio update collaborators" on storage.objects;
create policy "choreocore_audio update collaborators"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'choreocore-audio'
    and public.choreocore_can_access_audio_path(objects.name)
  )
  with check (
    bucket_id = 'choreocore-audio'
    and public.choreocore_can_access_audio_path(name)
  );

-- リアルタイム同期（private チャンネル `choreocore-project:{id}`）は作品にアクセスできる人だけ
create or replace function public.choreocore_can_access_realtime_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;
begin
  if p_topic is null or split_part(p_topic, ':', 1) <> 'choreocore-project' then
    return false;
  end if;
  seg := split_part(p_topic, ':', 2);
  if seg !~ '^[0-9]+$' then
    return false;
  end if;
  return public.choreocore_can_access_project(seg::bigint);
end;
$$;

revoke all on function public.choreocore_can_access_realtime_topic(text) from public;
grant execute on function public.choreocore_can_access_realtime_topic(text) to authenticated;

drop policy if exists "choreocore project realtime read" on realtime.messages;
create policy "choreocore project realtime read"
  on realtime.messages for select to authenticated
  using (public.choreocore_can_access_realtime_topic(realtime.topic()));

drop policy if exists "choreocore project realtime write" on realtime.messages;
create policy "choreocore project realtime write"
  on realtime.messages for insert to authenticated
  with check (public.choreocore_can_access_realtime_topic(realtime.topic()));
