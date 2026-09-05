import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/utils';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  notas: string | null;
  retorno_previsto: string | null;
}

interface ClienteComHistorico extends Cliente {
  primeiraVisita: string | null;
  ultimaVisita: string | null;
  procedimentos: string[];
}

const DIAS_ATENCAO = 90; // 3 meses
const DIAS_INATIVA = 180; // 6 meses

function diasDesde(dataISO: string | null): number | null {
  if (!dataISO) return null;
  const diff = Date.now() - new Date(dataISO).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatarDataCurta(dataISO: string | null): string {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [historicoPorCliente, setHistoricoPorCliente] = useState<
    Record<string, { primeiraVisita: string | null; ultimaVisita: string | null; procedimentos: string[] }>
  >({});
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);

  const [painelAberto, setPainelAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [retornoPrevisto, setRetornoPrevisto] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);

    const { data: dataClientes, error: erroClientes } = await supabase
      .from('clientes')
      .select('id, nome, telefone, email, notas, retorno_previsto')
      .order('nome', { ascending: true });

    if (erroClientes) {
      console.error('Erro ao buscar clientes:', erroClientes.message);
      setLoading(false);
      return;
    }

    setClientes(dataClientes || []);

    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('cliente, cliente_id, data, procedimento')
      .order('data', { ascending: true });

    const stats: Record<
      string,
      { primeiraVisita: string | null; ultimaVisita: string | null; procedimentos: Set<string> }
    > = {};

    (agendamentos || []).forEach((ag) => {
      const chave = ag.cliente_id || `nome:${(ag.cliente || '').trim().toLowerCase()}`;
      if (!chave || chave === 'nome:') return;
      if (!stats[chave]) stats[chave] = { primeiraVisita: null, ultimaVisita: null, procedimentos: new Set() };
      if (!stats[chave].primeiraVisita || ag.data < stats[chave].primeiraVisita!) stats[chave].primeiraVisita = ag.data;
      if (!stats[chave].ultimaVisita || ag.data > stats[chave].ultimaVisita!) stats[chave].ultimaVisita = ag.data;
      if (ag.procedimento) stats[chave].procedimentos.add(ag.procedimento);
    });

    const mapa: Record<string, { primeiraVisita: string | null; ultimaVisita: string | null; procedimentos: string[] }> = {};
    (dataClientes || []).forEach((c) => {
      const porId = stats[c.id];
      const porNome = stats[`nome:${c.nome.trim().toLowerCase()}`];

      const datasPrimeira = [porId?.primeiraVisita, porNome?.primeiraVisita].filter(Boolean) as string[];
      const datasUltima = [porId?.ultimaVisita, porNome?.ultimaVisita].filter(Boolean) as string[];
      const procedimentos = new Set<string>([
        ...(porId ? Array.from(porId.procedimentos) : []),
        ...(porNome ? Array.from(porNome.procedimentos) : []),
      ]);

      mapa[c.id] = {
        primeiraVisita: datasPrimeira.length ? datasPrimeira.sort()[0] : null,
        ultimaVisita: datasUltima.length ? datasUltima.sort().reverse()[0] : null,
        procedimentos: Array.from(procedimentos),
      };
    });

    setHistoricoPorCliente(mapa);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const clientesCompletas: ClienteComHistorico[] = useMemo(() => {
    return clientes
      .map((c) => ({
        ...c,
        primeiraVisita: historicoPorCliente[c.id]?.primeiraVisita || null,
        ultimaVisita: historicoPorCliente[c.id]?.ultimaVisita || null,
        procedimentos: historicoPorCliente[c.id]?.procedimentos || [],
      }))
      .filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => (b.ultimaVisita || '').localeCompare(a.ultimaVisita || ''));
  }, [clientes, historicoPorCliente, busca]);

  const limparFormulario = () => {
    setNome('');
    setTelefone('');
    setEmail('');
    setNotas('');
    setRetornoPrevisto('');
    setEditandoId(null);
    setPainelAberto(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);

    const payload = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
      retorno_previsto: retornoPrevisto || null,
    };

    const { error } = editandoId
      ? await supabase.from('clientes').update(payload).eq('id', editandoId)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      limparFormulario();
      carregarDados();
    } else {
      alert('Erro ao guardar cliente: ' + getErrorMessage(error));
    }
    setSalvando(false);
  };

  const handleEditar = (c: Cliente) => {
    setEditandoId(c.id);
    setNome(c.nome);
    setTelefone(c.telefone || '');
    setEmail(c.email || '');
    setNotas(c.notas || '');
    setRetornoPrevisto(c.retorno_previsto || '');
    setPainelAberto(true);
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir esta cliente? O histórico de agendamentos dela não é apagado.')) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) carregarDados();
  };

  const importarClientesExistentes = async () => {
    setImportando(true);
    try {
      const { data: agendamentos } = await supabase.from('agendamentos').select('cliente, telefone_cliente');
      const nomesExistentes = new Set(clientes.map((c) => c.nome.trim().toLowerCase()));
      const novos = new Map<string, { nome: string; telefone: string | null }>();

      (agendamentos || []).forEach((ag) => {
        const nomeAg = (ag.cliente || '').trim();
        if (!nomeAg) return;
        const chave = nomeAg.toLowerCase();
        if (nomesExistentes.has(chave) || novos.has(chave)) return;
        novos.set(chave, { nome: nomeAg, telefone: ag.telefone_cliente || null });
      });

      if (novos.size === 0) {
        alert('Não há clientes novas para importar — todos os nomes já têm registo.');
        return;
      }

      const { error } = await supabase.from('clientes').insert(Array.from(novos.values()));
      if (error) throw error;

      alert(`${novos.size} cliente(s) importada(s) com sucesso a partir dos agendamentos.`);
      carregarDados();
    } catch (err) {
      alert('Erro ao importar: ' + getErrorMessage(err));
    } finally {
      setImportando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar clientes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Base de clientes, histórico de visitas e próximas manutenções previstas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={importarClientesExistentes} disabled={importando} className="gap-1.5">
            <RefreshCw size={14} className={importando ? 'animate-spin' : ''} />
            {importando ? 'A importar...' : 'Importar'}
          </Button>
          <Button onClick={() => setPainelAberto(true)} className="gap-1.5">
            <Plus size={14} /> Nova Cliente
          </Button>
        </div>
      </div>

      {/* Painel de adicionar/editar */}
      {painelAberto && (
        <form onSubmit={handleSalvar} className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Plus size={16} className="text-primary" /> {editandoId ? 'Editar Cliente' : 'Adicionar Cliente'}
            </h3>
            <button type="button" onClick={limparFormulario} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Nome da cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input placeholder="Telefone (com +351 ou +55)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            <Input placeholder="Email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Retorno previsto (manutenção)
              </label>
              <Input type="date" value={retornoPrevisto} onChange={(e) => setRetornoPrevisto(e.target.value)} />
            </div>
          </div>
          <textarea
            placeholder="Observações (alergias, preferências, notas...)"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background/50 p-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" disabled={salvando}>
            {salvando ? 'A guardar...' : editandoId ? 'Guardar alterações' : 'Adicionar'}
          </Button>
        </form>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Procurar cliente pelo nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela */}
      {clientesCompletas.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há clientes registadas. Adiciona uma acima ou importa dos agendamentos já feitos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-black/10">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Telefone</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">1º Atendimento</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Último Atendimento</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Procedimento(s)</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Retorno Previsto</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Observações</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesCompletas.map((c, i) => {
                const dias = diasDesde(c.ultimaVisita);
                const inativa = dias !== null && dias >= DIAS_INATIVA;
                const atencao = dias !== null && dias >= DIAS_ATENCAO && dias < DIAS_INATIVA;
                const status = inativa ? 'Inativa' : atencao ? 'Atenção' : c.ultimaVisita ? 'Ativa' : 'Nova';
                const corStatus = inativa
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  : atencao
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : c.ultimaVisita
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border';

                return (
                  <tr
                    key={c.id}
                    className={i % 2 === 0 ? 'bg-card' : 'bg-background/40'}
                  >
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Users size={13} />
                        </div>
                        {c.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatarDataCurta(c.primeiraVisita)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatarDataCurta(c.ultimaVisita)}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate" title={c.procedimentos.join(', ')}>
                      {c.procedimentos.length ? c.procedimentos.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatarDataCurta(c.retorno_previsto)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${corStatus}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={c.notas || ''}>
                      {c.notas || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => handleEditar(c)} title="Editar" className="text-muted-foreground hover:text-primary transition-colors mr-3">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleExcluir(c.id)} title="Excluir" className="text-muted-foreground hover:text-rose-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
