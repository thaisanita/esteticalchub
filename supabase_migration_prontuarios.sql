-- Migration: prontuarios
-- Prontuário da cliente: ficha de anamnese, foto e contrato digitalizado.
-- Ficheiros (foto/contrato) vivem no Supabase Storage, não na base de dados —
-- a tabela só guarda o link, para o site continuar rápido.

create table if not exists public.prontuarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,

  foto_url text,
  contrato_url text,

  -- Ficha de anamnese (perguntas de saúde), guardada como JSON para
  -- facilitar adicionar novas perguntas no futuro sem outra migration.
  anamnese jsonb not null default '{}'::jsonb,

  consentimento_confirmado boolean not null default false,
  consentimento_em timestamptz,

  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (cliente_id)
);

comment on table public.prontuarios is
  'Prontuário por cliente: ficha de anamnese, foto e contrato digitalizado. Dados de saúde — tratar com cuidado extra.';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prontuarios_updated_at on public.prontuarios;
create trigger trg_prontuarios_updated_at
  before update on public.prontuarios
  for each row execute function public.set_updated_at();

alter table public.prontuarios enable row level security;

drop policy if exists "prontuarios_select_own" on public.prontuarios;
create policy "prontuarios_select_own"
  on public.prontuarios for select
  using (usuario_id = auth.uid());

drop policy if exists "prontuarios_insert_own" on public.prontuarios;
create policy "prontuarios_insert_own"
  on public.prontuarios for insert
  with check (usuario_id = auth.uid());

drop policy if exists "prontuarios_update_own" on public.prontuarios;
create policy "prontuarios_update_own"
  on public.prontuarios for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "prontuarios_delete_own" on public.prontuarios;
create policy "prontuarios_delete_own"
  on public.prontuarios for delete
  using (usuario_id = auth.uid());

-- Espaço de armazenamento (Storage) para as fotos e contratos.
-- Privado (não público) — só acessível através da app, com login.
insert into storage.buckets (id, name, public)
values ('prontuarios', 'prontuarios', false)
on conflict (id) do nothing;

-- RLS do Storage: cada profissional só acede aos ficheiros dentro da sua
-- própria pasta (o caminho começa sempre por auth.uid()/...).
drop policy if exists "prontuarios_storage_select_own" on storage.objects;
create policy "prontuarios_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'prontuarios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "prontuarios_storage_insert_own" on storage.objects;
create policy "prontuarios_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'prontuarios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "prontuarios_storage_update_own" on storage.objects;
create policy "prontuarios_storage_update_own"
  on storage.objects for update
  using (bucket_id = 'prontuarios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "prontuarios_storage_delete_own" on storage.objects;
create policy "prontuarios_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'prontuarios' and (storage.foldername(name))[1] = auth.uid()::text);
