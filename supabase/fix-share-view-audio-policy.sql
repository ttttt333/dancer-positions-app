-- 共有閲覧で anon が音源を読めない修正（RLS 経由の exists が常に false になる問題）
-- 既に schema.sql / share-view-audio-policy.sql を実行済みの本番で、このファイルだけ再実行すればよい。
--
-- 原因: storage.objects のポリシー内で choreocore_projects を直接参照すると、
--       anon には choreocore_projects の SELECT ポリシーが無く exists が常に false になる。
-- 対処: SECURITY DEFINER 関数で共有条件を評価する。

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
