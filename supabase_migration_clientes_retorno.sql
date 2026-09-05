-- Migration: clientes_retorno_previsto
-- Adiciona a data prevista de retorno/manutenção, editável manualmente por
-- cliente, para a nova tabela de Clientes no estilo da planilha.

alter table public.clientes
  add column if not exists retorno_previsto date;

comment on column public.clientes.retorno_previsto is
  'Data prevista para a próxima manutenção/retorno da cliente, definida manualmente.';
