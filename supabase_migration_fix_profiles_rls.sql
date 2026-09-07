-- Migration: fix_profiles_rls
-- A tabela "profiles" guarda o google_refresh_token (dado sensível) por
-- utilizadora, na coluna "id" (= auth.uid() da profissional dona do perfil).
-- Esta migration garante que só a própria dona consegue ler/escrever o seu
-- perfil, independentemente do que já existisse antes.

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (id = auth.uid());

-- Remove policies antigas/duplicadas com nomes diferentes que possam ainda
-- existir e sejam mais permissivas do que as de cima.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname not in (
        'profiles_select_own', 'profiles_insert_own',
        'profiles_update_own', 'profiles_delete_own'
      )
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;
