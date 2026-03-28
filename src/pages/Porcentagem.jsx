import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';

const Porcentagem = () => {
  const [dataParaFechamento, setDataParaFechamento] = useState('');
  const [agendamentos, setAgendamentos] = useState([]);
  const [pontoSelecionado, setPontoSelecionado] = useState('');
  const [taxaEspaco, setTaxaEspaco] = useState(25);
  const [loading, setLoading] = useState(false);
  const [diasDisponiveis, setDiasDisponiveis] = useState([]);
  const [diasJaSalvos, setDiasJaSalvos] = useState([]);

  const idioma = localStorage.getItem('config_idioma') || 'Português (PT)';
  const textos = {
    'Português (PT)': {
      titulo: 'Calculadora de Porcentagem',
      subtitulo: 'Fechamento financeiro por dia trabalhado',
      labelData: 'DIA TRABALHADO',
      placeholderData: 'Escolha uma data...',
      labelPonto: 'PONTO DE ATENDIMENTO',
      selecione: 'Selecione o local...',
      labelTaxa: '% ESPAÇO',
      brutoEm: 'Bruto em',
      noDia: 'no dia',
      comissao: '🏠 COMISSÃO',
      lucro: '✅ SEU LUCRO',
      btnSalvar: 'Confirmar e Salvar no Relatório',
      alertaSucesso: (local, data) => `✅ Fechamento de ${local} (${data}) salvo!`,
      nenhumDia: 'Nenhum atendimento pendente encontrado.'
    }
  }[idioma] || {};

  useEffect(() => {
    const buscarDiasComAtendimento = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('agendamentos')
        .select('data')
        .eq('user_id', user.id)
        .order('data', { ascending: false });

      if (!error && data) {
        const datasUnicas = [...new Set(data.map(item => item.data))];
        setDiasDisponiveis(datasUnicas);
        if (datasUnicas.length > 0) setDataParaFechamento(datasUnicas[0]);
      }

      const { data: fechamentos, error: erroFechamentos } = await supabase
        .from('fechamentos')
        .select('data_referencia')
        .eq('usuario_id', user.id);

      if (!erroFechamentos && fechamentos) {
        const datasSalvas = [...new Set(fechamentos.map(f => f.data_referencia))];
        setDiasJaSalvos(datasSalvas);
      }
    };
    buscarDiasComAtendimento();
  }, []);

  useEffect(() => {
    if (!dataParaFechamento) return;
    const buscarAgendamentosDoDia = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('data', dataParaFechamento)
        .eq('user_id', user.id);

      if (!error) setAgendamentos(data || []);
    };
    buscarAgendamentosDoDia();
  }, [dataParaFechamento]);

  const locaisUnicos = useMemo(() => {
    const locais = agendamentos.map(ag => ag.ponto_atendimento || ag.pontoAtendimento).filter(p => p);
    return [...new Set(locais)];
  }, [agendamentos]);

  const totalBrutoLocal = useMemo(() => {
    if (!pontoSelecionado) return 0;
    return agendamentos
      .filter(ag => (ag.ponto_atendimento || ag.pontoAtendimento) === pontoSelecionado)
      .reduce((sum, ag) => {
        const valor = parseFloat(String(ag.valor || ag.preco || '0').replace(',', '.'));
        return sum + valor;
      }, 0);
  }, [pontoSelecionado, agendamentos]);

  const valorParaEspaco = (totalBrutoLocal * (Number(taxaEspaco) / 100)).toFixed(2);
  const meuLucroReal = (totalBrutoLocal - Number(valorParaEspaco)).toFixed(2);
  const diaSelecionadoJaSalvo = diasJaSalvos.includes(dataParaFechamento);

  const salvarNoRelatorio = async () => {
    if (!pontoSelecionado) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fechamentos').insert([{
        local: pontoSelecionado,
        data_referencia: dataParaFechamento,
        faturamento_bruto: parseFloat(totalBrutoLocal),
        comissao_paga: parseFloat(valorParaEspaco),
        lucro_liquido: parseFloat(meuLucroReal),
        user_id: user.id
      }]);
      if (error) throw error;
      setDiasJaSalvos(prev => [...new Set([...prev, dataParaFechamento])]);
      alert(textos.alertaSucesso(pontoSelecionado, dataParaFechamento));
      setPontoSelecionado('');
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarDataBR = (dataIso) => {
    if (!dataIso) return "";
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="agenda-page-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .porc-select { padding: 12px 16px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: #1e1b4b; background: #fdfdff; width: 100%; outline: none; transition: border-color 0.2s; cursor: pointer; }
        .porc-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .porc-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,70,229,0.35) !important; }
        .porc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>💰</div>
          <div>
            <h2 style={s.titulo}>{textos.titulo}</h2>
            <p style={s.subtitulo}>{textos.subtitulo}</p>
          </div>
        </div>

        <div style={s.body}>
          {/* Data */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.labelData}</label>
            <select
              className="porc-select"
              value={dataParaFechamento}
              onChange={(e) => { setDataParaFechamento(e.target.value); setPontoSelecionado(''); }}
            >
              {diasDisponiveis.length === 0 && <option value="">{textos.nenhumDia}</option>}
              {diasDisponiveis.map(dia => (
                <option key={dia} value={dia}>
                  {diasJaSalvos.includes(dia) ? '✅ ' : '📅 '}{formatarDataBR(dia)}{diasJaSalvos.includes(dia) ? ' (salvo)' : ''}
                </option>
              ))}
            </select>
            {diaSelecionadoJaSalvo && (
              <div style={s.savedBanner}>
                <span>✅</span>
                <span style={s.savedText}>Este dia já foi salvo no relatório</span>
              </div>
            )}
          </div>

          {/* Local + Taxa */}
          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>{textos.labelPonto}</label>
              <select className="porc-select" value={pontoSelecionado} onChange={(e) => setPontoSelecionado(e.target.value)}>
                <option value="">{textos.selecione}</option>
                {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
              </select>
            </div>
            <div style={{ flexShrink: 0 }}>
              <label style={s.label}>{textos.labelTaxa}</label>
              <input
                type="number"
                className="porc-select"
                style={{ width: '90px' }}
                value={taxaEspaco}
                onChange={(e) => setTaxaEspaco(e.target.value)}
              />
            </div>
          </div>

          {/* Total Bruto */}
          <div style={s.brutoCard}>
            <div style={s.brutoLabel}>
              {textos.brutoEm} <strong style={{ color: '#4f46e5' }}>{pontoSelecionado || '...'}</strong>{' '}
              {textos.noDia} {formatarDataBR(dataParaFechamento)}
            </div>
            <div style={s.brutoValor}>€ {totalBrutoLocal.toFixed(2)}</div>
          </div>

          {/* Split */}
          <div style={s.splitRow}>
            <div style={s.splitCard}>
              <div style={s.splitLabel}>{textos.comissao}</div>
              <div style={{ ...s.splitValor, color: '#ef4444' }}>€ {valorParaEspaco}</div>
              <div style={s.splitPercent}>{taxaEspaco}% do bruto</div>
            </div>
            <div style={s.splitDivider} />
            <div style={s.splitCard}>
              <div style={{ ...s.splitLabel, color: '#059669' }}>{textos.lucro}</div>
              <div style={{ ...s.splitValor, color: '#059669' }}>€ {meuLucroReal}</div>
              <div style={{ ...s.splitPercent, color: '#059669' }}>{100 - taxaEspaco}% do bruto</div>
            </div>
          </div>

          <button
            className="porc-btn"
            onClick={salvarNoRelatorio}
            disabled={!pontoSelecionado || totalBrutoLocal === 0 || loading}
            style={s.btn}
          >
            {loading ? 'A salvar...' : textos.btnSalvar}
          </button>
        </div>
      </div>
    </div>
  );
};

