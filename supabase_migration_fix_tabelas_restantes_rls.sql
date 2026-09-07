-- Migration: fix_tabelas_restantes_rls
-- Garante RLS correta em 3 tabelas que ainda não tinham sido revistas:
-- configuracoes_usuario e fila_notificacoes (usadas ativamente pelo site,
-- guardam telefone e mensagens de clientes) e procedimentos (sem uso ativo
-- no site hoje, mas existe na base de dados e é acessível via API pública
-- com a chave anon, por isso tem de estar protegida na mesma).

-- configuracoes_usuario: dono = usuario_id
alter table public.configuracoes_usuario enable row level security;

drop policy if exists "configuracoes_usuario_select_own" on public.configuracoes_usuario;
create policy "configuracoes_usuario_select_own"
  on public.configuracoes_usuario for select
  using (usuario_id = auth.uid());

drop policy if exists "configuracoes_usuario_insert_own" on public.configuracoes_usuario;
create policy "configuracoes_usuario_insert_own"
  on public.configuracoes_usuario for insert
  with check (usuario_id = auth.uid());

drop policy if exists "configuracoes_usuario_update_own" on public.configuracoes_usuario;
create policy "configuracoes_usuario_update_own"
  on public.configuracoes_usuario for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "configuracoes_usuario_delete_own" on public.configuracoes_usuario;
create policy "configuracoes_usuario_delete_own"
  on public.configuracoes_usuario for delete
  using (usuario_id = auth.uid());

-- fila_notificacoes: dono = usuario_id (guarda telefone/mensagens de clientes)
alter table public.fila_notificacoes enable row level security;

drop policy if exists "fila_notificacoes_select_own" on public.fila_notificacoes;
create policy "fila_notificacoes_select_own"
  on public.fila_notificacoes for select
  using (usuario_id = auth.uid());

drop policy if exists "fila_notificacoes_insert_own" on public.fila_notificacoes;
create policy "fila_notificacoes_insert_own"
  on public.fila_notificacoes for insert
  with check (usuario_id = auth.uid());

drop policy if exists "fila_notificacoes_update_own" on public.fila_notificacoes;
create policy "fila_notificacoes_update_own"
  on public.fila_notificacoes for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "fila_notificacoes_delete_own" on public.fila_notificacoes;
create policy "fila_notificacoes_delete_own"
  on public.fila_notificacoes for delete
  using (usuario_id = auth.uid());

-- procedimentos: sem uso ativo no site hoje, sem coluna de dono conhecida —
-- por segurança, permite leitura só a quem está autenticado, e nenhuma
-- escrita pública (RLS ligada, sem policies de insert/update/delete).
alter table public.procedimentos enable row level security;

drop policy if exists "procedimentos_select_authenticated" on public.procedimentos;
create policy "procedimentos_select_authenticated"
  on public.procedimentos for select
  to authenticated
  using (true);

-- Remove quaisquer policies antigas mais permissivas que possam existir,
-- em qualquer uma das 3 tabelas.
do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('configuracoes_usuario', 'fila_notificacoes', 'procedimentos')
      and policyname not in (
        'configuracoes_usuario_select_own', 'configuracoes_usuario_insert_own',
        'configuracoes_usuario_update_own', 'configuracoes_usuario_delete_own',
        'fila_notificacoes_select_own', 'fila_notificacoes_insert_own',
        'fila_notificacoes_update_own', 'fila_notificacoes_delete_own',
        'procedimentos_select_authenticated'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;
