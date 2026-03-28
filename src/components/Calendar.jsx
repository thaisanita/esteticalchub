import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

const Calendar = ({ onDaySelect, agendamentos = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [filtroLocal, setFiltroLocal] = useState('Todos');
  const [porcentagem, setPorcentagem] = useState(0);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const locaisDisponiveis = useMemo(() => {
    const pontos = agendamentos.map(ag => ag.ponto_atendimento || ag.pontoAtendimento).filter(Boolean);
    return ['Todos', ...new Set(pontos)];
  }, [agendamentos]);

  const financeiro = useMemo(() => {
    const mesAtual = currentDate.getMonth();
    const anoAtual = currentDate.getFullYear();

    const filtrados = agendamentos.filter(ag => {
      const dataAg = new Date(ag.data);
      const bateData = dataAg.getMonth() === mesAtual && dataAg.getFullYear() === anoAtual;
      const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
      const bateLocal = filtroLocal === 'Todos' || localAg === filtroLocal;
      return bateData && bateLocal;
    });

    const bruto = filtrados.reduce((acc, curr) => acc + (Number(curr.preco) || 0), 0);
    const liquido = bruto * (Number(porcentagem) / 100);

    return { bruto, liquido };
  }, [agendamentos, currentDate, filtroLocal, porcentagem]);

  const top5 = useMemo(() => {
    const contagem = {};
    agendamentos.forEach(ag => {
      const nome = ag.cliente;
      if (!nome) return;
      if (!contagem[nome]) contagem[nome] = { nome, visitas: 0 };
      contagem[nome].visitas += 1;
    });

    // Aqui acontece a mágica:
    return Object.values(contagem)
      .filter(c => c.visitas >= 4) // <--- Só passam clientes com 4 ou mais visitas
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 5);
  }, [agendamentos]);

  
  // Função para encurtar nomes e garantir que o quadro não quebre
  const formatarNomeCurto = (nome) => {
    if (!nome) return '';
    const primeiroNome = nome.split(' ')[0];
    return primeiroNome.length > 9 ? primeiroNome.substring(0, 8) + '..' : primeiroNome;
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="dia-item dia-vazio"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const agendamentosDoDia = agendamentos.filter(ag => {
        const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
        return ag.data === dateString && (filtroLocal === 'Todos' || localAg === filtroLocal);
      });

      // Agrupamento por local
      const agendadosPorLocal = {};
      agendamentosDoDia.forEach(ag => {
        const loc = ag.ponto_atendimento || ag.pontoAtendimento || 'Gabinete';
        if (!agendadosPorLocal[loc]) agendadosPorLocal[loc] = [];
        agendadosPorLocal[loc].push(ag);
      });

      days.push(
        <button
          key={d}
          className={`dia-item ${selectedDate === dateString ? 'selecionado' : ''}`}
          onClick={() => { setSelectedDate(dateString); onDaySelect(dateString); }}
          style={{ overflow: 'hidden', padding: '2px' }}
        >
          <span className="numero-dia" style={{ fontWeight: 'bold', fontSize: '11px' }}>{d}</span>

          <div className="lista-agendamentos-dia">
            {Object.keys(agendadosPorLocal).map((localNome, lIdx) => (
              <div key={lIdx} style={{ marginBottom: '2px' }}>
                {/* Local com Pin - Exibido apenas uma vez */}
                <span style={{ 
                  display: 'block', 
                  fontWeight: '700', 
                  fontSize: '8px', 
                  color: '#6a1b9a', 
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}>
                  📍 {formatarNomeCurto(localNome)}
                </span>
                
                {/* Lista de Clientes - Limpa, sem negrito e sem itálico */}
                {agendadosPorLocal[localNome].map((ag, cIdx) => (
                  <span key={cIdx} style={{ 
                    display: 'block', 
                    fontSize: '9px', 
                    fontWeight: '400', // Força fonte normal
                    fontStyle: 'normal', // Remove itálico
                    color: '#222', 
                    textAlign: 'center',
                    lineHeight: '1',
                    fontFamily: 'sans-serif'
                  }}>
                    {formatarNomeCurto(ag.cliente).toLowerCase()}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </button>
      );
    }
    return days;
  };

  const mesAno = currentDate.toLocaleString('pt-PT', { month: 'long', year: 'numeric' });

  return (
    <div className="calendario-container-moderno">
      <div className="dashboard-financeiro">
        <div className="card-faturamento">
          <p>Total Sem Comissão</p>
          <h4>€ {financeiro.bruto.toFixed(2)}</h4>
        </div>
        <div className="card-faturamento liquido">
          <p>Comissão a Pagar</p>
          <h4>€ {financeiro.liquido.toFixed(2)}</h4>
        </div>
      </div>

 {/* 2. CONTROLES DE NAVEGAÇÃO E CONFIGURAÇÃO */}
 <div className="controles-navegacao">
        <div className="navegacao-mes-wrapper">
          <div className="navegacao-mes">
            <button onClick={handlePrevMonth} className="btn-circulo">←</button>
            <span className="mes-atual" style={{ textTransform: 'capitalize' }}>{mesAno}</span>
            <button onClick={handleNextMonth} className="btn-circulo">→</button>
          </div>
        </div>

        {/* NOVA DIV PARA ALINHAR OS DOIS BOTÕES EMBAIXO */}
        <div className="wrapper-ajustes-baixo">
          <div className="config-porcentagem-mini">
            Comissão: 
            <input 
              type="number" 
              value={porcentagem} 
              onChange={(e) => setPorcentagem(e.target.value)} 
            /> %
          </div>

          <select 
            value={filtroLocal} 
            onChange={(e) => setFiltroLocal(e.target.value)} 
            className="select-moderno-topo"
          >
            {locaisDisponiveis.map(local => (
              <option key={local} value={local}>
                {local === 'Todos' ? 'Gabinetes' : local}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="calendario-grid">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
          <div key={dia} className="dia-semana-label">{dia}</div>
        ))}
        {renderDays()}
      </div>

      {top5.length > 0 && (
        <div className="ranking-container" style={{ marginTop: '15px' }}>
          <details>
            <summary className="ranking-titulo-toggle" style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
               🏆 Clientes que mais marcam
            </summary>
            <div className="ranking-lista">
              {top5.map((c, i) => (
                <div key={i} className="ranking-item">
                  <span className="ranking-nome">{i + 1}º {c.nome}</span>
                  <span className="ranking-atendimentos">{c.visitas} atendimentos</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

Calendar.propTypes = {
  onDaySelect: PropTypes.func.isRequired,
  agendamentos: PropTypes.array
};

export default Calendar;