-- CHOREOCORE: Supabase（Dashboard の SQL エディタに貼り付けて実行）
-- 1. 認証: Email+Password（Authentication → Providers → Email から有効化）
-- 2. 開発時は「Confirm email」をオフにすると、登録直後にセッションが作られます。

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  json jsonb not null default '{}'::jsonb,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_share_token_idx on public.projects (share_token) where share_token is not null;

alter table public.projects enable row level security;

drop policy if exists "projects select own" on public.projects;
create policy "projects select own" on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "projects insert own" on public.projects;
create policy "projects insert own" on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "projects update own" on public.projects;
create policy "projects update own" on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects delete own" on public.projects;
create policy "projects delete own" on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 匿名でも share_token さえ合えば閲覧用（データは RPC 越しにのみ返す）
create or replace function public.get_project_by_share_token(t text)
returns table (id bigint, name text, json jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.json
  from public.projects p
  where t is not null
    and t <> ''
    and p.share_token = t
  limit 1;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;
