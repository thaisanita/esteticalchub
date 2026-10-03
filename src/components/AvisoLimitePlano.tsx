import { AlertTriangle } from 'lucide-react';

interface AvisoLimitePlanoProps {
  restantes: number;
  rotuloSingular: string;
  rotuloPlural: string;
}

/** Banner amarelo discreto quando a conta grátis está perto do limite (80%+). */
export default function AvisoLimitePlano({ restantes, rotuloSingular, rotuloPlural }: AvisoLimitePlanoProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle size={16} className="shrink-0" />
      Tens {restantes} {restantes === 1 ? rotuloSingular : rotuloPlural} restante{restantes === 1 ? '' : 's'} no plano
      grátis.
    </div>
  );
}
