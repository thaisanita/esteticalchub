-- Migration: custos_fase1
-- Custos fixos com frequência + opção "não contar duas vezes" nas despesas.
--
-- REGRA: só acrescenta colunas. Não altera, não corrige e não apaga nenhum
-- registo de nenhuma utilizadora. Os valores por omissão mantêm o que cada
-- utilizadora vê hoje:
--
-- custos_fixos
--   frequencia         -> 'mensal' | 'trimestral' | 'semestral' | 'anual'.
--                         Os custos que já existem ficam 'mensal' (como hoje).
--   valor_pagamento    -> quanto se paga de cada vez (ex.: seguro anual 240 €).
--                         Fica vazio nos custos que já existem; aí a app usa o
--                         valor_mensal de sempre.
--   proximo_pagamento  -> data do próximo pagamento (para "Próximos
--                         pagamentos" e o aviso antes do vencimento). Vazio
--                         nos que já existem, até a utilizadora a preencher.
--   valor_mensal continua a ser o valor mensal equivalente (a app calcula-o
--   ao guardar: anual ÷ 12, semestral ÷ 6, trimestral ÷ 3), por isso o
--   Assistente IA e as páginas antigas continuam certos.
--
-- se_custos (despesas pontuais e compras de material)
--   conta_no_lucro     -> true por omissão: tudo continua a contar como hoje.
--                         Só muda quando a própria utilizadora carrega no
--                         botão "Não contar duas vezes" na app.
--
-- RLS: as políticas atuais destas duas tabelas já filtram a linha inteira por
-- usuario_id = auth.uid(); as colunas novas ficam cobertas. Nenhuma política
-- é criada, alterada ou removida.

alter table public.custos_fixos
  add column if not exists frequencia text not null default 'mensal',
  add column if not exists valor_pagamento numeric,
  add column if not exists proximo_pagamento date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custos_fixos_frequencia_check'
      and conrelid = 'public.custos_fixos'::regclass
  ) then
    alter table public.custos_fixos
      add constraint custos_fixos_frequencia_check
      check (frequencia in ('mensal', 'trimestral', 'semestral', 'anual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'custos_fixos_valor_pagamento_check'
      and conrelid = 'public.custos_fixos'::regclass
  ) then
    alter table public.custos_fixos
      add constraint custos_fixos_valor_pagamento_check
      check (valor_pagamento is null or valor_pagamento >= 0);
  end if;
end $$;

alter table public.se_custos
  add column if not exists conta_no_lucro boolean not null default true;

comment on column public.custos_fixos.frequencia is
  'De quanto em quanto tempo se paga: mensal, trimestral, semestral ou anual.';
comment on column public.custos_fixos.valor_pagamento is
  'Valor de cada pagamento. NULL nos custos antigos (usa valor_mensal).';
comment on column public.custos_fixos.proximo_pagamento is
  'Data do próximo pagamento, para a lista e o aviso de vencimento.';
comment on column public.custos_fixos.valor_mensal is
  'Valor mensal equivalente (anual ÷ 12, semestral ÷ 6, trimestral ÷ 3).';
comment on column public.se_custos.conta_no_lucro is
  'Se false, a utilizadora escolheu não contar este lançamento no lucro (ex.: repetia um custo fixo).';
