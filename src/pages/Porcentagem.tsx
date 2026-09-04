import { useState, useMemo, useEffect } from 'react';
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
import { cn } from '@/lib/utils';
import {
  Calculator,
  CheckCircle2,
  Calendar as CalendarIcon,
  MapPin,
  Percent,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Building2,
} from 'lucide-react';

interface AgendamentoPorc {
  data: string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
  valor?: number | string;
  preco?: number | string;
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

const Porcentagem = () => {
  const dataHoje = new Date();
  const mesAtualStr = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const anoAtualStr = String(dataHoje.getFullYear());

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtualStr);

  const [dataParaFechamento, setDataParaFechamento] = useState('');
  const [agendamentos, setAgendamentos] = useState<AgendamentoPorc[]>([]);
  const [pontoSelecionado, setPontoSelecionado] = useState('');
  const [taxaEspaco, setTaxaEspaco] = useState(25);
  const [loading, setLoading] = useState(false);
  const [diasDisponiveis, setDiasDisponiveis] = useState<string[]>([]);
  const [diasJaSalvos, setDiasJaSalvos] = useState<string[]>([]);

  // Carrega os dias com atendimento e fechamentos salvos para o Mês/Ano selecionados
  useEffect(() => {
    const buscarDiasComAtendimento = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // CORRIGIDO: alterado 'user_id' para 'usuario_id'
      const { data, error } = await supabase
        .from('agendamentos')
        .select('data')
        .eq('usuario_id', user.id)
        .order('data', { ascending: false });

      if (!error && data) {
        // Filtra apenas as datas pertencentes ao Mês/Ano selecionados (ex: YYYY-MM)
        const prefixoMesAno = `${anoSelecionado}-${mesSelecionado}`;
        const datasFiltradas = data
          .map((item) => item.data)
          .filter((d) => d && d.startsWith(prefixoMesAno));

        const datasUnicas = [...new Set(datasFiltradas)];
        setDiasDisponiveis(datasUnicas);

        if (datasUnicas.length > 0) {
          setDataParaFechamento(datasUnicas[0]);
        } else {
          setDataParaFechamento('');
        }
      }

      // CORRIGIDO: Busca fechamentos pelo usuario_id correto
      const { data: fechamentos, error: erroFechamentos } = await supabase
        .from('fechamentos')
        .select('data_referencia, data')
        .or(`usuario_id.eq.${user.id},user_id.eq.${user.id}`);

      if (!erroFechamentos && fechamentos) {
        const datasSalvas = [
          ...new Set(fechamentos.map((f) => f.data_referencia || f.data)),
        ].filter(Boolean) as string[];
        setDiasJaSalvos(datasSalvas);
      }
    };

    buscarDiasComAtendimento();
  }, [mesSelecionado, anoSelecionado]);

  // Carrega os agendamentos do dia selecionado
  useEffect(() => {
    if (!dataParaFechamento) {
      setAgendamentos([]);
      return;
    }

    const buscarAgendamentosDoDia = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // CORRIGIDO: alterado 'user_id' para 'usuario_id'
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('data', dataParaFechamento)
        .eq('usuario_id', user.id);

      if (!error) setAgendamentos(data || []);
    };

    buscarAgendamentosDoDia();
  }, [dataParaFechamento]);

  const locaisUnicos = useMemo(() => {
    const locais = agendamentos
      .map((ag) => ag.ponto_atendimento || ag.pontoAtendimento)
      .filter(Boolean) as string[];
    return [...new Set(locais)];
  }, [agendamentos]);

  const totalBrutoLocal = useMemo(() => {
    if (!pontoSelecionado) return 0;
    return agendamentos
      .filter((ag) => (ag.ponto_atendimento || ag.pontoAtendimento) === pontoSelecionado)
      .reduce((sum, ag) => {
        const valorRaw = ag.valor ?? ag.preco ?? 0;
        const valor = typeof valorRaw === 'number'
          ? valorRaw
          : parseFloat(String(valorRaw).replace(',', '.')) || 0;
        return sum + valor;
      }, 0);
  }, [pontoSelecionado, agendamentos]);

  const valorParaEspaco = (totalBrutoLocal * (Number(taxaEspaco) / 100)).toFixed(2);
  const meuLucroReal = (totalBrutoLocal - Number(valorParaEspaco)).toFixed(2);
  const diaSelecionadoJaSalvo = diasJaSalvos.includes(dataParaFechamento);

  const salvarNoRelatorio = async () => {
    if (!pontoSelecionado) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('fechamentos').insert([{
        local: pontoSelecionado,
        data_referencia: dataParaFechamento,
        data: dataParaFechamento,
        faturamento_bruto: totalBrutoLocal,
        comissao_paga: parseFloat(valorParaEspaco),
        lucro_liquido: parseFloat(meuLucroReal),
        usuario_id: user.id,
        user_id: user.id,
      }]);

      if (error) throw error;

      setDiasJaSalvos((prev) => [...new Set([...prev, dataParaFechamento])]);
      setPontoSelecionado('');
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cartoesDatas = useMemo(() => {
    return diasDisponiveis.map((dataIso) => {
      const [ano, mes, dia] = dataIso.split('-').map(Number);
      const dataObj = new Date(ano, mes - 1, dia);
      const diaSemana = dataObj
        .toLocaleDateString('pt-PT', { weekday: 'short' })
        .replace('.', '')
        .toUpperCase();
      const mesAbrev = dataObj
        .toLocaleDateString('pt-PT', { month: 'short' })
        .replace('.', '')
        .toUpperCase();
      return { dataIso, diaSemana, diaNumero: String(dia).padStart(2, '0'), mesAbrev };
    });
  }, [diasDisponiveis]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Cabeçalho com Seleção de Mês e Ano */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Fechamento de Repasse
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Calcule o rateio e consolide o seu lucro por espaço trabalhado
          </p>
        </div>

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
            <Calculator size={18} />
          </div>
        </div>
      </div>

      {/* Card Principal - Controles */}
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10">
        {/* Seletor de Data em Cartões */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarIcon size={13} className="text-primary" />
            Dias Trabalhados em {MESES.find((m) => m.value === mesSelecionado)?.label} / {anoSelecionado}
          </label>

          {cartoesDatas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/40 px-4 py-5 text-center text-xs text-muted-foreground">
              Nenhum atendimento registado para este mês.
            </div>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]">
              {cartoesDatas.map(({ dataIso, diaSemana, diaNumero, mesAbrev }) => {
                const isSelecionado = dataIso === dataParaFechamento;
                const isSalvo = diasJaSalvos.includes(dataIso);
                return (
                  <button
                    key={dataIso}
                    type="button"
                    onClick={() => {
                      setDataParaFechamento(dataIso);
                      setPontoSelecionado('');
                    }}
                    className={cn(
                      'relative flex min-w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition-all duration-150',
                      isSelecionado
                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                        : 'border-border bg-background/50 hover:border-primary/40 hover:bg-card'
                    )}
                  >
                    {isSalvo && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-background shadow-sm">
                        <CheckCircle2 size={11} strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[9px] font-bold tracking-wide',
                        isSelecionado ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {diaSemana}
                    </span>
                    <span
                      className={cn(
                        'font-display text-xl font-bold tabular-nums',
                        isSelecionado ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {diaNumero}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-medium tracking-wide',
                        isSelecionado ? 'text-primary/80' : 'text-muted-foreground'
                      )}
                    >
                      {mesAbrev}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Campo Espaço */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <MapPin size={13} className="text-primary" />
            Espaço
          </label>
          {locaisUnicos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-center text-xs text-muted-foreground">
              {dataParaFechamento ? 'Nenhum espaço encontrado para este dia.' : 'Selecione um dia acima.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locaisUnicos.map((local) => {
                const isSelecionado = local === pontoSelecionado;
                return (
                  <button
                    key={local}
                    type="button"
                    onClick={() => setPontoSelecionado(local)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-150',
                      isSelecionado
                        ? 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20'
                        : 'border-border bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {local}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Campo Taxa */}
        <div className="max-w-[140px] space-y-1.5">
          <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Percent size={13} className="text-primary" />
            Taxa Espaço (%)
          </label>
          <Input
            type="number"
            value={taxaEspaco}
            onChange={(e) => setTaxaEspaco(Number(e.target.value))}
            className="h-10 border-border bg-background/50 text-center font-semibold"
          />
        </div>

        {diaSelecionadoJaSalvo && (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-2.5 text-success">
            <CheckCircle2 size={16} />
            <span className="text-xs font-semibold">Os dados desta data já foram salvos anteriormente no relatório.</span>
          </div>
        )}
      </div>

      {/* Cards de Resultados Financeiros */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Total Bruto */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Building2 size={14} /> Bruto
            </span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              {pontoSelecionado || '—'}
            </span>
          </div>
          <div className="mt-4">
            <div className="font-display text-2xl font-bold tabular-nums text-foreground">
              € {totalBrutoLocal.toFixed(2)}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Faturamento no local
            </p>
          </div>
        </div>

        {/* Comissão Espaço */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-danger">
              Comissão Espaço
            </span>
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
              {taxaEspaco}%
            </span>
          </div>
          <div className="mt-4">
            <div className="font-display text-2xl font-bold tabular-nums text-danger">
              € {valorParaEspaco}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Valor devido ao local
            </p>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-lg shadow-primary/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-success">
              <TrendingUp size={14} /> Seu Lucro
            </span>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              {100 - taxaEspaco}%
            </span>
          </div>
          <div className="mt-4">
            <div className="font-display text-2xl font-bold tabular-nums text-success">
              € {meuLucroReal}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Valor líquido retido
            </p>
          </div>
        </div>
      </div>

      {/* Indicador Proporcional */}
      {totalBrutoLocal > 0 && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Distribuição do faturamento</span>
            <span className="font-medium text-foreground">
              {taxaEspaco}% Espaço / {100 - taxaEspaco}% Seu
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full border border-border bg-background">
            <div
              className="h-full bg-danger transition-all duration-300"
              style={{ width: `${taxaEspaco}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-300"
              style={{ width: `${100 - taxaEspaco}%` }}
            />
          </div>
        </div>
      )}

      {/* Botão de Ação */}
      <Button
        onClick={salvarNoRelatorio}
        disabled={!pontoSelecionado || totalBrutoLocal === 0 || loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95"
      >
        {loading ? (
          'A registrar...'
        ) : (
          <>
            <Sparkles size={16} />
            Confirmar e Salvar Fechamento
            <ArrowRight size={16} />
          </>
        )}
      </Button>
    </div>
  );
};

export default Porcentagem;