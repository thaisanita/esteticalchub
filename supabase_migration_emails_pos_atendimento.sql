-- Migration: emails_pos_atendimento
-- Emails automáticos DEPOIS do atendimento: cuidados, avaliação e retoque.
--
-- Como funciona:
--   - Os emails não são criados ao marcar. A cada 15 minutos, o cron chama
--     agendar_emails_pos_atendimento(), que olha para as marcações que JÁ
--     TERMINARAM (até 3 dias atrás) e põe na fila os emails que a
--     profissional ligou em Configurações → Mensagens automáticas. Assim,
--     alterações, faltas e marcações apagadas antes do fim ficam tratadas
--     sozinhas.
--   - O texto não é guardado aqui: a função super-action monta-o no envio,
--     a partir do modelo da profissional (modelos_mensagem).
--   - Nunca cria emails para: faltas, marcações recusadas pela cliente,
--     clientes sem email ou que cancelaram os lembretes (aceita_lembretes =
--     false), nem para trás (nada com hora de envio já passada há mais de
--     30 minutos — ligar um email não envia nada de marcações antigas).
--   - Cada email sai no máximo uma vez por marcação (índice único).
--
-- Só acrescenta: uma coluna vazia, um índice, uma função e um job do cron.
-- Não altera nem apaga dados de ninguém. Sem modelos ligados (hoje ninguém
-- tem), a função não cria nada.

-- 1. Retoque por marcação. Vazio = nunca escolhido; 0 = desligado; N = dias.
--    A app usa a última escolha para o mesmo procedimento como sugestão.
alter table public.agendamentos
  add column if not exists retoque_dias integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_retoque_dias_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos
      add constraint agendamentos_retoque_dias_check
      check (retoque_dias is null or retoque_dias between 0 and 365);
  end if;
end $$;

comment on column public.agendamentos.retoque_dias is
  'Email de retoque: NULL = nunca escolhido, 0 = desligado, N = enviar N dias depois do atendimento.';

-- 2. Cada email pós-atendimento só uma vez por marcação.
create unique index if not exists fila_notificacoes_pos_atendimento_unico
  on public.fila_notificacoes (agendamento_id, tipo)
  where tipo in ('email_cuidados', 'email_avaliacao', 'email_retoque');

-- 3. Põe na fila os emails pós-atendimento que estão ligados. Devolve quantos criou.
create or replace function public.agendar_emails_pos_atendimento()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criados integer;
begin
  with base as (
    select
      a.id,
      a.usuario_id,
      a.data,
      a.retoque_dias,
      coalesce(nullif(trim(a.email_cliente), ''), nullif(trim(c.email), '')) as email,
      (
        a.data + case
          when a.hora_fim ~ '^\d{1,2}:\d{2}' then a.hora_fim::time
          else a.hora
        end
      ) at time zone 'Europe/Lisbon' as fim
    from public.agendamentos a
    left join public.clientes c on c.id = a.cliente_id
    where a.data between current_date - 3 and current_date
      and a.faltou is not true
      and coalesce(a.confirmacao_status, '') <> 'recusado'
      and coalesce(c.aceita_lembretes, true)
  ),
  terminadas as (
    select * from base
    where email like '%_@_%' and fim <= now()
  ),
  modelos as (
    select usuario_id, tipo, espera_horas, espera_dias, hora_envio
    from public.modelos_mensagem
    where ativo and tipo in ('email_cuidados', 'email_avaliacao', 'email_retoque')
  ),
  novos as (
    select
      t.id as agendamento_id,
      t.usuario_id,
      t.email,
      m.tipo,
      case m.tipo
        when 'email_cuidados' then
          t.fim + make_interval(hours => coalesce(m.espera_horas, 2))
        when 'email_avaliacao' then
          ((t.data + coalesce(m.espera_dias, 1)) + coalesce(m.hora_envio, time '10:00')) at time zone 'Europe/Lisbon'
        when 'email_retoque' then
          ((t.data + t.retoque_dias) + coalesce(m.hora_envio, time '10:00')) at time zone 'Europe/Lisbon'
      end as data_disparo
    from terminadas t
    join modelos m on m.usuario_id = t.usuario_id
    where m.tipo <> 'email_retoque' or coalesce(t.retoque_dias, 0) > 0
  )
  insert into public.fila_notificacoes
    (agendamento_id, usuario_id, tipo_destino, canal, antecedencia, data_disparo, status, destino, tipo)
  select agendamento_id, usuario_id, 'cliente', 'email', 'depois', data_disparo, 'pendente', email, tipo
  from novos
  where data_disparo > now() - interval '30 minutes'
  on conflict do nothing;

  get diagnostics v_criados = row_count;
  return v_criados;
end;
$$;

comment on function public.agendar_emails_pos_atendimento() is
  'Chamada pelo cron a cada 15 min: põe na fila os emails de cuidados/avaliação/retoque ligados pela profissional, para marcações já terminadas.';

revoke all on function public.agendar_emails_pos_atendimento() from public, anon, authenticated;

-- 4. Job do cron (se já existir com este nome, é atualizado).
select cron.schedule(
  'emails-pos-atendimento',
  '*/15 * * * *',
  $cron$select public.agendar_emails_pos_atendimento();$cron$
);
