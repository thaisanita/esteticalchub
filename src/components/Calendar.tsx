import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Euro, PiggyBank, Trophy, MapPin } from 'lucide-react';
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

interface Agendamento {
  id?: string | number;
  data: string;
  cliente: string;
  preco: number | string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
}

interface CalendarProps {
  onDaySelect: (data: string) => void;
  agendamentos?: Agendamento[];
}

// Utilitário para gerar data YYYY-MM-DD no fuso horário local
const getLocalDateString = (date = new Date()) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const Calendar = ({ onDaySelect, agendamentos = [] }: CalendarProps) => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => getLocalDateString(), []);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [filtroLocal, setFiltroLocal] = useState('Todos');
  const [porcentagem, setPorcentagem] = useState(0);

  const handlePrevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const locaisDisponiveis = useMemo(() => {
    const pontos = agendamentos
      .map((ag) => ag.ponto_atendimento || ag.pontoAtendimento)
      .filter(Boolean) as string[];
    return ['Todos', ...new Set(pontos)];
  }, [agendamentos]);

  // Função utilitária para extrair AAAA-MM sem problema de Timezone
  const extrairAnoMes = (dataStr: string) => {
    if (!dataStr) return { ano: -1, mes: -1 };
    const apenasData = dataStr.split('T')[0];
    const [ano, mes] = apenasData.split('-').map(Number);
    return { ano, mes: mes - 1 };
  };

  const financeiro = useMemo(() => {
    const mesAtual = currentDate.getMonth();
    const anoAtual = currentDate.getFullYear();

    const filtrados = agendamentos.filter((ag) => {
      const { ano, mes } = extrairAnoMes(ag.data);
      const bateData = mes === mesAtual && ano === anoAtual;
      const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
      const bateLocal = filtroLocal === 'Todos' || localAg === filtroLocal;
      return bateData && bateLocal;
    });

    const bruto = filtrados.reduce((acc, curr) => acc + (Number(curr.preco) || 0), 0);
    const liquido = bruto * (Number(porcentagem) / 100);

    return { bruto, liquido };
  }, [agendamentos, currentDate, filtroLocal, porcentagem]);

  const formatarNomeCurto = (nome: string) => {
    if (!nome) return '';
    const primeiroNome = nome.split(' ')[0];
    return primeiroNome.length > 9 ? primeiroNome.substring(0, 8) + '..' : primeiroNome;
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const agendamentosDoDia = agendamentos.filter((ag) => {
        if (!ag.data) return false;
        const dataApenas = ag.data.split('T')[0];
        const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
        return dataApenas === dateString && (filtroLocal === 'Todos' || localAg === filtroLocal);
      });

      const agendadosPorLocal: Record<string, Agendamento[]> = {};
      agendamentosDoDia.forEach((ag) => {
        const loc = ag.ponto_atendimento || ag.pontoAtendimento || 'Gabinete';
        if (!agendadosPorLocal[loc]) agendadosPorLocal[loc] = [];
        agendadosPorLocal[loc].push(ag);
      });

      const isSelecionado = selectedDate === dateString;
      const isHoje = dateString === todayStr;

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => {
            setSelectedDate(dateString);
            onDaySelect(dateString);
          }}
          className={cn(
            'relative flex min-h-[76px] flex-col items-center rounded-lg border border-border pt-1.5 transition-colors',
            isSelecionado
              ? 'border-primary bg-primary/10'
              : isHoje
              ? 'border-primary/50 bg-primary/5'
              : 'hover:border-muted-foreground/30 hover:bg-card'
          )}
        >
          <span
            className={cn(
              'font-display text-sm font-semibold',
              isSelecionado ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {d}
          </span>

          <div className="mt-0.5 flex w-full flex-col gap-0.5 px-1">
            {Object.keys(agendadosPorLocal).map((localNome, lIdx) => (
              <div key={lIdx}>
                <span className="flex items-center justify-center gap-0.5 text-center text-[8px] font-bold uppercase text-primary">
                  <MapPin size={7} />
                  {formatarNomeCurto(localNome)}
                </span>
                {agendadosPorLocal[localNome].map((ag, cIdx) => (
                  <span
                    key={cIdx}
                    className="block text-center text-[9px] leading-tight text-foreground/80"
                  >
                    {formatarNomeCurto(ag.cliente).toLowerCase()}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </button>
      );
    }
    return days;
  };

  const mesAno = currentDate.toLocaleString('pt-PT', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Cards financeiros */}
      <div className="mb-7 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-md shadow-black/20">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Euro size={12} />
            Total Sem Comissão
          </p>
          <h4 className="font-display text-[28px] font-bold tabular-nums text-emerald-500">
            € {financeiro.bruto.toFixed(2)}
          </h4>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-md shadow-black/20">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <PiggyBank size={12} />
            Comissão a Pagar
          </p>
          <h4 className="font-display text-[28px] font-bold tabular-nums text-primary">
            € {financeiro.liquido.toFixed(2)}
          </h4>
        </div>
      </div>

      {/* Controles */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3.5">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={handlePrevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <span className="font-display min-w-[130px] text-center text-[17px] font-semibold capitalize text-foreground">
            {mesAno}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={handleNextMonth}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground">
            Comissão:
            <Input
              type="number"
              value={porcentagem}
              onChange={(e) => setPorcentagem(Number(e.target.value))}
              className="h-6 w-11 border-none bg-transparent p-1 text-center text-foreground"
            />
            %
          </div>

          <Select value={filtroLocal} onValueChange={setFiltroLocal}>
            <SelectTrigger className="h-9 w-[140px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locaisDisponiveis.map((local) => (
                <SelectItem key={local} value={local}>
                  {local === 'Todos' ? 'Gabinetes' : local}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid do calendário */}
      <div className="grid grid-cols-7 gap-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
          <div
            key={dia}
            className="pb-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {dia}
          </div>
        ))}
        {renderDays()}
      </div>

      {/* Atalho para a página de Clientes (substituiu o ranking escondido que existia aqui) */}
      <button
        onClick={() => navigate('/clientes')}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Trophy size={14} className="text-amber-500" />
        Ver clientes que mais marcam
      </button>
    </div>
  );
};

export default Calendar;