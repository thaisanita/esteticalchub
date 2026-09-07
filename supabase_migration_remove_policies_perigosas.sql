-- Migration: remove_policies_perigosas
-- A verificação final encontrou 2 policies com condição "true" (acesso total,
-- sem exigir dono) que anulavam a proteção das policies corretas ao lado.

drop policy if exists "Permitir tudo em se_custos" on public.se_custos;
drop policy if exists "Permitir insercao na fila_notificacoes" on public.fila_notificacoes;

-- Confirmação: lista o que sobrou nestas 2 tabelas, para conferires que só
-- ficaram as policies corretas (as que exigem auth.uid() = usuario_id).
select tablename, policyname, cmd, coalesce(qual, with_check) as condicao
from pg_policies
where schemaname = 'public' and tablename in ('se_custos', 'fila_notificacoes')
order by tablename, policyname;
