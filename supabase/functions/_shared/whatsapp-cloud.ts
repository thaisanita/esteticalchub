// Cliente mínimo da WhatsApp Cloud API (Graph API oficial da Meta).
//
// Princípios:
//   * credenciais só por variáveis de ambiente (Supabase Secrets);
//   * nunca regista token, número completo nem o corpo da mensagem;
//   * distingue três resultados — e NUNCA trata "incerto" como "rejeitado":
//       aceite    -> a Meta devolveu um wamid (aceitou o pedido; NÃO é entrega)
//       rejeitado -> a Meta respondeu com um erro claro: a mensagem não foi aceite
//       incerto   -> não sabemos (timeout, rede, 5xx sem erro da Meta, 2xx sem wamid)
//   * um pedido "incerto" pode ter sido aceite: quem chama não o deve repetir.
//
// Versão da Graph API: v26.0 por omissão (a mais recente no changelog oficial
// https://developers.facebook.com/docs/graph-api/changelog/versions — lançada a
// 29/07/2026). Pode ser alterada com WA_GRAPH_API_VERSION.

import { mascararTelefone, normalizarTelefone } from "./telefone.ts";

export const GRAPH_API_VERSION_PADRAO = "v26.0";
export const TIMEOUT_PADRAO_MS = 10_000;

export const TEMPLATE_LEMBRETE_24H = {
  nome: "lembrete_marcacao_24h",
  idioma: "pt_PT",
  numeroParametros: 5,
} as const;

export type ConfigWhatsappCloud = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  timeoutMs: number;
};

export class ErroConfiguracao extends Error {
  constructor(public readonly emFalta: string[]) {
    super(`Configuração da WhatsApp Cloud API incompleta: ${emFalta.join(", ")}`);
    this.name = "ErroConfiguracao";
  }
}

type LeitorEnv = (nome: string) => string | undefined;

export function lerConfig(env: LeitorEnv = (n) => Deno.env.get(n)): ConfigWhatsappCloud {
  const emFalta: string[] = [];
  const accessToken = (env("WA_ACCESS_TOKEN") ?? "").trim();
  const phoneNumberId = (env("WA_PHONE_NUMBER_ID") ?? "").trim();
  const graphApiVersion = (env("WA_GRAPH_API_VERSION") ?? "").trim() || GRAPH_API_VERSION_PADRAO;

  if (!accessToken) emFalta.push("WA_ACCESS_TOKEN");
  if (!phoneNumberId) emFalta.push("WA_PHONE_NUMBER_ID");
  else if (!/^\d{5,25}$/.test(phoneNumberId)) emFalta.push("WA_PHONE_NUMBER_ID (formato inválido)");
  if (!/^v\d{1,3}\.\d$/.test(graphApiVersion)) emFalta.push("WA_GRAPH_API_VERSION (formato inválido, ex.: v26.0)");
  if (emFalta.length) throw new ErroConfiguracao(emFalta);

  const timeout = Number(env("WA_TIMEOUT_MS") ?? TIMEOUT_PADRAO_MS);
  return {
    accessToken,
    phoneNumberId,
    graphApiVersion,
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30_000 ? timeout : TIMEOUT_PADRAO_MS,
  };
}

// ---------------------------------------------------------------------------
// Pedido de envio
// ---------------------------------------------------------------------------

export type PedidoTemplate = {
  agendamentoId: string;
  usuarioId: string;
  telefone: string;            // formato internacional; é normalizado e validado aqui
  template: string;
  idioma: string;
  parametros: string[];        // parâmetros do corpo, por ordem ({{1}}, {{2}}, ...)
  numeroParametrosEsperado?: number;
};

export type PedidoValidado = {
  e164: string;
  telefoneMascarado: string;
  corpo: Record<string, unknown>;
};

