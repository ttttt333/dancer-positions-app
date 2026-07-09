drop function if exists public.choreocore_increment_export_count(uuid);
drop function if exists public.choreocore_can_export_video(uuid);

alter table public.choreocore_user_billing
  drop column if exists video_export_count;
