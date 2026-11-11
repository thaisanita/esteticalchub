import { assert, assertEquals } from "./assert.ts";
import { criarHandlerWebhook } from "../whatsapp-webhook/handler.ts";
import { extrairEstados, hmacSha256Hex } from "../_shared/webhook-meta.ts";
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
  const handler = criarHandlerWebhook({
    appSecret: SEGREDO,
    verifyToken: VERIFY,
    log: () => {},
    registarEvento: registar ?? ((e) => {
      const k = `${e.wamid}|${e.estado}`;
      if (vistos.has(k)) return Promise.resolve("repetido");
      vistos.add(k);
      gravados.push(e);
      return Promise.resolve("aplicado");
    }),
  });
  return { handler, gravados };
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
  const handler = criarHandlerWebhook({ appSecret: "", verifyToken: VERIFY, registarEvento: () => Promise.resolve("x"), log: () => {} });
  const r = await handler(await pedidoAssinado("{}"));
  assertEquals(r.status, 503);
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