const s = {
  card: {
    background: '#fff', borderRadius: '20px', padding: '28px',
    boxShadow: '0 4px 20px rgba(79,70,229,0.08)', border: '1px solid #ede9fe',
    maxWidth: '560px', margin: '0 auto', fontFamily: "'DM Sans', sans-serif"
  },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  headerIcon: {
    width: '50px', height: '50px', background: '#ede9fe', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0
  },
  titulo: { fontFamily: "'Sora', sans-serif", fontSize: '18px', fontWeight: '800', color: '#1e1b4b' },
  subtitulo: { fontSize: '12px', color: '#94a3b8', marginTop: '3px' },
  body: { display: 'flex', flexDirection: 'column', gap: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.8px' },
  row: { display: 'flex', gap: '14px', alignItems: 'flex-end' },
  savedBanner: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '10px', padding: '10px 14px'
  },
  savedText: { fontSize: '13px', color: '#166534', fontWeight: '600' },
  brutoCard: {
    background: 'linear-gradient(135deg,#f8f7ff,#ede9fe)', border: '1px dashed #c4b5fd',
    borderRadius: '14px', padding: '20px', textAlign: 'center'
  },
  brutoLabel: { fontSize: '13px', color: '#64748b', marginBottom: '8px' },
  brutoValor: { fontFamily: "'Sora', sans-serif", fontSize: '32px', fontWeight: '800', color: '#1e1b4b' },
  splitRow: {
    display: 'flex', gap: '0', background: '#f8f7ff',
    borderRadius: '14px', border: '1px solid #ede9fe', overflow: 'hidden'
  },
  splitCard: { flex: 1, padding: '18px', textAlign: 'center' },
  splitDivider: { width: '1px', background: '#ede9fe', flexShrink: 0 },
  splitLabel: { fontSize: '10px', fontWeight: '800', color: '#ef4444', letterSpacing: '0.8px', marginBottom: '6px' },
  splitValor: { fontFamily: "'Sora', sans-serif", fontSize: '22px', fontWeight: '800' },
  splitPercent: { fontSize: '11px', color: '#94a3b8', marginTop: '4px' },
  btn: {
    width: '100%', padding: '16px',
    background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
    color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
    fontWeight: '700', fontSize: '15px', fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79,70,229,0.3)'
  }
};

export default Porcentagem;