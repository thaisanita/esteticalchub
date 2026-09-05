-- Migration: metas_mensais
-- Antes, a meta de atendimentos ficava só no localStorage do navegador, num
-- único valor sem histórico — mudar de mês não gravava a meta anterior.
-- Agora cada mês tem a sua própria linha, guardada por profissional.

create table if not exists public.metas_mensais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ano integer not null,
  mes integer not null check (mes >= 1 and mes <= 12),
  meta integer not null default 30,
  updated_at timestamptz not null default now(),
  unique (usuario_id, ano, mes)
);

comment on table public.metas_mensais is
  'Meta de nº de atendimentos por mês, por profissional — uma linha por mês, preservando o histórico.';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_metas_mensais_updated_at on public.metas_mensais;
create trigger trg_metas_mensais_updated_at
  before update on public.metas_mensais
  for each row execute function public.set_updated_at();

alter table public.metas_mensais enable row level security;

drop policy if exists "metas_mensais_select_own" on public.metas_mensais;
create policy "metas_mensais_select_own"
  on public.metas_mensais for select
  using (usuario_id = auth.uid());

drop policy if exists "metas_mensais_insert_own" on public.metas_mensais;
create policy "metas_mensais_insert_own"
  on public.metas_mensais for insert
  with check (usuario_id = auth.uid());

drop policy if exists "metas_mensais_update_own" on public.metas_mensais;
create policy "metas_mensais_update_own"
  on public.metas_mensais for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "metas_mensais_delete_own" on public.metas_mensais;
create policy "metas_mensais_delete_own"
  on public.metas_mensais for delete
  using (usuario_id = auth.uid());
