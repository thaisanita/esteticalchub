import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Trash2, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, FileText, Banknote, CreditCard, Smartphone, Landmark } from 'lucide-react';
import { parseMoeda, cn } from '@/lib/utils';

interface AgendamentoRel {
  id?: string | number;
  cliente?: string;
  procedimento?: string;
  data?: string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
  valor?: number | string;
  preco?: number | string;
  pago?: boolean;
  forma_pagamento?: string | null;
}

interface Fechamento {
  id: string | number;
  data_referencia?: string;
  data?: string;
  local?: string;
  lucro_liquido?: number | string;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const Relatorios = () => {
  const [abaRelatorio, setAbaRelatorio] = useState<'anual' | 'mensal'>('mensal');
  const [agendamentos, setAgendamentos] = useState<AgendamentoRel[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [filtroLocal, setFiltroLocal] = useState('TODOS');
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const [mesRelatorio, setMesRelatorio] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const [anoRelatorio, setAnoRelatorio] = useState(String(hoje.getFullYear()));
  const [custosFixosMes, setCustosFixosMes] = useState(0);
  const [custosVariaveisMes, setCustosVariaveisMes] = useState(0);

  useEffect(() => {
    fetchDados();
  }, []);

  useEffect(() => {
    const buscarDespesasDoMes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const prefixo = `${anoRelatorio}-${mesRelatorio}`;

      const { data: fixos } = await supabase
        .from('custos_fixos')
        .select('valor_mensal, ativo')
        .eq('usuario_id', user.id);
      const totalFixos = (fixos || [])
        .filter((c) => c.ativo)
        .reduce((acc, c) => acc + parseMoeda(c.valor_mensal), 0);
      setCustosFixosMes(totalFixos);

      const { data: variaveis } = await supabase
        .from('se_custos')
        .select('valor, data_vencimento, data_pagamento')
        .eq('usuario_id', user.id);
      const totalVariaveis = (variaveis || [])
        .filter((c) => (c.data_vencimento || c.data_pagamento || '').startsWith(prefixo))
        .reduce((acc, c) => acc + parseMoeda(c.valor), 0);
      setCustosVariaveisMes(totalVariaveis);
    };
    buscarDespesasDoMes();
  }, [mesRelatorio, anoRelatorio]);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [resAg, resFech] = await Promise.all([
        // CORRIGIDO: usava 'user_id', alterado para 'usuario_id'
        supabase.from('agendamentos').select('*').eq('usuario_id', user.id),
        supabase
          .from('fechamentos')
          .select('*')
          .eq('usuario_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setAgendamentos(resAg.data || []);
      setFechamentos(resFech.data || []);
    } catch (e) {
      console.error('Erro ao carregar:', e);
    } finally {
      setLoading(false);
    }
  };

  const excluirFechamento = async (id: string | number) => {
    if (window.confirm('Deseja remover este registro?')) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('fechamentos')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user.id);
      if (!error) setFechamentos((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const locaisDisponiveis = useMemo(() => {
    const locais = agendamentos
      .map((ag) => ag.ponto_atendimento || ag.pontoAtendimento)
      .filter((p): p is string => Boolean(p));
    return ['TODOS', ...new Set(locais)];
  }, [agendamentos]);

  const resumoDados = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const mesAtualIdx = new Date().getMonth();
    let brutoTotalAno = 0;
    let lucroRealAcumulado = 0;
    let brutoTotalFechado = 0;
    const ganhosPorMes: Record<string, number> = {};

    agendamentos.forEach((ag) => {
      const dataStr = ag.data;
      if (dataStr && dataStr.startsWith(anoAtual.toString())) {
        const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
        if (filtroLocal === 'TODOS' || localAg === filtroLocal) {
          const partes = dataStr.split('-');
          const mesAg = parseInt(partes[1], 10) - 1;

          const valor = parseMoeda(ag.valor ?? ag.preco ?? 0);

          if (mesAg >= 0 && mesAg < 12) {
            ganhosPorMes[MESES[mesAg]] = (ganhosPorMes[MESES[mesAg]] || 0) + valor;
            brutoTotalAno += valor;
          }
        }
      }
    });

    fechamentos.forEach((f) => {
      const dataF = f.data_referencia || f.data;
      if (dataF && dataF.startsWith(anoAtual.toString())) {
        if (filtroLocal === 'TODOS' || f.local === filtroLocal) {
          lucroRealAcumulado += parseMoeda(f.lucro_liquido || 0);
          brutoTotalFechado += parseMoeda(f.faturamento_bruto || 0);
        }
      }
    });

    const chartData = MESES.map((mes) => ({ mes, ganho: ganhosPorMes[mes] || 0 }));

    const ganhoMesAtual = ganhosPorMes[MESES[mesAtualIdx]] || 0;
    const ganhoMesAnterior = mesAtualIdx > 0 ? ganhosPorMes[MESES[mesAtualIdx - 1]] || 0 : 0;
    const variacao =
      ganhoMesAnterior > 0 ? ((ganhoMesAtual - ganhoMesAnterior) / ganhoMesAnterior) * 100 : 0;

    return { chartData, brutoTotalAno, lucroRealAcumulado, brutoTotalFechado, variacao };
  }, [agendamentos, fechamentos, filtroLocal]);

  const relatorioMensal = useMemo(() => {
    const prefixo = `${anoRelatorio}-${mesRelatorio}`;
    const atendimentos = agendamentos
      .filter((ag) => {
        if (!ag.data || !ag.data.startsWith(prefixo)) return false;
        const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
        return filtroLocal === 'TODOS' || localAg === filtroLocal;
      })
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    const totalFaturado = atendimentos.reduce((acc, ag) => acc + parseMoeda(ag.valor ?? ag.preco ?? 0), 0);

    const porForma: Record<string, number> = { dinheiro: 0, cartao: 0, mbway: 0, transferencia: 0, nao_registado: 0 };
    atendimentos.forEach((ag) => {
      const valor = parseMoeda(ag.valor ?? ag.preco ?? 0);
      const chave = ag.pago && ag.forma_pagamento ? ag.forma_pagamento : 'nao_registado';
      porForma[chave] = (porForma[chave] || 0) + valor;
    });

    const totalDespesas = custosFixosMes + custosVariaveisMes;

    return {
      atendimentos,
      totalFaturado,
      porForma,
      totalDespesas,
      lucroEstimado: totalFaturado - totalDespesas,
    };
  }, [agendamentos, filtroLocal, mesRelatorio, anoRelatorio, custosFixosMes, custosVariaveisMes]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground">Carregando...</div>
    );
  }

  // Margem calculada só sobre os dias já fechados (mesma base do lucro),
  // para não dividir lucro de uma fração pelo faturamento do ano inteiro.
  const margemLucro =
    resumoDados.brutoTotalFechado > 0
      ? (resumoDados.lucroRealAcumulado / resumoDados.brutoTotalFechado) * 100
      : 0;

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Seletor de abas */}
      <div className="no-print mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setAbaRelatorio('mensal')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
            abaRelatorio === 'mensal'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText size={15} /> Relatório Mensal
        </button>
        <button
          onClick={() => setAbaRelatorio('anual')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
            abaRelatorio === 'anual'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingUp size={15} /> Dashboard Anual
        </button>
      </div>

      {abaRelatorio === 'mensal' && (
        <div>
          <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display relative pb-3.5 text-[32px] font-semibold text-foreground">
                Relatório Mensal
              </h2>
              <div className="-mt-3 h-0.5 w-14 bg-gradient-to-r from-primary to-primary-hover" />
            </div>
            <div className="flex gap-2.5">
              <Select value={mesRelatorio} onValueChange={setMesRelatorio}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anoRelatorio} onValueChange={setAnoRelatorio}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => window.print()} variant="outline" className="gap-2">
                <Printer size={14} />
                Imprimir
              </Button>
            </div>
          </div>

          <div className="print:block">
            <h3 className="hidden font-display text-2xl font-bold text-foreground print:block print:mb-4">
              Relatório de {MESES[parseInt(mesRelatorio, 10) - 1]} de {anoRelatorio}
            </h3>

            {/* Cartões-resumo */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 print:border print:shadow-none">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Faturado</p>
                <p className="font-display text-xl font-bold text-foreground">€ {relatorioMensal.totalFaturado.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 print:border print:shadow-none">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Despesas</p>
                <p className="font-display text-xl font-bold text-foreground">€ {relatorioMensal.totalDespesas.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-success/25 bg-success/5 p-5 print:border print:shadow-none">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-success">Lucro Estimado</p>
                <p className="font-display text-xl font-bold text-success">€ {relatorioMensal.lucroEstimado.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 print:border print:shadow-none">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Atendimentos</p>
                <p className="font-display text-xl font-bold text-foreground">{relatorioMensal.atendimentos.length}</p>
              </div>
            </div>

            {/* Formas de pagamento */}
            <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20 print:border print:shadow-none">
              <h3 className="mb-4 text-sm font-bold text-foreground">Recebido por Forma de Pagamento</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { chave: 'dinheiro', label: 'Dinheiro', Icone: Banknote },
                  { chave: 'cartao', label: 'Cartão', Icone: CreditCard },
                  { chave: 'mbway', label: 'MBWay', Icone: Smartphone },
                  { chave: 'transferencia', label: 'Transferência', Icone: Landmark },
                  { chave: 'nao_registado', label: 'Não registado', Icone: FileText },
                ].map(({ chave, label, Icone }) => (
                  <div key={chave} className="rounded-xl border border-border p-3 text-center">
                    <Icone size={16} className="mx-auto mb-1.5 text-primary" />
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-foreground">€ {(relatorioMensal.porForma[chave] || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ficha de atendimentos do mês — pronta para registar nas Finanças */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20 print:border print:shadow-none">
              <h3 className="mb-4 text-sm font-bold text-foreground">
                Atendimentos de {MESES[parseInt(mesRelatorio, 10) - 1]}
              </h3>
              <div className="max-h-[400px] overflow-y-auto rounded-xl border border-border print:max-h-none print:overflow-visible">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-card print:static">
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Procedimento</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioMensal.atendimentos.map((ag, i) => (
                      <tr key={ag.id ?? i} className="border-b border-border last:border-none">
                        <td className="px-4 py-3 text-foreground">{ag.data}</td>
                        <td className="px-4 py-3 text-foreground">{ag.cliente || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ag.procedimento || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ag.pago && ag.forma_pagamento
                            ? { dinheiro: 'Dinheiro', cartao: 'Cartão', mbway: 'MBWay', transferencia: 'Transferência' }[ag.forma_pagamento] || ag.forma_pagamento
                            : 'Não registado'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          € {parseMoeda(ag.valor ?? ag.preco ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {relatorioMensal.atendimentos.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                          Nenhum atendimento neste mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {abaRelatorio === 'anual' && (
      <div className="no-print">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display relative pb-3.5 text-[32px] font-semibold text-foreground">
              Dashboard Anual
            </h2>
            <div className="-mt-3 h-0.5 w-14 bg-gradient-to-r from-primary to-primary-hover" />
          </div>
          <div className="flex gap-2.5">
            <Select value={filtroLocal} onValueChange={setFiltroLocal}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locaisDisponiveis.map((local) => (
                  <SelectItem key={local} value={local}>
                    {local}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => window.print()} variant="outline" className="gap-2">
              <Printer size={14} />
              Imprimir
            </Button>
          </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Wallet size={17} className="text-muted-foreground" />
              </div>
            </div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Faturamento Bruto (Ano)
            </p>
            <p className="font-display text-[28px] font-bold text-foreground">
              € {resumoDados.brutoTotalAno.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl border border-success/25 bg-success/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp size={17} className="text-success" />
              </div>
              {resumoDados.variacao !== 0 && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                    resumoDados.variacao > 0
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  }`}
                >
                  {resumoDados.variacao > 0 ? (
                    <ArrowUpRight size={12} />
                  ) : (
                    <ArrowDownRight size={12} />
                  )}
                  {Math.abs(resumoDados.variacao).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-success">
              Lucro Líquido (Ano)
            </p>
            <p className="font-display text-[28px] font-bold text-success">
              € {resumoDados.lucroRealAcumulado.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <span className="font-display text-sm font-bold text-primary">%</span>
              </div>
            </div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margem de Lucro (dias fechados)
            </p>
            <p className="font-display text-[28px] font-bold text-foreground">
              {margemLucro.toFixed(1)}%
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Calculada só sobre os dias já fechados na página de Comissão
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Evolução Mensal</h3>
              <p className="text-[11px] text-muted-foreground">Faturamento por mês, ano atual</p>
            </div>
          </div>
          <div className="w-full" style={{ height: 380, minHeight: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resumoDados.chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="corGanho" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181C24',
                    border: '1px solid #262B36',
                    borderRadius: 10,
                    fontSize: 12,
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: '#FFFFFF', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: '#8B5CF6' }}
                  formatter={(value: number) => [`€ ${value.toFixed(2)}`, 'Faturamento']}
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="ganho"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fill="url(#corGanho)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="secao-impressao rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
        <h3 className="mb-4 text-sm font-bold text-foreground">
          Histórico {filtroLocal !== 'TODOS' && `— ${filtroLocal}`}
        </h3>
        <div className="max-h-[350px] overflow-y-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Data
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Local
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor
                </th>
                <th className="no-print px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {fechamentos
                .filter((f) => filtroLocal === 'TODOS' || f.local === filtroLocal)
                .map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border transition-colors last:border-none hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {f.data_referencia || f.data}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{f.local}</td>
                    <td className="px-4 py-3 font-bold text-success">
                      € {parseFloat(String(f.lucro_liquido || 0)).toFixed(2)}
                    </td>
                    <td className="no-print px-4 py-3 text-center">
                      <button
                        onClick={() => excluirFechamento(f.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2.5 py-1.5 text-[10px] font-semibold text-danger transition-colors hover:bg-danger/20"
                      >
                        <Trash2 size={11} />
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              {fechamentos.filter((f) => filtroLocal === 'TODOS' || f.local === filtroLocal)
                .length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    Nenhum fechamento registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};

export default Relatorios;