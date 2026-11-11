-- =============================================================================
-- Migration: whatsapp_cloud
-- Integração paralela com a WhatsApp Cloud API oficial da Meta (fase de testes).
--
-- ESTADO: arquitetura aprovada; APLICAÇÃO EM PRODUÇÃO NÃO AUTORIZADA.
--
-- Apenas ADITIVA:
--   * não altera reivindicar_notificacoes(), colunas, defaults ou policies existentes;
--   * não mexe no cron (o cron próprio está em supabase/cron/, por executar);
--   * sem linhas em whatsapp_cloud_profissionais com ativo = true, o comportamento
--     de produção é exatamente o atual.
--
-- Separação de fornecedores: o worker atual (Edge Function `super-action`, chamada
-- pelo cron `processar-fila-notificacoes`) só reivindica canal = 'email' e
-- canal = 'whatsapp' (filtro exato). Um trigger BEFORE INSERT encaminha os
-- lembretes de 1 dia das profissionais aderentes para canal = 'whatsapp_cloud',
-- reivindicado apenas pelo worker novo `processar-whatsapp-cloud`.
--
-- Ver docs/WHATSAPP_CLOUD_API.md.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Configuração: números e adesão das profissionais (limites configuráveis)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_numeros (
  phone_number_id text primary key check (phone_number_id ~ '^\d{5,25}$'),
  descricao       text,
  ativo           boolean not null default false,
  limite_diario   integer not null default 200 check (limite_diario between 0 and 100000),
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.whatsapp_cloud_numeros is
  'Números da Cloud API que o worker pode usar. Sem linha ativa para WA_PHONE_NUMBER_ID, nada é enviado. limite_diario = envios por 24 h (rolante) neste número, abaixo do limite do portefólio na Meta.';

create table if not exists public.whatsapp_cloud_profissionais (
  usuario_id    uuid primary key references auth.users(id) on delete cascade,
  ativo         boolean not null default false,
  limite_diario integer not null default 20 check (limite_diario between 0 and 1000),
  criado_em     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.whatsapp_cloud_profissionais is
  'Adesão (piloto) por profissional. limite_diario = envios por 24 h (rolante). Só o service_role escreve.';

-- -----------------------------------------------------------------------------
-- 2. Consentimento explícito e comprovável
-- -----------------------------------------------------------------------------
-- clientes.aceita_lembretes (default true) NÃO é consentimento: continua a ser
-- apenas o opt-out geral. A Cloud API exige um registo aqui, ligado ao texto
-- exato que a cliente viu.
create table if not exists public.whatsapp_cloud_textos_consentimento (
  versao      text primary key,
  texto       text not null,
  valido      boolean not null default true,
  criado_em   timestamptz not null default now()
);

insert into public.whatsapp_cloud_textos_consentimento (versao, texto)
values (
  'v1-2026-11',
  'Aceito receber no WhatsApp lembretes das minhas marcações, enviados pelo EstetiCalcHub em nome do estabelecimento onde marquei. Posso deixar de receber a qualquer momento respondendo PARAR.'
) on conflict (versao) do nothing;

create table if not exists public.whatsapp_cloud_consentimentos (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  usuario_id       uuid not null references auth.users(id) on delete cascade,
  concedido_em     timestamptz not null default now(),
  origem           text not null check (origem in ('formulario_publico', 'formulario_marcacao', 'presencial_registado')),
  texto_versao     text not null references public.whatsapp_cloud_textos_consentimento(versao),
  registado_por    uuid,          -- quem registou (auth.uid() da profissional, ou NULL se foi a própria cliente num formulário público)
  revogado_em      timestamptz,
  revogado_origem  text,
  criado_em        timestamptz not null default now()
);
create unique index if not exists uq_wa_cloud_consentimento_ativo
  on public.whatsapp_cloud_consentimentos (cliente_id) where revogado_em is null;
create index if not exists idx_wa_cloud_consentimento_usuario on public.whatsapp_cloud_consentimentos (usuario_id);

-- -----------------------------------------------------------------------------
-- 3. Opt-out global (número partilhado) — por hash do telefone, nunca o número
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_bloqueios (
  telefone_hash  text primary key check (telefone_hash ~ '^[0-9a-f]{64}$'),
  origem         text not null,      -- 'webhook_palavra_chave' | 'manual'
  palavra        text,
  wamid_origem   text,
  criado_em      timestamptz not null default now()
);
comment on table public.whatsapp_cloud_bloqueios is
  'Pedidos inequívocos de paragem (ex.: PARAR) recebidos no número partilhado. Bloqueio GLOBAL: nenhuma profissional envia para este telefone pela Cloud API. Hash HMAC-SHA256 com WA_TELEFONE_PEPPER.';

-- -----------------------------------------------------------------------------
-- 4. Envios e eventos
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_cloud_envios (
  id                    uuid primary key default gen_random_uuid(),
  fila_id               uuid references public.fila_notificacoes(id) on delete set null,
  agendamento_id        uuid references public.agendamentos(id) on delete set null,
  usuario_id            uuid not null references auth.users(id) on delete cascade,
  phone_number_id       text not null,
  tipo                  text not null,
  antecedencia          text not null,
  versao_marcacao       text not null,          -- 'AAAA-MM-DDTHH:MM' no momento da reserva
  chave_idempotencia    text not null,          -- marcação + tipo + data (ver docs)
  assinatura_versao     text not null,          -- hash de hora + telefone + template
  telefone_hash         text not null,
  telefone_mascarado    text not null,
  template              text not null,
  idioma                text not null,
  estado                text not null default 'reservado'
    check (estado in ('pendente', 'reservado', 'aceite', 'enviado', 'entregue', 'lido', 'falhado', 'desconhecido', 'cancelado')),
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
  'pendente=nova tentativa após rejeição temporária CONFIRMADA; reservado=a enviar; aceite=Meta devolveu wamid (não é entrega); enviado/entregue/lido=webhook; falhado=rejeição confirmada ou falha após aceitação; desconhecido=resultado incerto, NUNCA repetido; cancelado=reserva libertada antes de qualquer pedido à Meta.';

create index if not exists idx_wa_cloud_envios_fila     on public.whatsapp_cloud_envios (fila_id);
create index if not exists idx_wa_cloud_envios_usuario  on public.whatsapp_cloud_envios (usuario_id, reservado_em);
create index if not exists idx_wa_cloud_envios_numero   on public.whatsapp_cloud_envios (phone_number_id, reservado_em);
create index if not exists idx_wa_cloud_envios_reservado on public.whatsapp_cloud_envios (reservado_em) where estado = 'reservado';

create table if not exists public.whatsapp_cloud_eventos (
  id           bigserial primary key,
  wamid        text not null,
  estado       text not null check (estado in ('enviado', 'entregue', 'lido', 'falhado')),
  ocorrido_em  timestamptz,
  erro_codigo  text,
  recebido_em  timestamptz not null default now(),
  constraint whatsapp_cloud_eventos_unico unique (wamid, estado)
);

-- Trinco de execução do worker (uma execução de cada vez)
create table if not exists public.whatsapp_cloud_execucoes (
  nome            text primary key,
  dono            uuid,
  bloqueado_ate   timestamptz not null default '-infinity',
  ultima_execucao timestamptz
);
insert into public.whatsapp_cloud_execucoes (nome) values ('processar-whatsapp-cloud') on conflict do nothing;

-- updated_at
drop trigger if exists trg_wa_cloud_numeros_updated_at on public.whatsapp_cloud_numeros;
create trigger trg_wa_cloud_numeros_updated_at before update on public.whatsapp_cloud_numeros
  for each row execute function public.set_updated_at();
drop trigger if exists trg_wa_cloud_prof_updated_at on public.whatsapp_cloud_profissionais;
create trigger trg_wa_cloud_prof_updated_at before update on public.whatsapp_cloud_profissionais
  for each row execute function public.set_updated_at();
drop trigger if exists trg_wa_cloud_envios_updated_at on public.whatsapp_cloud_envios;
create trigger trg_wa_cloud_envios_updated_at before update on public.whatsapp_cloud_envios
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RLS: as profissionais só leem o que é seu; só o service_role escreve
-- -----------------------------------------------------------------------------
alter table public.whatsapp_cloud_numeros enable row level security;
alter table public.whatsapp_cloud_profissionais enable row level security;
alter table public.whatsapp_cloud_textos_consentimento enable row level security;
alter table public.whatsapp_cloud_consentimentos enable row level security;
alter table public.whatsapp_cloud_bloqueios enable row level security;
alter table public.whatsapp_cloud_envios enable row level security;
alter table public.whatsapp_cloud_eventos enable row level security;
alter table public.whatsapp_cloud_execucoes enable row level security;

drop policy if exists "wa_cloud_prof_select_own" on public.whatsapp_cloud_profissionais;
create policy "wa_cloud_prof_select_own" on public.whatsapp_cloud_profissionais
  for select using (usuario_id = auth.uid());
drop policy if exists "wa_cloud_envios_select_own" on public.whatsapp_cloud_envios;
create policy "wa_cloud_envios_select_own" on public.whatsapp_cloud_envios
  for select using (usuario_id = auth.uid());
drop policy if exists "wa_cloud_consent_select_own" on public.whatsapp_cloud_consentimentos;
create policy "wa_cloud_consent_select_own" on public.whatsapp_cloud_consentimentos
  for select using (usuario_id = auth.uid());
drop policy if exists "wa_cloud_textos_select" on public.whatsapp_cloud_textos_consentimento;
create policy "wa_cloud_textos_select" on public.whatsapp_cloud_textos_consentimento
  for select using (true);

-- -----------------------------------------------------------------------------
-- 6. Encaminhamento na criação + proteção contra edição pela profissional
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_encaminhar_fila()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.canal = 'whatsapp'
     and coalesce(new.tipo, 'lembrete') = 'lembrete'
     and new.antecedencia = '1_dia'
     and exists (select 1 from public.whatsapp_cloud_profissionais p
                  where p.usuario_id = new.usuario_id and p.ativo) then
    new.canal := 'whatsapp_cloud';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fila_whatsapp_cloud_encaminhar on public.fila_notificacoes;
create trigger trg_fila_whatsapp_cloud_encaminhar
  before insert on public.fila_notificacoes
  for each row execute function public.whatsapp_cloud_encaminhar_fila();

create or replace function public.whatsapp_cloud_proteger_fila()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if old.canal = 'whatsapp_cloud' or new.canal = 'whatsapp_cloud' then
    raise exception 'Linhas da WhatsApp Cloud API só podem ser alteradas pelo servidor.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fila_whatsapp_cloud_proteger on public.fila_notificacoes;
create trigger trg_fila_whatsapp_cloud_proteger
  before update on public.fila_notificacoes
  for each row execute function public.whatsapp_cloud_proteger_fila();

-- -----------------------------------------------------------------------------
-- 7. Trinco de execução (uma execução do worker de cada vez)
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_adquirir_execucao(p_nome text, p_dono uuid, p_segundos integer default 120)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.whatsapp_cloud_execucoes
     set dono = p_dono, bloqueado_ate = now() + make_interval(secs => p_segundos), ultima_execucao = now()
   where nome = p_nome and bloqueado_ate < now();
  return found;
end;
$$;

create or replace function public.whatsapp_cloud_libertar_execucao(p_nome text, p_dono uuid)
returns void language sql security definer set search_path = public as $$
  update public.whatsapp_cloud_execucoes set bloqueado_ate = '-infinity', dono = null
   where nome = p_nome and dono = p_dono;
$$;

-- -----------------------------------------------------------------------------
-- 8. Reivindicação atómica (só canal = 'whatsapp_cloud')
-- -----------------------------------------------------------------------------
create or replace function public.reivindicar_whatsapp_cloud(p_limite integer default 20, p_max_tentativas integer default 3)
returns setof public.fila_notificacoes language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.fila_notificacoes f
     set status = 'processando', tentativas = coalesce(f.tentativas, 0) + 1, updated_at = now()
   where f.id in (
     select c.id from public.fila_notificacoes c
      where c.canal = 'whatsapp_cloud'
        and c.status in ('pendente', 'erro')
        and c.data_disparo <= now()
        and coalesce(c.tentativas, 0) < p_max_tentativas
        and not exists (select 1 from public.whatsapp_cloud_envios e
                         where e.fila_id = c.id and e.estado = 'pendente' and e.proxima_tentativa_em > now())
      order by c.data_disparo
      for update skip locked
      limit p_limite)
  returning f.*;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Validação no servidor (estado ATUAL da marcação; nunca destino/mensagem da fila)
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_preparar(p_fila_id uuid, p_agora timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f public.fila_notificacoes%rowtype;
  a public.agendamentos%rowtype;
  c public.clientes%rowtype;
  adesao public.whatsapp_cloud_profissionais%rowtype;
  consent_id uuid;
  inicio timestamptz;
  nome_prof text;
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
  if not found or not adesao.ativo then return jsonb_build_object('ok', false, 'motivo', 'profissional_sem_adesao'); end if;

  select * into a from public.agendamentos where id = f.agendamento_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'agendamento_inexistente'); end if;
  if a.usuario_id is distinct from f.usuario_id then return jsonb_build_object('ok', false, 'motivo', 'profissional_nao_corresponde'); end if;
  if not a.lembrete_1dia then return jsonb_build_object('ok', false, 'motivo', 'lembrete_desligado'); end if;
  if a.canal_notificacao is distinct from 'whatsapp' then return jsonb_build_object('ok', false, 'motivo', 'canal_da_marcacao_nao_e_whatsapp'); end if;
  if a.faltou then return jsonb_build_object('ok', false, 'motivo', 'marcacao_com_falta'); end if;
  if a.status_confirmacao = 'cancelado' or a.confirmacao_status = 'cancelado' then
    return jsonb_build_object('ok', false, 'motivo', 'marcacao_cancelada');
  end if;

  if a.cliente_id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_cliente_associada'); end if;
  select * into c from public.clientes where id = a.cliente_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'cliente_inexistente'); end if;
  if c.agenda_id is distinct from a.agenda_id then return jsonb_build_object('ok', false, 'motivo', 'cliente_de_outra_agenda'); end if;
  if not c.aceita_lembretes then return jsonb_build_object('ok', false, 'motivo', 'cliente_com_opt_out'); end if;

  -- Consentimento explícito, não revogado, com texto válido. aceita_lembretes=true NÃO chega.
  select k.id into consent_id
    from public.whatsapp_cloud_consentimentos k
    join public.whatsapp_cloud_textos_consentimento t on t.versao = k.texto_versao and t.valido
   where k.cliente_id = c.id and k.revogado_em is null and k.concedido_em <= p_agora
   limit 1;
  if consent_id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_consentimento_whatsapp'); end if;

  telefone := coalesce(nullif(trim(c.telefone), ''), nullif(trim(a.telefone_cliente), ''));
  if telefone is null then return jsonb_build_object('ok', false, 'motivo', 'sem_telefone'); end if;

  inicio := (a.data + a.hora) at time zone 'Europe/Lisbon';
  if p_agora < inicio - interval '24 hours' - interval '15 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'cedo_demais');
  end if;
  if (p_agora at time zone 'Europe/Lisbon')::date <> a.data - 1 or p_agora >= inicio then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela_de_amanha');
  end if;

  select nullif(trim(pp.nome_negocio), '') into nome_prof from public.paginas_publicas pp where pp.usuario_id = a.usuario_id limit 1;
  if nome_prof is null then
    select nullif(trim(u.raw_user_meta_data ->> 'full_name'), '') into nome_prof from auth.users u where u.id = a.usuario_id;
  end if;
  if nome_prof is null then return jsonb_build_object('ok', false, 'motivo', 'sem_nome_profissional'); end if;

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
    'consentimento_id', consent_id,
    'tentativa_fila', f.tentativas
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Reserva idempotente com limites ATÓMICOS
-- -----------------------------------------------------------------------------
-- Serialização: a linha do número (whatsapp_cloud_numeros) é trancada FOR UPDATE
-- no início; todas as reservas no mesmo número ficam em fila nesse ponto, por
-- isso as contagens de 24 h nunca são ultrapassadas por workers simultâneos.
-- Estados que contam para os limites: tudo o que pode ter chegado à Meta.
create or replace function public.whatsapp_cloud_reservar(
  p_fila_id            uuid,
  p_chave              text,
  p_assinatura         text,
  p_agendamento_id     uuid,
  p_usuario_id         uuid,
  p_tipo               text,
  p_antecedencia       text,
  p_versao_marcacao    text,
  p_telefone_hash      text,
  p_telefone_mascarado text,
  p_template           text,
  p_idioma             text,
  p_phone_number_id    text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  num   public.whatsapp_cloud_numeros%rowtype;
  prof  public.whatsapp_cloud_profissionais%rowtype;
  ex    public.whatsapp_cloud_envios%rowtype;
  usados_num  integer;
  usados_prof integer;
  v_id  uuid;
begin
  select * into num from public.whatsapp_cloud_numeros where phone_number_id = p_phone_number_id for update;
  if not found or not num.ativo then return jsonb_build_object('reservado', false, 'motivo', 'numero_inativo'); end if;

  select * into prof from public.whatsapp_cloud_profissionais where usuario_id = p_usuario_id for update;
  if not found or not prof.ativo then return jsonb_build_object('reservado', false, 'motivo', 'profissional_sem_adesao'); end if;

  if exists (select 1 from public.whatsapp_cloud_bloqueios where telefone_hash = p_telefone_hash) then
    return jsonb_build_object('reservado', false, 'motivo', 'bloqueado_opt_out');
  end if;

  select * into ex from public.whatsapp_cloud_envios where chave_idempotencia = p_chave for update;
  if found then
    if not (
         (ex.estado = 'pendente' and coalesce(ex.proxima_tentativa_em, now()) <= now())
      or (ex.estado in ('falhado', 'cancelado') and ex.assinatura_versao <> p_assinatura)
      or (ex.estado = 'cancelado' and ex.assinatura_versao = p_assinatura)
    ) then
      return jsonb_build_object('reservado', false, 'motivo', 'duplicado', 'estado_existente', ex.estado);
    end if;
  end if;

  select count(*) into usados_num from public.whatsapp_cloud_envios
   where phone_number_id = p_phone_number_id and reservado_em > now() - interval '24 hours'
     and estado in ('reservado', 'aceite', 'enviado', 'entregue', 'lido', 'desconhecido');
  if usados_num >= num.limite_diario then return jsonb_build_object('reservado', false, 'motivo', 'limite_diario_numero'); end if;

  select count(*) into usados_prof from public.whatsapp_cloud_envios
   where usuario_id = p_usuario_id and reservado_em > now() - interval '24 hours'
     and estado in ('reservado', 'aceite', 'enviado', 'entregue', 'lido', 'desconhecido');
  if usados_prof >= prof.limite_diario then return jsonb_build_object('reservado', false, 'motivo', 'limite_diario_profissional'); end if;

  if ex.id is not null then
    update public.whatsapp_cloud_envios
       set fila_id = p_fila_id, estado = 'reservado', tentativas = tentativas + 1, reservado_em = now(),
           proxima_tentativa_em = null, versao_marcacao = p_versao_marcacao, assinatura_versao = p_assinatura,
           telefone_hash = p_telefone_hash, telefone_mascarado = p_telefone_mascarado, phone_number_id = p_phone_number_id,
           erro_codigo = null, erro_detalhe = null, retentavel = null, falhado_em = null
     where id = ex.id
    returning id into v_id;
  else
    insert into public.whatsapp_cloud_envios (
      fila_id, agendamento_id, usuario_id, phone_number_id, tipo, antecedencia, versao_marcacao,
      chave_idempotencia, assinatura_versao, telefone_hash, telefone_mascarado, template, idioma,
      estado, tentativas, reservado_em
    ) values (
      p_fila_id, p_agendamento_id, p_usuario_id, p_phone_number_id, p_tipo, p_antecedencia, p_versao_marcacao,
      p_chave, p_assinatura, p_telefone_hash, p_telefone_mascarado, p_template, p_idioma,
      'reservado', 1, now()
    )
    returning id into v_id;
  end if;

  return jsonb_build_object('reservado', true, 'envio_id', v_id);
end;
$$;

-- Última verificação imediatamente antes do pedido à Meta. Se algo mudou (linha
-- apagada por edição, bloqueio entretanto recebido, reserva já tratada), liberta
-- a reserva SEM enviar.
create or replace function public.whatsapp_cloud_confirmar_reserva(p_envio_id uuid, p_fila_id uuid, p_telefone_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.whatsapp_cloud_envios%rowtype;
  f public.fila_notificacoes%rowtype;
  motivo text;
begin
  select * into e from public.whatsapp_cloud_envios where id = p_envio_id for update;
  if not found or e.estado <> 'reservado' then return jsonb_build_object('ok', false, 'motivo', 'reserva_invalida'); end if;
  select * into f from public.fila_notificacoes where id = p_fila_id for update;
  if not found then motivo := 'fila_apagada';
  elsif f.status <> 'processando' or f.canal <> 'whatsapp_cloud' then motivo := 'fila_alterada';
  elsif e.telefone_hash <> p_telefone_hash then motivo := 'telefone_alterado';
  elsif exists (select 1 from public.whatsapp_cloud_bloqueios b where b.telefone_hash = p_telefone_hash) then motivo := 'bloqueado_opt_out';
  end if;
  if motivo is not null then
    perform public.whatsapp_cloud_libertar_reserva(p_envio_id, p_fila_id, motivo);
    return jsonb_build_object('ok', false, 'motivo', motivo);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.whatsapp_cloud_libertar_reserva(p_envio_id uuid, p_fila_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.whatsapp_cloud_envios
     set estado = 'cancelado', erro_codigo = left(p_motivo, 100)
   where id = p_envio_id and estado = 'reservado';
  update public.fila_notificacoes
     set status = 'cancelado', ultimo_erro = left('whatsapp_cloud:' || p_motivo, 500)
   where id = p_fila_id and canal = 'whatsapp_cloud' and status = 'processando';
end;
$$;

-- Limite atingido / número inativo: devolve a linha à fila para mais tarde, sem gastar tentativa.
create or replace function public.whatsapp_cloud_adiar(p_fila_id uuid, p_minutos integer, p_motivo text)
returns void language sql security definer set search_path = public as $$
  update public.fila_notificacoes
     set status = 'pendente', tentativas = greatest(coalesce(tentativas, 1) - 1, 0),
         data_disparo = now() + make_interval(mins => p_minutos),
         ultimo_erro = left('whatsapp_cloud_adiado:' || p_motivo, 500)
   where id = p_fila_id and canal = 'whatsapp_cloud' and status = 'processando';
$$;

-- -----------------------------------------------------------------------------
-- 11. Estados vindos do webhook (idempotente, nunca retrocede)
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_rank(p_estado text)
returns integer language sql immutable as $$
  select case p_estado
    when 'pendente' then 0 when 'reservado' then 0 when 'desconhecido' then 0
    when 'aceite' then 1 when 'enviado' then 2 when 'entregue' then 3 when 'lido' then 4
    else -1 end;
$$;

create or replace function public.whatsapp_cloud_aplicar_estado_envio(p_wamid text, p_estado text, p_ocorrido_em timestamptz, p_erro_codigo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  e public.whatsapp_cloud_envios%rowtype;
begin
  select * into e from public.whatsapp_cloud_envios where wamid = p_wamid for update;
  if not found then return false; end if;

  if p_estado = 'falhado' then
    if whatsapp_cloud_rank(e.estado) between 1 and 2 then
      update public.whatsapp_cloud_envios
         set estado = 'falhado', falhado_em = coalesce(p_ocorrido_em, now()), retentavel = false,
             erro_codigo = coalesce(p_erro_codigo, erro_codigo)
       where id = e.id;
      update public.fila_notificacoes
         set status = 'falhou', ultimo_erro = 'meta_falhou_apos_aceitacao:' || coalesce(p_erro_codigo, '?')
       where id = e.fila_id;
    end if;
    return true;
  end if;

  if e.estado in ('falhado', 'cancelado') then return true; end if;

  update public.whatsapp_cloud_envios
     set estado      = case when whatsapp_cloud_rank(p_estado) > whatsapp_cloud_rank(e.estado) then p_estado else e.estado end,
         enviado_em  = case when p_estado = 'enviado'  then coalesce(e.enviado_em,  p_ocorrido_em) else e.enviado_em end,
         entregue_em = case when p_estado = 'entregue' then coalesce(e.entregue_em, p_ocorrido_em) else e.entregue_em end,
         lido_em     = case when p_estado = 'lido'     then coalesce(e.lido_em,     p_ocorrido_em) else e.lido_em end
   where id = e.id;
  return true;
end;
$$;

create or replace function public.whatsapp_cloud_registar_evento(p_wamid text, p_estado text, p_ocorrido_em timestamptz, p_erro_codigo text)
returns text language plpgsql security definer set search_path = public as $$
begin
  insert into public.whatsapp_cloud_eventos (wamid, estado, ocorrido_em, erro_codigo)
  values (p_wamid, p_estado, p_ocorrido_em, p_erro_codigo)
  on conflict (wamid, estado) do nothing;
  if not found then return 'repetido'; end if;
  if public.whatsapp_cloud_aplicar_estado_envio(p_wamid, p_estado, p_ocorrido_em, p_erro_codigo) then
    return 'aplicado';
  end if;
  return 'guardado_sem_envio';
end;
$$;

-- Opt-out global por palavra-chave inequívoca recebida no webhook.
create or replace function public.whatsapp_cloud_registar_optout(p_telefone_hash text, p_palavra text, p_wamid text)
returns text language plpgsql security definer set search_path = public as $$
begin
  insert into public.whatsapp_cloud_bloqueios (telefone_hash, origem, palavra, wamid_origem)
  values (p_telefone_hash, 'webhook_palavra_chave', left(p_palavra, 50), p_wamid)
  on conflict (telefone_hash) do nothing;
  if not found then return 'repetido'; end if;
  -- reservas ainda não enviadas para este telefone são libertadas já
  perform public.whatsapp_cloud_libertar_reserva(e.id, e.fila_id, 'bloqueado_opt_out')
     from public.whatsapp_cloud_envios e
    where e.telefone_hash = p_telefone_hash and e.estado = 'reservado';
  update public.whatsapp_cloud_envios set estado = 'cancelado', erro_codigo = 'bloqueado_opt_out'
   where telefone_hash = p_telefone_hash and estado = 'pendente';
  return 'bloqueado';
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Registar o resultado do pedido à Meta
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_registar_resultado(
  p_envio_id uuid, p_fila_id uuid, p_resultado text, p_wamid text, p_retentavel boolean,
  p_erro_codigo text, p_erro_detalhe text, p_atraso_segundos integer default 600, p_max_tentativas integer default 3
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_tent_fila integer;
  ev record;
begin
  if p_resultado = 'aceite' then
    update public.whatsapp_cloud_envios
       set estado = 'aceite', wamid = p_wamid, aceite_em = now(), erro_codigo = null, erro_detalhe = null, retentavel = null
     where id = p_envio_id;
    update public.fila_notificacoes
       set status = 'enviado', enviado_em = now(), provider_id = p_wamid, ultimo_erro = null
     where id = p_fila_id;
    for ev in select estado, ocorrido_em, erro_codigo from public.whatsapp_cloud_eventos
               where wamid = p_wamid order by whatsapp_cloud_rank(estado), id loop
      perform public.whatsapp_cloud_aplicar_estado_envio(p_wamid, ev.estado, ev.ocorrido_em, ev.erro_codigo);
    end loop;
    return 'aceite';
  end if;

  if p_resultado = 'rejeitado' then
    select tentativas into v_tent_fila from public.fila_notificacoes where id = p_fila_id;
    if coalesce(p_retentavel, false) and coalesce(v_tent_fila, 0) < p_max_tentativas then
      update public.whatsapp_cloud_envios
         set estado = 'pendente', retentavel = true, proxima_tentativa_em = now() + make_interval(secs => p_atraso_segundos),
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
-- 13. Cancelar, expirar reservas órfãs, voltar ao Baileys
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_cancelar(p_fila_id uuid, p_motivo text)
returns void language sql security definer set search_path = public as $$
  update public.fila_notificacoes set status = 'cancelado', ultimo_erro = left('whatsapp_cloud:' || p_motivo, 500)
   where id = p_fila_id and canal = 'whatsapp_cloud';
$$;

create or replace function public.whatsapp_cloud_expirar_reservas(p_minutos integer default 10)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with exp as (
    update public.whatsapp_cloud_envios set estado = 'desconhecido', erro_codigo = 'reserva_expirada'
     where estado = 'reservado' and reservado_em < now() - make_interval(mins => p_minutos)
    returning id, fila_id)
  , fil as (
    update public.fila_notificacoes f
       set status = 'falhou', ultimo_erro = 'resultado_desconhecido:reserva_expirada (verificar antes de reenviar)'
      from exp where f.id = exp.fila_id)
  select count(*) into n from exp;
  return n;
end;
$$;

create or replace function public.whatsapp_cloud_devolver_ao_baileys(p_usuario_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.fila_notificacoes f set canal = 'whatsapp'
   where f.canal = 'whatsapp_cloud' and f.status in ('pendente', 'erro')
     and (p_usuario_id is null or f.usuario_id = p_usuario_id)
     and not exists (select 1 from public.whatsapp_cloud_envios e
                      where e.fila_id = f.id and e.estado not in ('pendente', 'cancelado'));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Consentimento: funções para o formulário (fase seguinte)
-- -----------------------------------------------------------------------------
create or replace function public.registar_consentimento_whatsapp(p_cliente_id uuid, p_origem text, p_texto_versao text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.clientes%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  if p_origem not in ('formulario_marcacao', 'presencial_registado') then
    raise exception 'Origem inválida para registo pela profissional.' using errcode = '22023';
  end if;
  select * into c from public.clientes where id = p_cliente_id;
  if not found or c.usuario_id <> auth.uid() then raise exception 'Cliente não encontrada.' using errcode = '42501'; end if;
  if not exists (select 1 from public.whatsapp_cloud_textos_consentimento where versao = p_texto_versao and valido) then
    raise exception 'Versão de texto inválida.' using errcode = '22023';
  end if;
  update public.whatsapp_cloud_consentimentos set revogado_em = now(), revogado_origem = 'substituido'
   where cliente_id = p_cliente_id and revogado_em is null;
  insert into public.whatsapp_cloud_consentimentos (cliente_id, usuario_id, origem, texto_versao, registado_por)
  values (p_cliente_id, c.usuario_id, p_origem, p_texto_versao, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revogar_consentimento_whatsapp(p_cliente_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  update public.whatsapp_cloud_consentimentos k set revogado_em = now(), revogado_origem = 'profissional'
    from public.clientes c
   where k.cliente_id = c.id and c.id = p_cliente_id and c.usuario_id = auth.uid() and k.revogado_em is null;
  return found;
end;
$$;

-- -----------------------------------------------------------------------------
-- 15. RGPD: exportação e eliminação (preparadas; não ligadas ao fluxo atual)
-- -----------------------------------------------------------------------------
create or replace function public.whatsapp_cloud_exportar_meus_dados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'adesao', (select to_jsonb(p) from public.whatsapp_cloud_profissionais p where p.usuario_id = uid),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(k) order by k.concedido_em)
                                  from public.whatsapp_cloud_consentimentos k where k.usuario_id = uid), '[]'::jsonb),
    'envios', coalesce((select jsonb_agg(to_jsonb(e) - 'telefone_hash' - 'chave_idempotencia' - 'assinatura_versao' order by e.criado_em)
                          from public.whatsapp_cloud_envios e where e.usuario_id = uid), '[]'::jsonb)
  );
end;
$$;

-- Para a Edge Function de eliminação de conta. Os bloqueios (opt-out das
-- clientes) NÃO são apagados: pertencem à cliente, não à profissional, e só
-- contêm um hash.
create or replace function public.whatsapp_cloud_eliminar_dados_profissional(p_usuario_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_env integer; n_con integer; n_ade integer;
begin
  delete from public.whatsapp_cloud_envios where usuario_id = p_usuario_id;
  get diagnostics n_env = row_count;
  delete from public.whatsapp_cloud_consentimentos where usuario_id = p_usuario_id;
  get diagnostics n_con = row_count;
  delete from public.whatsapp_cloud_profissionais where usuario_id = p_usuario_id;
  get diagnostics n_ade = row_count;
  return jsonb_build_object('envios', n_env, 'consentimentos', n_con, 'adesao', n_ade);
end;
$$;

-- -----------------------------------------------------------------------------
-- 16. Permissões
-- -----------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.whatsapp_cloud_adquirir_execucao(text, uuid, integer)',
    'public.whatsapp_cloud_libertar_execucao(text, uuid)',
    'public.reivindicar_whatsapp_cloud(integer, integer)',
    'public.whatsapp_cloud_preparar(uuid, timestamptz)',
    'public.whatsapp_cloud_reservar(uuid, text, text, uuid, uuid, text, text, text, text, text, text, text, text)',
    'public.whatsapp_cloud_confirmar_reserva(uuid, uuid, text)',
    'public.whatsapp_cloud_libertar_reserva(uuid, uuid, text)',
    'public.whatsapp_cloud_adiar(uuid, integer, text)',
    'public.whatsapp_cloud_aplicar_estado_envio(text, text, timestamptz, text)',
    'public.whatsapp_cloud_registar_evento(text, text, timestamptz, text)',
    'public.whatsapp_cloud_registar_optout(text, text, text)',
    'public.whatsapp_cloud_registar_resultado(uuid, uuid, text, text, boolean, text, text, integer, integer)',
    'public.whatsapp_cloud_cancelar(uuid, text)',
    'public.whatsapp_cloud_expirar_reservas(integer)',
    'public.whatsapp_cloud_devolver_ao_baileys(uuid)',
    'public.whatsapp_cloud_eliminar_dados_profissional(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;

  foreach fn in array array[
    'public.registar_consentimento_whatsapp(uuid, text, text)',
    'public.revogar_consentimento_whatsapp(uuid)',
    'public.whatsapp_cloud_exportar_meus_dados()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

commit;
