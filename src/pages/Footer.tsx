import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const Footer = () => {
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookies_accepted');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookies_accepted', 'true');
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookies_accepted', 'false');
    setShowBanner(false);
  };

  return (
    <footer className="flex w-full flex-col items-center justify-center gap-3 border-t border-border px-5 py-10">
      {/* Links de Navegação */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/privacidade')}
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary outline-none focus-visible:underline"
        >
          Política de Privacidade
        </button>

        <span className="select-none text-xs text-border">•</span>

        <button
          type="button"
          onClick={() => navigate('/termos-de-uso')}
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary outline-none focus-visible:underline"
        >
          Termos de Uso
        </button>

        <span className="select-none text-xs text-border">•</span>

        <a
          href="mailto:suporte.esteticalchub@gmail.com"
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary outline-none focus-visible:underline"
        >
          Suporte
        </a>
      </div>

      {/* Copyright */}
      <div className="flex items-center justify-center text-xs tracking-wide text-muted-foreground">
        <span>
          © 2026 <strong className="font-bold text-foreground">Esteti<span className="text-primary">Calc</span>Hub</strong>
        </span>
        <span className="mx-2 text-border">•</span>
        <span>Sistema de Gestão Profissional</span>
      </div>

      {/* Banner de Cookies */}
      {showBanner && (
        <div className="fixed bottom-6 left-1/2 z-[9999] flex w-[calc(100%-32px)] max-w-[680px] -translate-x-1/2 flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 rounded-xl border border-border bg-card/95 backdrop-blur-md p-5 shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3 flex-1">
            <Cookie size={20} className="shrink-0 text-primary mt-0.5" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Nós usamos cookies para melhorar sua experiência no EstetiCalcHub. Ao continuar
              navegando, você concorda com a nossa{' '}
              <button
                type="button"
                onClick={() => navigate('/privacidade')}
                className="text-primary underline font-medium hover:opacity-80"
              >
                Política de Privacidade
              </button>
              .
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDecline}
              className="rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-background transition-colors"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90"
            >
              Aceitar
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;