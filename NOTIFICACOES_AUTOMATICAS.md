# Mensagens automáticas para clientes — Fase 1 (email)

Quando a profissional cria um agendamento em **Novo Agendamento** e deixa os
lembretes ligados, o site grava uma ou duas linhas em `fila_notificacoes`
(1 dia antes e/ou 1 hora antes), já com o texto pronto.

Esta fase adiciona o **carteiro**: uma Edge Function do Supabase que corre de
poucos em poucos minutos, lê a fila e envia os lembretes de **email** pelo
[Resend](https://resend.com). As linhas de canal `whatsapp` ficam intactas na
fila para a Fase 2.

```
Novo Agendamento ──grava──▶ fila_notificacoes ──lê──▶ Edge Function processar-fila ──▶ Resend ──▶ email da cliente
                                    ▲                          │
                                pg_cron (a cada 5 min) ────────┘
```

## 1. Aplicar a migração

No **SQL Editor** do Supabase, correr:

- `supabase_migration_fila_notificacoes_envio.sql`

Isto amplia `fila_notificacoes` (colunas `mensagem`, `assunto`, `destino`,
`tentativas`, `ultimo_erro`, `enviado_em`, `provider_id`, `updated_at`), adiciona
`aceita_lembretes` / `opt_out_token` em `clientes`, e cria a função
`reivindicar_notificacoes()` que entrega lotes trancados ao worker (evita envio
duplicado).

## 2. Conta Resend

1. Criar conta em resend.com e **verificar um domínio** (SPF/DKIM). Para testar
   dá para usar o remetente `onboarding@resend.dev` sem domínio.
2. Gerar uma **API key**.
3. Definir o remetente final, ex.: `Agenda Estética <lembretes@seudominio.com>`.

## 3. Deploy da Edge Function

Requer a [CLI do Supabase](https://supabase.com/docs/guides/cli).

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

# segredos (só ficam no servidor, nunca no frontend)
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  NOTIF_FROM_EMAIL="Agenda Estética <lembretes@seudominio.com>" \
  CRON_SECRET=$(openssl rand -hex 24) \
  APP_URL=https://agenda-estetica-web.vercel.app

# a função é chamada pelo cron (não por utilizadores), por isso sem verificação de JWT
supabase functions deploy processar-fila --no-verify-jwt
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente no
> runtime — **não** os defina à mão.

Anotar o valor gerado de `CRON_SECRET` para o passo seguinte.

## 4. Agendar com pg_cron

No **SQL Editor**, uma vez:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'processar-fila-notificacoes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/processar-fila',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET_DO_PASSO_3>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Para remover: `select cron.unschedule('processar-fila-notificacoes');`

## 5. Testar

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/processar-fila' \
  -H 'x-cron-secret: <CRON_SECRET>'
# -> {"total":N,"enviados":N,"cancelados":0,"erros":0}
```

Criar um agendamento de teste com email e a hora daqui a ~1h05 (para a linha de
"1 hora antes" ficar com `data_disparo` no passado imediato) e ver o email chegar
no próximo ciclo do cron. Acompanhar em `fila_notificacoes` (`status`,
`ultimo_erro`) e nos logs da função no painel do Supabase.

## Estados de uma linha da fila

| status | significado |
|---|---|
| `pendente` | à espera de `data_disparo` |
| `processando` | worker a tratar agora |
| `enviado` | entregue ao Resend (`provider_id` guardado) |
| `erro` | falhou, vai voltar a tentar (até 3x) |
| `falhou` | desistiu após 3 tentativas |
| `cancelado` | opt-out da cliente / sem email válido / agendamento apagado |

## LGPD / opt-out

Cada email leva no rodapé um link `.../opt-out?token=<opt_out_token>`. Falta
ainda criar a rota `/opt-out` no site (página pública simples que, dado o token,
faz `update clientes set aceita_lembretes=false, opt_out_em=now()`). Enquanto não
existir, o cancelamento pode ser feito à mão no Supabase ou numa próxima fase.

## Próximas fases

- **Fase 2 — WhatsApp:** mesmo worker, ramo `canal='whatsapp'` a chamar a API
  oficial (Meta Cloud API) ou um BSP brasileiro (Zenvia/Gupshup), com templates
  aprovados. `reivindicar_notificacoes(p_canal => 'whatsapp')` já suporta.
- **Fase 3 — confirmação:** webhook do provedor a atualizar o estado do
  agendamento quando a cliente responde.
