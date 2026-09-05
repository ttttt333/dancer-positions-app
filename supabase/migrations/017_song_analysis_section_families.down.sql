-- 017 down
alter table public.song_analysis
  drop column if exists section_families;
