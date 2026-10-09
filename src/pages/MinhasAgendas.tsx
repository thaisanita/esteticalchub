import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  Users,
  Copy,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Crown,
  X,
} from 'lucide-react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getErrorMessage } from '@/lib/utils';
import { URL_PUBLICO } from '@/lib/empresa';

interface Agenda {
  id: string;
  nome: string;
  cor: string;
  principal: boolean;
  papel: 'dona' | 'membro';
}

interface Membro {
  user_id: string;
  email: string;
  papel: string;
}

const CORES = ['#B96AF1', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#EF4444', '#14B8A6', '#6366F1'];

export default function MinhasAgendas() {
  const [carregando, setCarregando] = useState(true);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [aCriar, setACriar] = useState(false);
  const [formAberto, setFormAberto] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');

  const [convites, setConvites] = useState<Record<string, string>>({});
  const [aGerarConvite, setAGerarConvite] = useState<string | null>(null);

  const [membrosAbertos, setMembrosAbertos] = useState<Record<string, Membro[]>>({});
  const [aCarregarMembros, setACarregarMembros] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');
      setMeuId(user.id);

      const [{ data: membros, error: erroMembros }, { data: dadosAgendas, error: erroAgendas }] = await Promise.all([
        supabase.from('agenda_membros').select('agenda_id, papel').eq('user_id', user.id),
        supabase.from('agendas').select('id, nome, cor, principal').order('principal', { ascending: false }).order('nome'),
      ]);
      if (erroMembros) throw erroMembros;
      if (erroAgendas) throw erroAgendas;

      const papelPorAgenda = new Map((membros ?? []).map((m) => [m.agenda_id, m.papel as 'dona' | 'membro']));
      setAgendas(
        (dadosAgendas ?? []).map((a) => ({ ...a, papel: papelPorAgenda.get(a.id) ?? 'membro' }))
      );
    } catch (e) {
      setErro(getErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarAgenda = async () => {
    if (!novoNome.trim()) return;
    setACriar(true);
    setErro(null);
    try {
      const { error } = await supabase.rpc('criar_agenda', { p_nome: novoNome.trim(), p_cor: novaCor });
      if (error) throw error;
      setNovoNome('');
      setFormAberto(false);
      await carregar();
    } catch (e) {
      setErro(getErrorMessage(e));
    } finally {
      setACriar(false);
    }
  };

  const guardarNome = async (agendaId: string) => {
    if (!nomeEditado.trim()) return;
    const { error } = await supabase.from('agendas').update({ nome: nomeEditado.trim() }).eq('id', agendaId);
    if (!error) {
      setAgendas((prev) => prev.map((a) => (a.id === agendaId ? { ...a, nome: nomeEditado.trim() } : a)));
      setEditandoId(null);
    } else {
      setErro(getErrorMessage(error));
    }
  };

  const mudarCor = async (agendaId: string, cor: string) => {
    const { error } = await supabase.from('agendas').update({ cor }).eq('id', agendaId);
    if (!error) {
      setAgendas((prev) => prev.map((a) => (a.id === agendaId ? { ...a, cor } : a)));
    }
  };

  const apagarAgenda = async (agenda: Agenda) => {
    const aviso = agenda.principal
      ? `"${agenda.nome}" é a tua agenda principal. Apagá-la elimina também todos os agendamentos e clientes lá dentro. Tens mesmo a certeza?`
      : `Apagar "${agenda.nome}"? Todos os agendamentos e clientes partilhados nesta agenda são eliminados para todas as membras. Esta ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;

    const { error } = await supabase.from('agendas').delete().eq('id', agenda.id);
    if (!error) {
      setAgendas((prev) => prev.filter((a) => a.id !== agenda.id));
    } else {
      setErro(getErrorMessage(error));
    }
  };

  const gerarConvite = async (agendaId: string) => {
    setAGerarConvite(agendaId);
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase
        .from('agenda_convites')
        .insert({ agenda_id: agendaId, criado_por: user.id })
        .select('token')
        .single();
      if (error) throw error;

      const link = `${URL_PUBLICO}/convite/${data.token}`;
      setConvites((prev) => ({ ...prev, [agendaId]: link }));
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // clipboard pode estar bloqueado; o link fica visível para copiar à mão
      }
    } catch (e) {
      setErro(getErrorMessage(e));
    } finally {
      setAGerarConvite(null);
    }
  };

  const alternarMembros = async (agendaId: string) => {
    if (membrosAbertos[agendaId]) {
      setMembrosAbertos((prev) => {
        const copia = { ...prev };
        delete copia[agendaId];
        return copia;
      });
      return;
    }
    setACarregarMembros(agendaId);
    const { data, error } = await supabase.rpc('listar_membros_agenda', { p_agenda_id: agendaId });
    setACarregarMembros(null);
    if (!error && data) {
      setMembrosAbertos((prev) => ({ ...prev, [agendaId]: data }));
    } else if (error) {
      setErro(getErrorMessage(error));
    }
  };

  const removerMembro = async (agendaId: string, userId: string) => {
    if (!window.confirm('Remover esta pessoa da agenda? Deixa de ver os agendamentos e clientes partilhados.')) return;
    const { error } = await supabase.from('agenda_membros').delete().eq('agenda_id', agendaId).eq('user_id', userId);
    if (!error) {
      setMembrosAbertos((prev) => ({
        ...prev,
        [agendaId]: (prev[agendaId] ?? []).filter((m) => m.user_id !== userId),
      }));
    } else {
      setErro(getErrorMessage(error));
    }
  };

  if (carregando) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar as agendas...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Minhas agendas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria agendas separadas (ex.: por local) e partilha cada uma com quem precisares. Clientes e agendamentos
          ficam ligados à agenda; os teus custos, relatórios e metas continuam privados.
        </p>
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{erro}</div>
      )}

      <div className="space-y-3">
        {agendas.map((agenda) => (
          <div key={agenda.id} className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: agenda.cor }} />
                {editandoId === agenda.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={nomeEditado}
                      onChange={(e) => setNomeEditado(e.target.value)}
                      className="h-8 w-40 text-sm"
                      autoFocus
                    />
                    <Button size="sm" className="h-8" onClick={() => guardarNome(agenda.id)}>
                      Guardar
                    </Button>
                    <button onClick={() => setEditandoId(null)} className="text-muted-foreground hover:text-foreground">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <strong className="truncate text-sm text-foreground">{agenda.nome}</strong>
                    {agenda.principal && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Principal
                      </span>
                    )}
                    {agenda.papel === 'dona' && (
                      <span title="És a dona desta agenda" className="shrink-0 text-amber-500">
                        <Crown size={13} />
                      </span>
                    )}
                  </div>
                )}
              </div>

              {agenda.papel === 'dona' && editandoId !== agenda.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setEditandoId(agenda.id);
                      setNomeEditado(agenda.nome);
                    }}
                    title="Renomear"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => apagarAgenda(agenda)}
                    title="Apagar agenda"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {agenda.papel === 'dona' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => mudarCor(agenda.id, cor)}
                    title={cor}
                    className={cn(
                      'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                      agenda.cor === cor ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => alternarMembros(agenda.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Users size={13} />
                Ver membros
                {aCarregarMembros === agenda.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : membrosAbertos[agenda.id] ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>

              {agenda.papel === 'dona' && (
                <Button
                  onClick={() => gerarConvite(agenda.id)}
                  disabled={aGerarConvite === agenda.id}
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                >
                  {aGerarConvite === agenda.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Convidar
                </Button>
              )}
            </div>

            {membrosAbertos[agenda.id] && (
              <ul className="space-y-1.5 rounded-xl border border-border bg-background/50 p-3">
                {membrosAbertos[agenda.id].map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">
                      {m.email} {m.user_id === meuId && <span className="text-muted-foreground">(tu)</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.papel}</span>
                      {agenda.papel === 'dona' && m.papel !== 'dona' && (
                        <button
                          onClick={() => removerMembro(agenda.id, m.user_id)}
                          title="Remover da agenda"
                          className="text-muted-foreground hover:text-rose-500"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {convites[agenda.id] && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 p-2.5 text-xs">
                <span className="flex-1 truncate text-muted-foreground">{convites[agenda.id]}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(convites[agenda.id])}
                  title="Copiar link"
                  className="flex shrink-0 items-center gap-1 text-primary"
                >
                  <Copy size={12} /> Copiar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {formAberto ? (
        <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Nova agenda</p>
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex.: Valença"
            className="h-10"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {CORES.map((cor) => (
              <button
                key={cor}
                onClick={() => setNovaCor(cor)}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  novaCor === cor ? 'border-foreground' : 'border-transparent'
                )}
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={criarAgenda} disabled={aCriar || !novoNome.trim()} size="sm" className="gap-1.5">
              {aCriar ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Criar
            </Button>
            <Button onClick={() => setFormAberto(false)} size="sm" variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setFormAberto(true)} variant="outline" className="gap-1.5">
          <Calendar size={14} /> Criar nova agenda
        </Button>
      )}
    </div>
  );
}
