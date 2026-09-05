-- Migration: clientes
-- Tabela própria de clientes, para resolver o problema de nomes duplicados/
-- escritos de forma diferente que existia ao contar clientes por texto livre.
-- Agendamentos passam a poder referenciar uma cliente por ID (cliente_id),
-- mantendo o campo de texto "cliente" como está, para não quebrar nada.

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  notas text,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clientes is
  'Base de dados de clientes por profissional, usada para contar visitas e detetar clientes inativas.';

-- Reaproveita a função de updated_at (já criada na migration de custos_fixos;
-- recriá-la aqui garante que esta migration funciona mesmo correndo sozinha).
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- RLS: cada utilizadora só vê e mexe nas suas próprias clientes
alter table public.clientes enable row level security;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own"
  on public.clientes for select
  using (usuario_id = auth.uid());

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own"
  on public.clientes for insert
  with check (usuario_id = auth.uid());

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own"
  on public.clientes for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own"
  on public.clientes for delete
  using (usuario_id = auth.uid());

-- Liga agendamentos a uma cliente concreta por ID (em vez de só pelo nome escrito)
alter table public.agendamentos
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists idx_agendamentos_cliente_id on public.agendamentos(cliente_id);
