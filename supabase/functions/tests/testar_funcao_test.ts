import { assert, assertEquals } from "./assert.ts";
import { criarHandlerTeste, lerListaDestinatarios } from "../testar-whatsapp-cloud/handler.ts";
import { ConfigWhatsappCloud, enviarTemplate } from "../_shared/whatsapp-cloud.ts";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMUM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONFIG: ConfigWhatsappCloud = { accessToken: "t", phoneNumberId: "123456", graphApiVersion: "v26.0", timeoutMs: 1000 };

function criar(opts: { envioRealPermitido?: boolean; chamadasRede?: number[] } = {}) {
  let tempo = 0;
  const chamadasRede = opts.chamadasRede ?? [];
  const enviar: typeof enviarTemplate = (c, p, o = {}) =>
    enviarTemplate(c, p, {
      ...o,
      fetch: () => {
        chamadasRede.push(1);
        return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.T" }] }), { status: 200 }));
      },
    });
  const handler = criarHandlerTeste({
    obterUtilizador: (auth) => Promise.resolve(auth === "Bearer admin" ? { id: ADMIN } : auth === "Bearer comum" ? { id: COMUM } : null),
    lerConfig: () => CONFIG,
    adminIds: [ADMIN],
    destinatarios: lerListaDestinatarios("+1 555 613 6206, lixo"),
    envioRealPermitido: opts.envioRealPermitido ?? false,
    enviar,
    agora: () => (tempo += 60_000),
    log: () => {},
  });
  return { handler, chamadasRede };
}

const pedido = (auth: string, corpo: unknown) =>
  new Request("https://x/", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(corpo) });

Deno.test("teste: sem sessão => 401; utilizador comum => 403", async () => {
  const { handler } = criar();
  assertEquals((await handler(pedido("", { destinatario: "+15556136206" }))).status, 401);
  assertEquals((await handler(pedido("Bearer comum", { destinatario: "+15556136206" }))).status, 403);
});

Deno.test("teste: destinatária fora da allowlist ou lista de destinatárias => recusado", async () => {
  const { handler } = criar();
  assertEquals((await handler(pedido("Bearer admin", { destinatario: "+351912345678" }))).status, 403);
  assertEquals((await handler(pedido("Bearer admin", { destinatario: ["+15556136206", "+351912345678"] }))).status, 400);
});

Deno.test("teste: template livre não é permitido", async () => {
  const { handler } = criar();
  assertEquals((await handler(pedido("Bearer admin", { destinatario: "+15556136206", template: "promo_natal" }))).status, 400);
});

Deno.test("teste: DRY-RUN por omissão — nunca chama a Meta", async () => {
  const { handler, chamadasRede } = criar({ envioRealPermitido: true });
  const r = await handler(pedido("Bearer admin", { destinatario: "+15556136206" }));
  const corpo = await r.json();
  assertEquals([r.status, corpo.modo, corpo.resultado.resultado], [200, "dry-run", "dry_run"]);
  assertEquals(corpo.destinatario, "+15******206");
  assertEquals(chamadasRede.length, 0);
});

Deno.test("teste: confirmar_envio_real sem permissão no servidor continua dry-run", async () => {
  const { handler, chamadasRede } = criar({ envioRealPermitido: false });
  const corpo = await (await handler(pedido("Bearer admin", { destinatario: "+15556136206", confirmar_envio_real: true }))).json();
  assertEquals(corpo.modo, "dry-run");
  assertEquals(chamadasRede.length, 0);
});

Deno.test("teste: envio real só com as DUAS autorizações", async () => {
  const { handler, chamadasRede } = criar({ envioRealPermitido: true });
  const corpo = await (await handler(pedido("Bearer admin", { destinatario: "+15556136206", confirmar_envio_real: true }))).json();
  assertEquals([corpo.modo, corpo.resultado.resultado], ["real", "aceite"]);
  assertEquals(chamadasRede.length, 1);
});

Deno.test("teste: intervalo mínimo impede envios em rajada", async () => {
  const handler = criarHandlerTeste({
    obterUtilizador: () => Promise.resolve({ id: ADMIN }),
    lerConfig: () => CONFIG,
    adminIds: [ADMIN],
    destinatarios: ["+15556136206"],
    envioRealPermitido: false,
    agora: () => 1000,
    log: () => {},
  });
  assertEquals((await handler(pedido("Bearer x", { destinatario: "+15556136206" }))).status, 200);
  assertEquals((await handler(pedido("Bearer x", { destinatario: "+15556136206" }))).status, 429);
});

Deno.test("teste: a função não importa nem toca na fila de produção", async () => {
  const src = await Deno.readTextFile(new URL("../testar-whatsapp-cloud/handler.ts", import.meta.url));
  const idx = await Deno.readTextFile(new URL("../testar-whatsapp-cloud/index.ts", import.meta.url));
  for (const s of [src, idx]) {
    assert(!s.includes(".from(\"fila_notificacoes\")") && !s.includes("whatsapp_cloud_envios\")") && !s.includes(".rpc("));
  }
});
