# WhatsApp Cloud API (Meta) — EstetiCalcHub

Integração **paralela** e **desligada por omissão** com a API oficial do WhatsApp,
para substituir no futuro o robô Baileys (`whatsapp-bot/`) nos lembretes de marcação.

> **Estado (11/11/2026):** código, testes, migration e SQL do cron no branch
> `feat/whatsapp-cloud-api`. **Nada foi aplicado no Supabase, nada foi publicado,
> o cron não foi criado e nenhuma mensagem foi enviada.** Ainda **não testado contra a
> API da Meta**.

---

## 1. Arquitetura

```
NovoAgendamento.tsx ──insert──▶ fila_notificacoes
                                  │ trigger BEFORE INSERT: canal 'whatsapp' + 1_dia +
                                  │ profissional aderente ⇒ canal 'whatsapp_cloud'
   ┌──────────────────────────────┴───────────────────────────────┐
   ▼                                                              ▼
'email' / 'whatsapp'  (INALTERADO)                          'whatsapp_cloud'
cron "processar-fila-notificacoes"                          cron "processar-whatsapp-cloud" (NOVO, criado DESATIVADO)
→ Edge Function super-action                                → Edge Function processar-whatsapp-cloud
→ reivindicar_notificacoes(canal)                             trinco · reivindicar · preparar · reservar (limites)
→ Resend / robô Baileys                                       · re-verificar · Meta · registar resultado
                                                                              ▲
Meta ──POST assinado──▶ Edge Function whatsapp-webhook ──▶ estados + opt-out (PARAR)
```

`super-action` e `processar-fila` **não foram alterados**.

### Ficheiros

| Ficheiro | O que faz |
|---|---|
| `supabase_migration_whatsapp_cloud.sql` | Tabelas, trigger, funções, permissões (aditiva) |
| `supabase/cron/processar_whatsapp_cloud.sql` | Cria o cron novo **já desativado** (por executar) |
| `supabase/functions/_shared/telefone.ts` | Normalização E.164 conservadora |
| `supabase/functions/_shared/whatsapp-cloud.ts` | Cliente da Graph API, chave, assinatura, hash do telefone |
| `supabase/functions/_shared/webhook-meta.ts` | HMAC, verificação GET, estados, palavras de paragem |
| `supabase/functions/_shared/lembretes-whatsapp-cloud.ts` | Núcleo do worker + adaptador Supabase |
| `supabase/functions/processar-whatsapp-cloud/` | Worker independente (cron) |
| `supabase/functions/whatsapp-webhook/` | Webhook (estados + opt-out) |
| `supabase/functions/testar-whatsapp-cloud/` | Teste manual controlado (dry-run por omissão) |
| `src/lib/rgpdWhatsappCloud.ts` + 3 linhas em `DadosEConta.tsx` | Exportação RGPD, **desligada** |
| `supabase/functions/tests/` · `supabase/tests/sql/` | 80 testes Deno · 50 testes SQL |

### Tabelas novas

| Tabela | Conteúdo |
|---|---|
| `whatsapp_cloud_numeros` | Números autorizados (`ativo`, `limite_diario`, por omissão 200) |
| `whatsapp_cloud_profissionais` | Adesão por profissional (`ativo`, `limite_diario`, por omissão 20) |
| `whatsapp_cloud_textos_consentimento` | Texto exato do consentimento, versionado (`v1-2026-11`) |
| `whatsapp_cloud_consentimentos` | Prova do consentimento: cliente, quando, origem, versão do texto, quem registou, revogação |
| `whatsapp_cloud_bloqueios` | Opt-out global: **hash** HMAC do telefone (nunca o número) |
| `whatsapp_cloud_envios` | Ciclo de vida por chave de idempotência |
| `whatsapp_cloud_eventos` | Estados do webhook, únicos por `(wamid, estado)` |
| `whatsapp_cloud_execucoes` | Trinco do worker (uma execução de cada vez) |

---

## 2. Separação Baileys / Cloud API

* O cron atual chama `super-action`, que só reivindica `canal = 'email'` e `'whatsapp'`
  (filtro exato). As linhas da Cloud API recebem `canal = 'whatsapp_cloud'` **na
  criação** ⇒ conjuntos **disjuntos por construção**.
* Um trigger `BEFORE UPDATE` impede a profissional de mudar uma linha para/de
  `whatsapp_cloud` ou de editar linhas da Cloud API. `DELETE` continua permitido.

