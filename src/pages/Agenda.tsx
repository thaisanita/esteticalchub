import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Target, CheckCircle2, RefreshCw } from 'lucide-react';
import Calendar from '../components/Calendar';
import ListaAgendamentos from '../components/ListaAgendamentos';
import { supabase } from '../supabase';
import { getErrorMessage } from '@/lib/utils';
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
    } else {
      // Ainda não existe meta para este mês — cria já com o valor padrão,
      // para este mês ficar registado desde o início (e não só quando editado).
      const { data: novaMeta } = await supabase
        .from('metas_mensais')
        .insert([{ ano: anoAtual, mes: mesAtual, meta: 30 }])
        .select('meta')
        .single();
      if (novaMeta) setMetaAtendimentos(novaMeta.meta);
    }
  }, [anoAtual, mesAtual]);

  useEffect(() => {
    carregarMeta();
  }, [carregarMeta]);


  const carregarAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let lista: Agendamento[] = [];

      if (user) {
        const { data, error } = await supabase
          .from('agendamentos')
          .select('*')
          .eq('usuario_id', user.id)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarAgendamentos]);

  // Função para EXCLUIR um agendamento no Supabase
  const handleDeletarAgendamento = async (id: string | number) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove localmente sem precisar dar F5
      setAgendamentos((prev) => prev.filter((ag) => ag.id !== id));
    } catch (err) {
      alert(`Erro ao excluir: ${getErrorMessage(err)}`);
    }
  };

  // Função para acionar a EDIÇÃO
  const handleEditarAgendamento = (agendamento: Agendamento) => {
    // Passa o ID na URL para o NovoAgendamento ler via searchParams.get('edit')
    navigate(`/novo-agendamento?edit=${agendamento.id}`);
  };

  const handleMetaChange = async (valor: number) => {
    const novaMeta = valor > 0 ? valor : 1;
    setMetaAtendimentos(novaMeta);

    const { error } = await supabase
      .from('metas_mensais')
      .upsert(
        { ano: anoAtual, mes: mesAtual, meta: novaMeta },
        { onConflict: 'usuario_id,ano,mes' }
      );

    if (error) console.error('Erro ao salvar meta do mês:', error.message);
  };

  const manipularSelecaoDia = (data: string) => {
    setDataSelecionada(data);
  };

  const estatisticasMes = useMemo(() => {
    const mesAtualStr = String(mesAtual).padStart(2, '0');
    const prefixoMesAtual = `${anoAtual}-${mesAtualStr}`;

    const atendimentosDoMes = agendamentos.filter((ag) => {
      if (!ag.data) return false;
      return ag.data.startsWith(prefixoMesAtual);
    });

    const realizados = atendimentosDoMes.length;
    const porcentagem = Math.min(Math.round((realizados / metaAtendimentos) * 100), 100);

    return { realizados, porcentagem };
  }, [agendamentos, metaAtendimentos, anoAtual, mesAtual]);

  const agendamentosDoDia = useMemo(() => {
    return agendamentos
      .filter((ag) => ag.data === dataSelecionada)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
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
        <Calendar onDaySelect={manipularSelecaoDia} onMonthChange={setMesExibido} agendamentos={agendamentos} />
      </div>

      {/* Coluna Direita: Lista de Agendamentos */}
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-lg shadow-black/20">
          <ListaAgendamentos 
            appointments={agendamentosDoDia} 
            loading={loading}
            onDelete={handleDeletarAgendamento}
            onEdit={handleEditarAgendamento}
            onPago={carregarAgendamentos}
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
                <p className="text-[11px] text-muted-foreground capitalize">
                  {mesExibido.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </p>
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