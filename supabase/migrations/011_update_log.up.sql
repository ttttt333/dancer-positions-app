-- お知らせ / UPDATE LOG（単一行ドキュメント）
-- 誰でも閲覧可。更新は choreocore_admin_emails に載ったログインユーザーのみ。

create table if not exists public.choreocore_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.choreocore_update_log (
  id integer primary key default 1 check (id = 1),
  body text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

insert into public.choreocore_update_log (id, body)
values (
  1,
  E'# ChoreoCore アップデートログ\n\nここにバージョンアップや修正の内容を書いてください。\n管理者がこのページで直接編集・更新できます。\n'
)
on conflict (id) do nothing;

alter table public.choreocore_update_log enable row level security;
alter table public.choreocore_admin_emails enable row level security;

drop policy if exists choreocore_update_log_select_all on public.choreocore_update_log;
create policy choreocore_update_log_select_all
  on public.choreocore_update_log
  for select
  to anon, authenticated
  using (true);

drop policy if exists choreocore_admin_emails_select_self on public.choreocore_admin_emails;
create policy choreocore_admin_emails_select_self
  on public.choreocore_admin_emails
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.choreocore_is_update_log_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.choreocore_admin_emails a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.choreocore_is_update_log_admin() from public;
grant execute on function public.choreocore_is_update_log_admin() to authenticated;

create or replace function public.choreocore_get_update_log()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.choreocore_update_log%rowtype;
begin
  select * into r from public.choreocore_update_log where id = 1;
  if not found then
    return jsonb_build_object(
      'body', '',
      'updatedAt', null,
      'canEdit', public.choreocore_is_update_log_admin()
    );
  end if;
  return jsonb_build_object(
    'body', r.body,
    'updatedAt', r.updated_at,
    'canEdit', case
      when auth.uid() is null then false
      else public.choreocore_is_update_log_admin()
    end
  );
end;
$$;

revoke all on function public.choreocore_get_update_log() from public;
grant execute on function public.choreocore_get_update_log() to anon, authenticated;

create or replace function public.choreocore_save_update_log(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.choreocore_update_log%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if not public.choreocore_is_update_log_admin() then
    raise exception '管理者権限がありません';
  end if;

  insert into public.choreocore_update_log (id, body, updated_at, updated_by)
  values (1, coalesce(p_body, ''), now(), auth.uid())
  on conflict (id) do update
    set body = excluded.body,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning * into r;

  return jsonb_build_object(
    'body', r.body,
    'updatedAt', r.updated_at,
    'canEdit', true
  );
end;
$$;

revoke all on function public.choreocore_save_update_log(text) from public;
grant execute on function public.choreocore_save_update_log(text) to authenticated;
