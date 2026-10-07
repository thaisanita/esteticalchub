import { useEffect, useState } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

/**
 * Aviso discreto quando a ligação falha. Aparece enquanto o cliente do Supabase
 * está a tentar de novo (ver fetchComRepeticao em src/supabase.js) e desaparece
 * quando um pedido volta a funcionar.
 */
export default function BannerRede() {
  const [aTentar, setATentar] = useState(!navigator.onLine);

  useEffect(() => {
    const falha = () => setATentar(true);
    const recuperou = () => setATentar(false);
    window.addEventListener('rede:falha', falha);
    window.addEventListener('rede:ok', recuperou);
    window.addEventListener('offline', falha);
    window.addEventListener('online', recuperou);
    return () => {
      window.removeEventListener('rede:falha', falha);
      window.removeEventListener('rede:ok', recuperou);
      window.removeEventListener('offline', falha);
      window.removeEventListener('online', recuperou);
    };
  }, []);

  if (!aTentar) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg shadow-black/20"
    >
      <WifiOff size={14} className="shrink-0" />
      Sem ligação. A tentar de novo…
      <Loader2 size={13} className="shrink-0 animate-spin" />
    </div>
  );
}
