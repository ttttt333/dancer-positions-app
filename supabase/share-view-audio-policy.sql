-- 生徒閲覧 URL（/view/s/{token}）から音源を再生できるようにする Storage ポリシー。
-- Dashboard の SQL エディタで実行（schema.sql にも同内容を追記済み）。

drop policy if exists "choreocore_audio select shared view" on storage.objects;
create policy "choreocore_audio select shared view"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'choreocore-audio'
    and exists (
      select 1
      from public.choreocore_projects p
      where p.share_token is not null
        and trim(both from coalesce(p.json->>'audioSupabasePath', '')) = name
    )
  );
