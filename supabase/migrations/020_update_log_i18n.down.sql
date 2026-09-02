alter table public.choreocore_update_log
  drop column if exists bodies;

drop function if exists public.choreocore_save_update_log(text, jsonb);

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
