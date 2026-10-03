-- Migration: planos (assinaturas Stripe)
-- Acrescenta à tabela profiles os campos do plano/subscrição. O valor por
-- defeito é 'free', por isso contas que nunca tiveram uma linha em profiles
-- continuam a ser tratadas como grátis pelo resto do código (hook usePlan()
-- e as Edge Functions usam sempre o plano 'free' quando a linha não existe).

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_expires_at timestamptz;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'pro'));

-- Importante (segurança): a política "profiles_update_own" já existente
-- deixa a própria dona atualizar QUALQUER coluna da sua linha, porque o RLS
-- do Postgres funciona por linha, não por coluna. Sem isto, bastava chamar
-- supabase.from('profiles').update({ plan: 'pro' }) com a própria sessão
-- para "ficar Pro" de borla. Isto bloqueia essas 4 colunas para todos os
-- papéis do site (anon/authenticated) — só as Edge Functions (que usam a
-- service_role, não sujeita a estes GRANTs) podem mudá-las.
revoke update (plan, stripe_customer_id, stripe_subscription_id, plan_expires_at)
  on public.profiles from authenticated, anon;
