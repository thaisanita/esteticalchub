-- Migration: conformidade (RGPD / Lei 41/2004)
-- 1. Opt-out público dos lembretes (link enviado nos emails/WhatsApp)
-- 2. Anti-spam e registo de origem no formulário da página pública
-- 3. Remove tokens do Google guardados na tabela profiles (a sincronização
--    com o Google Calendar foi removida, os tokens não devem ficar guardados)

-- ---------------------------------------------------------------------------
-- 1. Opt-out: a cliente carrega no link e deixa de receber lembretes.
-- O token (opt_out_token) é único por cliente; a função só altera essa linha.
-- ---------------------------------------------------------------------------
create or replace function public.optout_lembretes(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clientes
     set aceita_lembretes = false,
         opt_out_em = now()
   where opt_out_token = p_token;

  return found;
end;
$$;

revoke all on function public.optout_lembretes(uuid) from public;
grant execute on function public.optout_lembretes(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Formulário público: limite de pedidos (anti-spam) + origem no cartão.
-- Mantém a mesma assinatura (não quebra o site já publicado).
-- ---------------------------------------------------------------------------
create or replace function public.criar_lead_publica(
  p_slug text,
  p_nome text,
  p_telefone text,
  p_interesse text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_quadro_id uuid;
  v_lista_id uuid;
  v_ordem int;
  v_recentes int;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Nome é obrigatório';
  end if;
  if p_telefone is null or btrim(p_telefone) = '' then
    raise exception 'Telefone é obrigatório';
  end if;

  select usuario_id into v_usuario_id
  from public.paginas_publicas
  where slug = p_slug;

  if v_usuario_id is null then
    return false;
  end if;

  select id into v_quadro_id
  from public.quadros_kanban
  where usuario_id = v_usuario_id and nome = 'Leads'
  limit 1;

  if v_quadro_id is null then
    insert into public.quadros_kanban (usuario_id, nome, cor)
    values (v_usuario_id, 'Leads', '#10b981')
    returning id into v_quadro_id;
  end if;

  select id into v_lista_id
  from public.listas_kanban
  where quadro_id = v_quadro_id and nome = 'Nova Lead'
  limit 1;

  if v_lista_id is null then
    insert into public.listas_kanban (usuario_id, quadro_id, nome, ordem)
    values (v_usuario_id, v_quadro_id, 'Nova Lead', 0)
    returning id into v_lista_id;
  end if;

  -- Anti-spam: no máximo 10 leads por minuto por página
  select count(*) into v_recentes
  from public.cartoes_kanban
  where lista_id = v_lista_id and criado_em > now() - interval '1 minute';

  if v_recentes >= 10 then
    raise exception 'Demasiados pedidos. Tente novamente dentro de instantes.';
  end if;

  select coalesce(max(ordem), -1) + 1 into v_ordem
  from public.cartoes_kanban
  where lista_id = v_lista_id;

  insert into public.cartoes_kanban (usuario_id, lista_id, titulo, descricao, ordem)
  values (
    v_usuario_id,
    v_lista_id,
    left(btrim(p_nome), 200),
    'Telefone: ' || left(btrim(p_telefone), 50)
      || case when p_interesse is not null and btrim(p_interesse) <> ''
              then E'\nInteresse: ' || left(btrim(p_interesse), 500)
              else '' end
      || E'\nOrigem: formulário da página pública (a pessoa aceitou ser contactada) em '
      || to_char(now() at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI'),
    v_ordem
  );

  return true;
end;
$$;

revoke all on function public.criar_lead_publica(text, text, text, text) from public;
grant execute on function public.criar_lead_publica(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tokens do Google: apaga e remove as colunas (já não são usadas).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'google_refresh_token') then
    update public.profiles set google_refresh_token = null;
    alter table public.profiles drop column google_refresh_token;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'google_calendar_connected') then
    alter table public.profiles drop column google_calendar_connected;
  end if;
end $$;
