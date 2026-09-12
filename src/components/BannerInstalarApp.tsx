// Convite discreto para instalar o site como app (PWA) — aparece uma vez
// por sessão/dispositivo, e some sozinho se a pessoa já instalou ou já
// fechou o banner antes. O comportamento muda por plataforma:
//   - Android/Chrome/Edge: dispara o diálogo nativo via `beforeinstallprompt`
//   - iPhone/Safari: não existe esse evento (limitação da Apple) — mostra
//     instruções curtas de "Adicionar ao Ecrã Principal"
import { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';

export const CHAVE_BANNER_INSTALAR_FECHADO = 'banner_instalar_fechado';
const CHAVE_FECHADO = CHAVE_BANNER_INSTALAR_FECHADO;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function estaEmStandalone() {
  const navegadorComStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navegadorComStandalone.standalone === true
  );
}

function ehIOSSafari() {
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  // No iOS, Chrome/Firefox/Edge usam o motor do Safari por baixo mas têm o
  // próprio user agent — só mostramos as instruções (específicas do Safari)
  // quando é mesmo o Safari.
  const naoEhOutroNavegador = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOSDevice && naoEhOutroNavegador;
}

export default function BannerInstalarApp() {
  const [promptEvento, setPromptEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarInstrucoesIOS, setMostrarInstrucoesIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const jaFechou = localStorage.getItem(CHAVE_FECHADO) === '1';
    if (jaFechou || estaEmStandalone()) return;

    if (ehIOSSafari()) {
      setMostrarInstrucoesIOS(true);
      setVisivel(true);
      return;
    }

    const aoFicarInstalavel = (e: Event) => {
      e.preventDefault();
      setPromptEvento(e as BeforeInstallPromptEvent);
      setVisivel(true);
    };

    window.addEventListener('beforeinstallprompt', aoFicarInstalavel);
    return () => window.removeEventListener('beforeinstallprompt', aoFicarInstalavel);
  }, []);

  const fechar = () => {
    localStorage.setItem(CHAVE_FECHADO, '1');
    setVisivel(false);
  };

  const instalar = async () => {
    if (!promptEvento) return;
    await promptEvento.prompt();
    await promptEvento.userChoice;
    // Aceite ou recusado, não insiste de novo — a pessoa já viu a opção.
    fechar();
  };

  if (!visivel) return null;

  return (
    <div className="no-print relative mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 pr-9 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        {mostrarInstrucoesIOS ? (
          <Share size={18} className="text-primary" />
        ) : (
          <Download size={18} className="text-primary" />
        )}
      </div>

      {mostrarInstrucoesIOS ? (
        <div className="text-xs">
          <p className="font-bold text-foreground">Instala o app no teu iPhone</p>
          <p className="mt-0.5 text-muted-foreground">
            Toca no ícone de Partilhar <Share size={11} className="inline -mt-0.5" /> na barra do Safari, e depois
            em "Adicionar ao Ecrã Principal".
          </p>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-bold text-foreground">Instala o EstetiCalcHub</p>
            <p className="mt-0.5 text-muted-foreground">Acesso rápido direto do teu ecrã inicial.</p>
          </div>
          <button
            onClick={instalar}
            className="shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary-hover px-3.5 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Instalar
          </button>
        </>
      )}

      <button
        onClick={fechar}
        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
        title="Fechar"
      >
        <X size={15} />
      </button>
    </div>
  );
}
