-- Migration: whatsapp_bot
-- Suporte para o robô próprio de WhatsApp (whatsapp-bot/), que cada
-- profissional pode "ativar" mais tarde conectando o próprio número.
-- Ver whatsapp-bot/README.md para como ligar isto de verdade.

alter table public.configuracoes_usuario
  add column if not exists whatsapp_status text not null default 'desconectado'
    check (whatsapp_status in ('desconectado', 'aguardando_qr', 'conectado')),
  add column if not exists whatsapp_conectado_em timestamptz;

comment on column public.configuracoes_usuario.whatsapp_status is
  'Status da ligação do robô próprio de WhatsApp (whatsapp-bot/): desconectado, aguardando_qr ou conectado.';
