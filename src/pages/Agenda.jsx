import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from '../components/Calendar';
import ListaAgendamentos from '../components/ListaAgendamentos';
import { supabase } from '../supabase'; 

const Agenda = () => {
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const carregarAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscamos todos os agendamentos do usuário para o Calendar marcar os pontos (dots)
      // Nota: Para o Calendar mostrar os pontos de todos os dias, o ideal seria buscar o mês todo,
      // mas mantemos sua lógica de buscar por data selecionada para a lista abaixo.
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('usuario_id', user.id); // Removi o filtro de data aqui para o Calendário "ver" todos os dias

      if (error) throw error;

      setAgendamentos(data || []);
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, []); // Carrega uma vez ou quando houver mudança global

  useEffect(() => {
    carregarAgendamentos();
  }, [carregarAgendamentos]);

  const manipularSelecaoDia = (data) => {
    setDataSelecionada(data);
    navigate(`/procedimentos?date=${data}`);
  };

  // Filtramos os agendamentos apenas para a lista inferior (dia selecionado)
  const agendamentosDoDia = agendamentos.filter(ag => ag.data === dataSelecionada);

  return (
    /* A classe agenda-page-container agora faz todo o trabalho de centralizar e afastar da borda */
    <div className="agenda-page-container">
      <header className="agenda-header-custom">
        <h2 className="agenda-titulo-central">Minha Agenda</h2>
      </header>

      <div className="calendario-wrapper-central">
        <Calendar 
          onDaySelect={manipularSelecaoDia} 
          agendamentos={agendamentos} 
        />
      </div>

      <div className="lista-container-ajustada">
        <ListaAgendamentos 
          appointments={agendamentosDoDia} 
          loading={loading} 
        />
      </div>
    </div>
  );
};

export default Agenda;