import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import RegistoPagamentoRapido, { type AgendamentoParaPagar } from '../components/RegistoPagamentoRapido';
import {
  Wallet,
  Plus,
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  AlertTriangle,
  Euro,
} from 'lucide-react';
import { SkeletonLinhas } from '@/components/ui/skeleton';

interface PagamentoRegistado {
  id: string | number;
  cliente: string;
  procedimento?: string;
  data: string;
  valor: number;
  forma_pagamento: string | null;
  pago_em: string | null;
}

interface PendenteCobranca {
  id: string | number;
  cliente: string;
  cliente_id?: string | null;
  procedimento?: string;
  data: string;
  valor: number;
}

const ICONE_FORMA: Record<string, typeof Banknote> = {
  dinheiro: Banknote,
  cartao: CreditCard,
  mbway: Smartphone,
  transferencia: Landmark,
};

const LABEL_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  mbway: 'MBWay',
  transferencia: 'Transferência',
};

function formatarDataHora(dataISO: string | null): string {
  if (!dataISO) return '—';
  const d = new Date(dataISO);
  return d.toLocaleDateString('pt-PT') + ' às ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState<PagamentoRegistado[]>([]);
  const [pendentes, setPendentes] = useState<PendenteCobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [agendamentoParaPagar, setAgendamentoParaPagar] = useState<AgendamentoParaPagar | null>(null);

  const carregarPagamentos = useCallback(async () => {
    setLoading(true);
    const hoje = new Date().toISOString().slice(0, 10);

    const [resPagos, resPendentes] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, cliente, procedimento, data, preco, valor, forma_pagamento, pago_em')
        .eq('pago', true)
        .order('pago_em', { ascending: false })
        .limit(100),
      // Atendimentos já realizados (data já passou) e ainda não marcados como pagos —
      // é o mesmo conjunto que a notificação da barra de topo conta.
      supabase
        .from('agendamentos')
        .select('id, cliente, cliente_id, procedimento, data, preco, valor')
        .eq('pago', false)
        .lte('data', hoje)
        .order('data', { ascending: false })
        .limit(500),
    ]);

    if (resPagos.error) {
      console.error('Erro ao buscar pagamentos:', getErrorMessage(resPagos.error));
    } else {
      setPagamentos(
        (resPagos.data || []).map((p) => ({
          id: p.id,
          cliente: p.cliente,
          procedimento: p.procedimento,
          data: p.data,
          valor: Number(p.preco ?? p.valor ?? 0),
          forma_pagamento: p.forma_pagamento,
          pago_em: p.pago_em,
        }))
      );
    }

    if (resPendentes.error) {
      console.error('Erro ao buscar pendentes:', getErrorMessage(resPendentes.error));
    } else {
      setPendentes(
        (resPendentes.data || []).map((p) => ({
          id: p.id,
          cliente: p.cliente,
          cliente_id: p.cliente_id,
          procedimento: p.procedimento,
          data: p.data,
          valor: Number(p.preco ?? p.valor ?? 0),
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    carregarPagamentos();
  }, [carregarPagamentos]);

  const totalRecebido = pagamentos.reduce((acc, p) => acc + p.valor, 0);

  const abrirRegistoNovo = () => {
    setAgendamentoParaPagar(null);
    setPainelAberto(true);
  };

  const abrirPagamentoPendente = (p: PendenteCobranca) => {
    setAgendamentoParaPagar({ id: p.id, cliente: p.cliente, valor: p.valor, clienteId: p.cliente_id ?? undefined });
    setPainelAberto(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Gestão de Pagamentos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Histórico e recebimentos dos atendimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Wallet size={18} />
          </div>
          <Button onClick={abrirRegistoNovo} className="gap-1.5">
            <Plus size={14} /> Registar Pagamento
          </Button>
        </div>
      </div>

      {!loading && pendentes.length > 0 && (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-500">
            <AlertTriangle size={16} />
            <p className="text-sm font-bold">
              {pendentes.length} atendimento{pendentes.length > 1 ? 's' : ''} por pagar
            </p>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pendentes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{p.cliente}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.procedimento || 'Atendimento'} · {new Date(p.data).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-display text-sm font-bold text-foreground">€ {p.valor.toFixed(2)}</span>
                  <Button onClick={() => abrirPagamentoPendente(p)} size="sm" className="h-8 gap-1 px-2.5 text-xs">
                    <Euro size={12} /> Pago
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
          Total Recebido (últimos 100 registos)
        </p>
        <p className="font-display text-3xl font-bold text-emerald-500 mt-1">
          € {totalRecebido.toFixed(2)}
        </p>
      </div>

      {loading ? (
        <SkeletonLinhas linhas={5} />
      ) : pagamentos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há pagamentos registados. Usa o botão "Registar Pagamento" acima, ou marca um agendamento como pago na Agenda.
        </div>
      ) : (
        <div className="space-y-2">
          {pagamentos.map((p) => {
            const Icone = (p.forma_pagamento && ICONE_FORMA[p.forma_pagamento]) || Banknote;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                    <Icone size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.procedimento || 'Atendimento'} · {formatarDataHora(p.pago_em)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-emerald-500 tabular-nums">
                    € {p.valor.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.forma_pagamento ? LABEL_FORMA[p.forma_pagamento] || p.forma_pagamento : '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RegistoPagamentoRapido
        open={painelAberto}
        onOpenChange={setPainelAberto}
        onSuccess={carregarPagamentos}
        agendamento={agendamentoParaPagar}
      />
    </div>
  );
}
