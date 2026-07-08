-- Phase 0 / 003: 共同編集メンバー
-- ロールバック: 003_project_members.down.sql

create table if not exists public.choreocore_project_members (
  project_id  bigint not null references public.choreocore_projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'editor', 'viewer')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.choreocore_project_members is
  '共同編集。既存 projects.user_id は暗黙 owner（メンバー行が無くても owner 扱い）。';

create index if not exists choreocore_project_members_user_idx
  on public.choreocore_project_members (user_id);

-- 既存オーナーをメンバー行にバックフィル（冪等）
insert into public.choreocore_project_members (project_id, user_id, role)
select p.id, p.user_id, 'owner'
from public.choreocore_projects p
on conflict (project_id, user_id) do nothing;
