-- 生徒閲覧 URL（/view/s/{token}）から音源を再生できるようにする Storage ポリシー。
-- Dashboard の SQL エディタで実行（schema.sql にも同内容を追記済み）。
--
-- ■ 実行後に確認すること（「オブジェクトが見つからない」が出るとき）
-- 1. バケット `choreocore-audio` が存在する（private で可）
-- 2. 作品行に share_token が入っている（共有リンクを発行済み）
-- 3. Storage に実ファイルがある（パス例: {auth.uid()}/24/xxxxxxxx.mp3）
-- 4. choreocore_projects.json の audioSupabasePath が、Storage オブジェクトの objects.name と完全一致
--    （先頭スラッシュなし・URL ではなくパスのみ）
-- 5. 音源取り込み後にクラウド保存した（JSON にパスが載っていないと anon は読めない）
-- 6. 古い作品はエディタで音源を再取り込み → 保存し直す
--
-- ■ anon が choreocore_projects を直接読めないため SECURITY DEFINER 関数を使う
--    （ポリシー内の exists 直参照だと生徒だけ「object not found」になる）

create or replace function public.choreocore_is_shared_view_audio(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.choreocore_projects p
    where p.share_token is not null
      and trim(both from coalesce(p.json->>'audioSupabasePath', '')) = p_path
      and split_part(p_path, '/', 1) = p.user_id::text
  );
$$;

revoke all on function public.choreocore_is_shared_view_audio(text) from public;
grant execute on function public.choreocore_is_shared_view_audio(text) to anon, authenticated;

drop policy if exists "choreocore_audio select shared view" on storage.objects;
create policy "choreocore_audio select shared view"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'choreocore-audio'
    and public.choreocore_is_shared_view_audio(objects.name)
  );
