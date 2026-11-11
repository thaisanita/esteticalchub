# WhatsApp Cloud API (Meta) — EstetiCalcHub

Integração **paralela** e **desligada por omissão** com a API oficial do WhatsApp,
para substituir no futuro o robô Baileys (`whatsapp-bot/`) nos lembretes de marcação.

> **Estado (11/11/2026):** o código, os testes e a migration estão no branch
> `feat/whatsapp-cloud-api`. **Nada foi aplicado no Supabase, nada foi publicado e
> nenhuma mensagem foi enviada.** A integração ainda **não foi testada contra a API
> da Meta**.

---

## 1. Arquitetura

```
NovoAgendamento.tsx ──insert──▶ fila_notificacoes
                                  │
                 trigger BEFORE INSERT (whatsapp_cloud_encaminhar_fila)
                 canal='whatsapp' + 1_dia + profissional aderente ⇒ canal='whatsapp_cloud'
                                  │
   ┌──────────────────────────────┴──────────────────────────────┐
   ▼                                                             ▼
canal 'email' / 'whatsapp'                                 canal 'whatsapp_cloud'
cron "processar-fila-notificacoes" → Edge Function         worker Cloud API (núcleo pronto,
super-action → reivindicar_notificacoes(canal)             AINDA SEM PONTO DE ENTRADA — ver §11)
→ Resend / robô Baileys  (INALTERADO)                      → reivindicar_whatsapp_cloud
                                                           → whatsapp_cloud_preparar (valida na BD)
                                                           → whatsapp_cloud_reservar (idempotência)
                                                           → POST graph.facebook.com/v26.0/{PHONE_NUMBER_ID}/messages
                                                           → whatsapp_cloud_registar_resultado
                                                                      ▲
Meta ──POST assinado──▶ Edge Function whatsapp-webhook ──▶ whatsapp_cloud_registar_evento
```

### Ficheiros

| Ficheiro | O que faz |
|---|---|
| `supabase_migration_whatsapp_cloud.sql` | Tabelas, trigger, funções e permissões (aditiva) |
| `supabase/functions/_shared/telefone.ts` | Normalização E.164 conservadora |
| `supabase/functions/_shared/whatsapp-cloud.ts` | Cliente da Graph API: validação, timeout, classificação de erros |
| `supabase/functions/_shared/webhook-meta.ts` | HMAC-SHA256, verificação GET, extração de estados |
| `supabase/functions/_shared/lembretes-whatsapp-cloud.ts` | Núcleo do worker + adaptador Supabase |
| `supabase/functions/whatsapp-webhook/` | Webhook (GET verificação, POST estados) |
| `supabase/functions/testar-whatsapp-cloud/` | Teste manual controlado (dry-run por omissão) |
| `supabase/functions/tests/*_test.ts` | Testes Deno (60) |
| `supabase/tests/sql/` | Testes SQL num Postgres 17 local descartável (33) |
| `supabase/functions/.env.example` | Nomes dos segredos, com valores fictícios |

### Tabelas novas

| Tabela | Conteúdo |
|---|---|
| `whatsapp_cloud_profissionais` | Adesão por profissional (`ativo`, `limite_diario`). Ninguém está aderente por omissão. |
| `whatsapp_cloud_envios` | Um registo por chave de idempotência: estado, `wamid`, datas, erro, tentativas |
| `whatsapp_cloud_eventos` | Eventos do webhook, únicos por `(wamid, estado)` |
| `clientes.whatsapp_consentimento_em` / `_origem` | Opt-in explícito (colunas novas) |

---

## 2. Separação Baileys / Cloud API (nunca os dois na mesma linha)

* O cron de produção chama **`super-action`** (não `processar-fila`), que usa
  `reivindicar_notificacoes(p_limite, p_canal)` com `canal = 'email'` e `canal = 'whatsapp'`
  — filtro **exato**.
* As linhas da Cloud API têm `canal = 'whatsapp_cloud'`, atribuído **no momento da
  criação** por um trigger. Os dois reivindicadores trabalham sobre conjuntos
  **disjuntos por construção**; dentro de cada conjunto, `FOR UPDATE SKIP LOCKED`
  garante que uma linha é entregue a um só worker.
