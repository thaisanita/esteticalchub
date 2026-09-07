-- Migration: fix_confirmacao_rls
-- Corrige uma falha grave: qualquer policy pública em "agendamentos" que use
-- `using (token_confirmacao IS NOT NULL)` é verdadeira para TODAS as linhas
-- que tenham um token (ou seja, quase todas) — na prática dava acesso de
-- leitura E escrita a qualquer pessoa, a todos os agendamentos, de todas as
-- profissionais da plataforma, sem precisar saber o token certo.
--
-- A correção: remove essas policies, e substitui pelo padrão correto para
-- "links mágicos" — funções SECURITY DEFINER que validam o token exato
-- como parâmetro, e só essas funções (não a tabela diretamente) ficam
-- acessíveis publicamente.

-- 1. Remove as policies inseguras, se existirem (nomes conforme o relatório)
drop policy if exists "Permitir leitura pública por token" on public.agendamentos;
drop policy if exists "Permitir atualização de presença por token" on public.agendamentos;

-- Nomes alternativos possíveis, por segurança (caso tenham sido criadas com
-- outro nome) — remove qualquer policy que public/anon leia ou escreva sem
-- estar ligada a auth.uid().
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agendamentos'
      and (qual ilike '%token_confirmacao%' or with_check ilike '%token_confirmacao%')
  loop
    execute format('drop policy if exists %I on public.agendamentos', pol.policyname);
  end loop;
end $$;

-- 2. Função para o cliente ver o SEU agendamento através do token exato
create or replace function public.obter_agendamento_por_token(p_token text)
returns table (
  id uuid,
  cliente text,
  procedimento text,
  data date,
  hora text,
  ponto_atendimento text,
  status_confirmacao text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select a.id, a.cliente, a.procedimento, a.data, a.hora, a.ponto_atendimento, a.status_confirmacao
    from public.agendamentos a
    where a.token_confirmacao = p_token
    limit 1;
end;
$$;

-- 3. Função para o cliente confirmar/recusar presença através do token exato
create or replace function public.confirmar_presenca(p_token text, p_resposta text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_resposta not in ('confirmado', 'talvez', 'cancelado') then
    raise exception 'Resposta inválida';
  end if;

  update public.agendamentos
  set status_confirmacao = p_resposta
  where token_confirmacao = p_token;

  return found;
end;
$$;

-- 4. Só estas duas funções ficam acessíveis a quem não está logado —
-- nunca a tabela diretamente.
revoke all on function public.obter_agendamento_por_token(text) from public;
revoke all on function public.confirmar_presenca(text, text) from public;
grant execute on function public.obter_agendamento_por_token(text) to anon, authenticated;
grant execute on function public.confirmar_presenca(text, text) to anon, authenticated;
