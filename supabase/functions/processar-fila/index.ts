// Edge Function: processar-fila
// O "carteiro" das mensagens automáticas: email (Resend, sempre ativo) e
// WhatsApp (robô próprio em whatsapp-bot/, só ativo se WHATSAPP_BOT_URL e
// BOT_SECRET estiverem configurados — ver whatsapp-bot/README.md).
//
// É chamada a cada poucos minutos pelo pg_cron (ver NOTIFICACOES_AUTOMATICAS.md).
// Fluxo, por canal:
//   1. reivindicar_notificacoes(canal) devolve um lote já trancado
//   2. para cada linha: resolve o destino, respeita opt-out, envia
//   3. marca 'enviado' / 'erro' / 'falhou' / 'cancelado'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Remetente FIXO no codigo (nao usa secret, para nao arriscar formato invalido).
// Em modo de teste, a Resend so entrega para o email dono da conta Resend.
// Depois de verificar um dominio proprio em resend.com/domains, trocar esta
// linha por: "Agenda Estetica <lembretes@seudominio.com>"
const FROM_EMAIL = "onboarding@resend.dev";
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://agenda-estetica-web.vercel.app";

// Robô de WhatsApp: opcional. Enquanto não estiverem definidos, as linhas de
// canal 'whatsapp' ficam paradas na fila (não são tocadas nem dão erro).
const WHATSAPP_BOT_URL = Deno.env.get("WHATSAPP_BOT_URL");
const BOT_SECRET = Deno.env.get("BOT_SECRET");

const LOTE = 50;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Fila = {
  id: string;
  agendamento_id: string;
  usuario_id: string;
  canal: string;
  antecedencia: string;
  data_disparo: string;
  status: string;
  tentativas: number;
  mensagem: string | null;
  assunto: string | null;
  destino: string | null;
};

type Agendamento = {
  cliente?: string;
  procedimento?: string;
  data?: string;
  hora?: string;
  hora_fim?: string;
  ponto_atendimento?: string;
  email_cliente?: string;
  telefone_cliente?: string;
  clientes?: {
    email?: string;
    telefone?: string;
    aceita_lembretes?: boolean;
    opt_out_token?: string;
  } | null;
};