* Um trigger `BEFORE UPDATE` impede a profissional (role `authenticated`) de mudar uma
  linha para/de `whatsapp_cloud` ou de alterar linhas da Cloud API. `DELETE` continua
  permitido (a edição de marcações apaga e recria as linhas pendentes).
* Testado com 10 ligações simultâneas e com uma transação do cron antigo aberta
  enquanto o worker novo corre.

## 3. Prevenção de duplicados

**Chave de idempotência** (`SHA-256`):

```
v1 | agendamento_id | tipo | antecedencia | data+hora da marcação | telefone E.164 | template | idioma
```

`whatsapp_cloud_envios.chave_idempotencia` é `UNIQUE`. A reserva é feita **antes** do
pedido à Meta, com `INSERT … ON CONFLICT DO UPDATE … WHERE estado = 'pendente'`.

| Situação | Resultado |
|---|---|
| Cron corre duas vezes / dois workers | `SKIP LOCKED` + reserva única ⇒ 1 envio |
| Marcação editada sem mudar data/hora/telefone (fila recriada) | Mesma chave ⇒ bloqueado (`duplicado:aceite`) |
| **Remarcação** (nova data ou hora) | Chave nova ⇒ novo lembrete (correto: é outra marcação) |
| Telefone corrigido | Chave nova ⇒ lembrete para o número novo (pode haver 2 mensagens se a correção for depois do envio) |
| Rejeição temporária **confirmada** pela Meta | Mesma chave volta a `pendente` com `proxima_tentativa_em` (espera crescente: 10, 20, 40 min); máx. 3 tentativas |
| Resultado **incerto** | `desconhecido` — **nunca** repetido automaticamente, nem por linhas recriadas |
| Worker cai entre a reserva e o registo | Reserva com mais de 10 min passa a `desconhecido` |

O `wamid` confirma que a Meta **aceitou** o pedido, não que entregou. A entrega chega
pelo webhook (`enviado` → `entregue` → `lido`, ou `falhado`). Os estados nunca
retrocedem e um `failed` depois de `delivered` é ignorado.

### Rejeitado vs incerto

| Resposta | Classificação |
|---|---|
| 2xx com `messages[0].id` | **aceite** |
| 2xx sem `wamid`, ou corpo não-JSON | **incerto** |
| 400/401/403/404 com erro da Meta | **rejeitado** definitivo (ex.: 190 token, 132001 template, 100 parâmetro) |
| 429, ou códigos 4, 80007, 130429, 131048, 131056, 131016, 2 | **rejeitado** retentável |
| 5xx sem erro da Meta / com erro genérico, timeout, falha de rede | **incerto** |

## 4. Validação no servidor

`whatsapp_cloud_preparar` lê **tudo** das tabelas e ignora `destino` e `mensagem` da
fila (a profissional pode editá-los). Recusa (e cancela a linha) se:

* a profissional não estiver aderente/ativa;
* `agendamentos.usuario_id` ≠ `fila_notificacoes.usuario_id`;
* a cliente não for da mesma agenda que a marcação (`clientes.agenda_id`);
* `lembrete_1dia = false`, `canal_notificacao ≠ 'whatsapp'`, `faltou`, ou confirmação `cancelado`;
* `aceita_lembretes = false` ou **sem `whatsapp_consentimento_em`**;
* sem telefone, telefone inválido (§5), sem nome da profissional;
* fora da janela: antes de 24 h − 15 min, ou se em Lisboa já não for a véspera;
* limite diário da profissional atingido (`limite_diario`, por omissão 20).

## 5. Telefones

E.164 estrito. Aceita `+…`, `00…`, `3519XXXXXXXX` e 9 dígitos começados por `9`
(⇒ `+351`). **Recusa** tudo o resto, incluindo números sem `+` com outro indicativo
(havia 31 números a começar por `352` e alguns com 11 dígitos na base: precisam de ser
revistos pelas profissionais). Nos logs e na base só fica `+351******678`.

## 6. Variáveis de ambiente (Supabase Secrets)

Ver `supabase/functions/.env.example`. Nunca com prefixo `VITE_`.

