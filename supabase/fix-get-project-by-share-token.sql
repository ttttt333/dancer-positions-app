-- 既に schema.sql の前半まで実行済みで、関数だけ失敗した場合にこのブロックだけ実行してもよい
create or replace function public.get_project_by_share_token(t text)
returns table (id bigint, name text, project_json jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.json as project_json
  from public.projects p
  where t is not null
    and t <> ''
    and p.share_token = t
  limit 1;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;
