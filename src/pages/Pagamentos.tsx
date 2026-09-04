import { Wallet } from 'lucide-react';

export default function Pagamentos() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Gestão de Pagamentos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Histórico e recebimentos dos atendimentos
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Wallet size={18} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Página de pagamentos pronta para receber o fluxo de recebimentos.
      </div>
    </div>
  );
}