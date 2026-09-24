// Visão geral: o crescimento do negócio "ao vivo". Compara sempre o mesmo
// período (mês atual até hoje vs mês passado até ao mesmo dia), para a
// comparação ser justa a meio do mês, e atualiza sozinha quando entra um
// agendamento, cliente ou lead novo (Supabase Realtime + verificação a cada
// minuto como reserva).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Euro,
  CalendarCheck,
  Receipt,
  UserPlus,
  Target,
  RefreshCw,
  Inbox,
  UserX,
  Clock,
  Sparkles,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../supabase';
import { parseMoeda, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  calcularVisao,
  isoLocal,
  DIAS_CLIENTE_EM_RISCO,
  type Atendimento,
  type Dados,
} from '@/lib/visaoGeral';

const COR = '#8B5CF6';
const TOOLTIP_STYLE = {
  backgroundColor: '#181C24',
  border: '1px solid #262B36',
  borderRadius: 10,
  fontSize: 12,
  padding: '8px 12px',
};

const euro = (n: number) =>
  `€ ${n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Vai buscar todas as linhas, mesmo passando o limite de 1000 por pedido. */
async function buscarTodosAtendimentos(desde: string, usuarioId: string): Promise<Atendimento[]> {
  const todos: Atendimento[] = [];
  const TAMANHO = 1000;
  for (let inicio = 0; inicio < 20000; inicio += TAMANHO) {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('id, data, hora, valor, preco, cliente_id, cliente, procedimento')
      .eq('usuario_id', usuarioId)
      .gte('data', desde)
      .order('data', { ascending: true })
      .range(inicio, inicio + TAMANHO - 1);
    if (error || !data) break;
    for (const a of data) {
      if (!a.data) continue;
      todos.push({
        id: String(a.id),
        data: String(a.data).slice(0, 10),
        hora: a.hora ?? null,
        valor: parseMoeda(a.valor ?? a.preco ?? 0),
        cliente_id: a.cliente_id ?? null,
        cliente: a.cliente || 'Cliente',
        procedimento: a.procedimento || 'Sem procedimento',
      });
    }
    if (data.length < TAMANHO) break;
  }
  return todos;
}

function Variacao({
  atual,
  anterior,
  className,
  rotulo = 'vs mesmo período do mês passado',
}: {
  atual: number;
  anterior: number;
  className?: string;
  rotulo?: string;
}) {
  if (anterior === 0 && atual === 0) {
    return <span className={cn('flex items-center gap-1 text-[11px] text-muted-foreground', className)}><Minus size={12} /> sem dados no período anterior</span>;
  }
  if (anterior === 0) {
    return <span className={cn('flex items-center gap-1 text-[11px] font-semibold text-emerald-500', className)}><TrendingUp size={12} /> novo (sem período anterior)</span>;
  }
  const pct = ((atual - anterior) / anterior) * 100;
  const sobe = pct > 0.05;
  const desce = pct < -0.05;
  const Icone = sobe ? TrendingUp : desce ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold',
        sobe ? 'text-emerald-500' : desce ? 'text-rose-500' : 'text-muted-foreground',
        className
      )}
    >
      <Icone size={12} />
      {sobe ? '+' : ''}
      {pct.toFixed(1)}% {rotulo}
    </span>
  );
}

function CartaoKpi({
  titulo,
  valor,
  Icone,
  children,
}: {
  titulo: string;
  valor: string;
  Icone: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-lg shadow-black/10">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icone size={14} />
        </span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-foreground">{valor}</p>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

export default function VisaoGeral() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aoVivo, setAoVivo] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hoje = new Date();
    const janela = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const desde7d = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [atendimentos, custos, clientes, meta, quadro] = await Promise.all([
      buscarTodosAtendimentos(isoLocal(janela), user.id),
      supabase.from('custos_fixos').select('valor_mensal, ativo'),
      supabase.from('clientes').select('criado_em').gte('criado_em', inicioMesAnterior.toISOString()),
      supabase
        .from('metas_mensais')
        .select('meta')
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle(),
      supabase.from('quadros_kanban').select('id').eq('nome', 'Leads').limit(1).maybeSingle(),
    ]);

    // Leads dos últimos 7 dias (quadro "Leads" criado pela página pública)
    let leads7d = 0;
    if (quadro.data?.id) {
      const { data: listas } = await supabase.from('listas_kanban').select('id').eq('quadro_id', quadro.data.id);
      const ids = (listas ?? []).map((l) => l.id);
      if (ids.length) {
        const { count } = await supabase
          .from('cartoes_kanban')
          .select('id', { count: 'exact', head: true })
          .in('lista_id', ids)
          .gte('criado_em', desde7d);
        leads7d = count ?? 0;
      }
    }

    const listaClientes = clientes.data ?? [];
    setDados({
      atendimentos,
      custosFixosMensais: (custos.data ?? [])
        .filter((c) => c.ativo)
        .reduce((acc, c) => acc + Number(c.valor_mensal || 0), 0),
      clientesNovasMes: listaClientes.filter((c) => new Date(c.criado_em) >= inicioMesAtual).length,
      clientesNovasMesAnterior: listaClientes.filter((c) => new Date(c.criado_em) < inicioMesAtual).length,
      leads7d,
      metaAtendimentos: meta.data?.meta ?? 30,
    });
    setAtualizadoEm(new Date());
    setCarregando(false);
  }, []);

  // Atualização ao vivo: alterações na base de dados + verificação a cada minuto
  useEffect(() => {
    carregar();

    const agendarRecarga = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(carregar, 800);
    };

    const canal = supabase.channel('visao-geral');
    for (const tabela of ['agendamentos', 'clientes', 'cartoes_kanban', 'custos_fixos']) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, agendarRecarga);
    }
    canal.subscribe((estado) => setAoVivo(estado === 'SUBSCRIBED'));

    const minuto = setInterval(carregar, 60_000);
    const aoVoltar = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      clearInterval(minuto);
      document.removeEventListener('visibilitychange', aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const calc = useMemo(() => (dados ? calcularVisao(dados) : null), [dados]);

  if (carregando || !dados || !calc) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar a visão geral...
      </div>
    );
  }

  const variacaoTotal = calc.fatAntMesmoPeriodo
    ? ((calc.fatAteHoje - calc.fatAntMesmoPeriodo) / calc.fatAntMesmoPeriodo) * 100
    : null;
  const cobreCustos = calc.fatMesTotal >= dados.custosFixosMensais;
  const pctCustos = dados.custosFixosMensais > 0 ? Math.min((calc.fatMesTotal / dados.custosFixosMensais) * 100, 100) : 0;
  const nMes = calc.nAteHoje + calc.nAgendado;
  const pctMeta = Math.min(Math.round((nMes / dados.metaAtendimentos) * 100), 100);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[30px] font-semibold text-foreground">Visão geral</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">O crescimento do seu negócio, em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold',
              aoVivo
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-border bg-card text-muted-foreground'
            )}
            title={aoVivo ? 'Atualiza no instante em que algo muda' : 'Atualiza a cada minuto'}
          >
            <span className={cn('h-2 w-2 rounded-full', aoVivo ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground')} />
            {aoVivo ? 'Ao vivo' : 'Atualiza a cada minuto'}
            {atualizadoEm && (
              <span className="font-normal opacity-80">
                · {atualizadoEm.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </span>
          <Button variant="outline" size="icon" onClick={carregar} title="Atualizar agora" className="h-9 w-9">
            <RefreshCw size={15} />
          </Button>
        </div>
      </header>

      {/* Resumo do crescimento */}
      {calc.totalGeral === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <Sparkles size={26} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Ainda não há atendimentos para mostrar.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Assim que criar o primeiro agendamento, esta página começa a mostrar o crescimento do negócio.
          </p>
          <Button onClick={() => navigate('/novo-agendamento')} className="gap-1.5">
            <Plus size={14} /> Criar agendamento
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium',
            variacaoTotal === null
              ? 'border-border bg-card text-muted-foreground'
              : variacaoTotal >= 0
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
              : 'border-rose-500/30 bg-rose-500/5 text-rose-500'
          )}
        >
          {variacaoTotal !== null && variacaoTotal < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          {variacaoTotal === null
            ? `Faturou ${euro(calc.fatAteHoje)} este mês até hoje. Ainda não há mês anterior para comparar.`
            : `Até ao dia ${calc.diaHoje}, está ${Math.abs(variacaoTotal).toFixed(1)}% ${
                variacaoTotal >= 0 ? 'acima' : 'abaixo'
              } do mesmo período do mês passado (${euro(calc.fatAteHoje)} contra ${euro(calc.fatAntMesmoPeriodo)}).`}
        </div>
      )}

      {/* Números principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi titulo="Faturado no mês" valor={euro(calc.fatAteHoje)} Icone={Euro}>
          <Variacao atual={calc.fatAteHoje} anterior={calc.fatAntMesmoPeriodo} />
          {calc.fatAgendado > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Previsto até ao fim do mês: {euro(calc.fatMesTotal)}
            </p>
          )}
        </CartaoKpi>
        <CartaoKpi titulo="Atendimentos" valor={String(calc.nAteHoje)} Icone={CalendarCheck}>
          <Variacao atual={calc.nAteHoje} anterior={calc.nAntMesmoPeriodo} />
          {calc.nAgendado > 0 && <p className="text-[11px] text-muted-foreground">+ {calc.nAgendado} ainda agendados</p>}
        </CartaoKpi>
        <CartaoKpi titulo="Ticket médio" valor={euro(calc.ticket)} Icone={Receipt}>
          <Variacao atual={calc.ticket} anterior={calc.ticketAnt} />
        </CartaoKpi>
        <CartaoKpi titulo="Clientes novas" valor={String(dados.clientesNovasMes)} Icone={UserPlus}>
          <Variacao atual={dados.clientesNovasMes} anterior={dados.clientesNovasMesAnterior} rotulo="vs mês passado (completo)" />
        </CartaoKpi>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="text-sm font-semibold text-foreground">Faturamento — últimos 12 meses</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">A parte clara é o que ainda está agendado.</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <BarChart data={calc.serie} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#FFFFFF', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: '#C4B5FD' }}
                  cursor={{ fill: 'hsl(var(--border) / 0.4)' }}
                  formatter={(v: unknown, nome: unknown) => [euro(Number(v)), nome === 'agendado' ? 'Agendado' : 'Realizado']}
                />
                <Bar dataKey="realizado" stackId="a" fill={COR} radius={[0, 0, 0, 0]} />
                <Bar dataKey="agendado" stackId="a" fill={COR} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="text-sm font-semibold text-foreground">Ritmo do mês — este mês vs mês passado</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">Faturamento acumulado dia a dia.</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <LineChart data={calc.ritmo} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#FFFFFF', fontWeight: 600, marginBottom: 4 }}
                  labelFormatter={(d: unknown) => `Dia ${d}`}
                  formatter={(v: unknown, nome: unknown) => [euro(Number(v)), nome === 'atual' ? 'Este mês' : 'Mês passado']}
                />
                <Line type="monotone" dataKey="anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="atual" stroke={COR} strokeWidth={3} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ backgroundColor: COR }} /> Este mês</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t border-dashed border-muted-foreground" /> Mês passado</span>
          </div>
        </div>
      </div>

      {/* Hoje, ponto de equilíbrio e meta */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock size={15} className="text-primary" /> Hoje
          </h3>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-muted-foreground">Atendimentos</p>
              <p className="font-display text-2xl font-bold text-foreground">{calc.nHoje}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Valor</p>
              <p className="font-display text-2xl font-bold text-foreground">{euro(calc.fatHoje)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {calc.proximo
              ? `Próximo: ${calc.proximo.cliente} — ${calc.proximo.procedimento}, ${
                  calc.proximo.data === isoLocal(new Date()) ? 'hoje' : calc.proximo.data.split('-').reverse().join('/')
                }${calc.proximo.hora ? ` às ${calc.proximo.hora}` : ''}`
              : 'Sem mais atendimentos agendados.'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target size={15} className="text-primary" /> Ponto de equilíbrio
          </h3>
          {dados.custosFixosMensais > 0 ? (
            <>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>{euro(calc.fatMesTotal)} de {euro(dados.custosFixosMensais)}</span>
                <span className={cn('font-bold', cobreCustos ? 'text-emerald-500' : 'text-primary')}>{Math.round(pctCustos)}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-border bg-background">
                <div className={cn('h-full rounded-full transition-all duration-500', cobreCustos ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pctCustos}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {cobreCustos
                  ? `Já cobriu os custos fixos e tem ${euro(calc.fatMesTotal - dados.custosFixosMensais)} de folga.`
                  : `Faltam ${euro(dados.custosFixosMensais - calc.fatMesTotal)} para cobrir os custos fixos do mês.`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Registe os seus custos fixos (renda, internet…) para ver quanto precisa faturar por mês.{' '}
              <button onClick={() => navigate('/custos')} className="text-primary underline">Ir para Custos</button>
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target size={15} className="text-primary" /> Meta de atendimentos
          </h3>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>{nMes} de {dados.metaAtendimentos} este mês</span>
            <span className="font-bold text-primary">{pctMeta}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-border bg-background">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pctMeta}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pctMeta >= 100 ? 'Meta do mês atingida!' : `Faltam ${Math.max(dados.metaAtendimentos - nMes, 0)} atendimentos.`}
          </p>
        </div>
      </div>

      {/* Procedimentos, clientes a reativar e leads */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Procedimentos que mais faturam (mês)</h3>
          {calc.topProcedimentos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem atendimentos neste mês.</p>
          ) : (
            <ul className="space-y-2.5">
              {calc.topProcedimentos.map((p) => (
                <li key={p.nome}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate pr-2 text-foreground">{p.nome}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{euro(p.valor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.valor / calc.topProcedimentos[0].valor) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserX size={15} className="text-amber-500" /> Clientes a reativar
          </h3>
          <p className="mb-3 text-[11px] text-muted-foreground">Sem voltar há mais de {DIAS_CLIENTE_EM_RISCO} dias.</p>
          {calc.emRisco.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma cliente em risco por agora.</p>
          ) : (
            <>
              <p className="mb-2 font-display text-2xl font-bold text-foreground">{calc.emRisco.length}</p>
              <ul className="space-y-1.5">
                {calc.emRisco.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex justify-between text-xs">
                    <span className="truncate pr-2 text-foreground">{c.nome}</span>
                    <span className="shrink-0 text-muted-foreground">há {c.dias} dias</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/clientes')} className="mt-3 text-xs font-semibold text-primary hover:underline">
                Ver clientes →
              </button>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Inbox size={15} className="text-primary" /> Leads novos
          </h3>
          <p className="mb-3 text-[11px] text-muted-foreground">Pedidos recebidos pela página pública nos últimos 7 dias.</p>
          <p className="font-display text-2xl font-bold text-foreground">{dados.leads7d}</p>
          <button onClick={() => navigate('/kanban')} className="mt-3 text-xs font-semibold text-primary hover:underline">
            Abrir quadro Leads →
          </button>
        </div>
      </div>
    </div>
  );
}
