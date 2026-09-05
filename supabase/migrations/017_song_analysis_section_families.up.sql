-- 017: song_analysis に SSM section_families を追加
-- Fly algo-v1.4.0 以降が返すコールバック用クラスタ

alter table public.song_analysis
  add column if not exists section_families jsonb;

comment on column public.song_analysis.section_families is
  'SSM (Chroma+MFCC) section clusters: [{ familyId, type, occurrences }]';
