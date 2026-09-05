import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getErrorMessage, parseMoeda, cn } from '@/lib/utils';
import { Banknote, CreditCard, Smartphone, Landmark, Check } from 'lucide-react';

export interface AgendamentoParaPagar {
  id: string | number;
  cliente: string;
  preco?: number | string;
  valor?: number | string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Se vier preenchido, marca-se ESTE agendamento como pago. Se vier vazio, cria-se um novo registo rápido. */
  agendamento?: AgendamentoParaPagar | null;
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', Icone: Banknote },
  { value: 'cartao', label: 'Cartão', Icone: CreditCard },
  { value: 'mbway', label: 'MBWay', Icone: Smartphone },
  { value: 'transferencia', label: 'Transferência', Icone: Landmark },
] as const;

export default function RegistoPagamentoRapido({ open, onOpenChange, onSuccess, agendamento }: Props) {
  const modoNovo = !agendamento;

  const [cliente, setCliente] = useState('');
  const [clientesDb, setClientesDb] = useState<{ id: string; nome: string }[]>([]);
  const [preco, setPreco] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<string>('dinheiro');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (agendamento) {
      setCliente(agendamento.cliente || '');
      setPreco(String(agendamento.preco ?? agendamento.valor ?? ''));
    } else {
      setCliente('');
      setPreco('');
    }
    setFormaPagamento('dinheiro');

    if (modoNovo) {
      supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true })
        .then(({ data }) => setClientesDb(data || []));
    }
  }, [open, agendamento, modoNovo]);

  const sugestoes = cliente.trim()
    ? clientesDb.filter((c) => c.nome.toLowerCase().includes(cliente.trim().toLowerCase())).slice(0, 5)
    : [];

  const handleConfirmar = async () => {
    const valorNumerico = parseMoeda(preco);
    if (!cliente.trim() || valorNumerico <= 0) {
      alert('Preenche o nome da cliente e um valor válido.');
      return;
    }

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      if (agendamento) {
        // Modo: marcar agendamento existente como pago
        const { error } = await supabase
          .from('agendamentos')
          .update({
            pago: true,
            forma_pagamento: formaPagamento,
            pago_em: new Date().toISOString(),
            preco: valorNumerico,
            valor: valorNumerico,
          })
          .eq('id', agendamento.id);
        if (error) throw error;
      } else {
        // Modo: novo registo rápido (ex: cliente sem agendamento prévio)
        const agora = new Date();
        const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
        const dataHoje = agora.toISOString().split('T')[0];

        // Resolve ou cria a cliente pelo nome, para já entrar ligada por ID
        let clienteId: string | null = null;
        const { data: existente } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', cliente.trim())
          .maybeSingle();

        if (existente) {
          clienteId = existente.id;
        } else {
          const { data: novaCliente } = await supabase
            .from('clientes')
            .insert([{ nome: cliente.trim() }])
            .select('id')
            .single();
          if (novaCliente) clienteId = novaCliente.id;
        }

        const { error } = await supabase.from('agendamentos').insert([{
          cliente: cliente.trim(),
          cliente_id: clienteId,
          procedimento: 'Atendimento rápido',
          data: dataHoje,
          hora,
          preco: valorNumerico,
          valor: valorNumerico,
          pago: true,
          forma_pagamento: formaPagamento,
          pago_em: agora.toISOString(),
          usuario_id: user.id,
        }]);
        if (error) throw error;
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      alert('Erro ao registar pagamento: ' + getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{modoNovo ? 'Registar Pagamento Rápido' : 'Marcar como Pago'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {modoNovo ? (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </label>
              <Input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome da cliente"
                autoFocus
              />
              {sugestoes.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-card overflow-hidden">
                  {sugestoes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCliente(c.nome)}
                      className="px-3 py-2 text-left text-[13px] hover:bg-primary/5 transition-colors"
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Cliente</p>
              <p className="text-base font-semibold text-foreground">{cliente}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Valor Recebido (€)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
              className="text-lg font-bold text-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_PAGAMENTO.map(({ value, label, Icone }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormaPagamento(value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                    formaPagamento === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  )}
                >
                  <Icone size={16} />
                  {label}
                  {formaPagamento === value && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleConfirmar} disabled={salvando} className="w-full">
            {salvando ? 'A guardar...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
