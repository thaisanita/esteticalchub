import { ChevronLeft, ChevronRight } from 'lucide-react';
import { chaveMes, nomeMes } from '@/lib/lucro';

/** ‹ Novembro de 2026 › — muda de mês. `mes` em YYYY-MM. */
export default function SeletorMes({ mes, onChange }: { mes: string; onChange: (mes: string) => void }) {
  const [a, m] = mes.split('-').map(Number);
  const mudar = (delta: number) => onChange(chaveMes(new Date(a, m - 1 + delta, 1)));
  const atual = chaveMes(new Date());

  const classeBotao =
    'flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground';

  // Telemóvel: o mês por cima, os dois botões lado a lado por baixo.
  // Ecrã largo: ‹ Mês anterior · Novembro de 2026 · Mês seguinte ›
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
      <span
        className="order-first col-span-2 text-center text-sm font-semibold text-foreground sm:order-none sm:col-span-1 sm:min-w-[150px]"
        aria-live="polite"
      >
        {nomeMes(mes)}
      </span>
      <button type="button" onClick={() => mudar(-1)} className={`${classeBotao} sm:-order-1`}>
        <ChevronLeft size={15} aria-hidden /> Mês anterior
      </button>
      <button type="button" onClick={() => mudar(1)} className={classeBotao}>
        Mês seguinte <ChevronRight size={15} aria-hidden />
      </button>
      {mes !== atual && (
        <button
          type="button"
          onClick={() => onChange(atual)}
          className="col-span-2 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:underline sm:col-span-1"
        >
          Este mês
        </button>
      )}
    </div>
  );
}
