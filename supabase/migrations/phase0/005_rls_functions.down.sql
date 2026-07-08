-- Phase 0 / 005 ロールバック

drop policy if exists "choreocore_analysis_jobs insert" on public.choreocore_audio_analysis_jobs;
drop policy if exists "choreocore_analysis_jobs select" on public.choreocore_audio_analysis_jobs;
drop policy if exists "choreocore_project_members manage" on public.choreocore_project_members;
drop policy if exists "choreocore_project_members select" on public.choreocore_project_members;
drop policy if exists "choreocore_audio_versions insert" on public.choreocore_audio_asset_versions;
drop policy if exists "choreocore_audio_versions select" on public.choreocore_audio_asset_versions;
drop policy if exists "choreocore_audio_assets update" on public.choreocore_audio_assets;
drop policy if exists "choreocore_audio_assets insert" on public.choreocore_audio_assets;
drop policy if exists "choreocore_audio_assets select" on public.choreocore_audio_assets;
drop policy if exists "choreocore_projects update editor" on public.choreocore_projects;
drop policy if exists "choreocore_projects select member" on public.choreocore_projects;

drop function if exists public.choreocore_can_access_storage(text, text, text);
drop function if exists public.choreocore_project_id_for_audio_asset(uuid);
drop function if exists public.choreocore_can_delete_project(bigint);
drop function if exists public.choreocore_can_edit_project(bigint);
drop function if exists public.choreocore_can_view_project(bigint);
drop function if exists public.choreocore_project_role(bigint, uuid);
