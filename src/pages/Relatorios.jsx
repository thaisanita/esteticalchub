import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabase';

const Relatorios = () => {
  const [agendamentos, setAgendamentos] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [filtroLocal, setFiltroLocal] = useState('TODOS');
  const [loading, setLoading] = useState(true);

  const idioma = localStorage.getItem('config_idioma') || 'Português (PT)';
  const textos = useMemo(() => ({
    'Português (PT)': {
      dashboard: 'Dashboard Anual', imprimir: '🖨️ Imprimir', bruto: 'BRUTO', lucro: 'LUCRO',
      evolucao: '📊 Evolução Mensal', historico: '📑 Histórico', data: 'Data', local: 'Local',
      valor: 'Valor', acao: 'Ação', excluir: 'Excluir', confirmacao: 'Deseja remover este registro?',
      meses: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    }
  }[idioma] || {}), [idioma]);

  useEffect(() => { fetchDados(); }, []);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [resAg, resFech] = await Promise.all([
        supabase.from('agendamentos').select('*').eq('user_id', user.id),
        supabase.from('fechamentos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      setAgendamentos(resAg.data || []);
      setFechamentos(resFech.data || []);
    } catch (e) {
      console.error("Erro ao carregar:", e);
    } finally {
      setLoading(false);
    }
  };

  const excluirFechamento = async (id) => {
    if (window.confirm(textos.confirmacao)) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fechamentos').delete().eq('id', id).eq('user_id', user.id);
      if (!error) setFechamentos(prev => prev.filter(f => f.id !== id));
    }
  };

  const locaisDisponiveis = useMemo(() => {
    const locais = agendamentos.map(ag => ag.ponto_atendimento || ag.pontoAtendimento).filter(p => p);
    return ['TODOS', ...new Set(locais)];
  }, [agendamentos]);

  const resumoDados = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    let brutoTotalAno = 0;
    let lucroRealAcumulado = 0; 
    const ganhosPorMes = {};

    agendamentos.forEach(ag => {
      const dataStr = ag.data;
      if (dataStr && dataStr.startsWith(anoAtual.toString())) {
        const localAg = ag.ponto_atendimento || ag.pontoAtendimento;
        if (filtroLocal === 'TODOS' || localAg === filtroLocal) {
          const mesAg = parseInt(dataStr.split('-')[1], 10) - 1;
          const valor = parseFloat(String(ag.valor || ag.preco || '0').replace(',', '.'));
          ganhosPorMes[textos.meses[mesAg]] = (ganhosPorMes[textos.meses[mesAg]] || 0) + valor;
          brutoTotalAno += valor;
        }
      }
    });

    fechamentos.forEach(f => {
      const dataF = f.data_referencia || f.data;
      if (dataF && dataF.startsWith(anoAtual.toString())) {
        if (filtroLocal === 'TODOS' || f.local === filtroLocal) {
          lucroRealAcumulado += parseFloat(f.lucro_liquido || 0);
        }
      }
    });

    const chartData = textos.meses.map(mes => ({ mes, ganho: ganhosPorMes[mes] || 0 }));
    return { chartData, brutoTotalAno, lucroRealAcumulado };
  }, [agendamentos, fechamentos, filtroLocal, textos]);

  if (loading) return <div style={{padding: '20px', textAlign: 'center'}}>Carregando...</div>;

  return (
    <div className="agenda-page-container">
      <div className="container-aba-padrao">
        <style>{`.scroll-tabela { max-height: 350px; overflow-y: auto; margin-top: 10px; border-radius: 8px; } @media print { body * { visibility: hidden; } .secao-impressao, .secao-impressao * { visibility: visible; } .no-print { display: none !important; } }`}</style>
        <div className="no-print">
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>{textos.dashboard}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={filtroLocal} onChange={(e) => setFiltroLocal(e.target.value)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                {locaisDisponiveis.map(local => <option key={local} value={local}>{local}</option>)}
              </select>
              <button onClick={() => window.print()} style={{ padding: '8px 12px', borderRadius: '10px', background: '#1e293b', color: 'white', border: 'none', fontWeight: '600', fontSize: '12px' }}>{textos.imprimir}</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: '#f8fafc', padding: '15px', borderRadius: '16px' }}>
              <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{textos.bruto}</label>
              <div style={{ fontSize: '18px', fontWeight: '800' }}>€ {resumoDados.brutoTotalAno.toFixed(2)}</div>
            </div>
            <div style={{ flex: 1, background: '#ecfdf5', padding: '15px', borderRadius: '16px' }}>
              <label style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>{textos.lucro}</label>
              <div style={{ color: '#059669', fontSize: '18px', fontWeight: '800' }}>€ {resumoDados.lucroRealAcumulado.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '10px', borderRadius: '16px', border: '1px solid #f1f5f9', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', marginBottom: '15px', fontWeight: '800' }}>{textos.evolucao}</h3>
            <div style={{ width: '100%', height: '180px' }}>
              <ResponsiveContainer><BarChart data={resumoDados.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="mes" tick={{fontSize: 10}} /><YAxis tick={{fontSize: 10}} /><Tooltip /><Bar dataKey="ganho" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="secao-impressao">
          <h3 style={{ fontSize: '15px', marginBottom: '10px', fontWeight: '800' }}>{textos.historico} {filtroLocal !== 'TODOS' && `- ${filtroLocal}`}</h3>
          <div className="scroll-tabela"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #f8fafc' }}><th style={{ padding: '10px 5px' }}>{textos.data}</th><th style={{ padding: '10px 5px' }}>{textos.local}</th><th style={{ padding: '10px 5px' }}>{textos.valor}</th><th className="no-print" style={{ padding: '10px 5px', textAlign: 'center' }}>{textos.acao}</th></tr></thead>
            <tbody>{fechamentos.filter(f => filtroLocal === 'TODOS' || f.local === filtroLocal).map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 5px', fontWeight: '600' }}>{f.data_referencia || f.data}</td>
                <td style={{ padding: '12px 5px' }}>{f.local}</td>
                <td style={{ padding: '12px 5px', color: '#059669', fontWeight: '800' }}>€ {parseFloat(f.lucro_liquido || 0).toFixed(2)}</td>
                <td className="no-print" style={{ padding: '12px 5px', textAlign: 'center' }}>
                  <button onClick={() => excluirFechamento(f.id)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '10px' }}>{textos.excluir}</button>
                </td>
              </tr>
            ))}</tbody></table></div>
        </div>
      </div>
    </div>
  );
};

export default Relatorios;