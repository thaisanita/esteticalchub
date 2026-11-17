-- Migration: clientes_morada_codigo_postal
-- Morada da cliente dividida em três campos, para o atendimento ao domicílio:
--   morada        -> rua e número (já existia: foi criada à mão no Supabase e
--                    não estava em nenhum .sql, por isso fica aqui com
--                    "if not exists" para não falhar nem mexer nos dados)
--   codigo_postal -> 0000-000 (a app procura a localidade e as ruas na GEO API PT)
--   localidade    -> "Localidade, Concelho", preenchida pela app e editável à mão
--
-- Clientes antigas: a morada em texto livre continua em "morada", intacta.
-- Não há cópia nem divisão automática dos dados existentes.
--
-- RLS: não é preciso mexer. As políticas clientes_select/insert/update/delete_agenda
-- filtram linhas inteiras por e_membro_da_agenda(agenda_id), e as permissões
-- da tabela são dadas à tabela toda (não por coluna), por isso as colunas
-- novas ficam logo cobertas.

alter table public.clientes
  add column if not exists morada text,
  add column if not exists codigo_postal text,
  add column if not exists localidade text;

comment on column public.clientes.morada is
  'Rua e número (atendimento ao domicílio). Em clientes antigas, a morada completa em texto livre.';
comment on column public.clientes.codigo_postal is
  'Código postal português no formato 0000-000 (pode ficar como foi escrito se estiver incompleto).';
comment on column public.clientes.localidade is
  'Localidade e concelho, ex.: "Arão, Valença". Preenchida a partir do código postal e editável à mão.';
