// Lógica do webhook da Meta, separada de Deno.serve para poder ser testada.
//
// POST trata dois tipos de evento:
//   * estados das mensagens enviadas (sent/delivered/read/failed);
//   * pedidos INEQUÍVOCOS de paragem recebidos (ex.: "PARAR") => bloqueio global.
// O número da cliente nunca sai deste handler: só o hash HMAC com pepper.

import {
  assinaturaValida,
  EventoEstado,
  extrairEstados,
  extrairPedidosParagem,
  verificarSubscricao,
} from "../_shared/webhook-meta.ts";

export type DepsWebhook = {
  appSecret: string;
  verifyToken: string;
  /** Grava o evento de forma idempotente. Devolve 'aplicado' | 'repetido' | 'guardado_sem_envio'. */
  registarEvento: (e: EventoEstado) => Promise<string>;
  /** HMAC do E.164 com WA_TELEFONE_PEPPER. Se não estiver configurado, o webhook recusa tudo. */
  hashTelefone: ((e164: string) => Promise<string>) | null;
  /** Bloqueio global. Devolve 'bloqueado' | 'repetido'. */
  registarOptout: (telefoneHash: string, palavra: string, wamid: string) => Promise<string>;
  log?: (msg: string) => void;
};

const TAMANHO_MAXIMO = 1_000_000; // 1 MB

export function criarHandlerWebhook(deps: DepsWebhook) {
  const log = deps.log ?? ((m: string) => console.log(m));

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const challenge = verificarSubscricao(url.searchParams, deps.verifyToken);
      if (challenge === null) return new Response("Forbidden", { status: 403 });
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    if (!deps.appSecret || !deps.hashTelefone) {
      // Sem segredo ou sem pepper nunca aceitamos eventos: um opt-out perdido não é aceitável.
      log("[wa-webhook] configuração incompleta (WA_APP_SECRET/WA_TELEFONE_PEPPER) — evento recusado");
      return new Response("Service Unavailable", { status: 503 });
    }

    const tamanhoDeclarado = Number(req.headers.get("content-length") ?? "0");
    if (tamanhoDeclarado > TAMANHO_MAXIMO) return new Response("Payload Too Large", { status: 413 });

    const bruto = new Uint8Array(await req.arrayBuffer());
    if (bruto.byteLength > TAMANHO_MAXIMO) return new Response("Payload Too Large", { status: 413 });

    const ok = await assinaturaValida(deps.appSecret, bruto, req.headers.get("x-hub-signature-256"));
    if (!ok) {
      log("[wa-webhook] assinatura inválida — evento recusado");
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bruto));
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const eventos = extrairEstados(payload);
    const paragens = extrairPedidosParagem(payload);
    const resumo: Record<string, number> = {};
    try {
      // Opt-outs primeiro: são os mais importantes de não perder.
      for (const p of paragens) {
        const h = await deps.hashTelefone(p.e164);
        const r = await deps.registarOptout(h, p.palavra, p.wamid);
        resumo[`optout_${r}`] = (resumo[`optout_${r}`] ?? 0) + 1;
      }
      for (const ev of eventos) {
        const r = await deps.registarEvento(ev);
        resumo[r] = (resumo[r] ?? 0) + 1;
      }
    } catch (e) {
      // 500 => a Meta volta a enviar; a deduplicação (wamid/estado e hash) evita repetidos.
      log(`[wa-webhook] erro a gravar: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      return new Response("Internal Server Error", { status: 500 });
    }

    log(`[wa-webhook] estados=${eventos.length} paragens=${paragens.length} ${JSON.stringify(resumo)}`);
    return new Response("OK", { status: 200 });
  };
}
