import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Check } from 'lucide-react';

const BENEFICIOS_PRO = [
  'Clientes e agendamentos ilimitados',
  'Relatórios dos últimos 12 meses',
  'Assistente IA',
  'Página pública',
  'Lembretes por email',
];

interface ModalUpgradePlanoProps {
  open: boolean;
  onClose: () => void;
}

/** Modal mostrado quando a conta grátis atinge 100% de um limite (clientes/agendamentos). */
export default function ModalUpgradePlano({ open, onClose }: ModalUpgradePlanoProps) {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">Limite atingido</h3>
          <button onClick={onClose} title="Fechar" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Passa para o plano Pro para continuares sem limites:
        </p>
        <ul className="mt-4 space-y-2">
          {BENEFICIOS_PRO.map((beneficio) => (
            <li key={beneficio} className="flex items-start gap-2 text-sm text-foreground">
              <Check size={15} className="mt-0.5 shrink-0 text-primary" />
              {beneficio}
            </li>
          ))}
        </ul>
        <button
          onClick={() => navigate('/planos')}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Sparkles size={15} /> Ver planos
        </button>
      </div>
    </div>
  );
}
