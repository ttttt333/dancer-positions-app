-- Phase 0 / 007: マイグレーション検証（読み取り専用・本番適用後に実行）
-- ロールバック: 007_validation.down.sql
--
-- 使い方:
--   select * from public.choreocore_validate_audio_migration() order by check_id;
-- すべて status = 'ok' または severity = 'info' なら合格。

create or replace function public.choreocore_validate_audio_migration()
returns table (
  check_id   text,
  severity   text,  -- 'ok' | 'warn' | 'error' | 'info'
  metric     bigint,
  detail     text
)
language sql
stable
security definer
set search_path = public
as $$
  -- 1. active asset に current_version_id が無い
  select
    'active_asset_missing_current_version'::text,
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'status=active なのに current_version_id IS NULL'::text
  from public.choreocore_audio_assets
  where status = 'active' and current_version_id is null

  union all

  -- 2. current_version_id が別 asset を指している
  select
    'current_version_asset_mismatch',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'assets.current_version_id の asset_id が一致しない'
  from public.choreocore_audio_assets a
  join public.choreocore_audio_asset_versions v on v.id = a.current_version_id
  where a.current_version_id is not null and v.asset_id <> a.id

  union all

  -- 3. project が指す asset が存在しない
  select
    'project_missing_asset',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'current_audio_asset_id が dangling FK'
  from public.choreocore_projects p
  where p.current_audio_asset_id is not null
    and not exists (
      select 1 from public.choreocore_audio_assets a
      where a.id = p.current_audio_asset_id
    )

  union all

  -- 4. project が asset を指すが asset に version が無い
  select
    'project_asset_missing_version',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'project.current_audio_asset_id 先の asset に current_version_id なし'
  from public.choreocore_projects p
  join public.choreocore_audio_assets a on a.id = p.current_audio_asset_id
  where p.current_audio_asset_id is not null
    and a.current_version_id is null

  union all

  -- 5. storage_path の重複（versions テーブル内）
  select
    'duplicate_storage_path',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'choreocore_audio_asset_versions.storage_path 重複'
  from (
    select storage_path
    from public.choreocore_audio_asset_versions
    group by storage_path
    having count(*) > 1
  ) d

  union all

  -- 6. json.audioSupabasePath とレジストリの不一致（バックフィル後）
  select
    'json_path_registry_mismatch',
    case when count(*) = 0 then 'ok' else 'warn' end,
    count(*),
    'json.audioSupabasePath ≠ versions.storage_path（移行期は warn）'
  from public.choreocore_projects p
  join public.choreocore_audio_assets a on a.id = p.current_audio_asset_id
  join public.choreocore_audio_asset_versions v on v.id = a.current_version_id
  where trim(coalesce(p.json->>'audioSupabasePath', '')) <> ''
    and trim(p.json->>'audioSupabasePath') <> v.storage_path

  union all

  -- 7. 参照されている asset の件数（info）
  select
    'projects_with_audio_asset',
    'info',
    count(*),
    'current_audio_asset_id が設定された作品数'
  from public.choreocore_projects
  where current_audio_asset_id is not null

  union all

  -- 8. active asset 総数（info）
  select
    'active_audio_assets',
    'info',
    count(*),
    'status=active の asset 数'
  from public.choreocore_audio_assets
  where status = 'active'

  union all

  -- 9. version 総数（info）
  select
    'audio_asset_versions',
    'info',
    count(*),
    'version 行総数'
  from public.choreocore_audio_asset_versions

  union all

  -- 10. deleted だが deleted_at 無し（warn）
  select
    'deleted_without_timestamp',
    case when count(*) = 0 then 'ok' else 'warn' end,
    count(*),
    'status=deleted なのに deleted_at IS NULL'
  from public.choreocore_audio_assets
  where status = 'deleted' and deleted_at is null

  union all

  -- 11. current_version_id が存在しない version を指す
  select
    'current_version_missing_row',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'assets.current_version_id が versions に存在しない'
  from public.choreocore_audio_assets a
  where a.current_version_id is not null
    and not exists (
      select 1 from public.choreocore_audio_asset_versions v
      where v.id = a.current_version_id
    )

  union all

  -- 12. version はあるが親 asset が無い（FK 破損検出）
  select
    'orphan_version_rows',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'versions.asset_id が assets に存在しない'
  from public.choreocore_audio_asset_versions v
  where not exists (
    select 1 from public.choreocore_audio_assets a where a.id = v.asset_id
  )

  union all

  -- 13. project が deleted asset を指す
  select
    'project_points_deleted_asset',
    case when count(*) = 0 then 'ok' else 'error' end,
    count(*),
    'current_audio_asset_id 先が status=deleted'
  from public.choreocore_projects p
  join public.choreocore_audio_assets a on a.id = p.current_audio_asset_id
  where p.current_audio_asset_id is not null
    and a.status = 'deleted'

  union all

  -- 14. 同一 owner + 同一 checksum の active asset が複数（dedup 異常）
  select
    'duplicate_owner_checksum_active',
    case when count(*) = 0 then 'ok' else 'warn' end,
    count(*),
    '同一 owner・同一 checksum の active asset が 2 件以上'
  from (
    select owner_user_id, checksum_sha256
    from public.choreocore_audio_assets
    where status = 'active'
      and checksum_sha256 is not null
    group by owner_user_id, checksum_sha256
    having count(*) > 1
  ) d

  union all

  -- 15. active asset で checksum が NULL（新規 RPC 違反）
  select
    'active_asset_null_checksum',
    case when count(*) = 0 then 'ok' else 'warn' end,
    count(*),
    'status=active なのに checksum_sha256 IS NULL（バックフィル未完了 or RPC 未経由）'
  from public.choreocore_audio_assets
  where status = 'active' and checksum_sha256 is null

  union all

  -- 16. version はあるが current_version に選ばれていない active asset（info）
  select
    'active_assets_without_versions',
    case when count(*) = 0 then 'ok' else 'warn' end,
    count(*),
    'active asset に version 行が 1 件も無い'
  from public.choreocore_audio_assets a
  where a.status = 'active'
    and not exists (
      select 1 from public.choreocore_audio_asset_versions v
      where v.asset_id = a.id
    );
$$;

comment on function public.choreocore_validate_audio_migration is
  'Phase0/1 適用後の整合性チェック。error=0 を確認してから Phase2 へ。';

revoke all on function public.choreocore_validate_audio_migration() from public;
grant execute on function public.choreocore_validate_audio_migration() to authenticated, service_role;
