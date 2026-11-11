import { assert, assertEquals } from "./assert.ts";
import { criarHandlerWebhook } from "../whatsapp-webhook/handler.ts";
import { ePedidoDeParagem, extrairEstados, extrairPedidosParagem, hmacSha256Hex } from "../_shared/webhook-meta.ts";
import type { EventoEstado } from "../_shared/webhook-meta.ts";

const SEGREDO = "segredo-ficticio-de-teste";
const VERIFY = "verify-ficticio";

function payload(statuses: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "2588909118297251",
      changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: {}, statuses } }],
    }],
  };
}

async function pedidoAssinado(corpo: string, segredo = SEGREDO) {
  const assinatura = await hmacSha256Hex(segredo, new TextEncoder().encode(corpo));
  return new Request("https://x/functions/v1/whatsapp-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${assinatura}` },
    body: corpo,
  });
}

function criar(registar?: (e: EventoEstado) => Promise<string>) {
  const gravados: EventoEstado[] = [];
  const vistos = new Set<string>();
  const bloqueios = new Map<string, string>();
  const handler = criarHandlerWebhook({
    appSecret: SEGREDO,
    verifyToken: VERIFY,
    log: () => {},
    hashTelefone: (e164) => Promise.resolve(`hash(${e164.length})`),
    registarOptout: (h, palavra) => {
      if (bloqueios.has(h)) return Promise.resolve("repetido");
      bloqueios.set(h, palavra);
      return Promise.resolve("bloqueado");
    },
    registarEvento: registar ?? ((e) => {
      const k = `${e.wamid}|${e.estado}`;
      if (vistos.has(k)) return Promise.resolve("repetido");
      vistos.add(k);
      gravados.push(e);
      return Promise.resolve("aplicado");
    }),
  });
  return { handler, gravados, bloqueios };
}

Deno.test("GET de verificação: challenge só com token correto", async () => {
  const { handler } = criar();
  const ok = await handler(new Request(`https://x/?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=123`));
  assertEquals([ok.status, await ok.text()], [200, "123"]);
  const mau = await handler(new Request(`https://x/?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123`));
  assertEquals(mau.status, 403);
  const semModo = await handler(new Request(`https://x/?hub.verify_token=${VERIFY}&hub.challenge=123`));
  assertEquals(semModo.status, 403);
});

Deno.test("9. webhook com assinatura válida grava os estados", async () => {
  const { handler, gravados } = criar();
  const corpo = JSON.stringify(payload([
    { id: "wamid.A", status: "sent", timestamp: "1763000000", recipient_id: "351912345678" },
    { id: "wamid.A", status: "delivered", timestamp: "1763000005", recipient_id: "351912345678" },
  ]));
  const r = await handler(await pedidoAssinado(corpo));
  assertEquals(r.status, 200);
  assertEquals(gravados.map((g) => g.estado), ["enviado", "entregue"]);
  assertEquals(gravados[0].ocorridoEm, new Date(1763000000 * 1000).toISOString());
  // o número da destinatária não é passado à camada de gravação
  assert(!JSON.stringify(gravados).includes("351912345678"));
});

Deno.test("10. webhook com assinatura inválida, ausente ou de outro segredo é recusado", async () => {
  const { handler, gravados } = criar();
  const corpo = JSON.stringify(payload([{ id: "wamid.B", status: "sent", timestamp: "1" }]));

  const semCabecalho = await handler(new Request("https://x/", { method: "POST", body: corpo }));
  assertEquals(semCabecalho.status, 401);

  const outroSegredo = await handler(await pedidoAssinado(corpo, "outro"));
  assertEquals(outroSegredo.status, 401);

  // corpo alterado depois de assinado (ex.: re-serialização) => inválido
  const assinado = await pedidoAssinado(corpo);
  const adulterado = new Request(assinado.url, {
    method: "POST",
    headers: assinado.headers,
    body: corpo.replace("sent", "read"),
  });
  assertEquals((await handler(adulterado)).status, 401);

  const formato = await handler(new Request("https://x/", { method: "POST", headers: { "X-Hub-Signature-256": "md5=abc" }, body: corpo }));
  assertEquals(formato.status, 401);
  assertEquals(gravados.length, 0);
});

Deno.test("10. sem WA_APP_SECRET o webhook nunca aceita eventos", async () => {
  const base = { verifyToken: VERIFY, registarEvento: () => Promise.resolve("x"), registarOptout: () => Promise.resolve("x"), log: () => {} };
  const semSegredo = criarHandlerWebhook({ ...base, appSecret: "", hashTelefone: () => Promise.resolve("h") });
  assertEquals((await semSegredo(await pedidoAssinado("{}"))).status, 503);
  const semPepper = criarHandlerWebhook({ ...base, appSecret: SEGREDO, hashTelefone: null });
  assertEquals((await semPepper(await pedidoAssinado("{}"))).status, 503);
});

