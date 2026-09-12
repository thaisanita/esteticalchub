-- Migration: fila_notificacoes_envio
-- Fase 1 das mensagens automáticas para clientes.
-- 1. Amplia a fila_notificacoes com os campos que o "carteiro" (Edge Function
--    processar-fila) precisa para enviar de forma fiável e auditável.
-- 2. Adiciona consentimento / opt-out por cliente (LGPD).
-- 3. Cria a função reivindicar_notificacoes(), que entrega um lote de linhas
--    já "trancadas" para o worker, evitando envio em duplicado se o cron
--    correr duas vezes ao mesmo tempo.
--
-- Depois de aplicar, ver NOTIFICACOES_AUTOMATICAS.md para o deploy da função
-- e o agendamento com pg_cron.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas na fila
-- ---------------------------------------------------------------------------
alter table public.fila_notificacoes
  add column if not exists mensagem     text,          -- texto congelado no momento do agendamento
  add column if not exists assunto      text,          -- assunto (usado no email)
  add column if not exists destino      text,          -- email / telefone já resolvido
  add column if not exists tentativas   integer not null default 0,
  add column if not exists ultimo_erro  text,
  add column if not exists enviado_em   timestamptz,
  add column if not exists provider_id  text,          -- id da mensagem no provedor (Resend, etc.)
  add column if not exists updated_at   timestamptz not null default now();

-- status possíveis: 'pendente' | 'processando' | 'enviado' | 'erro' | 'falhou' | 'cancelado'
comment on column public.fila_notificacoes.status is
  'pendente=aguarda disparo; processando=worker a tratar; enviado=ok; erro=falhou mas vai repetir; falhou=desistiu apos 3 tentativas; cancelado=opt-out ou sem contacto';

create index if not exists idx_fila_notif_pendentes
  on public.fila_notificacoes (canal, data_disparo)
  where status in ('pendente', 'erro');

drop trigger if exists trg_fila_notif_updated_at on public.fila_notificacoes;
create trigger trg_fila_notif_updated_at
  before update on public.fila_notificacoes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Consentimento / opt-out por cliente
-- ---------------------------------------------------------------------------
alter table public.clientes
  add column if not exists aceita_lembretes boolean not null default true,
  add column if not exists opt_out_em       timestamptz,
  add column if not exists opt_out_token    uuid not null default gen_random_uuid();

comment on column public.clientes.aceita_lembretes is
  'Se false, a cliente pediu para nao receber mensagens automaticas (LGPD).';
comment on column public.clientes.opt_out_token is
  'Token do link "nao quero receber" enviado no rodape das mensagens.';

-- ---------------------------------------------------------------------------
-- 3. Reivindicação atómica de um lote para o worker
-- ---------------------------------------------------------------------------
create or replace function public.reivindicar_notificacoes(
  p_limite integer default 50,
  p_canal  text    default 'email'
)
returns setof public.fila_notificacoes
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.fila_notificacoes f
     set status     = 'processando',
         tentativas = coalesce(f.tentativas, 0) + 1,
         updated_at = now()
   where f.id in (
     select c.id
       from public.fila_notificacoes c
      where c.status in ('pendente', 'erro')
        and c.canal = p_canal
        and c.data_disparo <= now()
        and coalesce(c.tentativas, 0) < 3
      order by c.data_disparo
      for update skip locked
      limit p_limite
   )
  returning f.*;
end;
$$;

-- Só o service_role (usado pela Edge Function) pode chamar isto.
revoke all on function public.reivindicar_notificacoes(integer, text) from public, anon, authenticated;
grant execute on function public.reivindicar_notificacoes(integer, text) to service_role;
