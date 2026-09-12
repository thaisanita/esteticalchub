// Painel "Conectar WhatsApp automático" — fala com o robô próprio em
// whatsapp-bot/ (ver README lá para ativar). Enquanto VITE_WHATSAPP_BOT_URL
// não estiver definida, mostra só um aviso de "em breve" sem tentar nada.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { MessageCircle, CheckCircle2, Loader2, QrCode, Clock } from 'lucide-react';

const BOT_URL = import.meta.env.VITE_WHATSAPP_BOT_URL as string | undefined;

type StatusBot = 'desconectado' | 'aguardando_qr' | 'conectado';

async function chamarBot(caminho: string, opcoes: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${BOT_URL}${caminho}`, {
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  });
  if (!resp.ok) throw new Error((await resp.json().catch(() => ({})))?.erro || 'Erro ao falar com o robô.');
  return resp.json();
}

export default function ConectarWhatsAppBot() {
  const [status, setStatus] = useState<StatusBot>('desconectado');
  const [qr, setQr] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const verificarStatus = useCallback(async () => {
    try {
      const dados = await chamarBot('/sessao/status');
      setStatus(dados.status);
      setQr(dados.qr ?? null);
      if (dados.status === 'conectado') pararPolling();
    } catch {
      // robô offline/indisponível — mantém o estado atual, tenta de novo depois
    }
  }, [pararPolling]);

  useEffect(() => {
    if (!BOT_URL) return;
    verificarStatus();
    return pararPolling;
  }, [verificarStatus, pararPolling]);

  if (!BOT_URL) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/80 text-xs text-muted-foreground">
        <Clock size={16} className="shrink-0" />
        Envio automático de WhatsApp: em breve.
      </div>
    );
  }

  const conectar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      const dados = await chamarBot('/sessao/conectar', { method: 'POST' });
      setStatus(dados.status);
      setQr(dados.qr ?? null);
      pararPolling();
      pollRef.current = setInterval(verificarStatus, 3000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar.');
    } finally {
      setCarregando(false);
    }
  };

  const desconectar = async () => {
    setCarregando(true);
    try {
      await chamarBot('/sessao/desconectar', { method: 'POST' });
      setStatus('desconectado');
      setQr(null);
      pararPolling();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao desconectar.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3">
      <div className="flex items-center gap-2.5">
        <MessageCircle size={16} className="text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground">Envio automático de WhatsApp (robô próprio)</p>
      </div>

      {status === 'conectado' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 size={16} /> Conectado — os lembretes serão enviados pelo seu número.
          </div>
          <Button size="sm" variant="outline" onClick={desconectar} disabled={carregando}>
            Desconectar
          </Button>
        </div>
      ) : qr ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <img src={qr} alt="QR code do WhatsApp" className="h-44 w-44 rounded-lg border border-border" />
          <p className="text-center text-[11px] text-muted-foreground">
            Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho, e escaneie.
          </p>
        </div>
      ) : status === 'aguardando_qr' ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> A gerar o QR code, aguarde...
        </div>
      ) : (
        <Button size="sm" onClick={conectar} disabled={carregando} className="gap-1.5">
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
          Conectar WhatsApp
        </Button>
      )}

      {erro && <p className="text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
