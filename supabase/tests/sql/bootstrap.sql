-- Esquema mínimo que imita o Supabase de produção (nomes e tipos reais,
-- confirmados no projeto App-web-est em 11/11/2026), só com o que as funções
-- da WhatsApp Cloud API usam. Corre numa base de dados LOCAL e descartável.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  notas text,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agenda_id uuid not null,
  morada text
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  data date not null,
  hora time not null,
  cliente text not null,
  procedimento text,
  usuario_id uuid,
  telefone_cliente varchar,
  email_cliente varchar,
  status_confirmacao varchar,
  confirmacao_status text,
  cliente_id uuid references public.clientes(id) on delete set null,
  canal_notificacao text check (canal_notificacao in ('whatsapp', 'email')),
  lembrete_1dia boolean not null default true,
  lembrete_1hora boolean not null default true,
  agenda_id uuid not null,
  faltou boolean not null default false
);

create table public.paginas_publicas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  slug text not null,
  nome_negocio text not null
);

create table public.fila_notificacoes (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade,
  usuario_id uuid not null,
  tipo_destino varchar not null,
  canal varchar not null,
  antecedencia varchar not null,
  data_disparo timestamptz not null,
  status varchar default 'pendente',
  created_at timestamptz default now()
);

-- Policies equivalentes às de produção ("usuario ... suas proprias notificacoes")
alter table public.fila_notificacoes enable row level security;
create policy fila_sel on public.fila_notificacoes for select using (usuario_id = auth.uid());
create policy fila_ins on public.fila_notificacoes for insert with check (usuario_id = auth.uid());
create policy fila_upd on public.fila_notificacoes for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy fila_del on public.fila_notificacoes for delete using (usuario_id = auth.uid());

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
