-- Phase 0 / 002: 作品 → 現行音源リンク（nullable）
-- ロールバック: 002_projects_audio_link.down.sql

alter table public.choreocore_projects
  add column if not exists current_audio_asset_id uuid
    references public.choreocore_audio_assets (id) on delete set null;

comment on column public.choreocore_projects.current_audio_asset_id is
  '現行音源 asset。アップロード中は NULL になり得る。更新は choreocore_register_project_audio RPC 経由。';

create index if not exists choreocore_projects_current_audio_idx
  on public.choreocore_projects (current_audio_asset_id)
  where current_audio_asset_id is not null;
