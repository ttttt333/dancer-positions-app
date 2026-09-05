-- Stage 9: Human feedback 観測データ。Production formation とは分離。
-- 音源本体は保存しない。学習・自動 weight 更新には使わない。

create table if not exists public.choreocore_human_feedback_events (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references auth.users (id) on delete cascade,
  project_id      bigint references public.choreocore_projects (id) on delete set null,
  candidate_id    text not null,
  evaluation_id   text not null,
  kind            text not null check (kind in ('EXPLICIT', 'IMPLICIT')),
  action          text not null,
  layer           text not null check (layer in ('formation', 'transition')),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint choreocore_human_feedback_no_audio
    check (not (payload ? 'audio') and not (payload ? 'email'))
);

comment on table public.choreocore_human_feedback_events is
  'AI候補に対する人間の選択・編集の観測。Production 隊形の正ではない。保持目安 24 ヶ月。自動学習には使わない。';

create index if not exists choreocore_human_feedback_owner_created_idx
  on public.choreocore_human_feedback_events (owner_user_id, created_at desc);

create index if not exists choreocore_human_feedback_candidate_idx
  on public.choreocore_human_feedback_events (candidate_id, created_at desc);

create index if not exists choreocore_human_feedback_project_idx
  on public.choreocore_human_feedback_events (project_id, created_at desc)
  where project_id is not null;

alter table public.choreocore_human_feedback_events enable row level security;

create policy choreocore_human_feedback_select_own
  on public.choreocore_human_feedback_events
  for select
  using (owner_user_id = auth.uid());

create policy choreocore_human_feedback_insert_own
  on public.choreocore_human_feedback_events
  for insert
  with check (owner_user_id = auth.uid());

create policy choreocore_human_feedback_no_update
  on public.choreocore_human_feedback_events
  for update
  using (false);

create policy choreocore_human_feedback_delete_own
  on public.choreocore_human_feedback_events
  for delete
  using (owner_user_id = auth.uid());
