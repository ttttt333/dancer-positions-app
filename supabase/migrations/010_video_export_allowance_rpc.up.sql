-- 動画書き出し上限チェック + カウント増分（認証ユーザーが RPC で直接呼び出し可能）
-- Edge Function video-export-check と同等。CORS 問題を避けるためクライアントはこちらを優先。

create or replace function public.choreocore_request_video_export_allowance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_can boolean;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  select public.choreocore_can_export_video(v_user_id) into v_can;
  if not coalesce(v_can, false) then
    return jsonb_build_object('allowed', false, 'reason', 'export_limit_reached');
  end if;

  select public.choreocore_increment_export_count(v_user_id) into v_count;

  return jsonb_build_object(
    'allowed', true,
    'exportCount', v_count
  );
end;
$$;

revoke all on function public.choreocore_request_video_export_allowance() from public;
grant execute on function public.choreocore_request_video_export_allowance() to authenticated;
