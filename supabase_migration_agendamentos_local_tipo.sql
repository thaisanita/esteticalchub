-- Migration: agendamentos_local_tipo
-- O local passa a ser escolhido em cada agendamento ("Onde é o atendimento?"),
-- e não na agenda.
--
--   local_tipo     -> 'estudio' ou 'domicilio'. Fica NULL nos agendamentos
--                     antigos: para esses, a app continua a usar o tipo da
--                     agenda (agendas.tipo_atendimento) para saber se eram ao
--                     domicílio. Nenhuma linha antiga é alterada.
--   morada, codigo_postal, localidade
--                  -> morada do atendimento ao domicílio, em campos separados
--                     (para se poder editar). A morada completa continua
--                     também em ponto_atendimento, para os lembretes, o
--                     email de confirmação, o .ics e o link do Google
--                     Calendar continuarem a funcionar sem mudanças.
--
-- Só acrescenta colunas. Não apaga colunas nem dados.
-- agendas.tipo_atendimento deixa de ser editável na app, mas fica na base de
-- dados (é usada para interpretar os agendamentos antigos).
--
-- RLS: as políticas de agendamentos filtram linhas inteiras por
-- e_membro_da_agenda(agenda_id) e as permissões são à tabela toda, por isso
-- as colunas novas ficam logo cobertas.

alter table public.agendamentos
  add column if not exists local_tipo text,
  add column if not exists morada text,
  add column if not exists codigo_postal text,
  add column if not exists localidade text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_local_tipo_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos
      add constraint agendamentos_local_tipo_check
      check (local_tipo is null or local_tipo in ('estudio', 'domicilio'));
  end if;
end $$;

comment on column public.agendamentos.local_tipo is
  'Onde é o atendimento: estudio ou domicilio. NULL = agendamento antigo (usa agendas.tipo_atendimento).';
comment on column public.agendamentos.morada is
  'Rua e número do atendimento ao domicílio.';
comment on column public.agendamentos.codigo_postal is
  'Código postal do atendimento ao domicílio (0000-000).';
comment on column public.agendamentos.localidade is
  'Localidade do atendimento ao domicílio, ex.: "Arão, Valença".';
