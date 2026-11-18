-- Migration: modelos_mensagem
-- Modelos de texto editáveis em Configurações → "Mensagens automáticas".
-- Um por utilizadora e tipo:
--   whatsapp_marcacao   mensagem do botão do WhatsApp em cada marcação
--   email_confirmacao   email logo ao marcar
--   email_cuidados      email de cuidados, X horas depois do fim do atendimento
--   email_avaliacao     email a pedir avaliação, X dias depois, a uma hora certa
--   email_retoque       email a lembrar o retoque, X dias depois (por omissão)
-- Sem linha guardada, a app usa o texto e as definições por omissão (a
-- confirmação continua ligada como hoje; os emails novos ficam desligados).
--
-- Só acrescenta uma tabela nova, vazia. Não altera nem apaga nada que exista.
-- RLS: cada utilizadora só vê e muda os seus modelos (auth.uid() = usuario_id).
-- Ao apagar a conta, os modelos dela apagam-se também (on delete cascade).
-- Sem DROP: a tabela é nova, por isso as políticas ainda não existem.

create table if not exists public.modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,
  assunto text,
  texto text not null,
  ativo boolean not null default true,
  espera_horas integer,
  espera_dias integer,
  hora_envio time,
  link_avaliacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modelos_mensagem_tipo_check check (
    tipo in ('whatsapp_marcacao', 'email_confirmacao', 'email_cuidados', 'email_avaliacao', 'email_retoque')
  ),
  constraint modelos_mensagem_texto_check check (char_length(texto) between 1 and 5000),
  constraint modelos_mensagem_assunto_check check (assunto is null or char_length(assunto) between 1 and 200),
  constraint modelos_mensagem_espera_horas_check check (espera_horas is null or espera_horas between 0 and 720),
  constraint modelos_mensagem_espera_dias_check check (espera_dias is null or espera_dias between 0 and 365),
  constraint modelos_mensagem_link_check check (
    link_avaliacao is null or (link_avaliacao ~* '^https?://' and char_length(link_avaliacao) <= 500)
  ),
  constraint modelos_mensagem_unico unique (usuario_id, tipo)
);

comment on table public.modelos_mensagem is
  'Textos e definições das mensagens automáticas (WhatsApp da marcação e emails), um por utilizadora e tipo.';
comment on column public.modelos_mensagem.ativo is
  'Se este email automático está ligado. Sem linha, a app usa o que vem por omissão (só a confirmação ligada).';
comment on column public.modelos_mensagem.espera_horas is
  'Cuidados: quantas horas depois do fim do atendimento.';
comment on column public.modelos_mensagem.espera_dias is
  'Avaliação: quantos dias depois. Retoque: dias por omissão para novas marcações.';
comment on column public.modelos_mensagem.hora_envio is
  'Hora do dia a que sai (avaliação, retoque).';
comment on column public.modelos_mensagem.link_avaliacao is
  'Link de avaliação da profissional (ex.: Google), usado na variável {link_avaliacao}.';

alter table public.modelos_mensagem enable row level security;

create policy modelos_mensagem_select_own on public.modelos_mensagem
  for select to authenticated using (usuario_id = auth.uid());

create policy modelos_mensagem_insert_own on public.modelos_mensagem
  for insert to authenticated with check (usuario_id = auth.uid());

create policy modelos_mensagem_update_own on public.modelos_mensagem
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy modelos_mensagem_delete_own on public.modelos_mensagem
  for delete to authenticated using (usuario_id = auth.uid());
