-- 016_song_analysis down
drop policy if exists song_analysis_select_authenticated on public.song_analysis;
drop table if exists public.song_analysis;
