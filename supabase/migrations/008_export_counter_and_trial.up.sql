-- CHOREOCORE: 動画書き出し回数カウンタ + 書き出し判定 RPC
-- billing-schema.sql の choreocore_is_pro() を流用（trialing 含む）

alter table public.choreocore_user_billing
  add column if not exists video_export_count integer not null default 0;

create or replace function public.choreocore_can_export_video(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_count integer;
begin
  select public.choreocore_is_pro(p_user_id) into v_is_pro;
  if v_is_pro then
    return true;
  end if;

  select video_export_count into v_count
  from public.choreocore_user_billing
  where user_id = p_user_id;

  return coalesce(v_count, 0) < 10;
end;
$$;

revoke all on function public.choreocore_can_export_video(uuid) from public;
grant execute on function public.choreocore_can_export_video(uuid) to authenticated, service_role;

create or replace function public.choreocore_increment_export_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  update public.choreocore_user_billing
  set video_export_count = video_export_count + 1,
      updated_at = now()
  where user_id = p_user_id
  returning video_export_count into v_new_count;

  if v_new_count is null then
    insert into public.choreocore_user_billing (user_id, video_export_count)
    values (p_user_id, 1)
    on conflict (user_id) do update
      set video_export_count = choreocore_user_billing.video_export_count + 1,
          updated_at = now()
    returning video_export_count into v_new_count;
  end if;

  return v_new_count;
end;
$$;

revoke all on function public.choreocore_increment_export_count(uuid) from public;
grant execute on function public.choreocore_increment_export_count(uuid) to service_role;