## 3. Limites atómicos (correção 1)

`whatsapp_cloud_reservar` tranca **a linha do número** (`FOR UPDATE`) e depois a da
profissional, conta os envios das últimas 24 h e só então reserva. Todas as reservas no
mesmo número passam em fila por esse ponto ⇒ workers simultâneos não ultrapassam:

* `whatsapp_cloud_numeros.limite_diario` (por número; partilhado por todas);
* `whatsapp_cloud_profissionais.limite_diario` (por profissional).

Contam: `reservado`, `aceite`, `enviado`, `entregue`, `lido`, `desconhecido`.
Não contam: `cancelado`, `falhado`, `pendente`.
Limite atingido ⇒ a linha é **adiada 30 min** sem gastar tentativa. Se a janela da
véspera passar, é cancelada na tentativa seguinte.

Testado: 12 reservas simultâneas com limite 3 ⇒ exatamente 3; 12 reservas de 2
profissionais com limite de número 5 ⇒ exatamente 5.

## 4. Opt-out (correção 2)

* O webhook reconhece mensagens recebidas que sejam **exatamente** (depois de tirar
  acentos, pontuação e maiúsculas) uma de: `PARAR`, `PARA`, `STOP`, `PARAR LEMBRETES`,
  `CANCELAR LEMBRETES`, `NAO QUERO RECEBER`, `NAO QUERO RECEBER MAIS`,
  `NAO QUERO MAIS LEMBRETES`, `UNSUBSCRIBE` (texto ou botão de resposta rápida).
* Frases ambíguas ("pode parar de me enviar?", "não posso ir") **não** bloqueiam.
* Bloqueio **global** (número partilhado): nenhuma profissional volta a enviar para esse
  telefone pela Cloud API. Reservas ainda não enviadas e novas tentativas pendentes são
  canceladas no momento.
* Guarda-se `HMAC-SHA256(WA_TELEFONE_PEPPER, E.164)`, nunca o número.
  **Não mudar o pepper** depois de haver bloqueios.
* Desbloquear (só com novo consentimento explícito da cliente):
  `delete from whatsapp_cloud_bloqueios where telefone_hash = '<hash>';`

## 5. Consentimento explícito e comprovável (correção 3)

`aceita_lembretes = true` **não chega**. A Cloud API exige uma linha ativa em
`whatsapp_cloud_consentimentos`, com:

* `concedido_em` anterior ao envio, `origem`, `texto_versao` (texto exato guardado em
  `whatsapp_cloud_textos_consentimento`, ainda válido) e `registado_por`;
* sem revogação. Revogações e substituições ficam no histórico.

Para o formulário (fase seguinte), já existem:
`registar_consentimento_whatsapp(cliente_id, origem, texto_versao)` (só para clientes da
própria profissional; origens `formulario_marcacao` ou `presencial_registado`) e
`revogar_consentimento_whatsapp(cliente_id)`. A origem `formulario_publico` fica
reservada para um formulário em que é a própria cliente a aceitar (prova mais forte).

Texto v1: *"Aceito receber no WhatsApp lembretes das minhas marcações, enviados pelo
EstetiCalcHub em nome do estabelecimento onde marquei. Posso deixar de receber a
qualquer momento respondendo PARAR."*

## 6. Duplicados e remarcações (correção 4)

**Chave de idempotência** = `SHA-256(v2 | agendamento | tipo | antecedência | DATA | template | idioma)`
**Assinatura da versão** = `SHA-256(hora | telefone E.164 | template | idioma)`

| Situação | Resultado |
|---|---|
| Fila recriada pela edição, mesma data | Mesma chave ⇒ bloqueado |
| Só a hora ou o telefone mudou, lembrete já aceite | Mesma chave ⇒ **não** repete (a profissional avisa a alteração) |
| Remarcação para **outro dia** | Chave nova ⇒ novo lembrete |
| Alterações sucessivas A→B→A | A já lembrado ⇒ não repete |
| Tentativa anterior **rejeitada** + dados corrigidos | Assinatura diferente ⇒ pode tentar de novo |
| Reserva libertada antes de enviar | Pode ser retomada |
| Resultado **incerto** | `desconhecido`, nunca repetido |

