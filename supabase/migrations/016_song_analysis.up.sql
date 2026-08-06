-- 楽曲構造解析キャッシュ（AI提案パイプライン）
-- Spec: song-structure-analysis-spec.md

create table if not exists public.song_analysis (
  id uuid primary key default gen_random_uuid(),
  audio_hash text unique not null,
  track_title text,
  bpm numeric,
  duration_seconds numeric,
  eight_grid jsonb,
  change_points jsonb,
  song_dynamism numeric,
  analyzer_version text not null default 'v1.0.0',
  analyzed_at timestamptz not null default now()
);

create index if not exists idx_song_analysis_hash
  on public.song_analysis (audio_hash);

create index if not exists idx_song_analysis_hash_version
  on public.song_analysis (audio_hash, analyzer_version);

alter table public.song_analysis enable row level security;

-- 読み取りは認証ユーザーに許可（同一楽曲の再利用）
drop policy if exists song_analysis_select_authenticated on public.song_analysis;
create policy song_analysis_select_authenticated
  on public.song_analysis
  for select
  to authenticated
  using (true);

-- 書き込みは service role（Edge Function）想定。authenticated の insert は許可しない
