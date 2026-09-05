import { useState, useEffect, useCallback } from 'react';
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
import { getErrorMessage, parseMoeda } from '@/lib/utils';
import { Package, Plus, Trash2, TrendingUp, Users, Coins } from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_total: number;
  quantidade_restante: number;
  custo_compra: number;
  esgotado_em: string | null;
}

interface ResumoLote {
  clientes: number;
  faturado: number;
  lucro: number;
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [resumos, setResumos] = useState<Record<string, ResumoLote>>({});
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('ml');
  const [quantidade, setQuantidade] = useState('');
  const [custo, setCusto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .order('esgotado_em', { ascending: true, nullsFirst: true })
      .order('criado_em', { ascending: false });

    setProdutos(data || []);

    // Para os esgotados, calcula quantas clientes / faturamento / lucro geraram
    const esgotados = (data || []).filter((p) => p.esgotado_em);
    const novosResumos: Record<string, ResumoLote> = {};

    for (const p of esgotados) {
      const { data: usos } = await supabase
        .from('produto_usos')
        .select('agendamento_id')
        .eq('produto_id', p.id);

      const idsAgendamentos = (usos || []).map((u) => u.agendamento_id).filter(Boolean);
      let faturado = 0;
      if (idsAgendamentos.length > 0) {
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('valor, preco')
          .in('id', idsAgendamentos);
        faturado = (ags || []).reduce((acc, a) => acc + parseMoeda(a.valor ?? a.preco ?? 0), 0);
      }

      novosResumos[p.id] = {
        clientes: idsAgendamentos.length,
        faturado,
        lucro: faturado - Number(p.custo_compra),
      };
    }
    setResumos(novosResumos);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !quantidade) return;
    setSalvando(true);

    const qtd = parseMoeda(quantidade);
    const { error } = await supabase.from('produtos').insert([{
      nome: nome.trim(),
      unidade_medida: unidade,
      quantidade_total: qtd,
      quantidade_restante: qtd,
      custo_compra: parseMoeda(custo),
    }]);

    if (!error) {
      setNome('');
      setQuantidade('');
      setCusto('');
      carregarDados();
    } else {
      alert('Erro ao guardar produto: ' + getErrorMessage(error));
    }
    setSalvando(false);
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este produto? O histórico de uso dele não é apagado.')) return;
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (!error) carregarDados();
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        A carregar produtos...
      </div>
    );
  }

  const ativos = produtos.filter((p) => !p.esgotado_em);
  const esgotados = produtos.filter((p) => p.esgotado_em);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Produtos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Estoque por quantidade — sabe quantas clientes cada produto rende e quanto lucro dá.
        </p>
      </div>

      <form onSubmit={handleSalvar} className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Adicionar Produto
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input placeholder="Nome (ex: Pigmento Castanho)" value={nome} onChange={(e) => setNome(e.target.value)} className="sm:col-span-2" />
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ml">ml</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="unidade">unidade</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={`Quantidade total (${unidade})`} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <Input placeholder="Custo de compra (€)" value={custo} onChange={(e) => setCusto(e.target.value)} className="sm:max-w-xs" />
        <Button type="submit" disabled={salvando}>{salvando ? 'A guardar...' : 'Adicionar'}</Button>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Em uso</h3>
        {ativos.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum produto em estoque ainda.
          </div>
        )}
        {ativos.map((p) => {
          const percentual = Math.max(0, Math.min(100, (p.quantidade_restante / p.quantidade_total) * 100));
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package size={15} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {p.quantidade_restante} / {p.quantidade_total} {p.unidade_medida}
                  </span>
                  <button onClick={() => handleExcluir(p.id)} className="text-muted-foreground hover:text-rose-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border">
                <div
                  className={`h-full rounded-full transition-all ${percentual < 20 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {esgotados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Esgotados — resumo do lote</h3>
          {esgotados.map((p) => {
            const resumo = resumos[p.id];
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-sm opacity-90">
                <p className="text-sm font-semibold text-foreground mb-2">{p.nome}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <Users size={14} className="mx-auto mb-1 text-primary" />
                    <p className="text-sm font-bold text-foreground">{resumo?.clientes ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">clientes</p>
                  </div>
                  <div>
                    <TrendingUp size={14} className="mx-auto mb-1 text-emerald-500" />
                    <p className="text-sm font-bold text-emerald-500">€ {(resumo?.lucro ?? 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">lucro</p>
                  </div>
                  <div>
                    <Coins size={14} className="mx-auto mb-1 text-amber-500" />
                    <p className="text-sm font-bold text-foreground">€ {Number(p.custo_compra).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">reinvestir sugerido</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
