-- Phase 0 / 001 ロールバック

drop trigger if exists choreocore_audio_assets_updated_at_trg on public.choreocore_audio_assets;
drop function if exists public.choreocore_touch_audio_asset_updated_at();

alter table if exists public.choreocore_audio_assets
  drop constraint if exists choreocore_audio_assets_current_version_fk;

drop table if exists public.choreocore_audio_asset_versions cascade;
drop table if exists public.choreocore_audio_assets cascade;
