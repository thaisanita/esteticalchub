// 6. Edge Function processar-whatsapp-cloud: autenticação, interruptor, execução única.
import { assert, assertEquals } from "./assert.ts";
import { criarHandlerWorker, DepsWorker } from "../processar-whatsapp-cloud/handler.ts";
import { ConfigWhatsappCloud, ErroConfiguracao } from "../_shared/whatsapp-cloud.ts";
import { Contagens, RepositorioWhatsappCloud } from "../_shared/lembretes-whatsapp-cloud.ts";

const SEGREDO = "segredo-do-cron-ficticio-com-mais-de-24";
const CONFIG: ConfigWhatsappCloud = { accessToken: "t", phoneNumberId: "123456", graphApiVersion: "v26.0", timeoutMs: 1000 };
const VAZIO = {} as Contagens;

function deps(over: Partial<DepsWorker> = {}) {
  const chamadas = { processar: 0, libertar: 0 };
  let ocupado = false;
  const d: DepsWorker = {
    cronSecret: SEGREDO,
    ativo: true,
    lerConfig: () => CONFIG,
    hashTelefone: () => Promise.resolve("h"),
    repo: {} as RepositorioWhatsappCloud,
    adquirirExecucao: () => {
      if (ocupado) return Promise.resolve(false);
      ocupado = true;
      return Promise.resolve(true);
    },
    libertarExecucao: () => {
      ocupado = false;
      chamadas.libertar++;
      return Promise.resolve();
    },
    processar: async () => {
      chamadas.processar++;
      await new Promise((r) => setTimeout(r, 20));
      return VAZIO;
    },
    log: () => {},
    ...over,
  };
  return { handler: criarHandlerWorker(d), chamadas };
}

const pedido = (segredo?: string) =>
  new Request("https://x/", { method: "POST", headers: segredo === undefined ? {} : { "x-cron-secret": segredo } });

Deno.test("worker: sem segredo, segredo errado ou segredo curto configurado => 401", async () => {
  const { handler, chamadas } = deps();
  assertEquals((await handler(pedido())).status, 401);
  assertEquals((await handler(pedido("errado"))).status, 401);
  const curto = deps({ cronSecret: "curto" });
  assertEquals((await curto.handler(pedido("curto"))).status, 401);
  assertEquals((await handler(new Request("https://x/", { method: "GET" }))).status, 405);
  assertEquals(chamadas.processar, 0);
});

Deno.test("worker: desligado (WA_CLOUD_WORKER_ATIVO != true) não processa nada", async () => {
  const { handler, chamadas } = deps({ ativo: false });
  const r = await handler(pedido(SEGREDO));
  assertEquals(r.status, 200);
  assert((await r.json()).estado.startsWith("desativado"));
  assertEquals(chamadas.processar, 0);
});

Deno.test("worker: configuração em falta => 500 sem processar", async () => {
  const sem = deps({ lerConfig: () => { throw new ErroConfiguracao(["WA_ACCESS_TOKEN"]); } });
  assertEquals((await sem.handler(pedido(SEGREDO))).status, 500);
  const semPepper = deps({ hashTelefone: null });
  assertEquals((await semPepper.handler(pedido(SEGREDO))).status, 500);
  assertEquals(sem.chamadas.processar + semPepper.chamadas.processar, 0);
});

Deno.test("worker: duas chamadas simultâneas => só uma processa (trinco)", async () => {
  const { handler, chamadas } = deps();
  const [a, b] = await Promise.all([handler(pedido(SEGREDO)), handler(pedido(SEGREDO))]);
  const estados = [(await a.json()).estado, (await b.json()).estado].sort();
  assertEquals(estados, ["ok", "outra_execucao_em_curso"]);
  assertEquals(chamadas.processar, 1);
  assertEquals(chamadas.libertar, 1);
});

Deno.test("worker: o trinco é libertado mesmo se o processamento falhar", async () => {
  const { handler, chamadas } = deps({ processar: () => Promise.reject(new Error("x")) });
  assertEquals((await handler(pedido(SEGREDO))).status, 500);
  assertEquals(chamadas.libertar, 1);
});
