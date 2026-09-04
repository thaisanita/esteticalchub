import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Target, CheckCircle2, RefreshCw } from 'lucide-react';
import Calendar from '../components/Calendar';
import ListaAgendamentos from '../components/ListaAgendamentos';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Agendamento {
  id?: string | number;
  data: string;
  cliente: string;
  preco: number | string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
  hora?: string;
  procedimento?: string;
  origem?: 'supabase' | 'google';
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
  const [metaAtendimentos, setMetaAtendimentos] = useState<number>(() => {
    return Number(localStorage.getItem('meta_atendimentos_mes')) || 30;
  });

  const navigate = useNavigate();

  const carregarAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      let listaCombinada: Agendamento[] = [];

      if (user && session.provider_token) {
        supabase
          .from('profiles')
          .upsert({
            id: user.id,
            google_calendar_connected: true,
            google_refresh_token: session.provider_refresh_token || null,
            updated_at: new Date().toISOString(),
          })
          .then();
      }

      if (user) {
        const { data, error } = await supabase
          .from('agendamentos')
          .select('*')
          .eq('usuario_id', user.id)
          .order('hora', { ascending: true });

        if (!error && data) {
          listaCombinada = data.map((item) => ({ ...item, origem: 'supabase' }));
        }
      }

      const providerToken = session?.provider_token || localStorage.getItem('google_access_token');
      if (session?.provider_token) {
        localStorage.setItem('google_access_token', session.provider_token);
      }

      if (providerToken) {
        try {
          const res = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime',
            {
              headers: { Authorization: `Bearer ${providerToken}` },
            }
          );

          if (res.ok) {
            const googleData = await res.json();
            const eventosGoogle: Agendamento[] = (googleData.items || []).map((evt: any) => {
              const dataInicio = evt.start?.dateTime || evt.start?.date || '';
              const dataFormatada = dataInicio.split('T')[0];
              const horaFormatada = evt.start?.dateTime
                ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Dia todo';

              return {
                id: evt.id,
                data: dataFormatada,
                cliente: evt.summary || 'Agendamento Google',
                preco: 0,
                hora: horaFormatada,
                procedimento: evt.description || 'Sincronizado via Google',
                origem: 'google',
              };
            });

            listaCombinada = [...listaCombinada, ...eventosGoogle];
          }
        } catch (err) {
          console.error('Erro ao buscar eventos do Google Calendar:', err);
        }
      }

      setAgendamentos(listaCombinada);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarAgendamentos]);

  // Função para EXCLUIR um agendamento no Supabase
  const handleDeletarAgendamento = async (id: string | number, origem?: string) => {
    if (origem === 'google') {
      alert('Eventos vindos do Google Calendar devem ser excluídos direto pelo Google Calendar.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove localmente sem precisar dar F5
      setAgendamentos((prev) => prev.filter((ag) => ag.id !== id));
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Função para acionar a EDIÇÃO
  const handleEditarAgendamento = (agendamento: Agendamento) => {
    if (agendamento.origem === 'google') {
      alert('Eventos do Google Calendar devem ser editados pelo próprio Google.');
      return;
    }
    // Passa o ID na URL para o NovoAgendamento ler via searchParams.get('edit')
    navigate(`/novo-agendamento?edit=${agendamento.id}`);
  };

  const handleMetaChange = (valor: number) => {
    const novaMeta = valor > 0 ? valor : 1;
    setMetaAtendimentos(novaMeta);
    localStorage.setItem('meta_atendimentos_mes', String(novaMeta));
  };

  const manipularSelecaoDia = (data: string) => {
    setDataSelecionada(data);
  };

  const estatisticasMes = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtualStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const prefixoMesAtual = `${anoAtual}-${mesAtualStr}`;

    const atendimentosDoMes = agendamentos.filter((ag) => {
      if (!ag.data) return false;
      return ag.data.startsWith(prefixoMesAtual);
    });

    const realizados = atendimentosDoMes.length;
    const porcentagem = Math.min(Math.round((realizados / metaAtendimentos) * 100), 100);

    return { realizados, porcentagem };
  }, [agendamentos, metaAtendimentos]);

  const agendamentosDoDia = useMemo(() => {
    return agendamentos.filter((ag) => ag.data === dataSelecionada);
  }, [agendamentos, dataSelecionada]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
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
      <div className="rounded-2xl border border-border bg-card p-7 shadow-lg shadow-black/20">
        <Calendar onDaySelect={manipularSelecaoDia} agendamentos={agendamentos} />
      </div>

      {/* Coluna Direita: Lista de Agendamentos */}
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-lg shadow-black/20">
          <ListaAgendamentos 
            appointments={agendamentosDoDia} 
            loading={loading}
            onDelete={handleDeletarAgendamento}
            onEdit={handleEditarAgendamento}
          />
        </div>

        {/* Card de Meta */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Meta de Atendimentos</h3>
                <p className="text-[11px] text-muted-foreground">Progresso do mês atual</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <span>Meta:</span>
              <Input
                type="number"
                min="1"
                value={metaAtendimentos}
                onChange={(e) => handleMetaChange(Number(e.target.value))}
                className="h-7 w-14 rounded-md border-border bg-background text-center text-xs font-bold text-foreground"
              />
            </div>
          </div>

          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {estatisticasMes.realizados} <span className="text-xs font-normal text-muted-foreground">/ {metaAtendimentos} realizados</span>
            </span>
            <span className="text-sm font-bold text-primary">
              {estatisticasMes.porcentagem}%
            </span>
          </div>

          <div className="relative h-3 w-full overflow-hidden rounded-full bg-background border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-500 ease-out"
              style={{ width: `${estatisticasMes.porcentagem}%` }}
            />
          </div>

          {estatisticasMes.porcentagem >= 100 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
              <CheckCircle2 size={14} />
              Parabéns! Meta do mês atingida!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;