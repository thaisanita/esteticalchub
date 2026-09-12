// Servidor HTTP do robô de WhatsApp — a "API pronta" que o site chama.
//
// Rotas para o painel de Configurações do site (autenticadas com o login da
// profissional):
//   POST /sessao/conectar   -> inicia a ligação e devolve o QR code (imagem)
//   GET  /sessao/status     -> 'desconectado' | 'aguardando_qr' | 'conectado'
//   POST /sessao/desconectar
//
// Rota para o worker de notificações (Edge Function processar-fila),
// autenticada com um segredo fixo, nunca exposto ao navegador:
//   POST /enviar             -> manda um lembrete para uma cliente
//
// Ver README.md para como ativar isto em produção.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  iniciarSessao,
  statusDaSessao,
  qrDaSessao,
  desconectarSessao,
  enviarMensagem,
  reerguerSessoesExistentes,
} from './sessionManager.js';
import { usuarioIdDoToken } from './supabaseAdmin.js';

const PORT = process.env.PORT || 3333;
const BOT_SECRET = process.env.BOT_SECRET;

if (!BOT_SECRET) {
  throw new Error('Falta a variável de ambiente BOT_SECRET. Ver README.md.');
}

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Autenticação: quem está logada no site (para conectar/ver o próprio status)
// ---------------------------------------------------------------------------
async function exigirUsuarioLogado(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const usuarioId = await usuarioIdDoToken(token);
  if (!usuarioId) return res.status(401).json({ erro: 'Não autenticado.' });
  req.usuarioId = usuarioId;
  next();
}

// Autenticação: só o próprio worker de notificações pode mandar mensagens
function exigirSegredoDoWorker(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  next();
}

// ---------------------------------------------------------------------------
app.get('/saude', (_req, res) => res.json({ ok: true }));

app.post('/sessao/conectar', exigirUsuarioLogado, async (req, res) => {
  try {
    await iniciarSessao(req.usuarioId);
    // O QR demora um instante a chegar — espera até 8s por ele (verifica a
    // cada 500ms), em vez de assumir que 1,5s é sempre suficiente.
    for (let tentativa = 0; tentativa < 16; tentativa++) {
      if (qrDaSessao(req.usuarioId) || statusDaSessao(req.usuarioId) === 'conectado') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    res.json({
      status: statusDaSessao(req.usuarioId),
      qr: qrDaSessao(req.usuarioId),
    });
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/sessao/status', exigirUsuarioLogado, (req, res) => {
  res.json({
    status: statusDaSessao(req.usuarioId),
    qr: qrDaSessao(req.usuarioId),
  });
});

app.post('/sessao/desconectar', exigirUsuarioLogado, async (req, res) => {
  await desconectarSessao(req.usuarioId);
  res.json({ status: 'desconectado' });
});

// Chamado pela Edge Function processar-fila (worker de lembretes)
app.post('/enviar', exigirSegredoDoWorker, async (req, res) => {
  const { usuario_id, telefone, mensagem } = req.body || {};
  if (!usuario_id || !telefone || !mensagem) {
    return res.status(400).json({ erro: 'Faltam campos: usuario_id, telefone, mensagem.' });
  }
  try {
    await enviarMensagem(usuario_id, telefone, mensagem);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Robô de WhatsApp a correr na porta ${PORT}`);
  reerguerSessoesExistentes();
});