**Imediatamente antes de cada envio** o worker volta a validar a marcação na base de
dados e compara data/hora e telefone com os da reserva. Depois
`whatsapp_cloud_confirmar_reserva` verifica se a linha ainda existe, se não chegou um
PARAR entretanto e se a reserva continua válida. Qualquer diferença ⇒ reserva
**libertada sem envio**.

### Rejeitado vs incerto

| Resposta | Classificação |
|---|---|
| 2xx com `messages[0].id` | aceite |
| 2xx sem `wamid` / não-JSON | **incerto** |
| 4xx com erro da Meta | rejeitado definitivo |
| 429, ou códigos 4, 80007, 130429, 131048, 131056, 131016, 2 | rejeitado retentável (10, 20 min; máx. 3) |
| 5xx genérico, timeout, rede, reserva órfã > 10 min | **incerto** (nunca repetido) |

## 7. RGPD (correção 5)

* **Eliminação:** envios, consentimentos e adesão ligam-se a `auth.users` com
  `ON DELETE CASCADE`. A eliminação de conta atual (`excluir-conta`/`rapid-worker` →
  `deleteUser`) já os apaga, **sem alterar essa função** (testado). Para uso explícito
  existe `whatsapp_cloud_eliminar_dados_profissional(uuid)`.
* **Bloqueios** não são apagados com a conta da profissional: pertencem à cliente e só
  contêm um hash. `whatsapp_cloud_eventos` só tem `wamid`/estado.
* **Exportação:** `whatsapp_cloud_exportar_meus_dados()` (só os dados da própria, sem
  hashes). Ligada em `DadosEConta.tsx` através de `src/lib/rgpdWhatsappCloud.ts`, com
  `EXPORTACAO_WHATSAPP_CLOUD_ATIVA = false`. A exportação atual fica igual. Ligar só
  depois da migration.

## 8. Worker independente (correção 6)

`processar-whatsapp-cloud`:

* **Autenticação:** cabeçalho `x-cron-secret` = `WA_CRON_SECRET` (próprio, ≥ 24
  caracteres, comparação em tempo constante). Deploy com `--no-verify-jwt`.
* **Interruptor:** só processa com `WA_CLOUD_WORKER_ATIVO=true`.
* **Execução única:** trinco em `whatsapp_cloud_execucoes` (prazo de 120 s, libertado no
  `finally`). Não usa advisory locks, que não são fiáveis através do PostgREST.
* **Prazo:** para ao fim de `WA_PRAZO_MS` (40 s) e devolve o resto sem gastar tentativas.
* **Logs:** só contagens, ids internos e números mascarados. Sem tokens nem hashes.

## 9. Cron (correção 7)

`supabase/cron/processar_whatsapp_cloud.sql`: cria o job `processar-whatsapp-cloud`
(a cada 10 min) e **desativa-o na mesma transação**. O segredo é lido do Vault
(`wa_cron_secret`) e não fica escrito no comando. Recusa-se a correr se o job já
existir. **Não executado.**

## 10. Variáveis de ambiente (Supabase Secrets)

Ver `supabase/functions/.env.example`. Nunca com prefixo `VITE_`.

| Nome | Usado por |
|---|---|
| `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_GRAPH_API_VERSION` (v26.0) | envio |
| `WA_WABA_ID` | gestão de templates |
| `WA_APP_SECRET`, `WA_VERIFY_TOKEN` | webhook |
| `WA_TELEFONE_PEPPER` | webhook + worker |
| `WA_CRON_SECRET`, `WA_CLOUD_WORKER_ATIVO`, `WA_LOTE`, `WA_PRAZO_MS` | worker |
| `WA_TEST_ADMIN_USER_IDS`, `WA_TEST_DESTINATARIOS`, `WA_TEST_ENVIO_REAL_PERMITIDO` | função de teste |

**Graph API:** `v26.0` (lançada a 29/07/2026, a mais recente no changelog oficial).
Confirmar de novo antes de passar a produção.

## 11. Testes locais

```bash
cd supabase/functions && DENO_NO_PACKAGE_JSON=1 deno test --allow-read --no-config tests/   # 80
cd supabase/tests/sql && npm install && npm test                                            # 50 (Postgres 17 local)
```

## 12. Plano de ativação gradual

Cada fase precisa de autorização explícita. Se uma fase correr mal, para-se e volta-se
atrás (§13).

