import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModeloWhatsApp } from '@/hooks/useModeloWhatsApp';
import { linkWhatsApp, numeroWhatsApp, preencherModelo, valoresDaMarcacao } from '@/lib/whatsapp';

export interface MarcacaoWhatsApp {
  cliente?: string | null;
  procedimento?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  confirmacaoToken?: string | null;
  telefone?: string | null;
}

interface Props {
  marcacao: MarcacaoWhatsApp;
  /** 'icone' = só o ícone (listas); 'texto' = botão com "WhatsApp". */
  variante?: 'icone' | 'texto';
  className?: string;
}

const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/**
 * Botão do WhatsApp de uma marcação: abre o WhatsApp com a mensagem já
 * escrita (modelo de Configurações → Mensagens automáticas).
 *  - Sem telefone guardado: abre logo, sem número — a profissional escolhe a quem envia.
 *  - Com telefone: mostra "Enviar à cliente" e "Escolher contacto".
 */
export default function BotaoWhatsApp({ marcacao, variante = 'icone', className }: Props) {
  const modelo = useModeloWhatsApp();
  const [aberto, setAberto] = useState(false);
  // Posição do menu no ecrã. O menu é desenhado por cima da página (portal),
  // para os cartões com overflow escondido não o cortarem.
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const LARGURA_MENU = 224;

  const texto = preencherModelo(modelo, valoresDaMarcacao(marcacao));
  const numero = numeroWhatsApp(marcacao.telefone);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || menu.current?.contains(alvo)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    const fechar = () => setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('touchstart', fora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto]);

  const aoCarregar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!numero) {
      abrir(linkWhatsApp(texto, null));
      return;
    }
    if (!aberto && caixa.current) {
      const r = caixa.current.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.right - LARGURA_MENU), window.innerWidth - LARGURA_MENU - 8);
      // Perto do fundo do ecrã (barra de baixo do telemóvel), abre para cima.
      const ALTURA_MENU = 112;
      const cabeEmBaixo = r.bottom + 4 + ALTURA_MENU <= window.innerHeight - 80;
      setPosicao({ top: cabeEmBaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - ALTURA_MENU), left });
    }
    setAberto((v) => !v);
  };

  return (
    <div ref={caixa} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={aoCarregar}
        aria-haspopup={numero ? 'menu' : undefined}
        aria-expanded={numero ? aberto : undefined}
        aria-label="Enviar mensagem pelo WhatsApp"
        title="Enviar mensagem pelo WhatsApp"
        className={cn(
          'inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20',
          variante === 'icone' ? 'h-7 w-7' : 'h-9 px-3 text-xs',
        )}
      >
        <MessageCircle size={variante === 'icone' ? 14 : 15} />
        {variante === 'texto' && 'WhatsApp'}
      </button>

      {aberto && numero && posicao && createPortal(
        <div
          ref={menu}
          role="menu"
          style={{ position: 'fixed', top: posicao.top, left: posicao.left, width: LARGURA_MENU }}
          className="z-[1200] overflow-hidden rounded-xl border border-border bg-popover p-1 text-sm shadow-xl shadow-black/30"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setAberto(false);
              abrir(linkWhatsApp(texto, numero));
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-foreground hover:bg-muted"
          >
            <Send size={14} className="text-emerald-500" />
            <span>
              Enviar à cliente
              <span className="block text-[11px] text-muted-foreground">+{numero}</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setAberto(false);
              abrir(linkWhatsApp(texto, null));
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-foreground hover:bg-muted"
          >
            <Users size={14} className="text-muted-foreground" />
            Escolher contacto
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
