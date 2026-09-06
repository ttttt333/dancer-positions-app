-- 018 down
alter table public.song_analysis
  drop column if exists structure_v2;
