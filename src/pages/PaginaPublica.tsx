// Página pública de captação, uma por profissional — pensada para receber
// tráfego de anúncios (Facebook/Instagram Ads). Não precisa de login.
// Rota: /p/:slug
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Sparkles, MessageCircle, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PaginaInfo {
  nome_negocio: string;
  descricao: string | null;
  telefone_whatsapp: string | null;
  fotos: string[];
  meta_pixel_id: string | null;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Carrega o Pixel da Meta só nesta página, e só se a profissional tiver um configurado. */
function usarMetaPixel(pixelId: string | null) {
  useEffect(() => {
    if (!pixelId) return;

    if (!window.fbq) {
      const win = window as Window & { _fbq?: unknown };
      const fbq: { (...args: unknown[]): void; callMethod?: (...args: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string } =
        function (...args: unknown[]) {
          if (fbq.callMethod) fbq.callMethod(...args);
          else fbq.queue.push(args);
        } as never;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.push = fbq;
      win._fbq = fbq;
      window.fbq = fbq;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.id = 'meta-pixel-script';
      document.head.appendChild(script);
    }

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }, [pixelId]);
}

export default function PaginaPublica() {
  const { slug } = useParams<{ slug: string }>();

  const [pagina, setPagina] = useState<PaginaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [interesse, setInteresse] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    const buscar = async () => {
      if (!slug) {
        setNaoEncontrada(true);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('obter_pagina_publica', { p_slug: slug }).maybeSingle();
        if (error || !data) {
          setNaoEncontrada(true);
        } else {
          setPagina(data as PaginaInfo);
        }
      } catch {
        setNaoEncontrada(true);
      } finally {
        setLoading(false);
      }
    };
    buscar();
  }, [slug]);

  usarMetaPixel(pagina?.meta_pixel_id ?? null);

  const clicarWhatsApp = useCallback(() => {
    if (!pagina?.telefone_whatsapp) return;
    window.fbq?.('track', 'Contact');
    const numero = pagina.telefone_whatsapp.replace(/\D/g, '');
    const texto = encodeURIComponent(
      `Olá! Vi a página da ${pagina.nome_negocio} e gostaria de saber mais.`
    );
    window.open(`https://wa.me/${numero}?text=${texto}`, '_blank');
  }, [pagina]);

  const enviarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || enviando) return;
    setErroForm(null);

    if (!nome.trim() || !telefone.trim()) {
      setErroForm('Preenche o nome e o telefone.');
      return;
    }

    setEnviando(true);
    try {
      const { data: sucesso, error } = await supabase.rpc('criar_lead_publica', {
        p_slug: slug,
        p_nome: nome.trim(),
        p_telefone: telefone.trim(),
        p_interesse: interesse.trim() || null,
      });

      if (error || !sucesso) throw error || new Error('Não foi possível enviar.');

      window.fbq?.('track', 'Lead');
      setEnviado(true);
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : 'Não foi possível enviar. Tenta de novo.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (naoEncontrada || !pagina) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-3 rounded-2xl border border-border bg-card p-8 text-center shadow-lg shadow-black/10">
          <AlertCircle className="mx-auto h-10 w-10 text-danger" />
          <h1 className="text-lg font-bold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">Este link não existe ou já não está disponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        {/* Cabeçalho */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover shadow-lg shadow-primary/30">
            <Sparkles size={26} className="text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{pagina.nome_negocio}</h1>
          {pagina.descricao && (
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{pagina.descricao}</p>
          )}
        </div>

        {/* Fotos */}
        {pagina.fotos.length > 0 && (
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pagina.fotos.slice(0, 6).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${pagina.nome_negocio} ${i + 1}`}
                className="aspect-square w-full rounded-2xl border border-border object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Duas opções lado a lado */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Falar no WhatsApp */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-lg shadow-black/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <MessageCircle size={22} className="text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-foreground">Falar no WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Tira as tuas dúvidas diretamente, agora mesmo.</p>
            <button
              onClick={clicarWhatsApp}
              disabled={!pagina.telefone_whatsapp}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            >
              <MessageCircle size={16} /> Abrir WhatsApp
            </button>
          </div>

          {/* Deixar os dados */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-lg shadow-black/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Send size={20} className="text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">Deixar os meus dados</h2>
            <p className="text-xs text-muted-foreground">Entramos em contacto contigo em breve.</p>

            {!formAberto ? (
              <button
                onClick={() => setFormAberto(true)}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Send size={16} /> Preencher formulário
              </button>
            ) : enviado ? (
              <div className="flex w-full flex-col items-center gap-1.5 rounded-xl bg-emerald-500/10 py-4 text-emerald-600">
                <CheckCircle2 size={20} />
                <p className="text-xs font-semibold">Recebido! Já vamos entrar em contacto.</p>
              </div>
            ) : (
              <form onSubmit={enviarFormulario} className="w-full space-y-2 text-left">
                <input
                  type="text"
                  placeholder="O teu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="O teu telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <textarea
                  placeholder="O que procuras? (opcional)"
                  value={interesse}
                  onChange={(e) => setInteresse(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {erroForm && <p className="text-xs text-danger">{erroForm}</p>}
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Enviar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
