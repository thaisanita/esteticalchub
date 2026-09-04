import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { 
  X, 
  Calendar as CalendarIcon, 
  Check, 
  Loader2, 
  AlertCircle,
  UserCheck
} from 'lucide-react';

interface AgendamentoInfo {
  id: string;
  cliente: string;
  procedimento: string;
  data: string;
  hora: string;
  ponto_atendimento?: string;
  status_confirmacao: 'confirmado' | 'talvez' | 'cancelado' | 'pendente';
  data_resposta?: string;
  criador_nome?: string;
}

export const ConfirmacaoAtendimento = () => {
  const { token } = useParams<{ token: string }>();

  const [agendamento, setAgendamento] = useState<AgendamentoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<'confirmado' | 'talvez' | 'cancelado'>('confirmado');
  const [erro, setErro] = useState<string | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(true);

  useEffect(() => {
    const buscarAgendamento = async () => {
      if (!token) {
        setErro('Link de confirmação inválido.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('agendamentos')
          .select('id, cliente, procedimento, data, hora, ponto_atendimento, status_confirmacao')
          .eq('token_confirmacao', token)
          .maybeSingle();

        if (error || !data) {
          setErro('Agendamento não encontrado ou o link expirou.');
        } else {
          setAgendamento({
            ...data,
            criador_nome: data.ponto_atendimento || 'Gabinete'
          });
          if (data.status_confirmacao && data.status_confirmacao !== 'pendente') {
            setResposta(data.status_confirmacao);
          }
        }
      } catch (e) {
        setErro('Ocorreu um erro ao carregar as informações.');
      } finally {
        setLoading(false);
      }
    };

    buscarAgendamento();
  }, [token]);

  const salvarResposta = async (novaResposta: 'confirmado' | 'talvez' | 'cancelado') => {
    if (!agendamento) return;
    setResposta(novaResposta);
    setEnviando(true);

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status_confirmacao: novaResposta })
        .eq('id', agendamento.id);

      if (error) throw error;

      setAgendamento({
        ...agendamento,
        status_confirmacao: novaResposta
      });
    } catch (err) {
      alert('Não foi possível salvar sua resposta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const formatarDataHora = () => {
    if (!agendamento?.data) return '';
    const apenasData = agendamento.data.split('T')[0];
    const [ano, mes, dia] = apenasData.split('-');
    
    // Formata a data de maneira limpa (ex: "15/09, 14:30")
    return `${dia}/${mes}/${ano} às ${agendamento.hora || 'Horário a combinar'}`;
  };

  // Gerador de link do Google Calendar para o cliente adicionar o agendamento
  const gerarGoogleCalendarLink = () => {
    if (!agendamento) return '#';
    const apenasData = agendamento.data.split('T')[0].replace(/-/g, '');
    const horaFormatada = (agendamento.hora || '09:00').replace(':', '') + '00';
    
    const dataInicio = `${apenasData}T${horaFormatada}`;
    const titulo = encodeURIComponent(`${agendamento.procedimento} - ${agendamento.criador_nome}`);
    const detalhes = encodeURIComponent(`Agendamento de ${agendamento.procedimento} para ${agendamento.cliente}`);
    const local = encodeURIComponent(agendamento.ponto_atendimento || '');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${dataInicio}/${dataInicio}&details=${detalhes}&location=${local}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#D1D5DB] flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (erro || !agendamento) {
    return (
      <div className="min-h-screen bg-[#D1D5DB] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl p-6 text-center space-y-3 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900">Evento Indisponível</h2>
          <p className="text-sm text-zinc-600">{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#C8CBD1] flex flex-col items-center justify-between font-sans text-zinc-900 antialiased selection:bg-none select-none">
      
      {/* CARD SUPERIOR DE DETALHES DO EVENTO */}
      <div className="w-full max-w-md bg-[#E5E7EB] min-h-screen sm:min-h-0 sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden relative">
        
        <div className="p-5 space-y-6">
          {/* Header Superior */}
          <div className="flex items-center justify-between">
            <button 
              type="button" 
              onClick={() => setDrawerAberto(false)}
              className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center text-zinc-700 hover:bg-black/10 transition-colors"
            >
              <X size={20} />
            </button>
            <span className="font-semibold text-base text-zinc-800">Evento</span>
            <div className="w-9" />
          </div>

          {/* Título do Evento */}
          <div className="pt-2">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
              {agendamento.procedimento}
            </h1>
          </div>

          {/* Bloco Data e Hora */}
          <div className="bg-[#D8DCFAF0] backdrop-blur-sm rounded-2xl p-4 space-y-1">
            <p className="text-xs font-medium text-zinc-500">Data e hora</p>
            <p className="text-base font-semibold text-zinc-900">
              {formatarDataHora()}
            </p>
            <a 
              href={gerarGoogleCalendarLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-700 hover:underline pt-0.5 inline-flex items-center gap-1"
            >
              <CalendarIcon size={12} />
              Adicionar ao calendário
            </a>
          </div>

          {/* Lista Quem Vai */}
          <div className="bg-[#D8DCF0] backdrop-blur-sm rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-zinc-900">Quem vai</span>
              <span className="text-xs font-medium text-zinc-500">2 pessoas</span>
            </div>

            <div className="divide-y divide-black/5">
              {/* Criador/a */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-300 flex items-center justify-center text-zinc-600 font-bold text-sm overflow-hidden">
                    {agendamento.criador_nome?.[0] || 'G'}
                  </div>
                  <span className="font-medium text-sm text-zinc-900">{agendamento.criador_nome}</span>
                </div>
                <span className="text-xs text-zinc-500">Local</span>
              </div>

              {/* Cliente (Eu) */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {agendamento.cliente?.[0] || 'C'}
                  </div>
                  <span className="font-medium text-sm text-zinc-900">Eu ({agendamento.cliente})</span>
                </div>
                <span className="text-xs font-semibold text-zinc-600">
                  {resposta === 'confirmado' && 'Confirmado'}
                  {resposta === 'talvez' && 'Talvez'}
                  {resposta === 'cancelado' && 'Não vou'}
                  {!resposta && 'Pendente'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTAO PARA REABRIR O DRAWER SE ESTIVER FECHADO */}
        {!drawerAberto && (
          <div className="p-4 bg-white/80 backdrop-blur-md border-t border-black/5">
            <button
              onClick={() => setDrawerAberto(true)}
              className="w-full py-3 bg-zinc-900 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2"
            >
              <UserCheck size={16} /> Alterar Resposta
            </button>
          </div>
        )}

        {/* BOTTOM SHEET / DRAWER INTERATIVO DE RESPOSTA */}
        {drawerAberto && (
          <div className="bg-white rounded-t-3xl p-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] space-y-4 animate-in slide-in-from-bottom-5 duration-200">
            {/* Header do Drawer */}
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-lg text-zinc-900">Responder</span>
              <button 
                onClick={() => setDrawerAberto(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Opções de Seleção de Presença */}
            <div className="bg-zinc-50/80 rounded-2xl border border-zinc-200/80 divide-y divide-zinc-200/80 overflow-hidden">
              
              {/* Opção 1: Vou */}
              <button
                type="button"
                onClick={() => salvarResposta('confirmado')}
                disabled={enviando}
                className="w-full p-4 flex items-center gap-3 hover:bg-zinc-100/60 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  resposta === 'confirmado' 
                    ? 'bg-black text-white' 
                    : 'border-2 border-zinc-400 bg-transparent'
                }`}>
                  {resposta === 'confirmado' && <Check size={14} strokeWidth={3} />}
                </div>
                <span className="font-medium text-base text-zinc-900">Vou</span>
              </button>

              {/* Opção 2: Talvez */}
              <button
                type="button"
                onClick={() => salvarResposta('talvez')}
                disabled={enviando}
                className="w-full p-4 flex items-center gap-3 hover:bg-zinc-100/60 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  resposta === 'talvez' 
                    ? 'bg-black text-white' 
                    : 'border-2 border-zinc-400 bg-transparent'
                }`}>
                  {resposta === 'talvez' && <Check size={14} strokeWidth={3} />}
                </div>
                <span className="font-medium text-base text-zinc-900">Talvez</span>
              </button>

              {/* Opção 3: Não vou */}
              <button
                type="button"
                onClick={() => salvarResposta('cancelado')}
                disabled={enviando}
                className="w-full p-4 flex items-center gap-3 hover:bg-zinc-100/60 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  resposta === 'cancelado' 
                    ? 'bg-black text-white' 
                    : 'border-2 border-zinc-400 bg-transparent'
                }`}>
                  {resposta === 'cancelado' && <Check size={14} strokeWidth={3} />}
                </div>
                <span className="font-medium text-base text-zinc-900">Não vou</span>
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ConfirmacaoAtendimento;