import { assert, assertEquals, assertThrows } from "./assert.ts";
import {
  assinaturaVersao,
  chaveIdempotencia,
  hashTelefone,
  classificarResposta,
  ConfigWhatsappCloud,
  enviarTemplate,
  ErroConfiguracao,
  GRAPH_API_VERSION_PADRAO,
  lerConfig,
  parametrosLembrete24h,
  PedidoTemplate,
  sanitizar,
  TEMPLATE_LEMBRETE_24H,
  urlMensagens,
  validarPedido,
} from "../_shared/whatsapp-cloud.ts";

const CONFIG: ConfigWhatsappCloud = {
  accessToken: "EAAtokenFICTICIOparaTESTES123",
  phoneNumberId: "1376229915563846",
  graphApiVersion: "v26.0",
  timeoutMs: 1000,
};

const PEDIDO: PedidoTemplate = {
  agendamentoId: "11111111-1111-4111-8111-111111111111",
  usuarioId: "22222222-2222-4222-8222-222222222222",
  telefone: "912345678",
  template: TEMPLATE_LEMBRETE_24H.nome,
  idioma: TEMPLATE_LEMBRETE_24H.idioma,
  parametros: ["Ana", "Estúdio X", "12/11", "15:00", "Microblading"],
  numeroParametrosEsperado: 5,
};

function fetchFalso(status: number, corpo: unknown, registo?: { chamadas: Array<{ url: string; init: RequestInit }> }) {
  return (url: string | URL | Request, init?: RequestInit) => {
    registo?.chamadas.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(
      new Response(corpo === undefined ? "" : typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status }),
    );
  };
}

// --- 2. Parâmetros de templates -------------------------------------------------

Deno.test("2. parâmetros: lembrete 24h formata data, hora e primeiro nome", () => {
  assertEquals(
    parametrosLembrete24h({
      clienteNome: "  Ana  Maria Silva ",
      profissionalNome: "Janaína Dias PMU",
      data: "2026-11-12",
      hora: "15:00:00",
      procedimento: "Micro\nblading",
    }),
    ["Ana", "Janaína Dias PMU", "12/11", "15:00", "Micro blading"],
  );
});

Deno.test("2. parâmetros: número errado, vazios e demasiado longos são recusados", () => {
  const r1 = validarPedido({ ...PEDIDO, parametros: ["Ana", "X", "12/11", "15:00"] });
  assert(!r1.ok && r1.erros.some((e) => e.campo === "parametros"));
  const r2 = validarPedido({ ...PEDIDO, parametros: ["Ana", "  ", "12/11", "15:00", "X"] });
  assert(!r2.ok && r2.erros.some((e) => e.campo === "parametros[1]"));
  const r3 = validarPedido({ ...PEDIDO, parametros: ["Ana", "x".repeat(201), "12/11", "15:00", "X"] });
  assert(!r3.ok && r3.erros.some((e) => e.motivo === "demasiado_longo"));
});

Deno.test("2. corpo do pedido segue o formato da Cloud API", () => {
  const r = validarPedido(PEDIDO);
  assert(r.ok);
  assertEquals(r.pedido.corpo, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "351912345678",
    type: "template",
    template: {
      name: "lembrete_marcacao_24h",
      language: { code: "pt_PT" },
      components: [{ type: "body", parameters: PEDIDO.parametros.map((text) => ({ type: "text", text })) }],
    },
  });
});

Deno.test("2. validação: ids, template e idioma", () => {
  const r = validarPedido({ ...PEDIDO, agendamentoId: "x", template: "Lembrete!", idioma: "portugues" });
  assert(!r.ok);
  assertEquals(r.erros.map((e) => e.campo).sort(), ["agendamentoId", "idioma", "template"]);
});

// --- 3. Credenciais em falta -----------------------------------------------------

Deno.test("3. credenciais em falta geram ErroConfiguracao sem expor valores", () => {
  const e = assertThrows(() => lerConfig(() => undefined), ErroConfiguracao);
  assertEquals(e.emFalta, ["WA_ACCESS_TOKEN", "WA_PHONE_NUMBER_ID"]);
  const e2 = assertThrows(
    () => lerConfig((n) => ({ WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "abc" } as Record<string, string>)[n]),
    ErroConfiguracao,
  );
  assert(e2.emFalta[0].startsWith("WA_PHONE_NUMBER_ID"));
});

Deno.test("3. versão da Graph API: v26.0 por omissão e validada", () => {
  const env = { WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "123456" } as Record<string, string>;
  assertEquals(lerConfig((n) => env[n]).graphApiVersion, GRAPH_API_VERSION_PADRAO);
  assertEquals(GRAPH_API_VERSION_PADRAO, "v26.0");
  assertThrows(() => lerConfig((n) => ({ ...env, WA_GRAPH_API_VERSION: "26" })[n]), ErroConfiguracao);
  assertEquals(urlMensagens(CONFIG), "https://graph.facebook.com/v26.0/1376229915563846/messages");
});

// --- 4/5/6. Erros da Meta ------------------------------------------------------------

Deno.test("4. token inválido (401, code 190) => rejeitado, não retentável", async () => {
  const r = await enviarTemplate(CONFIG, PEDIDO, {
    fetch: fetchFalso(401, { error: { message: "Invalid OAuth access token - Cannot parse access token", type: "OAuthException", code: 190 } }),
  });
  assertEquals(r.resultado, "rejeitado");
  if (r.resultado === "rejeitado") {
    assertEquals([r.retentavel, r.codigo, r.http], [false, "meta_190", 401]);
  }
});

Deno.test("5. template inexistente/rejeitado (132001) => rejeitado definitivo", async () => {
  const r = await enviarTemplate(CONFIG, PEDIDO, {
    fetch: fetchFalso(404, { error: { message: "(#132001) Template name does not exist in the translation", code: 132001 } }),
  });
  assert(r.resultado === "rejeitado" && !r.retentavel && r.codigo === "meta_132001");
});

Deno.test("6. 400 / 403 => rejeitado; 429 => rejeitado retentável", async () => {
  const r400 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(400, { error: { code: 100, message: "Invalid parameter" } }) });
  assert(r400.resultado === "rejeitado" && !r400.retentavel);
  const r403 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(403, { error: { code: 10, message: "Permission denied" } }) });
  assert(r403.resultado === "rejeitado" && !r403.retentavel);
  const r429 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(429, { error: { code: 130429, message: "Rate limit hit" } }) });
  assert(r429.resultado === "rejeitado" && r429.retentavel);
  const r429sem = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(429, "") });
  assert(r429sem.resultado === "rejeitado" && r429sem.retentavel);
  const parPar = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(400, { error: { code: 131056, message: "pair rate limit" } }) });
  assert(parPar.resultado === "rejeitado" && parPar.retentavel);
});

Deno.test("6. 5xx: 'serviço indisponível' da Meta é retentável; 5xx sem erro claro é INCERTO", async () => {
  const r503 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(503, { error: { code: 131016, message: "Service unavailable" } }) });
  assert(r503.resultado === "rejeitado" && r503.retentavel);
  const r500 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(500, { error: { code: 131000, message: "Something went wrong" } }) });
  assertEquals(r500.resultado, "incerto");
  const r502 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(502, "<html>Bad gateway</html>") });
  assertEquals(r502.resultado, "incerto");
  const r504 = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(504, "") });
  assertEquals(r504.resultado, "incerto");
});

// --- 7. Timeouts ----------------------------------------------------------------------

Deno.test("7. timeout => incerto (pode ter sido aceite)", async () => {
  const lento = (_u: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    });
  const r = await enviarTemplate({ ...CONFIG, timeoutMs: 50 }, PEDIDO, { fetch: lento });
  assert(r.resultado === "incerto" && r.codigo === "timeout");
});

Deno.test("7. falha de rede => incerto", async () => {
  const r = await enviarTemplate(CONFIG, PEDIDO, { fetch: () => Promise.reject(new TypeError("connection reset")) });
  assert(r.resultado === "incerto" && r.codigo === "rede");
});

// --- 8. Respostas sem wamid ---------------------------------------------------------

