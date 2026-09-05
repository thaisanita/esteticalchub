import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/utils';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Trash2,
  Pencil,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface ClienteComStats extends Cliente {
  visitas: number;
  ultimaVisita: string | null;
}

const DIAS_ATENCAO = 90; // 3 meses
const DIAS_INATIVA = 180; // 6 meses

function diasDesde(dataISO: string | null): number | null {
  if (!dataISO) return null;
  const diff = Date.now() - new Date(dataISO).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitasPorCliente, setVisitasPorCliente] = useState<Record<string, { visitas: number; ultimaVisita: string | null }>>({});
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);

    const { data: dataClientes, error: erroClientes } = await supabase
      .from('clientes')
      .select('id, nome, telefone, email')
      .order('nome', { ascending: true });

    if (erroClientes) {
      console.error('Erro ao buscar clientes:', erroClientes.message);
      setLoading(false);
      return;
    }

    setClientes(dataClientes || []);

    // Visitas: por cliente_id (novo) e, em complemento, por nome (agendamentos antigos)
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('cliente, cliente_id, data')
      .order('data', { ascending: true });

    const stats: Record<string, { visitas: number; ultimaVisita: string | null }> = {};

    (agendamentos || []).forEach((ag) => {
      const chave = ag.cliente_id || `nome:${(ag.cliente || '').trim().toLowerCase()}`;
      if (!chave || chave === 'nome:') return;
      if (!stats[chave]) stats[chave] = { visitas: 0, ultimaVisita: null };
      stats[chave].visitas += 1;
      if (!stats[chave].ultimaVisita || ag.data > stats[chave].ultimaVisita!) {
        stats[chave].ultimaVisita = ag.data;
      }
    });

    // Junta estatísticas por cliente_id e, como fallback, por nome igual
    const mapa: Record<string, { visitas: number; ultimaVisita: string | null }> = {};
    (dataClientes || []).forEach((c) => {
      const porId = stats[c.id];
      const porNome = stats[`nome:${c.nome.trim().toLowerCase()}`];
      const visitas = (porId?.visitas || 0) + (porNome?.visitas || 0);
      const datas = [porId?.ultimaVisita, porNome?.ultimaVisita].filter(Boolean) as string[];
      const ultimaVisita = datas.length ? datas.sort().reverse()[0] : null;
      mapa[c.id] = { visitas, ultimaVisita };
    });

    setVisitasPorCliente(mapa);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const clientesComStats: ClienteComStats[] = useMemo(() => {
    return clientes
      .map((c) => ({
        ...c,
        visitas: visitasPorCliente[c.id]?.visitas || 0,
        ultimaVisita: visitasPorCliente[c.id]?.ultimaVisita || null,
      }))
      .filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => b.visitas - a.visitas);
  }, [clientes, visitasPorCliente, busca]);

  const limparFormulario = () => {
    setNome('');
    setTelefone('');
    setEmail('');
    setEditandoId(null);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);

    const payload = { nome: nome.trim(), telefone: telefone.trim() || null, email: email.trim() || null };

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
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir esta cliente? O histórico de agendamentos dela não é apagado.')) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) carregarDados();
  };

  // Importa nomes de clientes já usados nos agendamentos que ainda não têm registo próprio
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quem mais volta, quem está a ficar inativa, e os contactos de todas.
          </p>
        </div>
        <Button variant="outline" onClick={importarClientesExistentes} disabled={importando} className="shrink-0 gap-1.5">
          <RefreshCw size={14} className={importando ? 'animate-spin' : ''} />
          {importando ? 'A importar...' : 'Importar dos agendamentos'}
        </Button>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSalvar} className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus size={16} className="text-primary" /> {editandoId ? 'Editar Cliente' : 'Adicionar Cliente'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input placeholder="Nome da cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Telefone (com +351 ou +55)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="Email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? 'A guardar...' : editandoId ? 'Guardar alterações' : 'Adicionar'}
          </Button>
          {editandoId && (
            <Button type="button" variant="outline" onClick={limparFormulario}>Cancelar</Button>
          )}
        </div>
      </form>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Procurar cliente pelo nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {clientesComStats.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda não há clientes registadas. Adiciona uma acima ou importa dos agendamentos já feitos.
          </div>
        )}
        {clientesComStats.map((c) => {
          const dias = diasDesde(c.ultimaVisita);
          const inativa = dias !== null && dias >= DIAS_INATIVA;
          const atencao = dias !== null && dias >= DIAS_ATENCAO && dias < DIAS_INATIVA;

          return (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Users size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                    {inativa && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-500 border border-rose-500/20">
                        <AlertTriangle size={10} /> Inativa
                      </span>
                    )}
                    {atencao && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500 border border-amber-500/20">
                        Atenção
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {c.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {c.telefone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-display text-base font-bold text-foreground tabular-nums">{c.visitas}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {dias === null ? 'sem visitas' : `há ${dias} dia${dias === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button onClick={() => handleEditar(c)} title="Editar" className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleExcluir(c.id)} title="Excluir" className="text-muted-foreground hover:text-rose-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
