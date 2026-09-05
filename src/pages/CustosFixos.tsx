import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseMoeda } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Landmark,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface CustoFixo {
  id: string;
  nome: string;
  categoria: string;
  valor_mensal: number;
  ativo: boolean;
}

const CATEGORIAS = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'internet', label: 'Internet' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'seguranca_social', label: 'Segurança Social' },
  { value: 'higiene_seguranca', label: 'Higiene e Segurança' },
  { value: 'luz', label: 'Luz' },
  { value: 'software', label: 'Software (apps, assinaturas)' },
  { value: 'outro', label: 'Outro' },
];

const rotuloCategoria = (valor: string) =>
  CATEGORIAS.find((c) => c.value === valor)?.label ?? valor;

export default function CustosFixos() {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [faturamentoMes, setFaturamentoMes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('outro');
  const [valorMensal, setValorMensal] = useState('');

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Custos fixos
    const { data: dataCustos, error: erroCustos } = await supabase
      .from('custos_fixos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!erroCustos && dataCustos) {
      setCustos(dataCustos);
    } else if (erroCustos) {
      console.error('Erro ao buscar custos fixos:', erroCustos.message);
    }

    // 2. Faturamento do mês atual (mesma lógica usada em Custos e Estoque)
    const hoje = new Date();
    const prefixoMesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    let totalCalculado = 0;

    let queryFechamentos = supabase
      .from('fechamentos')
      .select('faturamento_bruto, lucro_liquido, data_referencia, data');
    if (user) {
      queryFechamentos = queryFechamentos.or(`usuario_id.eq.${user.id},usuario_id.is.null`);
    }
    const { data: fechamentos } = await queryFechamentos;

    if (fechamentos) {
      const doMes = fechamentos.filter((f) => (f.data_referencia || f.data || '').startsWith(prefixoMesAno));
      totalCalculado = doMes.reduce(
        (acc, item) => acc + Number(item.faturamento_bruto || item.lucro_liquido || 0),
        0
      );
    }

    let queryAgendamentos = supabase.from('agendamentos').select('valor, preco, data');
    if (user) {
      queryAgendamentos = queryAgendamentos.or(`usuario_id.eq.${user.id},usuario_id.is.null`);
    }
    const { data: agendamentos } = await queryAgendamentos;

    if (agendamentos) {
      const doMes = agendamentos.filter((a) => a.data && a.data.startsWith(prefixoMesAno));
      const soma = doMes.reduce((acc, item) => {
        const raw = item.valor ?? item.preco ?? 0;
        const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
        return acc + val;
      }, 0);
      if (soma > totalCalculado) totalCalculado = soma;
    }

    setFaturamentoMes(totalCalculado);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !valorMensal) return;
    setSalvando(true);

    const { error } = await supabase.from('custos_fixos').insert([
      {
        nome: nome.trim(),
        categoria,
        valor_mensal: parseMoeda(valorMensal),
      },
    ]);

    if (!error) {
      setNome('');
      setValorMensal('');
      setCategoria('outro');
      carregarDados();
    } else {
      alert('Erro ao guardar custo fixo: ' + error.message);
    }
    setSalvando(false);
  };

  const alternarAtivo = async (custo: CustoFixo) => {
    const { error } = await supabase
      .from('custos_fixos')
      .update({ ativo: !custo.ativo })
      .eq('id', custo.id);
    if (!error) carregarDados();
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este custo fixo?')) return;
    const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
    if (!error) carregarDados();
  };

  const totalMensal = custos
    .filter((c) => c.ativo)
    .reduce((acc, c) => acc + Number(c.valor_mensal || 0), 0);

  const diferenca = faturamentoMes - totalMensal;
  const jaCobreCustos = diferenca >= 0;
  const percentualCoberto = totalMensal > 0 ? Math.min((faturamentoMes / totalMensal) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar custos fixos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cartão de Ponto de Equilíbrio */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Target size={20} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Ponto de Equilíbrio</span>
            <p className="text-[11px] text-muted-foreground">Quanto precisa faturar este mês para pagar as contas</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Custos fixos ativos / mês</p>
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">€ {totalMensal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Faturado este mês</p>
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">€ {faturamentoMes.toFixed(2)}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ${jaCobreCustos ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${percentualCoberto}%` }}
          />
        </div>

        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${
            jaCobreCustos
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
              : 'border-primary/30 bg-primary/5 text-primary'
          }`}
        >
          {jaCobreCustos ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {jaCobreCustos
            ? `Já cobriu os custos fixos e está com € ${diferenca.toFixed(2)} de lucro este mês.`
            : `Faltam € ${Math.abs(diferenca).toFixed(2)} para cobrir os custos fixos deste mês.`}
        </div>
      </div>

      {/* Formulário de novo custo */}
      <form onSubmit={handleSalvar} className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Adicionar Custo Fixo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Ex: Aluguel do espaço"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="sm:col-span-1"
          />
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="Valor mensal (€)"
            value={valorMensal}
            onChange={(e) => setValorMensal(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={salvando} className="w-full sm:w-auto">
          {salvando ? 'A guardar...' : 'Adicionar'}
        </Button>
      </form>

      {/* Lista de custos fixos */}
      <div className="space-y-2">
        {custos.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda não há custos fixos registados. Adicione o primeiro acima.
          </div>
        )}
        {custos.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-xl border p-4 bg-card shadow-sm ${
              c.ativo ? 'border-border' : 'border-border opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Landmark size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{rotuloCategoria(c.categoria)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-bold text-foreground tabular-nums">
                € {Number(c.valor_mensal).toFixed(2)}
              </span>
              <button
                onClick={() => alternarAtivo(c)}
                title={c.ativo ? 'Desativar' : 'Ativar'}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {c.ativo ? <Power size={16} /> : <PowerOff size={16} />}
              </button>
              <button
                onClick={() => excluir(c.id)}
                title="Excluir"
                className="text-muted-foreground hover:text-rose-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
