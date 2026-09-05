import { useMemo, useState } from 'react';
import { CalendarX, MessageCircle, Sparkles, Pencil, Trash2, Euro, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseMoeda } from '@/lib/utils';
import RegistoPagamentoRapido, { type AgendamentoParaPagar } from './RegistoPagamentoRapido';

interface Appointment {
  id?: string | number;
  valor?: number | string;
  price?: number | string;
  percent_produto?: number | string;
  productPercent?: number | string;
  hora?: string;
  time?: string;
  cliente?: string;
  clientName?: string;
  procedimento?: string;
  procedure?: string;
  telefone?: string;
  origem?: 'supabase' | 'google';
  pago?: boolean;
  cliente_id?: string;
}

interface ListaAgendamentosProps {
  appointments?: Appointment[];
  loading: boolean;
  onDelete?: (id: string | number, origem?: string) => void;
  onEdit?: (appt: Appointment) => void;
  onPago?: () => void;
}

const ListaAgendamentos = ({
  appointments,
  loading,
  onDelete,
  onEdit,
  onPago,
}: ListaAgendamentosProps) => {
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [agendamentoParaPagar, setAgendamentoParaPagar] = useState<AgendamentoParaPagar | null>(null);

  const abrirPagamento = (appt: Appointment) => {
    setAgendamentoParaPagar({
      id: appt.id!,
      cliente: appt.cliente || appt.clientName || 'Cliente',
      preco: appt.valor ?? appt.price,
      clienteId: appt.cliente_id,
    });
    setPagamentoAberto(true);
  };

  const totals = useMemo(() => {
    if (!appointments || appointments.length === 0) {
      return { totalRendimento: 0, totalCusto: 0, totalLucro: 0 };
    }

    return appointments.reduce(
      (acc, appt) => {
        const precoRaw = appt.valor ?? appt.price ?? 0;
        const percentRaw = appt.percent_produto ?? appt.productPercent ?? 0;

        const preco = parseMoeda(precoRaw);
        const percent = parseMoeda(percentRaw);

        const custoProduto = preco * (percent / 100);

        acc.totalRendimento += preco;
        acc.totalCusto += custoProduto;
        acc.totalLucro += preco - custoProduto;

        return acc;
      },
      { totalRendimento: 0, totalCusto: 0, totalLucro: 0 }
    );
  }, [appointments]);

  // Função para enviar o lembrete via WhatsApp
  const enviarLembreteWhatsApp = (appt: Appointment) => {
    const nomeCliente = appt.cliente || appt.clientName || 'Cliente';
    const horario = appt.hora || appt.time || 'horário agendado';
    const procedimento = appt.procedimento || appt.procedure || 'atendimento';

    const texto = `Olá, ${nomeCliente}! 👋 Passando para lembrar do seu agendamento de *${procedimento}* hoje às *${horario}*. Podemos confirmar? ✨`;
    const mensagemEncoded = encodeURIComponent(texto);

    const numeroTelefone = appt.telefone ? appt.telefone.replace(/\D/g, '') : '';
    const url = numeroTelefone
      ? `https://wa.me/${numeroTelefone}?text=${mensagemEncoded}`
      : `https://wa.me/?text=${mensagemEncoded}`;

    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3.5 px-5 py-10 text-center">
        <p className="text-[13px] text-muted-foreground">Carregando atendimentos...</p>
      </div>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3.5 px-5 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CalendarX size={22} className="text-primary" />
        </div>
        <h4 className="font-display text-[19px] font-semibold text-foreground">
          Nenhum agendamento
        </h4>
        <p className="max-w-[240px] text-[13px] text-muted-foreground">
          Selecione um dia com marcação no calendário ao lado para ver os detalhes aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Resumo Financeiro Compacto */}
      <div className="mb-5 flex rounded-xl border border-border bg-card p-4">
        <div className="flex flex-1 flex-col items-center gap-1.5 border-r border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bruto
          </span>
          <strong className="font-display text-xl font-bold text-foreground">
            € {totals.totalRendimento.toFixed(2)}
          </strong>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5 border-r border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Custo
          </span>
          <strong className="font-display text-xl font-bold text-rose-500">
            € {totals.totalCusto.toFixed(2)}
          </strong>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Lucro
          </span>
          <strong className="font-display text-xl font-bold text-emerald-500">
            € {totals.totalLucro.toFixed(2)}
          </strong>
        </div>
      </div>

      {/* Lista de Atendimentos */}
      <div className="flex flex-col gap-2.5">
        {appointments.map((appt, index) => {
          const valor = parseMoeda(appt.valor ?? appt.price ?? 0);
          const cliente = appt.cliente || appt.clientName || 'Cliente';
          const procedimento = appt.procedimento || appt.procedure;
          const hora = appt.hora || appt.time;

          return (
            <div
              key={appt.id || index}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-center gap-3.5">
                {hora && (
                  <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {hora}
                  </span>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-foreground">{cliente}</strong>
                    {appt.origem === 'google' && (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-500">
                        Google / TimeTree
                      </span>
                    )}
                  </div>
                  {procedimento && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles size={11} className="text-primary" />
                      {procedimento}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-display text-base font-bold text-foreground">
                  € {valor.toFixed(2)}
                </span>

                {appt.origem !== 'google' && appt.id && (
                  appt.pago ? (
                    <span className="flex h-8 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-500">
                      <CheckCircle2 size={13} /> Pago
                    </span>
                  ) : (
                    <Button
                      onClick={() => abrirPagamento(appt)}
                      size="sm"
                      className="h-8 gap-1.5 px-2.5 font-semibold"
                      title="Marcar como pago"
                    >
                      <Euro size={14} />
                      <span className="hidden text-xs sm:inline">Pago</span>
                    </Button>
                  )
                )}

                <Button
                  onClick={() => enviarLembreteWhatsApp(appt)}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-emerald-500/30 px-2.5 font-semibold text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  title="Enviar lembrete pelo WhatsApp"
                >
                  <MessageCircle size={14} />
                  <span className="hidden text-xs sm:inline">Lembrete</span>
                </Button>

                {/* Botão Editar (Apenas para agendamentos do Supabase) */}
                {onEdit && appt.origem !== 'google' && (
                  <Button
                    onClick={() => onEdit(appt)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Editar agendamento"
                  >
                    <Pencil size={14} />
                  </Button>
                )}

                {/* Botão Excluir (Apenas para agendamentos do Supabase) */}
                {onDelete && appt.id && appt.origem !== 'google' && (
                  <Button
                    onClick={() => onDelete(appt.id!, appt.origem)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                    title="Excluir agendamento"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RegistoPagamentoRapido
        open={pagamentoAberto}
        onOpenChange={setPagamentoAberto}
        agendamento={agendamentoParaPagar}
        onSuccess={() => onPago?.()}
      />
    </div>
  );
};

export default ListaAgendamentos;