Deno.test("8. 200 sem wamid => incerto; 200 com wamid => aceite", async () => {
  const sem = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(200, { messaging_product: "whatsapp", messages: [] }) });
  assert(sem.resultado === "incerto" && sem.codigo === "sem_wamid");
  const naoJson = await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(200, "ok") });
  assertEquals(naoJson.resultado, "incerto");
  const com = await enviarTemplate(CONFIG, PEDIDO, {
    fetch: fetchFalso(200, { messaging_product: "whatsapp", contacts: [{ wa_id: "351912345678" }], messages: [{ id: "wamid.ABC" }] }),
  });
  assert(com.resultado === "aceite" && com.wamid === "wamid.ABC");
});

// --- Segurança ---------------------------------------------------------------------------

Deno.test("dry-run nunca chama a rede", async () => {
  const registo = { chamadas: [] as Array<{ url: string; init: RequestInit }> };
  const r = await enviarTemplate(CONFIG, PEDIDO, { dryRun: true, fetch: fetchFalso(200, {}, registo) });
  assertEquals(r.resultado, "dry_run");
  assertEquals(registo.chamadas.length, 0);
});

Deno.test("pedido inválido nunca chama a rede", async () => {
  const registo = { chamadas: [] as Array<{ url: string; init: RequestInit }> };
  const r = await enviarTemplate(CONFIG, { ...PEDIDO, telefone: "212345678" }, { fetch: fetchFalso(200, {}, registo) });
  assertEquals(r.resultado, "invalido");
  assertEquals(registo.chamadas.length, 0);
});

Deno.test("o token só vai no cabeçalho Authorization e é removido dos detalhes de erro", async () => {
  const registo = { chamadas: [] as Array<{ url: string; init: RequestInit }> };
  await enviarTemplate(CONFIG, PEDIDO, { fetch: fetchFalso(200, { messages: [{ id: "wamid.1" }] }, registo) });
  const init = registo.chamadas[0].init;
  assertEquals((init.headers as Record<string, string>).Authorization, `Bearer ${CONFIG.accessToken}`);
  assert(!String(init.body).includes(CONFIG.accessToken));
  assert(!String(registo.chamadas[0].url).includes(CONFIG.accessToken));
  const s = sanitizar(`erro com EAAabcdefghijklmnop e Bearer xyz.123 para 351912345678`);
  assert(!s.includes("EAAabcdefghijklmnop") && !s.includes("xyz.123") && !s.includes("351912345678"));
});

Deno.test("classificação: corpo de erro da Meta em 2xx não é aceite", () => {
  assertEquals(classificarResposta(200, { error: { code: 1 } }).resultado, "incerto");
});

Deno.test("chave de idempotência: por marcação + DATA (hora e telefone não contam)", async () => {
  const base = {
    agendamentoId: PEDIDO.agendamentoId, tipo: "lembrete", antecedencia: "1_dia",
    data: "2026-11-12", template: "lembrete_marcacao_24h", idioma: "pt_PT",
  };
  const k1 = await chaveIdempotencia(base);
  assertEquals(k1, await chaveIdempotencia({ ...base }));
  assert(k1 !== await chaveIdempotencia({ ...base, data: "2026-11-13" }));
  assert(k1 !== await chaveIdempotencia({ ...base, agendamentoId: "33333333-3333-4333-8333-333333333333" }));
  assertEquals(k1.length, 64);
});

Deno.test("assinatura da versão muda com hora e telefone", async () => {
  const b = { hora: "15:00", e164: "+351912345678", template: "t", idioma: "pt_PT" };
  const a1 = await assinaturaVersao(b);
  assert(a1 !== await assinaturaVersao({ ...b, hora: "16:00" }));
  assert(a1 !== await assinaturaVersao({ ...b, e164: "+351912345679" }));
});

Deno.test("hash do telefone: HMAC com pepper, determinístico, exige pepper forte", async () => {
  const pepper = "pepper-ficticio-de-teste-com-32-caracteres!";
  const h1 = await hashTelefone("+351912345678", pepper);
  assertEquals(h1, await hashTelefone("+351912345678", pepper));
  assert(/^[0-9a-f]{64}$/.test(h1));
  assert(h1 !== await hashTelefone("+351912345678", pepper + "x"));
  let erro = false;
  try { await hashTelefone("+351912345678", "curto"); } catch (e) { erro = e instanceof ErroConfiguracao; }
  assert(erro);
});
