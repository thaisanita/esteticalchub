-- Migration: produtos_estoque
-- Estoque real, por quantidade (ml/g/unidade), ligado ao uso em cada
-- atendimento — permite saber quantas clientes um produto rendeu, o lucro
-- gerado, e sugerir reinvestimento quando o produto acaba.

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  unidade_medida text not null default 'ml', -- ml | g | unidade
  quantidade_total numeric not null,
  quantidade_restante numeric not null,
  custo_compra numeric not null default 0,
  esgotado_em timestamptz,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.produtos is
  'Produtos/materiais em estoque, controlados por quantidade (ml/g/unidade) e ligados ao uso real em atendimentos.';

create table if not exists public.produto_usos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  quantidade_usada numeric not null,
  criado_em timestamptz not null default now()
);

comment on table public.produto_usos is
  'Cada registo de uso de um produto num atendimento — permite calcular quantas clientes um lote rendeu.';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

alter table public.produtos enable row level security;
alter table public.produto_usos enable row level security;

drop policy if exists "produtos_select_own" on public.produtos;
create policy "produtos_select_own" on public.produtos for select using (usuario_id = auth.uid());
drop policy if exists "produtos_insert_own" on public.produtos;
create policy "produtos_insert_own" on public.produtos for insert with check (usuario_id = auth.uid());
drop policy if exists "produtos_update_own" on public.produtos;
create policy "produtos_update_own" on public.produtos for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "produtos_delete_own" on public.produtos;
create policy "produtos_delete_own" on public.produtos for delete using (usuario_id = auth.uid());

drop policy if exists "produto_usos_select_own" on public.produto_usos;
create policy "produto_usos_select_own" on public.produto_usos for select using (usuario_id = auth.uid());
drop policy if exists "produto_usos_insert_own" on public.produto_usos;
create policy "produto_usos_insert_own" on public.produto_usos for insert with check (usuario_id = auth.uid());
drop policy if exists "produto_usos_delete_own" on public.produto_usos;
create policy "produto_usos_delete_own" on public.produto_usos for delete using (usuario_id = auth.uid());