Deno.test("11. eventos duplicados não duplicam registos", async () => {
  const { handler, gravados } = criar();
  const corpo = JSON.stringify(payload([{ id: "wamid.C", status: "read", timestamp: "2" }]));
  assertEquals((await handler(await pedidoAssinado(corpo))).status, 200);
  assertEquals((await handler(await pedidoAssinado(corpo))).status, 200);
  assertEquals(gravados.length, 1);
});

Deno.test("13. falha após aceitação (status failed) é extraída com o código", () => {
  const ev = extrairEstados(payload([
    { id: "wamid.D", status: "failed", timestamp: "3", errors: [{ code: 131026, title: "Message undeliverable" }] },
  ]));
  assertEquals(ev, [{ wamid: "wamid.D", estado: "falhado", ocorridoEm: new Date(3000).toISOString(), erroCodigo: "131026" }]);
});

Deno.test("webhook ignora mensagens recebidas e objetos desconhecidos", () => {
  assertEquals(extrairEstados({ object: "page", entry: [] }), []);
  assertEquals(
    extrairEstados({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "351912345678", text: { body: "olá" } }] } }] }],
    }),
    [],
  );
  assertEquals(extrairEstados(payload([{ id: "wamid.E", status: "deleted" }])), []);
});

Deno.test("erro ao gravar => 500 (a Meta volta a tentar; dedup trata a repetição)", async () => {
  const { handler } = criar(() => Promise.reject(new Error("db em baixo")));
  const corpo = JSON.stringify(payload([{ id: "wamid.F", status: "sent", timestamp: "4" }]));
  assertEquals((await handler(await pedidoAssinado(corpo))).status, 500);
});

Deno.test("JSON inválido com assinatura válida => 400; métodos errados => 405", async () => {
  const { handler } = criar();
  assertEquals((await handler(await pedidoAssinado("{nao json"))).status, 400);
  assertEquals((await handler(new Request("https://x/", { method: "PUT" }))).status, 405);
});

// --- 2. Opt-out ------------------------------------------------------------------

function recebida(texto: string, from = "351912345678", tipo: "text" | "button" = "text", id = "wamid.IN1") {
  return {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      messages: [tipo === "text" ? { from, id, type: "text", text: { body: texto } } : { from, id, type: "button", button: { text: texto } }],
    } }] }],
  };
}

Deno.test("2. palavras inequívocas reconhecidas, com acentos/maiúsculas/pontuação", () => {
  for (const t of ["PARAR", "parar", " Parar! ", "STOP", "Parar lembretes", "Não quero receber mais", "não quero receber.", "🛑 PARAR 🛑", "Para"]) {
    assert(ePedidoDeParagem(t) !== null, t);
  }
});

Deno.test("2. frases ambíguas NÃO bloqueiam", () => {
  for (const t of ["Pode parar de me enviar?", "parar o carro", "Obrigada, até amanhã", "não posso ir", "stop motion", "PARAR PARAR PARAR já agora tenho uma dúvida", "paro amanhã"]) {
    assertEquals(ePedidoDeParagem(t), null, t);
  }
});

Deno.test("2. webhook regista bloqueio global por hash (nunca o número) e é idempotente", async () => {
  const { handler, bloqueios } = criar();
  const corpo = JSON.stringify(recebida("PARAR"));
  assertEquals((await handler(await pedidoAssinado(corpo))).status, 200);
  assertEquals((await handler(await pedidoAssinado(corpo))).status, 200);
  assertEquals(bloqueios.size, 1);
  assert(![...bloqueios.keys()][0].includes("351912345678"));
});

Deno.test("2. botão de resposta rápida 'Parar lembretes' também bloqueia", () => {
  assertEquals(extrairPedidosParagem(recebida("Parar lembretes", "351912345678", "button")),
    [{ wamid: "wamid.IN1", e164: "+351912345678", palavra: "PARAR LEMBRETES" }]);
});

Deno.test("2. mensagem normal ou remetente inválido não bloqueia", () => {
  assertEquals(extrairPedidosParagem(recebida("Olá, confirmo!")), []);
  assertEquals(extrairPedidosParagem(recebida("PARAR", "abc")), []);
});

Deno.test("2. opt-out com assinatura inválida é ignorado", async () => {
  const { handler, bloqueios } = criar();
  const r = await handler(new Request("https://x/", { method: "POST", body: JSON.stringify(recebida("PARAR")) }));
  assertEquals(r.status, 401);
  assertEquals(bloqueios.size, 0);
});
