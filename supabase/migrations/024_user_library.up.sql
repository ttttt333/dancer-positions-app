-- 端末横断ライブラリ（形の箱・ステージプリセット・雛形お気に入り）
-- プロジェクト JSON とは独立。ログインユーザ 1 行。

create table if not exists public.choreocore_user_library (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.choreocore_user_library is
  'Cross-device library: formation box, stage presets, preset favorites. One row per auth user.';

alter table public.choreocore_user_library enable row level security;

drop policy if exists "choreocore_user_library select own" on public.choreocore_user_library;
create policy "choreocore_user_library select own"
  on public.choreocore_user_library
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "choreocore_user_library insert own" on public.choreocore_user_library;
create policy "choreocore_user_library insert own"
  on public.choreocore_user_library
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "choreocore_user_library update own" on public.choreocore_user_library;
create policy "choreocore_user_library update own"
  on public.choreocore_user_library
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "choreocore_user_library delete own" on public.choreocore_user_library;
create policy "choreocore_user_library delete own"
  on public.choreocore_user_library
  for delete
  to authenticated
  using (auth.uid() = user_id);
