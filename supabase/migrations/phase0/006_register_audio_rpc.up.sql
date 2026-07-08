-- Phase 0 / 006: 音源登録 RPC（Facade + 小関数分割）
-- 公開 API: choreocore_register_project_audio（1 トランザクションで内部関数を呼ぶ）
-- ロールバック: 006_register_audio_rpc.down.sql

-- ---------------------------------------------------------------------------
-- 内部: checksum 必須（Edge Function が SHA256 計算後に RPC を呼ぶ）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_assert_checksum_sha256(p_checksum_sha256 text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_checksum_sha256, '')));
begin
  if v = '' then
    raise exception 'checksum_sha256 required (compute via Edge Function before RPC)';
  end if;
  if length(v) <> 64 or v !~ '^[0-9a-f]{64}$' then
    raise exception 'checksum_sha256 must be 64-char hex SHA-256';
  end if;
  return v;
end;
$$;

revoke all on function public.choreocore_assert_checksum_sha256(text) from public;

-- ---------------------------------------------------------------------------
-- 内部: Asset 作成
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_register_audio_asset(
  p_checksum_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_checksum text;
  v_asset_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_checksum := public.choreocore_assert_checksum_sha256(p_checksum_sha256);

  insert into public.choreocore_audio_assets (
    owner_user_id,
    checksum_sha256,
    status,
    last_accessed_at
  ) values (
    v_uid,
    v_checksum,
    'active',
    now()
  )
  returning id into v_asset_id;

  return v_asset_id;
end;
$$;

revoke all on function public.choreocore_register_audio_asset(text) from public;

-- ---------------------------------------------------------------------------
-- 内部: Version 作成（asset 行を FOR UPDATE で直列化 → 同時編集の version_no 衝突を防止）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_register_audio_version(
  p_asset_id        uuid,
  p_storage_path    text,
  p_checksum_sha256 text,
  p_mime_type       text default null,
  p_byte_size       bigint default null,
  p_duration_sec    numeric default null,
  p_source          text default 'upload',
  p_change_note     text default null,
  p_project_id      bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_checksum text;
  v_version_id uuid;
  v_version_no int;
  v_owner uuid;
  v_linked_project bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_asset_id is null then
    raise exception 'asset_id required';
  end if;

  if p_storage_path is null or trim(p_storage_path) = '' then
    raise exception 'storage_path required';
  end if;

  v_checksum := public.choreocore_assert_checksum_sha256(p_checksum_sha256);

  if p_source is not null and p_source not in (
    'upload', 'recording', 'import', 'ai', 'youtube', 'stem'
  ) then
    raise exception 'invalid source: %', p_source;
  end if;

  select a.owner_user_id
  into v_owner
  from public.choreocore_audio_assets a
  where a.id = p_asset_id
  for update;

  if v_owner is null then
    raise exception 'asset not found: %', p_asset_id;
  end if;

  if v_owner <> v_uid then
    v_linked_project := public.choreocore_project_id_for_audio_asset(p_asset_id);
    if not (
      (p_project_id is not null and public.choreocore_can_edit_project(p_project_id))
      or (v_linked_project is not null and public.choreocore_can_edit_project(v_linked_project))
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  select coalesce(max(v.version_no), 0) + 1
  into v_version_no
  from public.choreocore_audio_asset_versions v
  where v.asset_id = p_asset_id;

  insert into public.choreocore_audio_asset_versions (
    asset_id,
    version_no,
    storage_path,
    mime_type,
    byte_size,
    duration_sec,
    checksum_sha256,
    source,
    created_by,
    change_note
  ) values (
    p_asset_id,
    v_version_no,
    trim(p_storage_path),
    p_mime_type,
    p_byte_size,
    p_duration_sec,
    v_checksum,
    coalesce(nullif(trim(p_source), ''), 'upload'),
    v_uid,
    p_change_note
  )
  returning id into v_version_id;

  update public.choreocore_audio_assets
  set current_version_id = v_version_id,
      checksum_sha256 = v_checksum,
      last_accessed_at = now(),
      updated_at = now()
  where id = p_asset_id;

  return v_version_id;
end;
$$;

revoke all on function public.choreocore_register_audio_version(
  uuid, text, text, text, bigint, numeric, text, text, bigint
) from public;

-- ---------------------------------------------------------------------------
-- 内部: 作品に Asset を紐づけ
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_bind_project_audio(
  p_project_id bigint,
  p_asset_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.choreocore_can_edit_project(p_project_id) then
    raise exception 'forbidden';
  end if;

  if p_asset_id is null then
    raise exception 'asset_id required';
  end if;

  if not exists (
    select 1 from public.choreocore_audio_assets a where a.id = p_asset_id
  ) then
    raise exception 'asset not found: %', p_asset_id;
  end if;

  update public.choreocore_projects
  set current_audio_asset_id = p_asset_id,
      updated_at = now()
  where id = p_project_id;
end;
$$;

revoke all on function public.choreocore_bind_project_audio(bigint, uuid) from public;

-- ---------------------------------------------------------------------------
-- 内部: 同一 owner の checksum dedup 検索
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_find_reusable_audio_asset(
  p_checksum_sha256 text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_checksum text;
  v_asset_id uuid;
begin
  if v_uid is null then
    return null;
  end if;

  v_checksum := public.choreocore_assert_checksum_sha256(p_checksum_sha256);

  select a.id
  into v_asset_id
  from public.choreocore_audio_assets a
  where a.owner_user_id = v_uid
    and a.checksum_sha256 = v_checksum
    and a.status = 'active'
    and a.current_version_id is not null
  order by a.updated_at desc
  limit 1;

  return v_asset_id;
end;
$$;

revoke all on function public.choreocore_find_reusable_audio_asset(text) from public;

-- ---------------------------------------------------------------------------
-- 公開 Facade: アップロード後の DB 登録（1 トランザクション）
-- Edge Function: SHA256 計算 → 本 RPC を呼ぶ
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_register_project_audio(
  p_project_id        bigint,
  p_storage_path      text,
  p_checksum_sha256   text,
  p_mime_type         text default null,
  p_byte_size         bigint default null,
  p_duration_sec      numeric default null,
  p_source            text default 'upload',
  p_change_note       text default null,
  p_reuse_same_owner  boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_asset_id uuid;
  v_version_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.choreocore_can_edit_project(p_project_id) then
    raise exception 'forbidden';
  end if;

  perform public.choreocore_assert_checksum_sha256(p_checksum_sha256);

  if p_reuse_same_owner then
    v_asset_id := public.choreocore_find_reusable_audio_asset(p_checksum_sha256);
    if v_asset_id is not null then
      update public.choreocore_audio_assets
      set last_accessed_at = now(),
          updated_at = now()
      where id = v_asset_id;

      perform public.choreocore_bind_project_audio(p_project_id, v_asset_id);
      return v_asset_id;
    end if;
  end if;

  v_asset_id := public.choreocore_register_audio_asset(p_checksum_sha256);

  v_version_id := public.choreocore_register_audio_version(
    v_asset_id,
    p_storage_path,
    p_checksum_sha256,
    p_mime_type,
    p_byte_size,
    p_duration_sec,
    p_source,
    p_change_note,
    p_project_id
  );

  perform public.choreocore_bind_project_audio(p_project_id, v_asset_id);

  return v_asset_id;
end;
$$;

comment on function public.choreocore_register_project_audio is
  'API Version 1. Facade: dedup → register_audio_asset → register_audio_version → bind_project_audio。checksum は必須（Edge Function で SHA256 計算後に呼ぶ）。破壊的変更時は register_project_audio_v2 を新設し v1 は維持。';

revoke all on function public.choreocore_register_project_audio(
  bigint, text, text, text, bigint, numeric, text, text, boolean
) from public;
grant execute on function public.choreocore_register_project_audio(
  bigint, text, text, text, bigint, numeric, text, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 公開: last_accessed_at 更新（5 分スロットル）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_touch_audio_access(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_asset_id is null then
    return;
  end if;

  update public.choreocore_audio_assets a
  set last_accessed_at = now(),
      updated_at = now()
  where a.id = p_asset_id
    and (
      a.last_accessed_at is null
      or a.last_accessed_at < now() - interval '5 minutes'
    )
    and (
      a.owner_user_id = auth.uid()
      or (
        public.choreocore_project_id_for_audio_asset(a.id) is not null
        and public.choreocore_can_view_project(
          public.choreocore_project_id_for_audio_asset(a.id)
        )
      )
    );
end;
$$;

comment on function public.choreocore_touch_audio_access is
  'last_accessed_at を更新。5 分以内の連続呼び出し（seek/play 等）は no-op。';

revoke all on function public.choreocore_touch_audio_access(uuid) from public;
grant execute on function public.choreocore_touch_audio_access(uuid) to authenticated;
