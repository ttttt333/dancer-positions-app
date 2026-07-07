-- 波形サイドカー (.wavepeaks.json) の upsert に必要な UPDATE ポリシー。
-- 「new row violates row-level security policy」が upsert 時に出る場合は Dashboard SQL で実行。

drop policy if exists "choreocore_audio update own" on storage.objects;
create policy "choreocore_audio update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'choreocore-audio'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'choreocore-audio'
    and split_part(name, '/', 1) = auth.uid()::text
  );
