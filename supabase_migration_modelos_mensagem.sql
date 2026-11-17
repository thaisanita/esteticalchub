-- Migration: modelos_mensagem
-- Modelos de texto editáveis em Configurações → "Mensagens automáticas".
-- Por agora só um tipo: 'whatsapp_marcacao' (a mensagem do botão do WhatsApp
-- em cada marcação). Sem linha guardada, a app usa o texto por omissão.
--
-- Só acrescenta uma tabela nova, vazia. Não altera nem apaga nada que exista.
-- RLS: cada utilizadora só vê e muda os seus modelos (auth.uid() = usuario_id).
-- Ao apagar a conta, os modelos dela apagam-se também (on delete cascade).

create table if not exists public.modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,
  texto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modelos_mensagem_tipo_check check (tipo in ('whatsapp_marcacao')),
  constraint modelos_mensagem_texto_check check (char_length(texto) between 1 and 2000),
  constraint modelos_mensagem_unico unique (usuario_id, tipo)
);

comment on table public.modelos_mensagem is
  'Textos editáveis das mensagens (ex.: WhatsApp da marcação), um por utilizadora e tipo.';

alter table public.modelos_mensagem enable row level security;

drop policy if exists modelos_mensagem_select_own on public.modelos_mensagem;
create policy modelos_mensagem_select_own on public.modelos_mensagem
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists modelos_mensagem_insert_own on public.modelos_mensagem;
create policy modelos_mensagem_insert_own on public.modelos_mensagem
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists modelos_mensagem_update_own on public.modelos_mensagem;
create policy modelos_mensagem_update_own on public.modelos_mensagem
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists modelos_mensagem_delete_own on public.modelos_mensagem;
create policy modelos_mensagem_delete_own on public.modelos_mensagem
  for delete to authenticated using (usuario_id = auth.uid());
