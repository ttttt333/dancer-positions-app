-- CHOREOCORE: Supabase（Dashboard の SQL エディタに貼り付けて実行）
-- 1. 認証: Email+Password（Authentication → Providers → Email から有効化）
-- 2. 開発時は「Confirm email」をオフにすると、登録直後にセッションが作られます。
--
-- テーブル名は public.projects ではなく choreocore_projects。
-- 既存の projects（UUID 主キー等）と名前衝突・型不一致を避けるため。

create table if not exists public.choreocore_projects (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  json jsonb not null default '{}'::jsonb,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists choreocore_projects_user_id_idx on public.choreocore_projects (user_id);
create index if not exists choreocore_projects_share_token_idx on public.choreocore_projects (share_token) where share_token is not null;

alter table public.choreocore_projects enable row level security;

drop policy if exists "choreocore_projects select own" on public.choreocore_projects;
create policy "choreocore_projects select own" on public.choreocore_projects
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "choreocore_projects insert own" on public.choreocore_projects;
create policy "choreocore_projects insert own" on public.choreocore_projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "choreocore_projects update own" on public.choreocore_projects;
create policy "choreocore_projects update own" on public.choreocore_projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "choreocore_projects delete own" on public.choreocore_projects;
create policy "choreocore_projects delete own" on public.choreocore_projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 匿名でも share_token さえ合えば閲覧用（データは RPC 越しにのみ返す）
-- 戻り列名は `json` にできない（PostgreSQL の型名と衝突するため `project_json`）
create or replace function public.get_project_by_share_token(t text)
returns table (id bigint, name text, project_json jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.json as project_json
  from public.choreocore_projects p
  where t is not null
    and t <> ''
    and p.share_token = t
  limit 1;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: 音源（バケット名は src/lib/supabaseAudio.ts の CHOREOCORE_AUDIO_BUCKET と一致）
-- Dashboard → Storage で同名の private バケットを作ってもよい（未作成だとアップロードが失敗します）
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('choreocore-audio', 'choreocore-audio', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "choreocore_audio select own" on storage.objects;
create policy "choreocore_audio select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'choreocore-audio'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "choreocore_audio insert own" on storage.objects;
create policy "choreocore_audio insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'choreocore-audio'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "choreocore_audio delete own" on storage.objects;
create policy "choreocore_audio delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'choreocore-audio'
    and split_part(name, '/', 1) = auth.uid()::text
  );
