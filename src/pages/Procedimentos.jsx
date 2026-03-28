import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Procedimentos = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const dataSelecionada = searchParams.get('date');
  const idioma = localStorage.getItem('config_idioma') || 'Português (PT)';

  const textos = {
    'Português (PT)': {
      titulo: 'Atendimentos do Dia', encontrado: 'atendimento encontrado', encontrados: 'atendimentos encontrados', vazio: 'Nenhum atendimento para este dia.', faltou: 'FALTOU', editar: 'EDITAR', total: 'Total Realizado:', lembrete: 'Lembrete Importante:', lembreteMsg: 'Se você acabou de editar um preço ou marcar falta, lembre-se de atualizar a porcentagem no seu relatório financeiro.', btnVoltar: 'Voltar para Agenda', btnNovo: '+ Novo Cliente', confFalta: 'A cliente faltou? O valor será zerado para o relatório.', confExcluir: 'Tem certeza que deseja excluir este atendimento?', formatoData: 'pt-PT', selecione: 'Selecione um dia'
    },
    'English (US)': {
      titulo: 'Appointments of the Day', encontrado: 'appointment found', encontrados: 'appointments found', vazio: 'No appointments for this day.', faltou: 'NO-SHOW', editar: 'EDIT', total: 'Total Revenue:', lembrete: 'Important Reminder:', lembreteMsg: 'If you just edited a price or marked a no-show, remember to update the percentage in your financial report.', btnVoltar: 'Back to Schedule', btnNovo: '+ New Client', confFalta: 'Did the client miss the appointment? The value will be zeroed for reports.', confExcluir: 'Are you sure you want to delete this appointment?', formatoData: 'en-US', selecione: 'Select a day'
    },
    'Español (ES)': {
      titulo: 'Citas del Día', encontrado: 'cita encontrada', encontrados: 'citas encontradas', vazio: 'No hay citas para este día.', faltou: 'FALTÓ', editar: 'EDITAR', total: 'Total Realizado:', lembrete: 'Recordatorio Importante:', lembreteMsg: 'Si acaba de editar un precio o marcar una falta, recuerde actualizar el porcentaje en su informe financiero.', btnVoltar: 'Volver a la Agenda', btnNovo: '+ Nuevo Cliente', confFalta: '¿La cliente faltó? El valor se pondrá a cero para el informe.', confExcluir: '¿Está seguro de que desea eliminar esta cita?', formatoData: 'es-ES', selecione: 'Seleccione un día'
    }
  }[idioma];

  const buscarAtendimentos = React.useCallback(async () => {
    if (!dataSelecionada) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('data', dataSelecionada)
      .order('hora', { ascending: true });

    if (error) {
      console.error("Erro ao buscar atendimentos:", error.message);
    } else {
      setAgendamentos(data || []);
    }
    setLoading(false);
  }, [dataSelecionada]);

  useEffect(() => { buscarAtendimentos(); }, [dataSelecionada, buscarAtendimentos]);

  const marcarFalta = async (id, procedimentoAtual) => {
    if (window.confirm(textos.confFalta)) {
      const tagFalta = idioma === 'English (US)' ? '(NO-SHOW)' : '(FALTOU)';
      const novoProcedimento = procedimentoAtual.includes(tagFalta) ? procedimentoAtual : `${procedimentoAtual} ${tagFalta}`;
      const { error } = await supabase.from('agendamentos').update({ valor: 0, procedimento: novoProcedimento }).eq('id', id);
      if (!error) buscarAtendimentos();
    }
  };

  const excluirAgendamento = async (id) => {
    if (window.confirm(textos.confExcluir)) {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (!error) buscarAtendimentos();
    }
  };

  const totalFaturado = agendamentos.reduce((acc, item) => {
    const valorRaw = item.valor || item.preco || '0';
    const valor = parseFloat(String(valorRaw).replace(',', '.'));
    return acc + (valor || 0);
  }, 0);

  const dataFormatada = dataSelecionada
    ? new Date(dataSelecionada + 'T00:00:00').toLocaleDateString(textos.formatoData, { weekday: 'long', day: 'numeric', month: 'long' })
    : textos.selecione;

  if (loading && dataSelecionada) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: "'DM Sans', sans-serif", color: '#94a3b8' }}>
      A carregar atendimentos...
    </div>
  );

  return (
    <div className="app-container" style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .proc-card:hover { box-shadow: 0 6px 20px rgba(79,70,229,0.08) !important; }
        .proc-edit-btn:hover { color: #4f46e5 !important; background: #ede9fe !important; }
        .proc-falta-btn:hover { color: #ef4444 !important; background: #fee2e2 !important; }
        .proc-del-btn:hover { opacity: 0.8 !important; }
        .proc-btn-nav:hover { opacity: 0.88 !important; transform: translateY(-1px) !important; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <h2 style={s.titulo}>{textos.titulo}</h2>
        <p style={s.dataLabel}>{dataFormatada}</p>
        {agendamentos.length > 0 && (
          <div style={s.countBadge}>
            {agendamentos.length} {agendamentos.length === 1 ? textos.encontrado : textos.encontrados}
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={s.lista}>
        {agendamentos.length === 0 && !loading && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>🗓️</div>
            <p style={s.emptyText}>{textos.vazio}</p>
          </div>
        )}
        {agendamentos.map((item) => {
          const valorNum = parseFloat(String(item.valor || item.preco || '0').replace(',', '.'));
          const isFalta = valorNum === 0;
          return (
            <div key={item.id} className="proc-card" style={{ ...s.card, opacity: isFalta ? 0.65 : 1 }}>
              <div style={{ ...s.cardAccent, background: isFalta ? '#e2e8f0' : 'linear-gradient(180deg,#4f46e5,#6366f1)' }} />
              <div style={s.cardContent}>
                <div style={s.cardTop}>
                  <div style={s.cardInfo}>
                    <div style={s.cardHora}>🕒 {item.hora}</div>
                    <div style={s.cardCliente}>
                      <span>👤 {item.cliente}</span>
                      <button className="proc-del-btn" onClick={() => excluirAgendamento(item.id)} style={s.delBtn}>🗑️</button>
                    </div>
                    <div style={s.cardProc}>✨ {item.procedimento}</div>
                    <div style={s.cardLocal}>📍 {item.ponto_atendimento || item.pontoAtendimento}</div>
                  </div>
                  <div style={s.cardRight}>
                    <span style={{ ...s.cardValor, color: isFalta ? '#94a3b8' : '#059669' }}>
                      € {valorNum.toFixed(2)}
                    </span>
                    <div style={s.cardActions}>
                      {!isFalta && (
                        <button className="proc-falta-btn" onClick={() => marcarFalta(item.id, item.procedimento)} style={s.faltaBtn}>
                          {textos.faltou}
                        </button>
                      )}
                      <button className="proc-edit-btn" onClick={() => navigate(`/novo-agendamento?date=${dataSelecionada}&edit=${item.id}`)} style={s.editBtn}>
                        {textos.editar}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      {agendamentos.length > 0 && (
        <div style={s.totalCard}>
          <span style={s.totalLabel}>{textos.total}</span>
          <span style={s.totalValor}>€ {totalFaturado.toFixed(2)}</span>
        </div>
      )}

      {/* Botões de navegação */}
      <div style={s.navRow}>
        <button className="proc-btn-nav" onClick={() => navigate('/')} style={s.btnBack}>
          {textos.btnVoltar}
        </button>
        <button className="proc-btn-nav" onClick={() => navigate(`/novo-agendamento?date=${dataSelecionada}`)} style={s.btnNew}>
          {textos.btnNovo}
        </button>
      </div>
    </div>
  );
};

const s = {
  page: {
    maxWidth: '600px', margin: '0 auto', padding: '30px 20px 60px',
    fontFamily: "'DM Sans', sans-serif"
  },
  header: { marginBottom: '24px', textAlign: 'center' },
  titulo: { fontFamily: "'Sora', sans-serif", fontSize: '22px', fontWeight: '800', color: '#1e1b4b' },
  dataLabel: { color: '#4f46e5', fontWeight: '700', fontSize: '16px', marginTop: '6px', textTransform: 'capitalize' },
  countBadge: {
    display: 'inline-block', background: '#ede9fe', color: '#4f46e5',
    fontSize: '12px', fontWeight: '700', padding: '4px 14px',
    borderRadius: '20px', marginTop: '8px'
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyState: { textAlign: 'center', padding: '50px 20px' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  emptyText: { color: '#94a3b8', fontSize: '15px' },
  card: {
    display: 'flex', background: '#fff', borderRadius: '14px',
    boxShadow: '0 2px 10px rgba(79,70,229,0.05)', border: '1px solid #ede9fe',
    overflow: 'hidden', transition: 'box-shadow 0.2s'
  },
  cardAccent: { width: '5px', flexShrink: 0 },
  cardContent: { flex: 1, padding: '16px 18px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  cardHora: { fontSize: '11px', color: '#94a3b8', fontWeight: '600' },
  cardCliente: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: '#1e1b4b', fontFamily: "'Sora', sans-serif" },
  cardProc: { fontSize: '13px', color: '#64748b' },
  cardLocal: { fontSize: '11px', color: '#94a3b8' },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' },
  cardValor: { fontFamily: "'Sora', sans-serif", fontSize: '20px', fontWeight: '800' },
  cardActions: { display: 'flex', gap: '6px' },
  delBtn: { background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, fontSize: '14px', padding: '0', transition: 'opacity 0.2s' },
  faltaBtn: {
    background: '#fff', border: 'none', color: '#94a3b8',
    cursor: 'pointer', fontSize: '10px', fontWeight: '800',
    padding: '5px 9px', borderRadius: '6px', transition: 'all 0.2s'
  },
  editBtn: {
    background: '#ede9fe', border: 'none', color: '#4f46e5',
    cursor: 'pointer', fontSize: '10px', fontWeight: '800',
    padding: '5px 9px', borderRadius: '6px', transition: 'all 0.2s'
  },
  totalCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '20px', padding: '16px 20px',
    background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    borderRadius: '12px', border: '1px solid #bbf7d0'
  },
  totalLabel: { color: '#166534', fontWeight: '700', fontSize: '14px' },
  totalValor: { fontFamily: "'Sora', sans-serif", fontSize: '22px', fontWeight: '800', color: '#059669' },
  navRow: { display: 'flex', gap: '12px', marginTop: '20px' },
  btnBack: {
    flex: 1, padding: '14px', borderRadius: '12px',
    background: '#f1f5f9', color: '#64748b', border: 'none',
    cursor: 'pointer', fontWeight: '700', fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s'
  },
  btnNew: {
    flex: 1, padding: '14px', borderRadius: '12px',
    background: 'linear-gradient(135deg,#059669,#10b981)',
    color: '#fff', border: 'none', cursor: 'pointer',
    fontWeight: '700', fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 4px 14px rgba(5,150,105,0.3)', transition: 'all 0.2s'
  }
};

export default Procedimentos;