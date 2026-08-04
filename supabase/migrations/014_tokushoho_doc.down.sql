-- 特定商取引法表記ドキュメントの削除

drop function if exists public.choreocore_save_tokushoho(text);
drop function if exists public.choreocore_get_tokushoho();
drop policy if exists choreocore_tokushoho_select_all on public.choreocore_tokushoho;
drop table if exists public.choreocore_tokushoho;
