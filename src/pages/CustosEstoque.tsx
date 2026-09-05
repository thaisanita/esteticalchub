import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Receipt, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert,
  Search,
  Calendar,
  Trash2,
  Check
} from 'lucide-react';

interface Custo {
  id: string;
  titulo: string;
  categoria: string;
  valor: number;
  data_pagamento: string | null;
  data_vencimento: string | null;
  status: string;
}

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export default function CustosEstoque() {
  const dataHoje = new Date();
  const mesAtualStr = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const anoAtualStr = String(dataHoje.getFullYear());

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtualStr);

  const [custos, setCustos] = useState<Custo[]>([]);
  const [faturamentoMes, setFaturamentoMes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  // Estados do Formulário
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('material_estoque');
  const [valor, setValor] = useState('');
  const [dataPagamento, setDataPagamento] = useState(dataHoje.toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState('');
  const [status, setStatus] = useState('pago');
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Buscar Custos no Banco
    let queryCustos = supabase.from('se_custos').select('*');
    if (user) {
      queryCustos = queryCustos.or(`usuario_id.eq.${user.id},usuario_id.is.null`);
    }

    const { data: dataCustos, error: erroCustos } = await queryCustos.order('created_at', { ascending: false });

    if (!erroCustos && dataCustos) {
      setCustos(dataCustos);
    }

    // 2. Buscar Faturamento do Mês/Ano Selecionado
    const prefixoMesAno = `${anoSelecionado}-${mesSelecionado}`;
    let totalCalculado = 0;

    // Fechamentos
    let queryFechamentos = supabase.from('fechamentos').select('faturamento_bruto, lucro_liquido, data_referencia, data');
    if (user) {
      queryFechamentos = queryFechamentos.or(`usuario_id.eq.${user.id},usuario_id.is.null`);
    }

    const { data: fechamentos } = await queryFechamentos;

    if (fechamentos) {
      const fechamentosDoMes = fechamentos.filter((f) => {
        const d = f.data_referencia || f.data || '';
        return d.startsWith(prefixoMesAno);
      });

      totalCalculado = fechamentosDoMes.reduce(
        (acc, item) => acc + Number(item.faturamento_bruto || item.lucro_liquido || 0),
        0
      );
    }

    // Agendamentos
    let queryAgendamentos = supabase.from('agendamentos').select('valor, preco, data');
    if (user) {
      queryAgendamentos = queryAgendamentos.or(`usuario_id.eq.${user.id},usuario_id.is.null`);
    }

    const { data: agendamentos } = await queryAgendamentos;

    if (agendamentos) {
      const agendamentosDoMes = agendamentos.filter((a) => a.data && a.data.startsWith(prefixoMesAno));

      const somaAgendamentos = agendamentosDoMes.reduce((acc, item) => {
        const valRaw = item.valor ?? item.preco ?? 0;
        const val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw).replace(',', '.')) || 0;
        return acc + val;
      }, 0);

      if (somaAgendamentos > totalCalculado) {
        totalCalculado = somaAgendamentos;
      }
    }

    setFaturamentoMes(totalCalculado);
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, [mesSelecionado, anoSelecionado]);

  const handleSalvarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !valor) return;
    setSalvando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('se_custos').insert([
        {
          titulo: titulo.trim(),
          categoria,
          valor: parseFloat(valor),
          data_pagamento: status === 'pago' ? (dataPagamento || new Date().toISOString().split('T')[0]) : null,
          data_vencimento: dataVencimento || null,
          status,
          usuario_id: user?.id || null
        },
      ]);

      if (!error) {
        setTitulo('');
        setValor('');
        setDataVencimento('');
        carregarDados();
      } else {
        alert('Erro ao salvar despesa: ' + error.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleMarcarComoPago = async (id: string) => {
    const hojeStr = new Date().toISOString().split('T')[0];

    setCustos((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'pago', data_pagamento: c.data_pagamento || hojeStr } : c
      )
    );

    try {
      const { error } = await supabase
        .from('se_custos')
        .update({
          status: 'pago',
          data_pagamento: hojeStr
        })
        .eq('id', id);

      if (error) carregarDados();
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      carregarDados();
    }
  };

  const handleExcluirCusto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    try {
      const { error } = await supabase.from('se_custos').delete().eq('id', id);
      if (!error) {
        setCustos((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  const formatarDataLegivel = (dataStr: string) => {
    if (!dataStr) return '';
    const apenasData = dataStr.split('T')[0];
    const [ano, mes, dia] = apenasData.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Filtra os custos com base no Mês e Ano Selecionados
  const prefixoMesAnoSelecionado = `${anoSelecionado}-${mesSelecionado}`;

  const custosDoMesSelecionado = custos.filter((c) => {
    const dataRef = c.data_vencimento || c.data_pagamento || '';
    if (!dataRef) return true;
    return dataRef.startsWith(prefixoMesAnoSelecionado);
  });

  // Cálculos Financeiros do Mês Selecionado
  const totalCustosMes = custosDoMesSelecionado
    .filter((c) => c.status === 'pago')
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const contasPendentes = custosDoMesSelecionado.filter((c) => c.status === 'pendente');
  const totalPendente = contasPendentes.reduce((acc, c) => acc + Number(c.valor), 0);

  const lucroLiquido = faturamentoMes - totalCustosMes;

  const custosFiltrados = custosDoMesSelecionado.filter(
    (c) =>
      c.titulo.toLowerCase().includes(filtro.toLowerCase()) ||
      c.categoria.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Seleção de Mês e Ano */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Seletores de Mês e Ano */}
        <div className="flex items-center gap-2">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
            <SelectTrigger className="w-[85px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Receipt size={18} />
          </div>
        </div>
      </div>

      {/* Cards de Resumo de Caixa e Reserva */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Entradas (Faturamento) */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp size={14} className="text-emerald-500" />
            Faturado em {MESES.find((m) => m.value === mesSelecionado)?.label}
          </span>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-foreground">
              € {faturamentoMes.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Custos Totais Pagos */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingDown size={14} className="text-rose-500" />
            Custos & Insumos Pagos
          </span>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-rose-500">
              € {totalCustosMes.toFixed(2)}
            </span>
            {totalPendente > 0 && (
              <p className="mt-1 text-[10px] font-medium text-amber-500">
                + € {totalPendente.toFixed(2)} pendente de vencimento
              </p>
            )}
          </div>
        </div>

        {/* Lucro Real */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-lg shadow-black/10">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            <ShieldAlert size={14} />
            Lucro Líquido Real
          </span>
          <div className="mt-3">
            <span className={`text-2xl font-extrabold ${lucroLiquido >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              € {lucroLiquido.toFixed(2)}
            </span>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Guarde ao menos 20% (€ {(lucroLiquido > 0 ? lucroLiquido * 0.2 : 0).toFixed(2)}) para emergências/impostos
            </p>
          </div>
        </div>
      </div>

      {/* Formulário de Cadastro de Despesas/Materiais */}
      <form
        onSubmit={handleSalvarCusto}
        className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Plus size={14} className="text-primary" />
          Registrar Custo, Compra ou Conta
        </span>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Item / Descrição (ex: Segurança Social, Lâminas)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="h-10 bg-background/50 text-xs"
            required
          />

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-10 rounded-md border border-border bg-background/50 px-3 text-xs font-medium text-foreground focus:outline-none"
          >
            <option value="material_estoque">Material / Insumos de Estoque</option>
            <option value="fixo_recorrente">Custo Fixo (Segurança Social, Renda)</option>
            <option value="imposto_taxa">Imposto / Licenças / Seguros</option>
            <option value="equipamento">Equipamento / Manutenção</option>
          </select>

          <Input
            type="number"
            step="0.01"
            placeholder="Valor (€)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-10 bg-background/50 text-xs font-semibold text-rose-500"
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Data do Pagamento/Compra</label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="h-9 bg-background/50 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Data de Vencimento (se houver)</label>
            <Input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="h-9 bg-background/50 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Status do Pagamento</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-border bg-background/50 px-3 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="pago">Já Pago</option>
              <option value="pendente">Pendente / A Vencer</option>
            </select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={salvando}
          className="h-9 w-full bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-95"
        >
          {salvando ? 'A guardar...' : 'Adicionar Despesa'}
        </Button>
      </form>

      {/* Lista de Registros */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">
            Contas de {MESES.find((m) => m.value === mesSelecionado)?.label} / {anoSelecionado}
          </span>
          <div className="relative w-48 sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar custo..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-9 border-border bg-background/50 pl-8 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">A carregar despesas...</p>
        ) : custosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhum registo de despesa encontrado para este mês.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {custosFiltrados.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    item.status === 'pago' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {item.status === 'pago' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.titulo}</p>
                    <p className="flex items-center gap-2 text-[10px] font-medium capitalize text-muted-foreground">
                      <span>{item.categoria.replace('_', ' ')}</span>
                      {item.data_vencimento && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Calendar size={10} /> Vence: {formatarDataLegivel(item.data_vencimento)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.status === 'pendente' && (
                    <button
                      type="button"
                      onClick={() => handleMarcarComoPago(item.id)}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
                      title="Marcar conta como paga"
                    >
                      <Check size={12} />
                      Marcar Pago
                    </button>
                  )}

                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-500">
                      - € {Number(item.valor).toFixed(2)}
                    </span>
                    <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      item.status === 'pago' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>
                      {item.status}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExcluirCusto(item.id)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    title="Excluir custo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}