export type ErroValidacao = { campo: string; motivo: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Limpa um parâmetro de template conforme as regras da Meta (sem \n, \t nem 4+ espaços seguidos). */
export function limparParametro(valor: string): string {
  return String(valor ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

export function validarPedido(p: PedidoTemplate): { ok: true; pedido: PedidoValidado } | { ok: false; erros: ErroValidacao[] } {
  const erros: ErroValidacao[] = [];
  if (!UUID.test(p.agendamentoId ?? "")) erros.push({ campo: "agendamentoId", motivo: "uuid_invalido" });
  if (!UUID.test(p.usuarioId ?? "")) erros.push({ campo: "usuarioId", motivo: "uuid_invalido" });
  if (!/^[a-z0-9_]{1,512}$/.test(p.template ?? "")) erros.push({ campo: "template", motivo: "nome_invalido" });
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(p.idioma ?? "")) erros.push({ campo: "idioma", motivo: "codigo_invalido" });

  const tel = normalizarTelefone(p.telefone);
  if (!tel.ok) erros.push({ campo: "telefone", motivo: tel.motivo });

  const params = Array.isArray(p.parametros) ? p.parametros.map(limparParametro) : [];
  if (!Array.isArray(p.parametros)) erros.push({ campo: "parametros", motivo: "nao_e_lista" });
  if (p.numeroParametrosEsperado !== undefined && params.length !== p.numeroParametrosEsperado) {
    erros.push({ campo: "parametros", motivo: `esperados_${p.numeroParametrosEsperado}_recebidos_${params.length}` });
  }
  params.forEach((v, i) => {
    if (!v) erros.push({ campo: `parametros[${i}]`, motivo: "vazio" });
    else if (v.length > 200) erros.push({ campo: `parametros[${i}]`, motivo: "demasiado_longo" });
  });

  if (erros.length || !tel.ok) return { ok: false, erros };

  const corpo: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: tel.e164.replace("+", ""),
    type: "template",
    template: {
      name: p.template,
      language: { code: p.idioma },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] }
        : {}),
    },
  };
  return { ok: true, pedido: { e164: tel.e164, telefoneMascarado: mascararTelefone(tel.e164), corpo } };
}

// ---------------------------------------------------------------------------
// Resultado e classificação de erros
// ---------------------------------------------------------------------------

export type ResultadoEnvio =
  | { resultado: "aceite"; wamid: string; http: number }
  | { resultado: "rejeitado"; retentavel: boolean; codigo: string; detalhe: string; http: number }
  | { resultado: "incerto"; codigo: string; detalhe: string; http?: number }
  | { resultado: "invalido"; erros: ErroValidacao[] }
  | { resultado: "dry_run"; template: string; idioma: string; numeroParametros: number };

// Códigos da Meta para os quais a documentação indica que a mensagem NÃO foi
// processada e que se pode tentar mais tarde.
const CODIGOS_RETENTAVEIS = new Set([
  4,       // limite de chamadas da app
  80007,   // limite de chamadas da WABA
  130429,  // limite de throughput
  131048,  // limite por spam
  131056,  // limite por par remetente/destinatário
  131016,  // serviço indisponível
  2,       // serviço temporariamente indisponível
]);

type ErroMeta = { code?: number; error_subcode?: number; message?: string; type?: string; error_data?: { details?: string } };

function extrairErroMeta(corpo: unknown): ErroMeta | null {
  if (corpo && typeof corpo === "object" && "error" in corpo) {
    const e = (corpo as { error?: unknown }).error;
    if (e && typeof e === "object") return e as ErroMeta;
  }
  return null;
}

/** Remove qualquer coisa que pareça um token ou um número de telefone longo. */
export function sanitizar(texto: string): string {
  return String(texto ?? "")
    .replace(/EAA[A-Za-z0-9]{10,}/g, "EAA***")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***")
    .replace(/\+?\d{9,15}/g, (m) => (m.length > 8 ? m.slice(0, 3) + "***" : m))
    .slice(0, 300);
}

