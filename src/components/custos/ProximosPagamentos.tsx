import { AlertTriangle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  custoJaTerminou,
  type CustoFixo,
  DIAS_AVISO,
  dataCurta,
  euro,
  pagamentosAAvisar,
  textoQuando,
  type Pagamento,
} from '@/lib/lucro';

/**
 * Lista "Próximos pagamentos" (custos fixos com data + despesas por pagar,
 * nas próximas semanas). O convite para acrescentar a data só aparece quando
 * há custos fixos ativos SEM data — nunca por causa de um que já a tem.
 */
export function ListaProximosPagamentos({
  pagamentos,
  custosSemData,
  onde,
}: {
  pagamentos: Pagamento[];
  custosSemData: number;
  /** Onde a lista aparece, para o convite apontar para o sítio certo. */
  onde: 'resumo' | 'custos-fixos';
}) {
  const comoAcrescentar =
    onde === 'custos-fixos'
      ? 'Carrega no lápis do custo (mais abaixo) e preenche «Próximo pagamento».'
      : 'Acrescenta-a na aba Custos fixos para a veres aqui.';
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarClock size={15} className="text-primary" /> Próximos pagamentos
      </h3>
      {pagamentos.length === 0 && (
        <p className="text-xs text-muted-foreground">Nada para pagar nas próximas 6 semanas.</p>
      )}
      {custosSemData > 0 && (
        <p className="text-xs text-muted-foreground">
          {custosSemData === 1
            ? '1 custo fixo ainda não tem a data do próximo pagamento.'
            : `${custosSemData} custos fixos ainda não têm a data do próximo pagamento.`}{' '}
          {comoAcrescentar}
        </p>
      )}
      {pagamentos.length > 0 && (
        <ul className="divide-y divide-border">
          {pagamentos.map((p) => {
            const urgente = p.dias <= DIAS_AVISO;
            return (
              <li key={`${p.tipo}-${p.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                  <p className={cn('text-[11px]', p.dias < 0 ? 'text-rose-500' : urgente ? 'text-amber-500' : 'text-muted-foreground')}>
                    {dataCurta(p.data)} · {textoQuando(p.dias)}
                    {p.tipo === 'despesa' && ' · despesa por pagar'}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{euro(p.valor)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Custos fixos ativos (e que ainda não terminaram) sem data do próximo pagamento. */
export const contarCustosSemData = (custos: CustoFixo[]) =>
  custos.filter((c) => c.ativo && !c.proximo_pagamento && !custoJaTerminou(c)).length;

/** Aviso curto quando há pagamentos em atraso ou nos próximos dias. */
export function AvisoPagamentos({ pagamentos, onAbrir }: { pagamentos: Pagamento[]; onAbrir?: () => void }) {
  const aAvisar = pagamentosAAvisar(pagamentos);
  if (aAvisar.length === 0) return null;
  const atrasados = aAvisar.filter((p) => p.dias < 0).length;
  const total = aAvisar.reduce((acc, p) => acc + p.valor, 0);
  const primeiro = aAvisar[0];

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm',
        atrasados ? 'border-rose-500/30 bg-rose-500/5 text-rose-500' : 'border-amber-500/30 bg-amber-500/5 text-amber-500',
      )}
    >
      <p className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          {aAvisar.length === 1
            ? `${primeiro.nome} (${euro(primeiro.valor)}): ${primeiro.dias < 0 ? 'pagamento' : 'vence'} ${textoQuando(primeiro.dias)}.`
            : `${aAvisar.length} pagamentos nos próximos ${DIAS_AVISO} dias (${euro(total)})${atrasados ? `, ${atrasados} em atraso` : ''}.`}
        </span>
      </p>
      {onAbrir && (
        <button type="button" onClick={onAbrir} className="text-xs font-semibold underline">
          Ver pagamentos
        </button>
      )}
    </div>
  );
}
