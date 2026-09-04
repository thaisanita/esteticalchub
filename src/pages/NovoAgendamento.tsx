import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  Pencil, 
  User, 
  Sparkles, 
  MapPin, 
  Clock, 
  Euro, 
  ArrowLeft, 
  Save, 
  History,
  Phone,
  Mail,
  Bell
} from 'lucide-react';

interface NovoAgendamentoProps {
  setAgendamentos?: (novosDados: any[]) => void;
}

const NovoAgendamento: React.FC<NovoAgendamentoProps> = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dataAgendamento, setDataAgendamento] = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );
  const idParaEditar = searchParams.get('edit');

  const [cliente, setCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('10:00');
  const [preco, setPreco] = useState('');
  const [pontoAtendimento, setPontoAtendimento] = useState('');
  
  // Configurações de Notificação
  const [lembrete1Dia, setLembrete1Dia] = useState(true);
  const [lembrete1Hora, setLembrete1Hora] = useState(true);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [sugestoesCliente, setSugestoesCliente] = useState<string[]>([]);
  const [sugestoesProcedimento, setSugestoesProcedimento] = useState<string[]>([]);
  const [sugestoesPonto, setSugestoesPonto] = useState<string[]>([]);

  // Atualiza a hora de fim automaticamente ao alterar o início
  const handleHoraInicioChange = (novaHoraInicio: string) => {
    setHoraInicio(novaHoraInicio);
    if (!novaHoraInicio) return;
    const [horas, minutos] = novaHoraInicio.split(':').map(Number);
    const novaHoraFim = (horas + 1) % 24;
    const horaFormatada = String(novaHoraFim).padStart(2, '0') + ':' + String(minutos).padStart(2, '0');
    setHoraFim(horaFormatada);
  };

  useEffect(() => {
    setSugestoesCliente(JSON.parse(localStorage.getItem('hist_clientes') || '[]'));
    setSugestoesProcedimento(JSON.parse(localStorage.getItem('hist_procedimentos') || '[]'));
    setSugestoesPonto(JSON.parse(localStorage.getItem('hist_pontos') || '[]'));
  }, []);

  const salvarHistorico = (chave: string, valor: string) => {
    if (!valor.trim()) return;
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');
    const nova = [valor.trim(), ...lista.filter((i: string) => i !== valor.trim())].slice(0, 5);
    localStorage.setItem(chave, JSON.stringify(nova));
  };

  useEffect(() => {
    const buscarDados = async () => {
      if (idParaEditar) {
        try {
          const { data, error } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('id', idParaEditar)
            .single();

          if (data && !error) {
            setCliente(data.cliente || '');
            setTelefoneCliente(data.telefone_cliente || '');
            setEmailCliente(data.email_cliente || '');
            setProcedimento(data.procedimento || '');
            setPreco(
              data.preco !== undefined && data.preco !== null
                ? String(data.preco)
                : data.valor !== undefined && data.valor !== null
                ? String(data.valor)
                : ''
            );
            setPontoAtendimento(data.ponto_atendimento || data.pontoAtendimento || '');
            setDataAgendamento(data.data || '');
            setHoraInicio(data.hora || '09:00');
            if (data.hora_fim) setHoraFim(data.hora_fim);
          }
        } catch (e) {
          console.error('Erro ao buscar agendamento:', e);
        }
      }
      setLoading(false);
    };
    buscarDados();
  }, [idParaEditar]);

  // Função de gerenciamento da fila de notificações com mensagens de log para o console
  const criarFilaNotificacoes = async (agendamentoId: string, userId: string) => {
    const dataHoraAtendimento = new Date(`${dataAgendamento}T${horaInicio}:00`);
    const notificacoes = [];

    // Lembrete de 1 Dia Antes
    if (lembrete1Dia) {
      const data1Dia = new Date(dataHoraAtendimento.getTime() - 24 * 60 * 60 * 1000);
      if (data1Dia > new Date()) {
        notificacoes.push({
          agendamento_id: agendamentoId,
          usuario_id: userId,
          tipo_destino: 'cliente',
          canal: telefoneCliente ? 'whatsapp' : 'email',
          antecedencia: '1_dia',
          data_disparo: data1Dia.toISOString(),
          status: 'pendente'
        });
      }
    }

    // Lembrete de 1 Hora Antes
    if (lembrete1Hora) {
      const data1Hora = new Date(dataHoraAtendimento.getTime() - 60 * 60 * 1000);
      if (data1Hora > new Date()) {
        notificacoes.push({
          agendamento_id: agendamentoId,
          usuario_id: userId,
          tipo_destino: 'cliente',
          canal: telefoneCliente ? 'whatsapp' : 'email',
          antecedencia: '1_hora',
          data_disparo: data1Hora.toISOString(),
          status: 'pendente'
        });
      }
    }

    if (notificacoes.length > 0) {
      if (idParaEditar) {
        await supabase
          .from('fila_notificacoes')
          .delete()
          .eq('agendamento_id', agendamentoId)
          .eq('status', 'pendente');
      }

      console.log('🔔 Tentando agendar notificações na fila:', notificacoes);

      const { data: resultFila, error } = await supabase
        .from('fila_notificacoes')
        .insert(notificacoes)
        .select();

      if (error) {
        console.error('❌ Erro ao agendar notificações:', error.message);
        alert(`Erro ao agendar notificação: ${error.message}`);
      } else {
        console.log('✅ Lembretes agendados com sucesso na fila_notificacoes!', resultFila);
      }
    } else {
      console.warn('⚠️ Nenhuma notificação agendada. Verifique se as opções de lembrete estão marcadas e se a data selecionada é futura.');
    }
  };

  const manipularSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert('Sua sessão expirou. Por favor, entre novamente no sistema.');
        navigate('/login');
        return;
      }

      const valorFormatado = parseFloat(preco.replace(',', '.')) || 0;

      const dadosParaEnviar = {
        cliente: cliente.trim(),
        telefone_cliente: telefoneCliente.trim(),
        email_cliente: emailCliente.trim(),
        procedimento: procedimento.trim(),
        data: dataAgendamento,
        hora: horaInicio,
        hora_fim: horaFim,
        preco: valorFormatado,
        valor: valorFormatado,
        ponto_atendimento: pontoAtendimento.trim(),
        usuario_id: user.id,
      };

      let agendamentoId = idParaEditar;

      if (idParaEditar) {
        const { error } = await supabase
          .from('agendamentos')
          .update(dadosParaEnviar)
          .eq('id', idParaEditar);

        if (error) throw error;
        console.log('✅ Agendamento atualizado com sucesso:', agendamentoId);
      } else {
        const { data, error } = await supabase
          .from('agendamentos')
          .insert([dadosParaEnviar])
          .select('id')
          .single();

        if (error) throw error;
        agendamentoId = data.id;
        console.log('✅ Novo agendamento criado com sucesso ID:', agendamentoId);
      }

      if (agendamentoId) {
        await criarFilaNotificacoes(agendamentoId, user.id);
      }

      salvarHistorico('hist_clientes', cliente);
      salvarHistorico('hist_procedimentos', procedimento);
      salvarHistorico('hist_pontos', pontoAtendimento);
      
      // Redireciona de volta para a lista de procedimentos na data do agendamento
      navigate(`/procedimentos?date=${dataAgendamento}`);
    } catch (err: any) {
      console.error('❌ Erro ao salvar agendamento:', err);
      alert(`Erro ao salvar agendamento: ${err.message || 'Tente novamente.'}`);
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar dados do agendamento...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {idParaEditar ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina os detalhes do atendimento e configure os lembretes do cliente
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          {idParaEditar ? <Pencil size={18} /> : <Calendar size={18} />}
        </div>
      </div>

      <form onSubmit={manipularSalvar} className="space-y-4">
        {/* Bloco 1: Data e Local */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                Data
              </label>
              <Input
                type="date"
                required
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />
                Espaço / Local
              </label>
              <Input
                type="text"
                value={pontoAtendimento}
                onChange={(e) => setPontoAtendimento(e.target.value)}
                placeholder="Ex: Studio Central"
                className="h-10 bg-background/50 border-border"
              />
              {sugestoesPonto.length > 0 && !pontoAtendimento && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {sugestoesPonto.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPontoAtendimento(item)}
                      className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors flex items-center gap-1"
                    >
                      <History size={10} />
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloco 2: Cliente e Contatos */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={13} className="text-primary" />
              Nome da Cliente
            </label>
            <Input
              type="text"
              required
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Digite o nome completo"
              className="h-10 bg-background/50 border-border"
            />
            {sugestoesCliente.length > 0 && !cliente && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {sugestoesCliente.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCliente(item)}
                    className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone size={13} className="text-primary" />
                WhatsApp / Telefone
              </label>
              <Input
                type="tel"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                placeholder="+351 912 345 678"
                className="h-10 bg-background/50 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail size={13} className="text-primary" />
                E-mail da Cliente
              </label>
              <Input
                type="email"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
                placeholder="cliente@email.com"
                className="h-10 bg-background/50 border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" />
              Procedimento
            </label>
            <Input
              type="text"
              required
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              placeholder="Ex: Microblading, Limpeza de Pele..."
              className="h-10 bg-background/50 border-border"
            />
            {sugestoesProcedimento.length > 0 && !procedimento && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {sugestoesProcedimento.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProcedimento(item)}
                    className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bloco 3: Horários e Preço */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock size={13} className="text-primary" />
                Início
              </label>
              <Input
                type="time"
                required
                value={horaInicio}
                onChange={(e) => handleHoraInicioChange(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium text-center px-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock size={13} className="text-muted-foreground" />
                Fim
              </label>
              <Input
                type="time"
                required
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium text-center px-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Euro size={13} className="text-emerald-500" />
                Valor (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0.00"
                className="h-10 bg-background/50 border-border font-bold text-emerald-500 text-center"
              />
            </div>
          </div>
        </div>

        {/* Bloco 4: Notificações Lembretes */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Bell size={13} className="text-primary" />
            Lembretes Automáticos de Atendimento
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-background/50 border border-border p-3 rounded-xl hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={lembrete1Dia}
                onChange={(e) => setLembrete1Dia(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>1 Dia antes do evento</span>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-background/50 border border-border p-3 rounded-xl hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={lembrete1Hora}
                onChange={(e) => setLembrete1Hora(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>1 Hora antes do evento</span>
            </label>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 h-12 border-border rounded-xl gap-2 font-medium"
          >
            <ArrowLeft size={16} />
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={salvando}
            className="flex-[2] h-12 bg-gradient-to-r from-primary to-primary/90 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 rounded-xl gap-2"
          >
            <Save size={16} />
            {salvando ? 'A guardar...' : idParaEditar ? 'Salvar Alterações' : 'Confirmar Agendamento'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NovoAgendamento;