-- 018: song_analysis に chroma-SSM v2 構造結果を追加
alter table public.song_analysis
  add column if not exists structure_v2 jsonb;

comment on column public.song_analysis.structure_v2 is
  'song_structure_v2 / StructureResultV2 JSON（cluster_id・energy_trend 含む）';
