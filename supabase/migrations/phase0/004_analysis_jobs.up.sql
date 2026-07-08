-- Phase 0 / 004: AI 解析ジョブ（結果は別テーブル・後日追加）
-- ロールバック: 004_analysis_jobs.down.sql

create table if not exists public.choreocore_audio_analysis_jobs (
  id                uuid primary key default gen_random_uuid(),
  asset_version_id  uuid not null
    references public.choreocore_audio_asset_versions (id) on delete cascade,
  job_type          text not null,
  status            text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by      uuid not null references auth.users (id) on delete restrict,
  error_message     text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

comment on table public.choreocore_audio_analysis_jobs is
  'AI 解析ジョブのみ。結果は将来 choreocore_audio_analysis_results へ分離。';

create index if not exists choreocore_audio_analysis_jobs_version_idx
  on public.choreocore_audio_analysis_jobs (asset_version_id, created_at desc);

create index if not exists choreocore_audio_analysis_jobs_status_idx
  on public.choreocore_audio_analysis_jobs (status)
  where status in ('queued', 'running');
