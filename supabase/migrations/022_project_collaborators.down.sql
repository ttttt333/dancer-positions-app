drop policy if exists "choreocore project realtime write" on realtime.messages;
drop policy if exists "choreocore project realtime read" on realtime.messages;
drop function if exists public.choreocore_can_access_realtime_topic(text);

drop policy if exists "choreocore_audio update collaborators" on storage.objects;
drop policy if exists "choreocore_audio insert collaborators" on storage.objects;
drop policy if exists "choreocore_audio select collaborators" on storage.objects;
drop function if exists public.choreocore_can_access_audio_path(text);

drop function if exists public.choreocore_join_project(text);
drop trigger if exists choreocore_projects_guard_owner_fields on public.choreocore_projects;
drop function if exists public.choreocore_projects_guard_owner_fields();

drop policy if exists "choreocore_projects select own" on public.choreocore_projects;
create policy "choreocore_projects select own" on public.choreocore_projects
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "choreocore_projects update own" on public.choreocore_projects;
create policy "choreocore_projects update own" on public.choreocore_projects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop table if exists public.choreocore_project_members;
drop function if exists public.choreocore_can_access_project(bigint);
drop function if exists public.choreocore_is_project_owner(bigint);

alter table public.choreocore_projects drop column if exists edit_token;
