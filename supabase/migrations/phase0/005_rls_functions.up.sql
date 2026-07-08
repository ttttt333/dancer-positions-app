-- Phase 0 / 005: 権限関数 + テーブル RLS（Storage ポリシーは Phase 2）
-- ロールバック: 005_rls_functions.down.sql

-- ---------------------------------------------------------------------------
-- プロジェクト権限（4 関数に分割・各 30〜50 行目標）
-- ---------------------------------------------------------------------------

create or replace function public.choreocore_project_role(
  p_project_id bigint,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.role
      from public.choreocore_project_members m
      where m.project_id = p_project_id
        and m.user_id = p_user_id
    ),
    (
      select 'owner'::text
      from public.choreocore_projects p
      where p.id = p_project_id
        and p.user_id = p_user_id
      limit 1
    )
  );
$$;

create or replace function public.choreocore_can_view_project(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.choreocore_project_role(p_project_id) is not null;
$$;

create or replace function public.choreocore_can_edit_project(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.choreocore_project_role(p_project_id) in ('owner', 'editor');
$$;

create or replace function public.choreocore_can_delete_project(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.choreocore_project_role(p_project_id) = 'owner';
$$;

-- asset に紐づく project_id を解決（current_audio_asset_id 経由）
create or replace function public.choreocore_project_id_for_audio_asset(p_asset_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.choreocore_projects p
  where p.current_audio_asset_id = p_asset_id
  order by p.updated_at desc
  limit 1;
$$;

create or replace function public.choreocore_can_access_storage(
  p_bucket text,
  p_path text,
  p_op text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_bucket = 'choreocore-audio'
    and (
      -- (1) レジストリ経由
      exists (
        select 1
        from public.choreocore_audio_asset_versions v
        join public.choreocore_audio_assets a on a.id = v.asset_id
        left join lateral (
          select public.choreocore_project_id_for_audio_asset(a.id) as pid
        ) link on true
        where v.storage_path = p_path
          and a.status in ('active', 'superseded')
          and (
            case p_op
              when 'select' then
                a.owner_user_id = auth.uid()
                or (link.pid is not null and public.choreocore_can_view_project(link.pid))
              when 'insert' then
                a.owner_user_id = auth.uid()
                or (link.pid is not null and public.choreocore_can_edit_project(link.pid))
              when 'update' then
                (p_path like '%.wavepeaks.json' and link.pid is not null
                  and public.choreocore_can_edit_project(link.pid))
                or a.owner_user_id = auth.uid()
              when 'delete' then
                a.owner_user_id = auth.uid()
                or (link.pid is not null and public.choreocore_can_delete_project(link.pid))
              else false
            end
          )
      )
      -- (2) レガシー: Tier A canonical
      or split_part(p_path, '/', 1) = auth.uid()::text
      -- (3) レガシー: {project_id}/...
      or (
        p_op in ('select', 'update')
        and split_part(p_path, '/', 1) ~ '^[0-9]+$'
        and exists (
          select 1 from public.choreocore_projects p
          where p.id::text = split_part(p_path, '/', 1)
            and p.user_id = auth.uid()
        )
      )
      -- (4) レガシー: json.audioSupabasePath（所有者）
      or (
        p_op = 'select'
        and exists (
          select 1 from public.choreocore_projects p
          where p.user_id = auth.uid()
            and trim(both from coalesce(p.json->>'audioSupabasePath', '')) = p_path
        )
      )
      -- (5) 共有閲覧
      or (
        p_op = 'select'
        and exists (
          select 1 from public.choreocore_projects p
          where p.share_token is not null
            and trim(both from coalesce(p.json->>'audioSupabasePath', '')) = p_path
        )
      )
    );
$$;

revoke all on function public.choreocore_project_role(bigint, uuid) from public;
grant execute on function public.choreocore_project_role(bigint, uuid) to authenticated, service_role;

revoke all on function public.choreocore_can_view_project(bigint) from public;
grant execute on function public.choreocore_can_view_project(bigint) to authenticated, service_role;

revoke all on function public.choreocore_can_edit_project(bigint) from public;
grant execute on function public.choreocore_can_edit_project(bigint) to authenticated, service_role;

revoke all on function public.choreocore_can_delete_project(bigint) from public;
grant execute on function public.choreocore_can_delete_project(bigint) to authenticated, service_role;

revoke all on function public.choreocore_project_id_for_audio_asset(uuid) from public;
grant execute on function public.choreocore_project_id_for_audio_asset(uuid) to authenticated, service_role;

revoke all on function public.choreocore_can_access_storage(text, text, text) from public;
grant execute on function public.choreocore_can_access_storage(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- テーブル RLS（既存 choreocore_projects ポリシーは維持・追加のみ）
-- ---------------------------------------------------------------------------

alter table public.choreocore_audio_assets enable row level security;
alter table public.choreocore_audio_asset_versions enable row level security;
alter table public.choreocore_project_members enable row level security;
alter table public.choreocore_audio_analysis_jobs enable row level security;

drop policy if exists "choreocore_projects select member" on public.choreocore_projects;
create policy "choreocore_projects select member"
  on public.choreocore_projects for select to authenticated
  using (public.choreocore_can_view_project(id));

drop policy if exists "choreocore_projects update editor" on public.choreocore_projects;
create policy "choreocore_projects update editor"
  on public.choreocore_projects for update to authenticated
  using (public.choreocore_can_edit_project(id))
  with check (public.choreocore_can_edit_project(id));

-- audio_assets
drop policy if exists "choreocore_audio_assets select" on public.choreocore_audio_assets;
create policy "choreocore_audio_assets select"
  on public.choreocore_audio_assets for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (
      public.choreocore_project_id_for_audio_asset(id) is not null
      and public.choreocore_can_view_project(public.choreocore_project_id_for_audio_asset(id))
    )
  );

drop policy if exists "choreocore_audio_assets insert" on public.choreocore_audio_assets;
create policy "choreocore_audio_assets insert"
  on public.choreocore_audio_assets for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "choreocore_audio_assets update" on public.choreocore_audio_assets;
create policy "choreocore_audio_assets update"
  on public.choreocore_audio_assets for update to authenticated
  using (
    owner_user_id = auth.uid()
    or (
      public.choreocore_project_id_for_audio_asset(id) is not null
      and public.choreocore_can_edit_project(public.choreocore_project_id_for_audio_asset(id))
    )
  );

-- audio_asset_versions
drop policy if exists "choreocore_audio_versions select" on public.choreocore_audio_asset_versions;
create policy "choreocore_audio_versions select"
  on public.choreocore_audio_asset_versions for select to authenticated
  using (
    exists (
      select 1 from public.choreocore_audio_assets a
      where a.id = asset_id
        and (
          a.owner_user_id = auth.uid()
          or (
            public.choreocore_project_id_for_audio_asset(a.id) is not null
            and public.choreocore_can_view_project(
              public.choreocore_project_id_for_audio_asset(a.id)
            )
          )
        )
    )
  );

drop policy if exists "choreocore_audio_versions insert" on public.choreocore_audio_asset_versions;
create policy "choreocore_audio_versions insert"
  on public.choreocore_audio_asset_versions for insert to authenticated
  with check (
    exists (
      select 1 from public.choreocore_audio_assets a
      where a.id = asset_id and a.owner_user_id = auth.uid()
    )
  );

-- project_members
drop policy if exists "choreocore_project_members select" on public.choreocore_project_members;
create policy "choreocore_project_members select"
  on public.choreocore_project_members for select to authenticated
  using (public.choreocore_can_view_project(project_id));

drop policy if exists "choreocore_project_members manage" on public.choreocore_project_members;
create policy "choreocore_project_members manage"
  on public.choreocore_project_members for all to authenticated
  using (public.choreocore_can_delete_project(project_id))
  with check (public.choreocore_can_delete_project(project_id));

-- analysis_jobs
drop policy if exists "choreocore_analysis_jobs select" on public.choreocore_audio_analysis_jobs;
create policy "choreocore_analysis_jobs select"
  on public.choreocore_audio_analysis_jobs for select to authenticated
  using (
    exists (
      select 1
      from public.choreocore_audio_asset_versions v
      join public.choreocore_audio_assets a on a.id = v.asset_id
      where v.id = asset_version_id
        and (
          a.owner_user_id = auth.uid()
          or (
            public.choreocore_project_id_for_audio_asset(a.id) is not null
            and public.choreocore_can_view_project(
              public.choreocore_project_id_for_audio_asset(a.id)
            )
          )
        )
    )
  );

drop policy if exists "choreocore_analysis_jobs insert" on public.choreocore_audio_analysis_jobs;
create policy "choreocore_analysis_jobs insert"
  on public.choreocore_audio_analysis_jobs for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (
      select 1
      from public.choreocore_audio_asset_versions v
      join public.choreocore_audio_assets a on a.id = v.asset_id
      where v.id = asset_version_id
        and (
          public.choreocore_project_id_for_audio_asset(a.id) is not null
          and public.choreocore_can_edit_project(
            public.choreocore_project_id_for_audio_asset(a.id)
          )
        )
    )
  );