| Fase | O que se faz | Critério para avançar |
|---|---|---|
| **0. Dry-run** | Migration aplicada; segredos de **teste**; deploy de `testar-whatsapp-cloud`; chamadas em dry-run | Validação, autenticação e allowlist corretas; nada enviado |
| **1. Teste real (número de teste)** | `hello_world` para o teu telemóvel (registado no painel API Setup); depois `lembrete_marcacao_24h` quando aprovado | `aceite` com `wamid`; mensagem recebida |
| **2. Webhook** | Deploy de `whatsapp-webhook`; configurar no painel; webhooks de teste; enviar "PARAR" do teu telemóvel | Estados em `whatsapp_cloud_eventos`; bloqueio criado; assinatura inválida recusada |
| **3. Número português** | Registar o número; forma de pagamento; `insert into whatsapp_cloud_numeros (phone_number_id, ativo, limite_diario) values ('<id>', true, 20)`; trocar `WA_PHONE_NUMBER_ID` | Número "Conectado" no WhatsApp Manager |
| **4. Piloto interno** | Formulário de consentimento em produção; a tua conta aderente com `limite_diario = 5`; marcações de teste para ti; deploy do worker; `WA_CLOUD_WORKER_ATIVO=true`; **ativar o cron** | 1 lembrete por marcação; remarcação e PARAR testados; sem `desconhecido` |
| **5. 1–2 profissionais** | Adesão com `limite_diario = 10`; acompanhar diariamente `whatsapp_cloud_envios` e a qualidade do número | 1 semana sem duplicados nem queixas; qualidade "Alta" |
| **6. Alargar** | Mais profissionais aos poucos; subir limites com o tier da Meta (250 sem verificação, portefólio inteiro) | — |

O cron do Baileys continua a tratar quem não está aderente durante todo o processo.

## 13. Voltar ao sistema anterior

```sql
-- parar imediatamente (qualquer um chega):
select cron.alter_job(job_id := (select jobid from cron.job where jobname='processar-whatsapp-cloud'), active := false);
-- ou: WA_CLOUD_WORKER_ATIVO=false   ou: update whatsapp_cloud_numeros set ativo = false;
-- deixar de encaminhar novas linhas:
update whatsapp_cloud_profissionais set ativo = false;
-- devolver ao Baileys as linhas ainda não tratadas:
select whatsapp_cloud_devolver_ao_baileys(null);
```

## 14. Template

Categoria **Utilidade**, nome `lembrete_marcacao_24h`, idioma `pt_PT`:

```
Olá, {{1}}! 👋

{{2}} relembra que tens uma marcação amanhã, dia {{3}}, às {{4}}, para {{5}}.

Se precisares de alterar ou cancelar a marcação, contacta diretamente o estabelecimento.

Lembrete enviado através do EstetiCalcHub. Responde PARAR para não receberes mais lembretes.
```

Exemplos: Ana · Janaína Dias PMU · 12/11 · 15:00 · Microblading. A última frase é
**recomendada** (torna o opt-out evidente e coerente com o texto de consentimento). Não
muda os parâmetros.

## 15. Limitações e custos

* Sem verificação: 250 destinatárias/24 h **no portefólio inteiro**; máx. 2 números.
* Número de teste: até 5 destinatários registados. App em Desenvolvimento: só webhooks de teste.
* Cobrança por mensagem entregue. Mensagens de utilidade pagas também dentro da janela
  de atendimento desde 1/10/2026. Referência não oficial para Portugal: ~€0,014 por
  lembrete. Forma de pagamento **não configurada**.

## 16. Problemas conhecidos / pendentes

* **Formulário de consentimento** por fazer (obrigatório antes de envios reais).
* `processar-fila` publicado (v20) ≠ repositório; `super-action` e `rapid-worker`
  publicados sem equivalente com esse nome no repositório. Não foram tocados.
* Telefones na base sem `+` e com outro indicativo (ex.: 31 a começar por `352`) são
  recusados: têm de ser corrigidos nas fichas.
* Lembretes de 1 hora continuam no fluxo atual.
* Mensagens recebidas que não sejam pedidos de paragem claros são ignoradas (sem revisão
  humana ainda). Pedidos como "pode parar?" **não** bloqueiam.
* Se só a hora mudar no próprio dia depois do lembrete, não há segundo lembrete
  automático (decisão para evitar repetições).
* Os `index.ts` importam `@supabase/supabase-js` de esm.sh. Não foi possível fazer
  type-check desses imports aqui (sem rede). Os `handler.ts` testados não dependem deles.