export function classificarResposta(http: number, corpo: unknown): ResultadoEnvio {
  const erroMeta = extrairErroMeta(corpo);

  if (http >= 200 && http < 300) {
    const msgs = (corpo as { messages?: Array<{ id?: unknown }> } | null)?.messages;
    const wamid = Array.isArray(msgs) && typeof msgs[0]?.id === "string" ? (msgs[0].id as string) : "";
    if (wamid) return { resultado: "aceite", wamid, http };
    return { resultado: "incerto", codigo: "sem_wamid", detalhe: "Resposta 2xx sem messages[0].id", http };
  }

  if (erroMeta && typeof erroMeta.code === "number") {
    const codigo = `meta_${erroMeta.code}${erroMeta.error_subcode ? "_" + erroMeta.error_subcode : ""}`;
    const detalhe = sanitizar(`${erroMeta.message ?? ""} ${erroMeta.error_data?.details ?? ""}`);
    if (http === 429 || CODIGOS_RETENTAVEIS.has(erroMeta.code)) {
      return { resultado: "rejeitado", retentavel: true, codigo, detalhe, http };
    }
    if (http >= 400 && http < 500) {
      return { resultado: "rejeitado", retentavel: false, codigo, detalhe, http };
    }
    // 5xx com um erro da Meta que não é explicitamente temporário: não sabemos se foi processado.
    return { resultado: "incerto", codigo, detalhe, http };
  }

  if (http === 429) return { resultado: "rejeitado", retentavel: true, codigo: "http_429", detalhe: "Too Many Requests", http };
  if (http >= 400 && http < 500) {
    return { resultado: "rejeitado", retentavel: false, codigo: `http_${http}`, detalhe: "Erro do cliente sem corpo da Meta", http };
  }
  return { resultado: "incerto", codigo: `http_${http}`, detalhe: "Resposta do servidor sem erro estruturado da Meta", http };
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

export type OpcoesEnvio = { fetch?: typeof fetch; dryRun?: boolean };

export function urlMensagens(config: ConfigWhatsappCloud): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
}

export async function enviarTemplate(
  config: ConfigWhatsappCloud,
  pedido: PedidoTemplate,
  opcoes: OpcoesEnvio = {},
): Promise<ResultadoEnvio & { telefoneMascarado?: string; dryRun?: boolean }> {
  const v = validarPedido(pedido);
  if (!v.ok) return { resultado: "invalido", erros: v.erros };

  if (opcoes.dryRun) {
    // Nada sai do servidor. Devolve o que SERIA enviado, com o número mascarado.
    return {
      resultado: "dry_run",
      template: pedido.template,
      idioma: pedido.idioma,
      numeroParametros: pedido.parametros.length,
      telefoneMascarado: v.pedido.telefoneMascarado,
      dryRun: true,
    };
  }

  const fazerFetch = opcoes.fetch ?? fetch;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), config.timeoutMs);

  let resp: Response;
  try {
    resp = await fazerFetch(urlMensagens(config), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(v.pedido.corpo),
      signal: controlador.signal,
    });
  } catch (e) {
    clearTimeout(temporizador);
    const abortado = e instanceof DOMException && e.name === "AbortError";
    return {
      resultado: "incerto",
      codigo: abortado ? "timeout" : "rede",
      detalhe: sanitizar(abortado ? `Sem resposta em ${config.timeoutMs} ms` : String((e as Error)?.message ?? e)),
      telefoneMascarado: v.pedido.telefoneMascarado,
    };
  }

  let corpo: unknown = null;
  try {
    corpo = await resp.json();
  } catch {
    corpo = null; // corpo não-JSON: a classificação trata pelo código HTTP
  } finally {
    clearTimeout(temporizador);
  }

  return { ...classificarResposta(resp.status, corpo), telefoneMascarado: v.pedido.telefoneMascarado };
}

// ---------------------------------------------------------------------------
// Template de lembrete
// ---------------------------------------------------------------------------

export type DadosLembrete = {
  clienteNome: string;
  profissionalNome: string;
  data: string;        // AAAA-MM-DD
  hora: string;        // HH:MM
  procedimento: string;
};

/** {{1}} primeiro nome, {{2}} profissional/estabelecimento, {{3}} dd/mm, {{4}} HH:MM, {{5}} serviço. */
export function parametrosLembrete24h(d: DadosLembrete): string[] {
  const primeiroNome = limparParametro(d.clienteNome).split(" ")[0] || "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.data ?? "");
  const dataFmt = m ? `${m[3]}/${m[2]}` : "";
  const hora = /^\d{2}:\d{2}/.test(d.hora ?? "") ? d.hora.slice(0, 5) : "";
  return [primeiroNome, limparParametro(d.profissionalNome), dataFmt, hora, limparParametro(d.procedimento)];
}

/** Chave de idempotência: marcação + versão relevante (data/hora) + destino + template. */
export async function chaveIdempotencia(partes: {
  agendamentoId: string;
  tipo: string;
  antecedencia: string;
  versaoMarcacao: string;
  e164: string;
  template: string;
  idioma: string;
}): Promise<string> {
  const texto = [
    "v1", partes.agendamentoId, partes.tipo, partes.antecedencia,
    partes.versaoMarcacao, partes.e164, partes.template, partes.idioma,
  ].join("|");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
