// Gestor de sessões do WhatsApp — uma sessão por profissional (usuario_id).
// Cada sessão é uma ligação tipo "WhatsApp Web": a primeira vez precisa de
// escanear um QR code; depois disso as credenciais ficam guardadas em disco
// (pasta sessions/<usuario_id>/) e a ligação reconecta sozinha.
//
// Isto NÃO é a API oficial da Meta — ver README.md para os riscos antes de
// ativar em produção.

import path from 'node:path';
import fs from 'node:fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { atualizarStatusWhatsapp } from './supabaseAdmin.js';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

/** @type {Map<string, { sock: any, status: 'aguardando_qr' | 'conectado' | 'desconectado', qrDataUrl: string | null }>} */
const sessoes = new Map();

function pastaDaSessao(usuarioId) {
  return path.join(SESSIONS_DIR, usuarioId);
}

export function statusDaSessao(usuarioId) {
  return sessoes.get(usuarioId)?.status ?? 'desconectado';
}

export function qrDaSessao(usuarioId) {
  return sessoes.get(usuarioId)?.qrDataUrl ?? null;
}

/**
 * Garante que existe uma sessão a tentar ligar para este utilizador. Se já
 * houver credenciais salvas de uma vez anterior, reconecta sozinha sem pedir
 * QR novo.
 */
export async function iniciarSessao(usuarioId) {
  if (sessoes.has(usuarioId)) return sessoes.get(usuarioId);

  const entrada = { sock: null, status: 'aguardando_qr', qrDataUrl: null };
  sessoes.set(usuarioId, entrada);

  const { state, saveCreds } = await useMultiFileAuthState(pastaDaSessao(usuarioId));

  const sock = makeWASocket({
    auth: state,
    logger,
    // Não precisamos de histórico de mensagens nem de sincronizar conversas
    // antigas — só vamos mandar lembretes, então mantemos a ligação leve.
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  entrada.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entrada.qrDataUrl = await QRCode.toDataURL(qr);
      entrada.status = 'aguardando_qr';
    }

    if (connection === 'open') {
      entrada.status = 'conectado';
      entrada.qrDataUrl = null;
      await atualizarStatusWhatsapp(usuarioId, 'conectado').catch(() => {});
    }

    if (connection === 'close') {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const foiLogout = motivo === DisconnectReason.loggedOut;

      entrada.status = 'desconectado';
      await atualizarStatusWhatsapp(usuarioId, 'desconectado').catch(() => {});

      if (foiLogout) {
        // A profissional desconectou pelo próprio celular — apaga as
        // credenciais locais, vai precisar de escanear um QR novo.
        sessoes.delete(usuarioId);
        fs.rmSync(pastaDaSessao(usuarioId), { recursive: true, force: true });
      } else {
        // Queda de rede/reinício normal — tenta reconectar sozinha.
        sessoes.delete(usuarioId);
        setTimeout(() => iniciarSessao(usuarioId).catch(() => {}), 3000);
      }
    }
  });

  return entrada;
}

export async function desconectarSessao(usuarioId) {
  const entrada = sessoes.get(usuarioId);
  if (entrada?.sock) {
    await entrada.sock.logout().catch(() => {});
  }
  sessoes.delete(usuarioId);
  fs.rmSync(pastaDaSessao(usuarioId), { recursive: true, force: true });
  await atualizarStatusWhatsapp(usuarioId, 'desconectado').catch(() => {});
}

/**
 * Envia uma mensagem de texto pelo número já conectado deste utilizador.
 * `telefone` pode vir só com dígitos (com código do país, ex.: 351912345678).
 */
export async function enviarMensagem(usuarioId, telefone, texto) {
  const entrada = sessoes.get(usuarioId);
  if (!entrada || entrada.status !== 'conectado') {
    throw new Error('WhatsApp não está conectado para este utilizador.');
  }
  const numeroLimpo = String(telefone).replace(/\D/g, '');
  if (!numeroLimpo) throw new Error('Número de telefone inválido.');

  const jid = `${numeroLimpo}@s.whatsapp.net`;
  await entrada.sock.sendMessage(jid, { text: texto });
}

/** Ao ligar o servidor, tenta reerguer as sessões que já tinham credenciais salvas. */
export async function reerguerSessoesExistentes() {
  const pastas = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const pasta of pastas) {
    iniciarSessao(pasta.name).catch((e) => logger.error(e, `Falha ao reerguer sessão ${pasta.name}`));
  }
}
