import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Target, CheckCircle2, RefreshCw } from 'lucide-react';
import Calendar from '../components/Calendar';
import ListaAgendamentos from '../components/ListaAgendamentos';
import { supabase } from '../supabase';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EVENTO_PAGAMENTO_REGISTADO } from '@/lib/eventos';
import { confirmar } from '@/components/ConfirmDialog';
import { totaisDoMes } from '@/lib/lucro';
import { resumoMeta } from '@/lib/visaoGeral';

interface Agendamento {
  id?: string | number;
  data: string;
  cliente: string;
  preco: number | string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
  hora?: string;
  procedimento?: string;
  usuario_id?: string;
  agenda_id?: string;
  faltou?: boolean;
  valor?: number | string;
}

interface AgendaInfo {
  id: string;
  nome: string;
  cor: string;
  principal: boolean;
  tipo_atendimento?: 'estudio' | 'domicilio' | 'ambos';
}

const getLocalDateString = (date = new Date()) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const Agenda = () => {
  const [dataSelecionada, setDataSelecionada] = useState<string>(getLocalDateString());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaAtendimentos, setMetaAtendimentos] = useState<number>(30);
  // O que está escrito no campo da meta. Só grava ao sair do campo ou com Enter,
  // para não gravar valores a meio (ex.: "1" ao escrever "10").
  const [metaTexto, setMetaTexto] = useState('30');
  // Agendas a que pertenço (TimeTree-style) e quais estão visíveis no calendário.
  const [agendasDisponiveis, setAgendasDisponiveis] = useState<AgendaInfo[]>([]);
  const [agendasVisiveis, setAgendasVisiveis] = useState<Set<string>>(new Set());

  const navigate = useNavigate();

  const [mesExibido, setMesExibido] = useState<Date>(new Date());
  const anoAtual = mesExibido.getFullYear();
  const mesAtual = mesExibido.getMonth() + 1; // 1 a 12

  const carregarMeta = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('metas_mensais')
      .select('meta')
      .eq('usuario_id', user.id)
      .eq('ano', anoAtual)
      .eq('mes', mesAtual)
      .maybeSingle();

    if (data) {
      setMetaAtendimentos(data.meta);
      setMetaTexto(String(data.meta));
    } else {
      // Ainda não existe meta para este mês — cria já com o valor padrão,
      // para este mês ficar registado desde o início (e não só quando editado).
      const { data: novaMeta } = await supabase
        .from('metas_mensais')
        .insert([{ ano: anoAtual, mes: mesAtual, meta: 30 }])
        .select('meta')
        .single();
      if (novaMeta) {
        setMetaAtendimentos(novaMeta.meta);
        setMetaTexto(String(novaMeta.meta));
      }
    }
  }, [anoAtual, mesAtual]);

  useEffect(() => {
    carregarMeta();
  }, [carregarMeta]);

  // Lista de agendas a que pertenço, para o seletor com caixas de marcar.
  useEffect(() => {
    const carregarAgendas = async () => {
      const { data } = await supabase
        .from('agendas')
        .select('id, nome, cor, principal, tipo_atendimento')
        .order('principal', { ascending: false })
        .order('nome');
      if (data) {
        setAgendasDisponiveis(data);
        setAgendasVisiveis((prev) => (prev.size === 0 ? new Set(data.map((a) => a.id)) : prev));
      }
    };
    carregarAgendas();
  }, []);

  const alternarAgendaVisivel = (agendaId: string) => {
    setAgendasVisiveis((prev) => {
      const nova = new Set(prev);
      if (nova.has(agendaId)) nova.delete(agendaId);
      else nova.add(agendaId);
      return nova;
    });
  };


  const carregarAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let lista: Agendamento[] = [];

      if (user) {
        // Agenda partilhada: sem filtro por usuario_id — o RLS já mostra os
        // agendamentos de toda a equipa, não só os meus.
        const { data, error } = await supabase
          .from('agendamentos')
          .select('*')
          .order('hora', { ascending: true });

        if (!error && data) {
          lista = data;
        }
      }

      setAgendamentos(lista);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarAgendamentos();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => carregarAgendamentos()
      )
      .subscribe();

    // O botão flutuante de "pagamento rápido" vive fora desta página (em
    // App.tsx), por isso avisa por este evento em vez de depender só do
    // Realtime (que pode não estar ativo para esta tabela).
    window.addEventListener(EVENTO_PAGAMENTO_REGISTADO, carregarAgendamentos);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(EVENTO_PAGAMENTO_REGISTADO, carregarAgendamentos);
    };
  }, [carregarAgendamentos]);

  // Função para EXCLUIR um agendamento no Supabase
  const handleDeletarAgendamento = async (id: string | number) => {
    const ok = await confirmar({
      descricao: 'Tens a certeza de que queres eliminar este agendamento?',
      destrutivo: true,
      textoConfirmar: 'Eliminar',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove localmente sem precisar dar F5
      setAgendamentos((prev) => prev.filter((ag) => ag.id !== id));
      toast.success('Agendamento eliminado.');
    } catch (err) {
      toast.error(`Erro ao eliminar: ${getErrorMessage(err)}`);
    }
  };

  // Função para acionar a EDIÇÃO
  const handleEditarAgendamento = (agendamento: Agendamento) => {
    // Passa o ID na URL para o NovoAgendamento ler via searchParams.get('edit')
    navigate(`/novo-agendamento?edit=${agendamento.id}`);
  };

  // Grava a meta (número inteiro, pelo menos 1) quando a utilizadora acaba de escrever.
  const guardarMeta = async () => {
    const novaMeta = parseInt(metaTexto.replace(/\D/g, ''), 10);
    if (!Number.isFinite(novaMeta) || novaMeta < 1) {
      setMetaTexto(String(metaAtendimentos));
      toast.error('A meta tem de ser um número inteiro, pelo menos 1.');
      return;
    }
    setMetaTexto(String(novaMeta));
    if (novaMeta === metaAtendimentos) return;
    const anterior = metaAtendimentos;
    setMetaAtendimentos(novaMeta);

    const { error } = await supabase
      .from('metas_mensais')
      .upsert(
        { ano: anoAtual, mes: mesAtual, meta: novaMeta },
        { onConflict: 'usuario_id,ano,mes' }
      );

    if (error) {
      setMetaAtendimentos(anterior);
      setMetaTexto(String(anterior));
      toast.error('Não foi possível guardar a meta: ' + error.message);
      return;
    }
    toast.success(`Meta de ${novaMeta} atendimentos guardada.`);
  };

  const manipularSelecaoDia = (data: string) => {
    setDataSelecionada(data);
  };

  const estatisticasMes = useMemo(() => {
    const mesAtualStr = String(mesAtual).padStart(2, '0');
    const prefixoMesAtual = `${anoAtual}-${mesAtualStr}`;

    // Realizados = já aconteceram; marcados = ainda vão acontecer (sem faltas).
    const t = totaisDoMes(agendamentos, prefixoMesAtual, getLocalDateString());
    return resumoMeta(t.nRealizado, t.nPrevisto - t.nRealizado, metaAtendimentos);
  }, [agendamentos, metaAtendimentos, anoAtual, mesAtual]);

  // Só as agendas marcadas como visíveis entram no calendário e na lista do dia.
  const agendamentosVisiveis = useMemo(
    () => agendamentos.filter((ag) => !ag.agenda_id || agendasVisiveis.has(ag.agenda_id)),
    [agendamentos, agendasVisiveis]
  );

  const mapaAgendas = useMemo(
    () => new Map(agendasDisponiveis.map((a) => [a.id, a])),
    [agendasDisponiveis]
  );

  const agendamentosDoDia = useMemo(() => {
    return agendamentosVisiveis
      .filter((ag) => ag.data === dataSelecionada)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  }, [agendamentosVisiveis, dataSelecionada]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:items-start">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-3 lg:col-span-2">
        <div>
          <h2 className="font-display relative pb-3.5 text-[32px] font-semibold text-foreground">
            Minha Agenda
          </h2>
          <div className="-mt-3 h-0.5 w-14 bg-gradient-to-r from-primary to-primary-hover" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={carregarAgendamentos}
            disabled={loading}
            title="Recarregar agenda"
            className="h-10 w-10 border-border"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            onClick={() => navigate('/novo-agendamento')}
            className="gap-2 bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={16} />
            Novo Agendamento
          </Button>
        </div>
      </header>

      {/* Coluna Esquerda: Calendário */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
        {agendasDisponiveis.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2.5 border-b border-border pb-4">
            {agendasDisponiveis.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <input
                  type="checkbox"
                  checked={agendasVisiveis.has(a.id)}
                  onChange={() => alternarAgendaVisivel(a.id)}
                  className="sr-only"
                />
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: a.cor,
                    backgroundColor: agendasVisiveis.has(a.id) ? a.cor : 'transparent',
                  }}
                />
                <span className={agendasVisiveis.has(a.id) ? 'text-foreground' : ''}>{a.nome}</span>
              </label>
            ))}
          </div>
        )}
        <Calendar
          onDaySelect={manipularSelecaoDia}
          onMonthChange={setMesExibido}
          agendamentos={agendamentosVisiveis}
          mapaAgendas={mapaAgendas}
        />
      </div>

      {/* Coluna Direita: Lista de Agendamentos */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20">
          <ListaAgendamentos
            appointments={agendamentosDoDia}
            loading={loading}
            onDelete={handleDeletarAgendamento}
            onEdit={handleEditarAgendamento}
            onPago={carregarAgendamentos}
            mapaAgendas={mapaAgendas}
          />
        </div>

        {/* Card de Meta */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Meta de Atendimentos</h3>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {mesExibido.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <span>Meta:</span>
              <Input
                type="text"
                inputMode="numeric"
                aria-label="Meta de atendimentos do mês"
                value={metaTexto}
                onChange={(e) => setMetaTexto(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={guardarMeta}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="h-7 w-14 rounded-md border-border bg-background text-center text-xs font-bold text-foreground"
              />
            </div>
          </div>

          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground tabular-nums">{estatisticasMes.texto}</span>
            <span className="text-sm font-bold text-primary">
              {estatisticasMes.pctRealizado}%
            </span>
          </div>

          {/* Escuro: realizados. Claro: o que está marcado. */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-background border border-border">
            <div
              className="absolute inset-y-0 left-0 bg-primary/30 transition-all duration-500 ease-out"
              style={{ width: `${estatisticasMes.pctComMarcados}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary-hover transition-all duration-500 ease-out"
              style={{ width: `${estatisticasMes.pctRealizado}%` }}
            />
          </div>

          {estatisticasMes.atingida ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
              <CheckCircle2 size={14} />
              Parabéns! Meta do mês atingida!
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{estatisticasMes.rodape}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;