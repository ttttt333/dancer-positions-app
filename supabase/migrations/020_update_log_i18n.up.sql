-- お知らせ本文を言語別に保持する。
-- body は日本語ソース（編集用）。bodies は { ja, en, ko, zh, es, fr, de, pt }。

alter table public.choreocore_update_log
  add column if not exists bodies jsonb not null default '{}'::jsonb;

update public.choreocore_update_log
set bodies = jsonb_build_object('ja', body)
where coalesce(bodies, '{}'::jsonb) = '{}'::jsonb
  and coalesce(body, '') <> '';

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
      'bodies', '{}'::jsonb,
      'updatedAt', null,
      'canEdit', public.choreocore_is_update_log_admin()
    );
  end if;
  return jsonb_build_object(
    'body', r.body,
    'bodies', coalesce(r.bodies, '{}'::jsonb),
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

drop function if exists public.choreocore_save_update_log(text);

create or replace function public.choreocore_save_update_log(
  p_body text,
  p_bodies jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.choreocore_update_log%rowtype;
  next_bodies jsonb;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if not public.choreocore_is_update_log_admin() then
    raise exception '管理者権限がありません';
  end if;

  next_bodies := coalesce(p_bodies, '{}'::jsonb);
  if next_bodies = '{}'::jsonb and coalesce(p_body, '') <> '' then
    next_bodies := jsonb_build_object('ja', coalesce(p_body, ''));
  elsif coalesce(next_bodies ->> 'ja', '') = '' and coalesce(p_body, '') <> '' then
    next_bodies := next_bodies || jsonb_build_object('ja', p_body);
  end if;

  insert into public.choreocore_update_log (id, body, bodies, updated_at, updated_by)
  values (1, coalesce(p_body, ''), next_bodies, now(), auth.uid())
  on conflict (id) do update
    set body = excluded.body,
        bodies = excluded.bodies,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning * into r;

  return jsonb_build_object(
    'body', r.body,
    'bodies', coalesce(r.bodies, '{}'::jsonb),
    'updatedAt', r.updated_at,
    'canEdit', true
  );
end;
$$;

revoke all on function public.choreocore_save_update_log(text, jsonb) from public;
grant execute on function public.choreocore_save_update_log(text, jsonb) to authenticated;
