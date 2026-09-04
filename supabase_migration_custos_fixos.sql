-- Migration: custos_fixos
-- Custos recorrentes mensais (aluguel, internet, seguros, segurança social,
-- higiene e segurança, luz, software, etc.) usados para calcular o
-- ponto de equilíbrio: quanto é preciso faturar antes de haver lucro.

create table if not exists public.custos_fixos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  categoria text not null default 'outro',
  valor_mensal numeric not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.custos_fixos is
  'Custos fixos mensais recorrentes usados no cálculo do ponto de equilíbrio.';
comment on column public.custos_fixos.categoria is
  'aluguel | internet | seguros | seguranca_social | higiene_seguranca | luz | software | outro';

-- Mantém updated_at atualizado automaticamente
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_custos_fixos_updated_at on public.custos_fixos;
create trigger trg_custos_fixos_updated_at
  before update on public.custos_fixos
  for each row execute function public.set_updated_at();

-- RLS: cada utilizadora só vê e mexe nos seus próprios custos fixos
alter table public.custos_fixos enable row level security;

drop policy if exists "custos_fixos_select_own" on public.custos_fixos;
create policy "custos_fixos_select_own"
  on public.custos_fixos for select
  using (usuario_id = auth.uid());

drop policy if exists "custos_fixos_insert_own" on public.custos_fixos;
create policy "custos_fixos_insert_own"
  on public.custos_fixos for insert
  with check (usuario_id = auth.uid());

drop policy if exists "custos_fixos_update_own" on public.custos_fixos;
create policy "custos_fixos_update_own"
  on public.custos_fixos for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "custos_fixos_delete_own" on public.custos_fixos;
create policy "custos_fixos_delete_own"
  on public.custos_fixos for delete
  using (usuario_id = auth.uid());
