import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import RegistoPagamentoRapido from '../components/RegistoPagamentoRapido';
import {
  Wallet,
  Plus,
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
} from 'lucide-react';

interface PagamentoRegistado {
  id: string | number;
  cliente: string;
  procedimento?: string;
  data: string;
  valor: number;
  forma_pagamento: string | null;
  pago_em: string | null;
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
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);

  const carregarPagamentos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('id, cliente, procedimento, data, preco, valor, forma_pagamento, pago_em')
      .eq('pago', true)
      .order('pago_em', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao buscar pagamentos:', getErrorMessage(error));
    } else {
      setPagamentos(
        (data || []).map((p) => ({
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
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarPagamentos();
  }, [carregarPagamentos]);

  const totalRecebido = pagamentos.reduce((acc, p) => acc + p.valor, 0);

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
          <Button onClick={() => setPainelAberto(true)} className="gap-1.5">
            <Plus size={14} /> Registar Pagamento
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
          Total Recebido (últimos 100 registos)
        </p>
        <p className="font-display text-3xl font-bold text-emerald-500 mt-1">
          € {totalRecebido.toFixed(2)}
        </p>
      </div>

      {loading ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          A carregar pagamentos...
        </div>
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
      />
    </div>
  );
}
