-- Migration: canal_notificacao_agendamento
-- Corrige bug: a escolha de canal (WhatsApp/Email) e os lembretes (1 dia/1
-- hora) só existiam na tela do Novo Agendamento, nunca eram salvos no
-- agendamento. Resultado: ao editar um agendamento já criado, o formulário
-- sempre voltava para o padrão "WhatsApp" e, se salvo de novo, recriava a
-- fila de notificações como WhatsApp — apagando a fila de Email que existia.
--
-- Agora essas 3 escolhas ficam gravadas no próprio agendamento e são
-- restauradas ao editar.

alter table public.agendamentos
  add column if not exists canal_notificacao text check (canal_notificacao in ('whatsapp', 'email')),
  add column if not exists lembrete_1dia boolean not null default true,
  add column if not exists lembrete_1hora boolean not null default true;

comment on column public.agendamentos.canal_notificacao is
  'Canal escolhido para os lembretes deste agendamento: whatsapp ou email.';
