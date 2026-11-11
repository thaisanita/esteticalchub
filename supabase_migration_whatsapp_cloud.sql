-- =============================================================================
-- Migration: whatsapp_cloud
-- Integração paralela com a WhatsApp Cloud API oficial da Meta (fase de testes).
--
-- ESTADO: PENDENTE DE APROVAÇÃO. Não aplicar sem autorização explícita.
--
-- Esta migration é apenas ADITIVA:
--   * não altera reivindicar_notificacoes();
--   * não altera colunas, defaults ou policies existentes;
--   * não mexe no cron;
--   * enquanto nenhuma profissional estiver em whatsapp_cloud_profissionais com
--     ativo = true, o comportamento de produção é exatamente o atual.
--
-- Separação de fornecedores (Baileys vs Meta Cloud):
--   O worker de produção (Edge Function `super-action`, chamada pelo cron
--   `processar-fila-notificacoes`) só reivindica linhas com canal = 'email' e
--   canal = 'whatsapp' (filtro exato `c.canal = p_canal`). Um trigger BEFORE
--   INSERT reencaminha os lembretes de 1 dia das profissionais aderentes para
--   canal = 'whatsapp_cloud'. Assim, cada linha pertence a UM único fornecedor
--   desde o momento em que é criada — os dois "reivindicadores" atuam sobre
--   conjuntos disjuntos por construção, não por coincidência de horários.
--
-- Ver docs/WHATSAPP_CLOUD_API.md.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Consentimento explícito para lembretes por WhatsApp (EstetiCalcHub)
-- -----------------------------------------------------------------------------
-- aceita_lembretes (default true) continua a ser o opt-out geral. Para a Meta é
-- preciso um opt-in que identifique quem envia; sem estes campos preenchidos o
-- envio pela Cloud API é recusado. O formulário que os preenche fica para a
-- fase seguinte (obrigatória antes de envios reais).
alter table public.clientes
  add column if not exists whatsapp_consentimento_em     timestamptz,
  add column if not exists whatsapp_consentimento_origem text;

comment on column public.clientes.whatsapp_consentimento_em is
  'Quando a cliente aceitou receber lembretes por WhatsApp enviados pelo EstetiCalcHub. NULL = sem consentimento (a Cloud API não envia).';
comment on column public.clientes.whatsapp_consentimento_origem is
  'Como o consentimento foi recolhido (ex.: formulario_marcacao, presencial_registado_pela_profissional).';

