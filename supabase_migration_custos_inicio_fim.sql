-- Migration: custos_inicio_fim
-- Em que meses conta cada custo fixo.
--
-- REGRA: só acrescenta colunas VAZIAS. Não altera, não corrige e não apaga
-- nenhum registo de nenhuma utilizadora. Sem valor por omissão: nos custos
-- que já existem as duas colunas ficam vazias e tudo continua como hoje.
--
-- custos_fixos
--   comeca_em  -> data a partir da qual o custo conta (conta o mês inteiro
--                 dessa data). Vazio = conta a partir do mês em que foi
--                 registado (created_at), como hoje.
--   termina_em -> último mês em que o custo conta (o mês inteiro dessa
--                 data). Vazio = continua a contar. A app grava a data de
--                 hoje quando a utilizadora desativa o custo, para os meses
--                 passados não mudarem.
--
-- RLS: as políticas atuais de custos_fixos filtram a linha inteira por
-- usuario_id = auth.uid(); as colunas novas ficam cobertas. Nenhuma política
-- é criada, alterada ou removida.

alter table public.custos_fixos
  add column if not exists comeca_em date,
  add column if not exists termina_em date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custos_fixos_inicio_fim_check'
      and conrelid = 'public.custos_fixos'::regclass
  ) then
    alter table public.custos_fixos
      add constraint custos_fixos_inicio_fim_check
      check (comeca_em is null or termina_em is null or termina_em >= comeca_em);
  end if;
end $$;

comment on column public.custos_fixos.comeca_em is
  'Conta a partir do mês desta data. NULL = a partir do mês de created_at.';
comment on column public.custos_fixos.termina_em is
  'Último mês em que conta (o mês desta data). NULL = continua a contar. Gravado pela app ao desativar.';