| Nome | Usado por |
|---|---|
| `WA_ACCESS_TOKEN` | envio |
| `WA_PHONE_NUMBER_ID` | envio |
| `WA_WABA_ID` | referência/gestão (templates) |
| `WA_APP_SECRET` | webhook (assinatura) |
| `WA_VERIFY_TOKEN` | webhook (GET) |
| `WA_GRAPH_API_VERSION` | envio (por omissão `v26.0`) |
| `WA_TEST_ADMIN_USER_IDS`, `WA_TEST_DESTINATARIOS`, `WA_TEST_ENVIO_REAL_PERMITIDO` | função de teste |

**Versão da Graph API:** `v26.0`, lançada a 29/07/2026, é a mais recente no changelog
oficial (https://developers.facebook.com/docs/graph-api/changelog/versions). Confirmar de
novo antes de passar a produção.

## 7. Como testar

### Localmente (sem rede, sem Supabase, sem Meta)

```bash
# Testes Deno (60) — o DENO_NO_PACKAGE_JSON evita o package.json do frontend
cd supabase/functions
DENO_NO_PACKAGE_JSON=1 deno test --allow-read --no-config tests/

# Testes SQL (33) — Postgres 17 local e descartável
cd supabase/tests/sql
npm install
npm test
```

### Com a conta Meta (quando autorizado — por esta ordem)

1. Aplicar a migration (SQL Editor) — **pendente de aprovação**.
2. Definir os segredos (`supabase secrets set …`) com o token **de teste** e o
   Phone Number ID de teste (`1376229915563846`).
3. No painel **API Setup**, adicionar o teu telemóvel à lista de destinatários do número
   de teste e pôr esse número em `WA_TEST_DESTINATARIOS`.
4. Deploy: `supabase functions deploy testar-whatsapp-cloud` (com JWT).
5. Chamar em **dry-run** (por omissão):
   ```bash
   curl -X POST https://<ref>.supabase.co/functions/v1/testar-whatsapp-cloud \
     -H "Authorization: Bearer <JWT de uma conta admin>" \
     -H "Content-Type: application/json" \
     -d '{"destinatario":"+3519XXXXXXXX","template":"hello_world"}'
   ```
6. Envio real (só com autorização): `WA_TEST_ENVIO_REAL_PERMITIDO=true` **e**
   `"confirmar_envio_real": true`. Começar por `hello_world`.
7. Webhook: deploy com `--no-verify-jwt`, configurar no painel (§8), confirmar os
   estados em `whatsapp_cloud_envios`/`whatsapp_cloud_eventos`.

## 8. Configurar o webhook

1. `supabase functions deploy whatsapp-webhook --no-verify-jwt`
2. developers.facebook.com → app **esteticalchub** → WhatsApp → Configuração:
   * URL de callback: `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
   * Verificar token: o valor de `WA_VERIFY_TOKEN`
3. Subscrever o campo **messages**.
4. Enquanto a app estiver em modo **Desenvolvimento**, a Meta só envia webhooks de teste
   do painel. Os estados reais exigem a app **publicada**.

A assinatura `X-Hub-Signature-256` é sempre validada (HMAC-SHA256 do corpo bruto com
`WA_APP_SECRET`). Sem `WA_APP_SECRET` o webhook responde 503 a tudo.

## 9. Aprovar o template

WhatsApp Manager → Modelos de mensagem → Criar modelo:

* **Categoria:** Utilidade · **Nome:** `lembrete_marcacao_24h` · **Idioma:** Português (Portugal) `pt_PT`
* **Corpo:**
  ```
  Olá, {{1}}! 👋

  {{2}} relembra que tens uma marcação amanhã, dia {{3}}, às {{4}}, para {{5}}.

  Se precisares de alterar ou cancelar a marcação, contacta diretamente o estabelecimento.

  Lembrete enviado através do EstetiCalcHub.
  ```
* **Exemplos:** {{1}} Ana · {{2}} Janaína Dias PMU · {{3}} 12/11 · {{4}} 15:00 · {{5}} Microblading

O código envia exatamente 5 parâmetros por esta ordem: primeiro nome, profissional,
`dd/mm`, `HH:MM`, serviço.

## 10. Migrar do Baileys (quando autorizado)

1. Template aprovado + número português registado + forma de pagamento.
2. Formulário de consentimento em produção (preenche `whatsapp_consentimento_em`).
3. Definir o ponto de entrada do worker (§11) e o seu agendamento — **decisão pendente**.
4. Ativar uma profissional piloto:
   `insert into whatsapp_cloud_profissionais (usuario_id, ativo) values ('<uuid>', true);`
   Só as **novas** linhas de lembrete de 1 dia dessa profissional passam a `whatsapp_cloud`.
5. Acompanhar `whatsapp_cloud_envios` e os estados do webhook. Alargar aos poucos.

## 11. Voltar ao sistema anterior

```sql
-- 1. parar novas linhas Cloud API
update whatsapp_cloud_profissionais set ativo = false;
-- 2. devolver ao Baileys as linhas ainda não tratadas (todas, ou de uma profissional)
select whatsapp_cloud_devolver_ao_baileys(null);
```

Linhas já aceites ou com resultado desconhecido não são devolvidas (evita duplicados).

### Decisão pendente: onde corre o worker

O plano aprovado previa um ramo `meta_cloud` dentro de `processar-fila`. Na análise
verificou-se que:

* o cron de produção chama **`super-action`**, não `processar-fila`;
* o `processar-fila` publicado (v20) é uma versão **antiga, só de email**, diferente do
  repositório; publicar o do repositório mudaria o email (remetente fixo, convite .ics)
  e ligaria o ramo Baileys.

Por isso **não alterei `processar-fila`**. O núcleo (`lembretes-whatsapp-cloud.ts`) está
pronto e testado, mas sem ponto de entrada. Opções:
**(A)** Edge Function própria `processar-whatsapp-cloud` com um cron separado (recomendado:
não toca no fluxo atual); **(B)** ramo dentro de `super-action`, depois de alinhar o
repositório com o código publicado.

## 12. Limitações da conta não verificada

* 250 destinatárias diferentes por 24 h, **para o portefólio inteiro** (partilhado por
  todas as profissionais). Por isso há limite diário por profissional.
* Máximo de 2 números de telefone.
* Número de teste: só envia para até 5 números registados no painel.
* App em modo Desenvolvimento: só webhooks de teste.

## 13. Custos e faturação

* Cobrança por mensagem **entregue**, consoante a categoria e o país da destinatária.
  Portugal usa a tabela "Rest of Western Europe".
* Desde 1/10/2026 as mensagens de utilidade também são pagas dentro da janela de
  atendimento.
* Referência não oficial: cerca de €0,014 por lembrete de utilidade (≈ €14 / 1000).
  Confirmar na tabela oficial antes de definir preços.
* É precisa uma forma de pagamento na conta de mensagens. **Não configurada.**

## 14. Problemas conhecidos / pendentes

* **Ponto de entrada do worker** por decidir (§11).
* **Formulário de consentimento** por fazer — sem ele, nenhum lembrete é enviado (por desenho).
* `processar-fila` publicado ≠ repositório; `super-action` e `rapid-worker` estão
  publicados mas não existem com esse nome no repositório.
* `DadosEConta.tsx` (exportação de dados) ainda não inclui as tabelas novas. A
  eliminação de conta já as apaga por `ON DELETE CASCADE` (via `auth.users`).
  `whatsapp_cloud_eventos` só guarda `wamid`/estado (sem dados pessoais).
* Lembretes de **1 hora** continuam no fluxo atual (o template diz "amanhã").
* O limite diário por profissional é verificado antes da reserva. Dois workers em
  simultâneo podem ultrapassá-lo em 1–2 mensagens.
* Respostas das clientes (mensagens recebidas) são ignoradas pelo webhook. Um pedido de
  "parar" por WhatsApp ainda não atualiza `aceita_lembretes`.
* Os ficheiros `index.ts` importam `@supabase/supabase-js` de esm.sh. Não foi possível
  fazer type-check desses imports aqui (sem acesso à rede). Os `handler.ts` testados
  não dependem deles.
