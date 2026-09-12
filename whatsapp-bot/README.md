# Robô de WhatsApp (próprio, não-oficial)

Serviço separado do site principal: liga ao WhatsApp de cada profissional
"como se fosse" o WhatsApp Web (escaneando um QR code), e expõe uma API
simples pro site mandar lembretes automáticos.

**Isto NÃO é a API oficial da Meta.** É a mesma técnica usada por serviços
como Whapi.cloud/UltraMsg, só que rodando no seu próprio servidor em vez de
pagar mensalidade a terceiros. Ver os riscos abaixo antes de ativar.

## Por que este código existe mas não está "ligado"

Foi construído e testado (arranca, autentica, recusa pedidos sem permissão),
mas **fica desligado até você decidir ativar**, porque ativar de verdade
exige 3 coisas que só você pode decidir/pagar:

1. **Hospedar isto nalgum lugar que fique ligado 24 horas.** Ao contrário do
   resto do site (Vercel + Supabase Edge Functions, que só "acordam" quando
   chamados), o WhatsApp Web precisa duma ligação sempre aberta. Opções
   simples: [Railway](https://railway.app), [Fly.io](https://fly.io), ou uma
   VPS pequena (ex.: DigitalOcean, Hetzner). Custo típico: ~$5-10/mês no
   total (não por profissional — um servidor aguenta várias sessões).
2. **Definir as variáveis de ambiente** (ver `.env.example`).
3. **Aceitar o risco:** por não ser a API oficial, o WhatsApp pode banir o
   número que escanear o QR code, sem aviso — mais provável com volume alto
   ou uso muito automatizado. Para o volume de uma esteticista mandando
   lembretes pras próprias clientes, o risco é geralmente baixo, mas é real.

## Como ativar (quando estiver pronta)

1. `cd whatsapp-bot && npm install`
2. `cp .env.example .env` e preenche com os valores do Supabase + um
   `BOT_SECRET` inventado por você.
3. `npm start` (localmente, só pra testar) — ou faz deploy no Railway/Fly.io.
4. No site principal, define a variável de ambiente
   `VITE_WHATSAPP_BOT_URL` (no `.env.local` e na Vercel) com o endereço
   público deste servidor. Isso faz aparecer o botão "Conectar WhatsApp" na
   tela de Configurações.
5. Na Edge Function `processar-fila` do Supabase, define os secrets
   `WHATSAPP_BOT_URL` (mesmo endereço) e `BOT_SECRET` (igual ao passo 2).
   Isso liga o "carteiro" de e-mail para também processar lembretes de
   WhatsApp.
6. Cada profissional entra em Configurações → Conectar WhatsApp → escaneia o
   QR code com o próprio celular. Pronto — a partir daí os lembretes dela
   saem do número dela.

## Rotas

| Rota | Quem chama | O que faz |
|---|---|---|
| `GET /saude` | qualquer um | verifica se está no ar |
| `POST /sessao/conectar` | o site, com o login da profissional | inicia a ligação, devolve o QR code |
| `GET /sessao/status` | o site | `desconectado` \| `aguardando_qr` \| `conectado` |
| `POST /sessao/desconectar` | o site | desliga e apaga a sessão |
| `POST /enviar` | só a Edge Function `processar-fila` (com `x-bot-secret`) | manda um lembrete |

## Onde ficam as sessões

Em `sessions/<usuario_id>/` (fica de fora do git). Se o servidor reiniciar,
reconecta sozinho usando esses ficheiros — só pede QR code de novo se a
profissional desconectar pelo próprio celular, ou se apagar essa pasta.
