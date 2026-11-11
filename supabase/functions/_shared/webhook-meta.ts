// Utilitários do webhook da WhatsApp Cloud API.
//
// A Meta assina cada POST com HMAC-SHA256 do CORPO BRUTO, usando o App Secret,
// no cabeçalho X-Hub-Signature-256: "sha256=<hex>". A validação tem de usar os
// bytes exatamente como chegaram (antes de qualquer JSON.parse).

export async function hmacSha256Hex(segredo: string, dados: Uint8Array<ArrayBuffer>): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, dados);
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante (não termina cedo no primeiro carácter diferente). */
export function iguaisTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export async function assinaturaValida(
  segredo: string,
  corpoBruto: Uint8Array<ArrayBuffer>,
  cabecalho: string | null,
): Promise<boolean> {
  if (!segredo || !cabecalho) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(cabecalho.trim());
  if (!m) return false;
  const esperado = await hmacSha256Hex(segredo, corpoBruto);
  return iguaisTempoConstante(esperado, m[1].toLowerCase());
}

/** GET de verificação: devolve o challenge se o token bater certo, senão null. */
export function verificarSubscricao(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (modo !== "subscribe" || !challenge) return null;
  if (!iguaisTempoConstante(token, verifyToken)) return null;
  return challenge;
}

export type EventoEstado = {
  wamid: string;
  estado: "enviado" | "entregue" | "lido" | "falhado";
  ocorridoEm: string | null;
  erroCodigo: string | null;
};

const MAPA_ESTADOS: Record<string, EventoEstado["estado"]> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhado",
};

/**
 * Extrai só os eventos de estado relevantes. Ignora mensagens recebidas e
 * qualquer outro campo. Não devolve o número da destinatária.
 */
export function extrairEstados(payload: unknown): EventoEstado[] {
  const eventos: EventoEstado[] = [];
  const p = payload as { object?: string; entry?: unknown[] } | null;
  if (!p || p.object !== "whatsapp_business_account" || !Array.isArray(p.entry)) return eventos;

  for (const entry of p.entry) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const ch of changes) {
      const valor = (ch as { field?: string; value?: { statuses?: unknown[] } }) ?? {};
      if (valor.field !== "messages" || !Array.isArray(valor.value?.statuses)) continue;
      for (const s of valor.value!.statuses!) {
        const st = s as { id?: unknown; status?: unknown; timestamp?: unknown; errors?: Array<{ code?: unknown }> };
        const estado = typeof st.status === "string" ? MAPA_ESTADOS[st.status] : undefined;
        if (!estado || typeof st.id !== "string" || !st.id) continue;
        const ts = Number(st.timestamp);
        eventos.push({
          wamid: st.id,
          estado,
          ocorridoEm: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null,
          erroCodigo: Array.isArray(st.errors) && st.errors[0]?.code !== undefined ? String(st.errors[0].code) : null,
        });
      }
    }
  }
  return eventos;
}