function fmtData(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

/** Texto de fallback para linhas antigas que não têm `mensagem` guardada. */
function montarMensagem(ag: Agendamento, antecedencia: string) {
  const quando = antecedencia === "1_dia" ? "amanhã" : "hoje";
  const nome = String(ag.cliente ?? "").split(" ")[0] || "tudo bem";
  const proc = ag.procedimento ?? "atendimento";
  const local = ag.ponto_atendimento ? ` Local: ${ag.ponto_atendimento}.` : "";
  return (
    `Olá, ${nome}! Passando para lembrar do seu agendamento de ${proc} ` +
    `${quando} (${fmtData(String(ag.data))}) às ${ag.hora}.${local} ` +
    `Qualquer imprevisto, é só responder. Até breve! ✨`
  );
}

async function enviarEmail(
  para: string,
  assunto: string,
  texto: string,
  optOutUrl: string,
  conviteICS: string | null,
) {
  const html =
    `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1e1b2e">` +
    texto.replace(/\n/g, "<br>") +
    (conviteICS
      ? `<p style="font-size:13px;color:#4b4458">📅 Convite de calendário anexado — abra para adicionar à sua agenda.</p>`
      : "") +
    `<hr style="border:none;border-top:1px solid #e5e0ef;margin:20px 0">` +
    `<p style="font-size:12px;color:#8a83a3">Não quer mais receber estes lembretes? ` +
    `<a href="${optOutUrl}" style="color:#8a83a3">Cancelar</a>.</p></div>`;

  const attachments = conviteICS
    ? [
        {
          filename: "convite.ics",
          content: paraBase64(conviteICS),
          content_type: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ]
    : undefined;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [para], subject: assunto, text: texto, html, attachments }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Resend ${resp.status}: ${JSON.stringify(body)}`);
  }
  return body?.id as string | undefined;
}

async function enviarWhatsapp(usuarioId: string, telefone: string, texto: string) {
  const resp = await fetch(`${WHATSAPP_BOT_URL}/enviar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-secret": BOT_SECRET!,
    },
    body: JSON.stringify({ usuario_id: usuarioId, telefone, mensagem: texto }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Robô WhatsApp ${resp.status}: ${JSON.stringify(body)}`);
  }
}

async function finalizar(linha: Fila, patch: Record<string, unknown>) {
  await admin.from("fila_notificacoes").update(patch).eq("id", linha.id);
}

async function buscarAgendamento(agendamentoId: string): Promise<Agendamento | null> {
  const { data } = await admin
    .from("agendamentos")
    .select(
      "cliente, procedimento, data, hora, hora_fim, ponto_atendimento, email_cliente, telefone_cliente, cliente_id, " +
        "clientes:cliente_id ( email, telefone, aceita_lembretes, opt_out_token )",
    )
    .eq("id", agendamentoId)
    .maybeSingle();
  return data as Agendamento | null;
}

// ---------------------------------------------------------------------------
// Convite de calendário (.ics) anexado ao lembrete por email
// ---------------------------------------------------------------------------

const cacheOrganizador = new Map<string, { nome: string; email: string | null }>();

/** Nome/email da profissional dona do agendamento, para o campo ORGANIZER do convite. */
async function buscarOrganizador(usuarioId: string): Promise<{ nome: string; email: string | null }> {
  const emCache = cacheOrganizador.get(usuarioId);
  if (emCache) return emCache;

  const { data } = await admin.auth.admin.getUserById(usuarioId);
  const info = {
    nome: (data?.user?.user_metadata?.full_name as string | undefined) || "a sua profissional",
    email: data?.user?.email ?? null,
  };
  cacheOrganizador.set(usuarioId, info);
  return info;
}

/** Escapa vírgulas, ponto-e-vírgulas, barras invertidas e quebras de linha, conforme o RFC 5545. */
function escaparICS(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Dobra linhas com mais de 75 octetos em continuações, conforme o RFC 5545. */
function dobrarLinhaICS(linha: string) {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;

  let resultado = "";
  let atual = "";
  let contagem = 0;
  for (const char of linha) {
    const tamanho = enc.encode(char).length;
    if (contagem + tamanho > 74) {
      resultado += (resultado ? "\r\n " : "") + atual;
      atual = "";
      contagem = 0;
    }
    atual += char;
    contagem += tamanho;
  }
  resultado += (resultado ? "\r\n " : "") + atual;
  return resultado;
}

/** "2026-09-12" + "14:00" -> "20260912T140000" (hora local "flutuante", sem fuso — correto para um
 * compromisso presencial: cada calendário mostra a hora tal como foi marcada, sem conversão). */
function paraDataHoraICS(dataISO: string, horaHHMM: string) {
  const [ano, mes, dia] = dataISO.split("-");
  const [h, m] = horaHHMM.split(":");
  return `${ano}${mes}${dia}T${(h || "00").padStart(2, "0")}${(m || "00").padStart(2, "0")}00`;
}

function paraBase64(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

/** Gera o conteúdo de um convite .ics (METHOD:REQUEST) para o agendamento. */
function gerarConviteICS(
  ag: Agendamento,
  agendamentoId: string,
  emailCliente: string,
  organizador: { nome: string; email: string | null },
) {
  if (!ag.data || !ag.hora || !organizador.email) return null;

  const dtStart = paraDataHoraICS(ag.data, ag.hora);
  const dtEnd = paraDataHoraICS(ag.data, ag.hora_fim || ag.hora);
  const agora = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const nomeCliente = ag.cliente || "Cliente";
  const descricao = `Atendimento com ${organizador.nome}.`;

  const linhas = [
    "BEGIN:VCALENDAR",
    "PRODID:-//EstetiCalcHub//Lembrete de Atendimento//PT",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:agendamento-${agendamentoId}@estetichub`,
    `DTSTAMP:${agora}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escaparICS(ag.procedimento || "Atendimento")}`,
    ...(ag.ponto_atendimento ? [`LOCATION:${escaparICS(ag.ponto_atendimento)}`] : []),
    `DESCRIPTION:${escaparICS(descricao)}`,
    `ORGANIZER;CN=${escaparICS(organizador.nome)}:mailto:${organizador.email}`,
    `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escaparICS(nomeCliente)}:mailto:${emailCliente}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return linhas.map(dobrarLinhaICS).join("\r\n") + "\r\n";
}

type ResultadoEnvio = "enviado" | "cancelado";

/** Processa um lote de um canal (email ou whatsapp). Devolve as contagens. */
async function processarCanal(
  canal: "email" | "whatsapp",
  enviar: (
    linha: Fila,
    ag: Agendamento,
    cli: NonNullable<Agendamento["clientes"]>,
    texto: string,
  ) => Promise<ResultadoEnvio>,
) {
  const contagem = { total: 0, enviados: 0, cancelados: 0, erros: 0 };

  const { data: lote, error } = await admin.rpc("reivindicar_notificacoes", {
    p_limite: LOTE,
    p_canal: canal,
  });
  if (error) throw new Error(`reivindicar_notificacoes(${canal}): ${error.message}`);

  const linhas = (lote ?? []) as Fila[];
  contagem.total = linhas.length;

  for (const linha of linhas) {
    try {
      const ag = await buscarAgendamento(linha.agendamento_id);
      if (!ag) {
        await finalizar(linha, { status: "cancelado", ultimo_erro: "agendamento não encontrado" });
        contagem.cancelados++;
        continue;
      }

      const cli = ag.clientes ?? {};
      if (cli.aceita_lembretes === false) {
        await finalizar(linha, { status: "cancelado", ultimo_erro: "cliente com opt-out" });
        contagem.cancelados++;
        continue;
      }

      const texto = linha.mensagem?.trim() || montarMensagem(ag, linha.antecedencia);
      const resultado = await enviar(linha, ag, cli, texto);
      if (resultado === "cancelado") contagem.cancelados++;
      else contagem.enviados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const desiste = linha.tentativas >= 3;
      await finalizar(linha, { status: desiste ? "falhou" : "erro", ultimo_erro: msg.slice(0, 500) });
      contagem.erros++;
      console.error(`fila ${linha.id} (${canal}):`, msg);
    }
  }

  return contagem;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("não autorizado", { status: 401 });
  }

  const resultado: Record<string, unknown> = {};

  resultado.email = await processarCanal("email", async (linha, ag, cli, texto) => {
    const email = (linha.destino || ag.email_cliente || cli.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      await finalizar(linha, { status: "cancelado", ultimo_erro: "sem email válido" });
      return "cancelado";
    }
    const assunto = linha.assunto?.trim() || `Lembrete: ${ag.procedimento ?? "seu atendimento"}`;
    const optOutUrl = cli.opt_out_token
      ? `${APP_URL}/opt-out?token=${cli.opt_out_token}`
      : `${APP_URL}/opt-out`;

    const organizador = await buscarOrganizador(linha.usuario_id);
    const conviteICS = gerarConviteICS(ag, linha.agendamento_id, email, organizador);

    const providerId = await enviarEmail(email, assunto, texto, optOutUrl, conviteICS);
    await finalizar(linha, {
      status: "enviado",
      enviado_em: new Date().toISOString(),
      provider_id: providerId ?? null,
      destino: email,
      ultimo_erro: null,
    });
    return "enviado";
  }).catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));

  if (WHATSAPP_BOT_URL && BOT_SECRET) {
    resultado.whatsapp = await processarCanal("whatsapp", async (linha, ag, cli, texto) => {
      const telefone = (linha.destino || ag.telefone_cliente || cli.telefone || "").toString();
      const numeroLimpo = telefone.replace(/\D/g, "");
      if (!numeroLimpo) {
        await finalizar(linha, { status: "cancelado", ultimo_erro: "sem telefone válido" });
        return "cancelado";
      }
      await enviarWhatsapp(linha.usuario_id, numeroLimpo, texto);
      await finalizar(linha, {
        status: "enviado",
        enviado_em: new Date().toISOString(),
        destino: numeroLimpo,
        ultimo_erro: null,
      });
      return "enviado";
    }).catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));
  } else {
    resultado.whatsapp = "desativado (WHATSAPP_BOT_URL/BOT_SECRET não configurados)";
  }

  return new Response(JSON.stringify(resultado), {
    headers: { "Content-Type": "application/json" },
  });
});
