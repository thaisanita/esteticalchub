-- Migration: kanban
-- Painel de planeamento estilo Trello: Quadro -> Lista -> Cartão. Usado para
-- organizar notas e projetos do negócio (ideias de marketing, tarefas
-- administrativas, planeamento de conteúdo), fora da agenda de clientes.

create table if not exists public.quadros_kanban (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  cor text,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.quadros_kanban is
  'Quadro de planeamento (nível 1 do kanban). Cada profissional pode ter vários, ex.: "Marketing", "Financeiro".';

create table if not exists public.listas_kanban (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quadro_id uuid not null references public.quadros_kanban(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

comment on table public.listas_kanban is
  'Coluna dentro de um quadro (nível 2 do kanban). "ordem" controla a posição horizontal das colunas.';

create table if not exists public.cartoes_kanban (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lista_id uuid not null references public.listas_kanban(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer not null default 0,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cartoes_kanban is
  'Cartão de tarefa/nota dentro de uma lista (nível 3 do kanban). "ordem" controla a posição vertical dentro da coluna.';

create index if not exists idx_listas_kanban_quadro on public.listas_kanban(quadro_id, ordem);
create index if not exists idx_cartoes_kanban_lista on public.cartoes_kanban(lista_id, ordem);

-- Reaproveita a função de updated_at já usada nas outras tabelas do projeto
-- (recriá-la aqui garante que esta migration funciona mesmo correndo sozinha).
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_quadros_kanban_updated_at on public.quadros_kanban;
create trigger trg_quadros_kanban_updated_at
  before update on public.quadros_kanban
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cartoes_kanban_updated_at on public.cartoes_kanban;
create trigger trg_cartoes_kanban_updated_at
  before update on public.cartoes_kanban
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cada profissional só vê e mexe nos seus próprios quadros/listas/cartões
-- ---------------------------------------------------------------------------
alter table public.quadros_kanban enable row level security;

drop policy if exists "quadros_kanban_select_own" on public.quadros_kanban;
create policy "quadros_kanban_select_own"
  on public.quadros_kanban for select
  using (usuario_id = auth.uid());

drop policy if exists "quadros_kanban_insert_own" on public.quadros_kanban;
create policy "quadros_kanban_insert_own"
  on public.quadros_kanban for insert
  with check (usuario_id = auth.uid());

drop policy if exists "quadros_kanban_update_own" on public.quadros_kanban;
create policy "quadros_kanban_update_own"
  on public.quadros_kanban for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "quadros_kanban_delete_own" on public.quadros_kanban;
create policy "quadros_kanban_delete_own"
  on public.quadros_kanban for delete
  using (usuario_id = auth.uid());

alter table public.listas_kanban enable row level security;

drop policy if exists "listas_kanban_select_own" on public.listas_kanban;
create policy "listas_kanban_select_own"
  on public.listas_kanban for select
  using (usuario_id = auth.uid());

drop policy if exists "listas_kanban_insert_own" on public.listas_kanban;
create policy "listas_kanban_insert_own"
  on public.listas_kanban for insert
  with check (usuario_id = auth.uid());

drop policy if exists "listas_kanban_update_own" on public.listas_kanban;
create policy "listas_kanban_update_own"
  on public.listas_kanban for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "listas_kanban_delete_own" on public.listas_kanban;
create policy "listas_kanban_delete_own"
  on public.listas_kanban for delete
  using (usuario_id = auth.uid());

alter table public.cartoes_kanban enable row level security;

drop policy if exists "cartoes_kanban_select_own" on public.cartoes_kanban;
create policy "cartoes_kanban_select_own"
  on public.cartoes_kanban for select
  using (usuario_id = auth.uid());

drop policy if exists "cartoes_kanban_insert_own" on public.cartoes_kanban;
create policy "cartoes_kanban_insert_own"
  on public.cartoes_kanban for insert
  with check (usuario_id = auth.uid());

drop policy if exists "cartoes_kanban_update_own" on public.cartoes_kanban;
create policy "cartoes_kanban_update_own"
  on public.cartoes_kanban for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "cartoes_kanban_delete_own" on public.cartoes_kanban;
create policy "cartoes_kanban_delete_own"
  on public.cartoes_kanban for delete
  using (usuario_id = auth.uid());
