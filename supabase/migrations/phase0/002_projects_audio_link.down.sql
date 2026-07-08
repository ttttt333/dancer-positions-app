-- Phase 0 / 002 ロールバック

drop index if exists public.choreocore_projects_current_audio_idx;

alter table public.choreocore_projects
  drop column if exists current_audio_asset_id;
