-- Phase 0 / 001: 音源コアテーブル（ADR-002.1）
-- ロールバック: 001_audio_core_tables.down.sql

create table if not exists public.choreocore_audio_assets (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references auth.users (id) on delete restrict,
  current_version_id  uuid,
  checksum_sha256     text,
  status              text not null default 'active'
    check (status in ('active', 'superseded', 'deleted')),
  deleted_at          timestamptz,
  last_accessed_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.choreocore_audio_assets is
  '音源メタの正。storage_path は versions のみが保持する。';
comment on column public.choreocore_audio_assets.checksum_sha256 is
  '同一 owner 内 dedup 用。UNIQUE 制約は付けない（他ユーザーとの Storage 共有を避ける）。';
comment on column public.choreocore_audio_assets.last_accessed_at is
  'GC / LRU 判断用。再生・解析・共同編集で更新。';

create index if not exists choreocore_audio_assets_owner_idx
  on public.choreocore_audio_assets (owner_user_id);

-- 同一 owner + 同一 checksum の検索用（UNIQUE ではない）
create index if not exists choreocore_audio_assets_owner_checksum_idx
  on public.choreocore_audio_assets (owner_user_id, checksum_sha256)
  where checksum_sha256 is not null and status = 'active';

create index if not exists choreocore_audio_assets_status_deleted_idx
  on public.choreocore_audio_assets (status, deleted_at)
  where status = 'deleted';

create table if not exists public.choreocore_audio_asset_versions (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.choreocore_audio_assets (id) on delete cascade,
  version_no      int not null check (version_no > 0),
  storage_bucket  text not null default 'choreocore-audio',
  storage_path    text not null,
  wave_peaks_path text generated always as (storage_path || '.wavepeaks.json') stored,
  mime_type       text,
  byte_size       bigint,
  duration_sec    numeric(12, 3),
  checksum_sha256 text,
  source          text not null default 'upload'
    check (source in ('upload', 'recording', 'import', 'ai', 'youtube', 'stem')),
  created_by      uuid not null references auth.users (id) on delete restrict,
  change_note     text,
  created_at      timestamptz not null default now(),
  unique (asset_id, version_no),
  unique (storage_bucket, storage_path)
);

comment on column public.choreocore_audio_asset_versions.storage_path is
  'Storage objects.name の唯一の正。';
comment on column public.choreocore_audio_asset_versions.source is
  '音源の由来（upload / recording / import / ai / youtube / stem）。';

create index if not exists choreocore_audio_asset_versions_asset_idx
  on public.choreocore_audio_asset_versions (asset_id, version_no desc);

alter table public.choreocore_audio_assets
  drop constraint if exists choreocore_audio_assets_current_version_fk;

alter table public.choreocore_audio_assets
  add constraint choreocore_audio_assets_current_version_fk
  foreign key (current_version_id)
  references public.choreocore_audio_asset_versions (id)
  on delete set null;

create or replace function public.choreocore_touch_audio_asset_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists choreocore_audio_assets_updated_at_trg on public.choreocore_audio_assets;
create trigger choreocore_audio_assets_updated_at_trg
  before update on public.choreocore_audio_assets
  for each row
  execute function public.choreocore_touch_audio_asset_updated_at();
