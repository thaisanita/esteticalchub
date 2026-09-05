-- Migration: pagamentos_rapidos
-- Permite marcar um agendamento como pago, com a forma de pagamento usada,
-- de forma rápida — sem precisar reabrir o formulário completo.

alter table public.agendamentos
  add column if not exists pago boolean not null default false,
  add column if not exists forma_pagamento text,
  add column if not exists pago_em timestamptz;

comment on column public.agendamentos.forma_pagamento is
  'dinheiro | cartao | mbway | transferencia';