-- -----------------------------------------------------------------------------
-- 2. Adesão (piloto) por profissional
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_profissionais (
  usuario_id    uuid primary key references auth.users(id) on delete cascade,
  ativo         boolean not null default false,
  limite_diario integer not null default 20 check (limite_diario between 0 and 250),
  criado_em     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.whatsapp_cloud_profissionais is
  'Profissionais cujos lembretes de 1 dia por WhatsApp passam a ser enviados pela Cloud API (número partilhado). Só o service_role escreve.';

drop trigger if exists trg_wa_cloud_prof_updated_at on public.whatsapp_cloud_profissionais;
create trigger trg_wa_cloud_prof_updated_at
  before update on public.whatsapp_cloud_profissionais
  for each row execute function public.set_updated_at();

alter table public.whatsapp_cloud_profissionais enable row level security;
drop policy if exists "wa_cloud_prof_select_own" on public.whatsapp_cloud_profissionais;
create policy "wa_cloud_prof_select_own"
  on public.whatsapp_cloud_profissionais for select
  using (usuario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Registo de envios pela Cloud API (ciclo de vida completo)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_envios (
  id                    uuid primary key default gen_random_uuid(),
  fila_id               uuid references public.fila_notificacoes(id) on delete set null,
  agendamento_id        uuid references public.agendamentos(id) on delete set null,
  usuario_id            uuid not null references auth.users(id) on delete cascade,
  tipo                  text not null,
  antecedencia          text not null,
  versao_marcacao       text not null,          -- 'AAAA-MM-DDTHH:MM' da marcação no momento do envio
  chave_idempotencia    text not null,
  telefone_mascarado    text not null,          -- ex.: +351*****569 (nunca o número completo)
  template              text not null,
  idioma                text not null,
  estado                text not null default 'reservado'
    check (estado in ('pendente', 'reservado', 'aceite', 'enviado', 'entregue', 'lido', 'falhado', 'desconhecido')),
  retentavel            boolean,
  wamid                 text,
  tentativas            integer not null default 0,
  proxima_tentativa_em  timestamptz,
  reservado_em          timestamptz,
  aceite_em             timestamptz,
  enviado_em            timestamptz,
  entregue_em           timestamptz,
  lido_em               timestamptz,
  falhado_em            timestamptz,
  erro_codigo           text,
  erro_detalhe          text,
  criado_em             timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint whatsapp_cloud_envios_chave_unica unique (chave_idempotencia),
  constraint whatsapp_cloud_envios_wamid_unico unique (wamid)
);

comment on column public.whatsapp_cloud_envios.estado is
  'pendente=nova tentativa agendada após rejeição temporária CONFIRMADA; reservado=a enviar agora; aceite=Meta devolveu wamid (não é entrega); enviado/entregue/lido=webhook; falhado=rejeição confirmada ou falha após aceitação; desconhecido=resultado incerto (timeout, resposta sem wamid, reserva expirada) — NUNCA é repetido automaticamente.';

create index if not exists idx_wa_cloud_envios_fila    on public.whatsapp_cloud_envios (fila_id);
create index if not exists idx_wa_cloud_envios_usuario on public.whatsapp_cloud_envios (usuario_id, criado_em);
create index if not exists idx_wa_cloud_envios_reservado
  on public.whatsapp_cloud_envios (reservado_em) where estado = 'reservado';

drop trigger if exists trg_wa_cloud_envios_updated_at on public.whatsapp_cloud_envios;
create trigger trg_wa_cloud_envios_updated_at
  before update on public.whatsapp_cloud_envios
  for each row execute function public.set_updated_at();

alter table public.whatsapp_cloud_envios enable row level security;
drop policy if exists "wa_cloud_envios_select_own" on public.whatsapp_cloud_envios;
create policy "wa_cloud_envios_select_own"
  on public.whatsapp_cloud_envios for select
  using (usuario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. Eventos de webhook (deduplicação)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_eventos (
  id           bigserial primary key,
  wamid        text not null,
  estado       text not null check (estado in ('enviado', 'entregue', 'lido', 'falhado')),
  ocorrido_em  timestamptz,
  erro_codigo  text,
  recebido_em  timestamptz not null default now(),
  constraint whatsapp_cloud_eventos_unico unique (wamid, estado)
);

alter table public.whatsapp_cloud_eventos enable row level security;  -- sem policies: só service_role

-- -----------------------------------------------------------------------------
-- 5. Encaminhamento na criação + proteção contra edição pelo cliente
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_encaminhar_fila()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.canal = 'whatsapp'
     and coalesce(new.tipo, 'lembrete') = 'lembrete'
     and new.antecedencia = '1_dia'
     and exists (
       select 1 from public.whatsapp_cloud_profissionais p
        where p.usuario_id = new.usuario_id and p.ativo
     ) then
    new.canal := 'whatsapp_cloud';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fila_whatsapp_cloud_encaminhar on public.fila_notificacoes;
create trigger trg_fila_whatsapp_cloud_encaminhar
  before insert on public.fila_notificacoes
  for each row execute function public.whatsapp_cloud_encaminhar_fila();

-- As policies atuais deixam a profissional fazer UPDATE às suas linhas. Para o
-- número partilhado isso não pode servir para mudar uma linha de fornecedor nem
-- para mexer numa linha que já pertence à Cloud API. DELETE continua permitido
-- (é o que NovoAgendamento.tsx faz ao editar uma marcação).
create or replace function public.whatsapp_cloud_proteger_fila()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if old.canal = 'whatsapp_cloud' or new.canal = 'whatsapp_cloud' then
    raise exception 'Linhas da WhatsApp Cloud API só podem ser alteradas pelo servidor.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fila_whatsapp_cloud_proteger on public.fila_notificacoes;
create trigger trg_fila_whatsapp_cloud_proteger
  before update on public.fila_notificacoes
  for each row execute function public.whatsapp_cloud_proteger_fila();

-- -----------------------------------------------------------------------------
-- 6. Reivindicação atómica (só canal = 'whatsapp_cloud')
-- -----------------------------------------------------------------------------
create or replace function public.reivindicar_whatsapp_cloud(
  p_limite         integer default 20,
  p_max_tentativas integer default 3
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
      where c.canal = 'whatsapp_cloud'
        and c.status in ('pendente', 'erro')
        and c.data_disparo <= now()
        and coalesce(c.tentativas, 0) < p_max_tentativas
        and not exists (
          select 1 from public.whatsapp_cloud_envios e
           where e.fila_id = c.id
             and e.estado = 'pendente'
             and e.proxima_tentativa_em > now()
        )
      order by c.data_disparo
      for update skip locked
      limit p_limite
   )
  returning f.*;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Validação no servidor — nunca confia em destino/mensagem da fila
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_preparar(
  p_fila_id uuid,
  p_agora   timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f        public.fila_notificacoes%rowtype;
  a        public.agendamentos%rowtype;
  c        public.clientes%rowtype;
  adesao   public.whatsapp_cloud_profissionais%rowtype;
  inicio   timestamptz;
  nome_prof text;
  usados   integer;
  telefone text;
begin
  select * into f from public.fila_notificacoes where id = p_fila_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'fila_inexistente'); end if;
  if f.canal <> 'whatsapp_cloud' then return jsonb_build_object('ok', false, 'motivo', 'canal_invalido'); end if;
  if f.status <> 'processando' then return jsonb_build_object('ok', false, 'motivo', 'fila_nao_reservada'); end if;
  if coalesce(f.tipo, 'lembrete') <> 'lembrete' or f.antecedencia <> '1_dia' then
    return jsonb_build_object('ok', false, 'motivo', 'tipo_nao_suportado');
  end if;

  select * into adesao from public.whatsapp_cloud_profissionais where usuario_id = f.usuario_id;
  if not found or not adesao.ativo then
    return jsonb_build_object('ok', false, 'motivo', 'profissional_sem_adesao');
  end if;

  select * into a from public.agendamentos where id = f.agendamento_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'agendamento_inexistente'); end if;
  if a.usuario_id is distinct from f.usuario_id then
    return jsonb_build_object('ok', false, 'motivo', 'profissional_nao_corresponde');
  end if;
  if not a.lembrete_1dia then return jsonb_build_object('ok', false, 'motivo', 'lembrete_desligado'); end if;
  if a.canal_notificacao is distinct from 'whatsapp' then
    return jsonb_build_object('ok', false, 'motivo', 'canal_da_marcacao_nao_e_whatsapp');
  end if;
  if a.faltou then return jsonb_build_object('ok', false, 'motivo', 'marcacao_com_falta'); end if;
  if a.status_confirmacao = 'cancelado' or a.confirmacao_status = 'cancelado' then
    return jsonb_build_object('ok', false, 'motivo', 'marcacao_cancelada');
  end if;

  if a.cliente_id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_cliente_associada'); end if;
  select * into c from public.clientes where id = a.cliente_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'cliente_inexistente'); end if;
  if c.agenda_id is distinct from a.agenda_id then
    return jsonb_build_object('ok', false, 'motivo', 'cliente_de_outra_agenda');
  end if;
  if not c.aceita_lembretes then return jsonb_build_object('ok', false, 'motivo', 'cliente_com_opt_out'); end if;
  if c.whatsapp_consentimento_em is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_consentimento_whatsapp');
  end if;

  telefone := coalesce(nullif(trim(c.telefone), ''), nullif(trim(a.telefone_cliente), ''));
  if telefone is null then return jsonb_build_object('ok', false, 'motivo', 'sem_telefone'); end if;

  -- Elegibilidade temporal: hora de Lisboa; a mensagem diz "amanhã".
  inicio := (a.data + a.hora) at time zone 'Europe/Lisbon';
  if p_agora < inicio - interval '24 hours' - interval '15 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'cedo_demais');
  end if;
  if (p_agora at time zone 'Europe/Lisbon')::date <> a.data - 1 or p_agora >= inicio then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela_de_amanha');
  end if;

  select nullif(trim(pp.nome_negocio), '') into nome_prof
    from public.paginas_publicas pp where pp.usuario_id = a.usuario_id limit 1;
  if nome_prof is null then
    select nullif(trim(u.raw_user_meta_data ->> 'full_name'), '') into nome_prof
      from auth.users u where u.id = a.usuario_id;
  end if;
  if nome_prof is null then return jsonb_build_object('ok', false, 'motivo', 'sem_nome_profissional'); end if;

  select count(*) into usados
    from public.whatsapp_cloud_envios e
   where e.usuario_id = a.usuario_id
     and e.criado_em > p_agora - interval '24 hours'
     and e.estado in ('reservado', 'aceite', 'enviado', 'entregue', 'lido', 'desconhecido');
  if usados >= adesao.limite_diario then
    return jsonb_build_object('ok', false, 'motivo', 'limite_diario_da_profissional');
  end if;

  return jsonb_build_object(
    'ok', true,
    'fila_id', f.id,
    'usuario_id', a.usuario_id,
    'agendamento_id', a.id,
    'tipo', coalesce(f.tipo, 'lembrete'),
    'antecedencia', f.antecedencia,
    'versao_marcacao', to_char(a.data, 'YYYY-MM-DD') || 'T' || to_char(a.hora, 'HH24:MI'),
    'telefone', telefone,
    'cliente_nome', coalesce(nullif(trim(c.nome), ''), nullif(trim(a.cliente), '')),
    'profissional_nome', nome_prof,
    'data', to_char(a.data, 'YYYY-MM-DD'),
    'hora', to_char(a.hora, 'HH24:MI'),
    'procedimento', coalesce(nullif(trim(a.procedimento), ''), 'o seu atendimento'),
    'tentativa_fila', f.tentativas
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Reserva idempotente (antes de chamar a Meta)
-- -----------------------------------------------------------------------------
-- A chave identifica a marcação NA VERSÃO RELEVANTE (data, hora, telefone,
-- template). Só uma reserva por chave consegue avançar; uma chave com estado
-- 'pendente' (rejeição temporária confirmada) pode ser retomada, inclusive por
-- uma linha de fila recriada após edição.
create or replace function public.whatsapp_cloud_reservar(
  p_fila_id            uuid,
  p_chave              text,
  p_agendamento_id     uuid,
  p_usuario_id         uuid,
  p_tipo               text,
  p_antecedencia       text,
  p_versao_marcacao    text,
  p_telefone_mascarado text,
  p_template           text,
  p_idioma             text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_estado text;
begin
  insert into public.whatsapp_cloud_envios as e (
    fila_id, agendamento_id, usuario_id, tipo, antecedencia, versao_marcacao,
    chave_idempotencia, telefone_mascarado, template, idioma,
    estado, tentativas, reservado_em
  ) values (
    p_fila_id, p_agendamento_id, p_usuario_id, p_tipo, p_antecedencia, p_versao_marcacao,
    p_chave, p_telefone_mascarado, p_template, p_idioma,
    'reservado', 1, now()
  )
  on conflict (chave_idempotencia) do update
     set fila_id              = excluded.fila_id,
         estado               = 'reservado',
         tentativas           = e.tentativas + 1,
         reservado_em         = now(),
         proxima_tentativa_em = null
   where e.estado = 'pendente'
     and coalesce(e.proxima_tentativa_em, now()) <= now()
  returning e.id into v_id;

  if v_id is not null then
    return jsonb_build_object('reservado', true, 'envio_id', v_id);
  end if;

  select estado into v_estado from public.whatsapp_cloud_envios where chave_idempotencia = p_chave;
  return jsonb_build_object('reservado', false, 'estado_existente', v_estado);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Aplicar estado vindo do webhook (idempotente, nunca retrocede)
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_rank(p_estado text)
returns integer
language sql
immutable
as $$
  select case p_estado
    when 'pendente' then 0 when 'reservado' then 0 when 'desconhecido' then 0
    when 'aceite' then 1 when 'enviado' then 2 when 'entregue' then 3 when 'lido' then 4
    else -1 end;
$$;

create or replace function public.whatsapp_cloud_aplicar_estado_envio(
  p_wamid       text,
  p_estado      text,
  p_ocorrido_em timestamptz,
  p_erro_codigo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.whatsapp_cloud_envios%rowtype;
begin
  select * into e from public.whatsapp_cloud_envios where wamid = p_wamid for update;
  if not found then return false; end if;

  if p_estado = 'falhado' then
    -- Falha depois de aceite: só se ainda não houver entrega/leitura.
    if whatsapp_cloud_rank(e.estado) between 1 and 2 then
      update public.whatsapp_cloud_envios
         set estado = 'falhado', falhado_em = coalesce(p_ocorrido_em, now()),
             retentavel = false, erro_codigo = coalesce(p_erro_codigo, erro_codigo)
       where id = e.id;
      update public.fila_notificacoes
         set status = 'falhou', ultimo_erro = 'meta_falhou_apos_aceitacao:' || coalesce(p_erro_codigo, '?')
       where id = e.fila_id;
    end if;
    return true;
  end if;

  if e.estado = 'falhado' then return true; end if;

  update public.whatsapp_cloud_envios
     set estado      = case when whatsapp_cloud_rank(p_estado) > whatsapp_cloud_rank(e.estado) then p_estado else e.estado end,
         enviado_em  = case when p_estado = 'enviado'  then coalesce(e.enviado_em,  p_ocorrido_em) else e.enviado_em end,
         entregue_em = case when p_estado = 'entregue' then coalesce(e.entregue_em, p_ocorrido_em) else e.entregue_em end,
         lido_em     = case when p_estado = 'lido'     then coalesce(e.lido_em,     p_ocorrido_em) else e.lido_em end
   where id = e.id;
  return true;
end;
$$;

create or replace function public.whatsapp_cloud_registar_evento(
  p_wamid       text,
  p_estado      text,
  p_ocorrido_em timestamptz,
  p_erro_codigo text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.whatsapp_cloud_eventos (wamid, estado, ocorrido_em, erro_codigo)
  values (p_wamid, p_estado, p_ocorrido_em, p_erro_codigo)
  on conflict (wamid, estado) do nothing;
  if not found then return 'repetido'; end if;

  if public.whatsapp_cloud_aplicar_estado_envio(p_wamid, p_estado, p_ocorrido_em, p_erro_codigo) then
    return 'aplicado';
  end if;
  return 'guardado_sem_envio';  -- chegou antes do registo do wamid; é reaplicado em registar_resultado
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Registar o resultado do pedido à Meta
-- -----------------------------------------------------------------------------
-- p_resultado: 'aceite' | 'rejeitado' | 'incerto'
create or replace function public.whatsapp_cloud_registar_resultado(
  p_envio_id       uuid,
  p_fila_id        uuid,
  p_resultado      text,
  p_wamid          text,
  p_retentavel     boolean,
  p_erro_codigo    text,
  p_erro_detalhe   text,
  p_atraso_segundos integer default 600,
  p_max_tentativas integer default 3
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tent_fila integer;
  ev record;
begin
  if p_resultado = 'aceite' then
    update public.whatsapp_cloud_envios
       set estado = 'aceite', wamid = p_wamid, aceite_em = now(),
           erro_codigo = null, erro_detalhe = null, retentavel = null
     where id = p_envio_id;
    update public.fila_notificacoes
       set status = 'enviado', enviado_em = now(), provider_id = p_wamid, ultimo_erro = null
     where id = p_fila_id;
    -- webhooks que tenham chegado antes deste registo
    for ev in
      select estado, ocorrido_em, erro_codigo from public.whatsapp_cloud_eventos
       where wamid = p_wamid order by whatsapp_cloud_rank(estado), id
    loop
      perform public.whatsapp_cloud_aplicar_estado_envio(p_wamid, ev.estado, ev.ocorrido_em, ev.erro_codigo);
    end loop;
    return 'aceite';
  end if;

  if p_resultado = 'rejeitado' then
    select tentativas into v_tent_fila from public.fila_notificacoes where id = p_fila_id;
    if coalesce(p_retentavel, false) and coalesce(v_tent_fila, 0) < p_max_tentativas then
      update public.whatsapp_cloud_envios
         set estado = 'pendente', retentavel = true,
             proxima_tentativa_em = now() + make_interval(secs => p_atraso_segundos),
             erro_codigo = p_erro_codigo, erro_detalhe = left(p_erro_detalhe, 300)
       where id = p_envio_id;
      update public.fila_notificacoes
         set status = 'erro', ultimo_erro = left('meta_rejeitou_temporario:' || coalesce(p_erro_codigo, '?'), 500)
       where id = p_fila_id;
      return 'nova_tentativa_agendada';
    end if;
    update public.whatsapp_cloud_envios
       set estado = 'falhado', retentavel = coalesce(p_retentavel, false), falhado_em = now(),
           erro_codigo = p_erro_codigo, erro_detalhe = left(p_erro_detalhe, 300)
     where id = p_envio_id;
    update public.fila_notificacoes
       set status = 'falhou', ultimo_erro = left('meta_rejeitou:' || coalesce(p_erro_codigo, '?'), 500)
     where id = p_fila_id;
    return 'falhado';
  end if;

  if p_resultado = 'incerto' then
    update public.whatsapp_cloud_envios
       set estado = 'desconhecido', erro_codigo = p_erro_codigo, erro_detalhe = left(p_erro_detalhe, 300)
     where id = p_envio_id;
    update public.fila_notificacoes
       set status = 'falhou', ultimo_erro = left('resultado_desconhecido:' || coalesce(p_erro_codigo, '?') || ' (verificar antes de reenviar)', 500)
     where id = p_fila_id;
    return 'desconhecido';
  end if;

  raise exception 'resultado inválido: %', p_resultado;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Cancelar uma linha (validação falhou) e expirar reservas órfãs
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_cancelar(p_fila_id uuid, p_motivo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.fila_notificacoes
     set status = 'cancelado', ultimo_erro = left('whatsapp_cloud:' || p_motivo, 500)
   where id = p_fila_id and canal = 'whatsapp_cloud';
$$;

-- Uma reserva que nunca recebeu resultado (worker caiu a meio) pode ou não ter
-- chegado à Meta: passa a 'desconhecido' e não é repetida.
create or replace function public.whatsapp_cloud_expirar_reservas(p_minutos integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with exp as (
    update public.whatsapp_cloud_envios
       set estado = 'desconhecido', erro_codigo = 'reserva_expirada'
     where estado = 'reservado' and reservado_em < now() - make_interval(mins => p_minutos)
    returning fila_id
  )
  update public.fila_notificacoes f
     set status = 'falhou', ultimo_erro = 'resultado_desconhecido:reserva_expirada (verificar antes de reenviar)'
    from exp where f.id = exp.fila_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Voltar ao sistema anterior (rollback operacional)
-- -----------------------------------------------------------------------------
-- Devolve ao Baileys as linhas ainda não tratadas pela Cloud API. Não toca em
-- linhas com envio aceite/desconhecido.
create or replace function public.whatsapp_cloud_devolver_ao_baileys(p_usuario_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.fila_notificacoes f
     set canal = 'whatsapp'
   where f.canal = 'whatsapp_cloud'
     and f.status in ('pendente', 'erro')
     and (p_usuario_id is null or f.usuario_id = p_usuario_id)
     and not exists (
       select 1 from public.whatsapp_cloud_envios e
        where e.fila_id = f.id and e.estado <> 'pendente'
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Permissões: só o service_role chama estas funções
-- -----------------------------------------------------------------------------
revoke all on function public.reivindicar_whatsapp_cloud(integer, integer) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_preparar(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_reservar(uuid, text, uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_aplicar_estado_envio(text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_registar_evento(text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_registar_resultado(uuid, uuid, text, text, boolean, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_cancelar(uuid, text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_expirar_reservas(integer) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_devolver_ao_baileys(uuid) from public, anon, authenticated;

grant execute on function public.reivindicar_whatsapp_cloud(integer, integer) to service_role;
grant execute on function public.whatsapp_cloud_preparar(uuid, timestamptz) to service_role;
grant execute on function public.whatsapp_cloud_reservar(uuid, text, uuid, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.whatsapp_cloud_aplicar_estado_envio(text, text, timestamptz, text) to service_role;
grant execute on function public.whatsapp_cloud_registar_evento(text, text, timestamptz, text) to service_role;
grant execute on function public.whatsapp_cloud_registar_resultado(uuid, uuid, text, text, boolean, text, text, integer, integer) to service_role;
grant execute on function public.whatsapp_cloud_cancelar(uuid, text) to service_role;
grant execute on function public.whatsapp_cloud_expirar_reservas(integer) to service_role;
grant execute on function public.whatsapp_cloud_devolver_ao_baileys(uuid) to service_role;

commit;
