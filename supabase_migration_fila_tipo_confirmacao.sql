-- Fase 3 — confirmação de marcação por email.
--
-- fila_notificacoes passa a saber distinguir um LEMBRETE (antes do
-- atendimento, 1 dia/1 hora) de uma CONFIRMAÇÃO (enviada uma única vez,
-- assim que o agendamento é criado). Tudo o que já existe continua a valer
-- como 'lembrete' (valor por omissão) — incluindo as linhas que a função
-- confirmar_presenca() já insere para avisar a profissional — por isso não
-- altera nada do que já está em produção.
--
-- Aplicar ANTES de publicar o código que grava tipo='confirmacao_agendamento'
-- (NovoAgendamento.tsx), senão esse insert falha por a coluna não existir.
--
-- processar-fila não decide o conteúdo da mensagem por esta coluna — o
-- texto (mensagem/assunto) já vem pronto da app, como já acontece com os
-- lembretes — esta coluna serve só para relatórios/depuração e para um
-- eventual filtro futuro.

alter table public.fila_notificacoes
  add column if not exists tipo text not null default 'lembrete';

comment on column public.fila_notificacoes.tipo is
  'Que mensagem é esta: lembrete (antes do atendimento) ou confirmacao_agendamento (assim que a marcação é criada). Linhas antigas/sem valor explícito continuam como lembrete.';
