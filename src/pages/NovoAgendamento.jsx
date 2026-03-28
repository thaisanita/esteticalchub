import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

const NovoAgendamento = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dataAgendamento, setDataAgendamento] = useState(searchParams.get('date') || '');
  const idParaEditar = searchParams.get('edit');

  const [cliente, setCliente] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('10:00');

  useEffect(() => {
    const [horas, minutos] = horaInicio.split(':').map(Number);
    const novaHora = (horas + 1) % 24;
    const horaFormatada = String(novaHora).padStart(2, '0') + ':' + String(minutos).padStart(2, '0');
    setHoraFim(horaFormatada);
  }, [horaInicio]);

  const [preco, setPreco] = useState('');
  const [pontoAtendimento, setPontoAtendimento] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [sugestoesCliente, setSugestoesCliente] = useState([]);
  const [sugestoesProcedimento, setSugestoesProcedimento] = useState([]);
  const [sugestoesPonto, setSugestoesPonto] = useState([]);

  useEffect(() => {
    setSugestoesCliente(JSON.parse(localStorage.getItem('hist_clientes') || '[]'));
    setSugestoesProcedimento(JSON.parse(localStorage.getItem('hist_procedimentos') || '[]'));
    setSugestoesPonto(JSON.parse(localStorage.getItem('hist_pontos') || '[]'));
  }, []);

  const salvarHistorico = (chave, valor) => {
    if (!valor.trim()) return;
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');
    const nova = [valor.trim(), ...lista.filter(i => i !== valor.trim())].slice(0, 10);
    localStorage.setItem(chave, JSON.stringify(nova));
  };

  const idioma = localStorage.getItem('config_idioma') || 'Português (PT)';
  const textos = {
    'Português (PT)': {
      titulo: 'Novo Agendamento',
      editar: 'Editar Agendamento',
      ponto: 'Ponto de Atendimento',
      nome: 'Nome da Cliente',
      proc: 'Procedimento',
      inicio: 'Início',
      fim: 'Término',
      preco: 'Preço (€)',
      btnConfirmar: 'Confirmar Agendamento',
      btnSalvar: 'Salvar Alterações',
      btnSair: 'Cancelar',
      dataLabel: 'Data Selecionada'
    },
  }[idioma] || { titulo: 'Novo Agendamento', dataLabel: 'Data' };

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
            setProcedimento(data.procedimento || '');
            setPreco(data.preco || '');
            setPontoAtendimento(data.ponto_atendimento || '');
            setDataAgendamento(data.data || '');
            setHoraInicio(data.hora || '09:00');
          }
        } catch (e) {
          console.error("Erro ao buscar:", e);
        }
      }
      setLoading(false);
    };
    buscarDados();
  }, [idParaEditar]);

  const manipularSalvar = async (e) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Sua sessão expirou. Por favor, saia e entre novamente no sistema.");
        navigate('/login');
        return;
      }

      const dadosParaEnviar = {
        cliente: cliente.trim(),
        procedimento: procedimento.trim(),
        data: dataAgendamento,
        hora: horaInicio,
        preco: parseFloat(preco) || 0,
        ponto_atendimento: pontoAtendimento.trim(),
        usuario_id: user.id
      };

      let response;
      if (idParaEditar) {
        response = await supabase.from('agendamentos').update(dadosParaEnviar).eq('id', idParaEditar);
      } else {
        response = await supabase.from('agendamentos').insert([dadosParaEnviar]);
      }

      if (response.error) {
        alert(`Erro técnico: ${response.error.message}\nVerifique se as colunas existem no Supabase.`);
      } else {
        salvarHistorico('hist_clientes', cliente);
        salvarHistorico('hist_procedimentos', procedimento);
        salvarHistorico('hist_pontos', pontoAtendimento);
        alert("✅ Agendamento salvo com sucesso!");
        navigate('/');
      }
    } catch (err) {
      console.error("Erro geral:", err);
      alert("Ocorreu um erro inesperado ao tentar salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#94a3b8' }}>
      A carregar...
    </div>
  );

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .na-input { width: 100%; padding: 13px 16px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-size: 15px; font-family: 'DM Sans', sans-serif; color: #1e1b4b; background: #fdfdff; transition: border-color 0.2s, box-shadow 0.2s; outline: none; }
        .na-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .na-input::placeholder { color: #c4c9e0; }
        .na-btn-save:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,70,229,0.35) !important; }
        .na-btn-cancel:hover { border-color: #4f46e5 !important; color: #4f46e5 !important; }
      `}</style>

      <div style={s.wrapper}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>{idParaEditar ? '✏️' : '📅'}</div>
          <div>
            <h2 style={s.titulo}>{idParaEditar ? textos.editar : textos.titulo}</h2>
            <p style={s.subtitulo}>Preencha os dados do atendimento</p>
          </div>
        </div>

        <form onSubmit={manipularSalvar} style={s.form}>
          {/* Data */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.dataLabel}</label>
            <input type="date" required className="na-input" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)} />
          </div>

          {/* Ponto */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.ponto}</label>
            <input type="text" className="na-input" value={pontoAtendimento} onChange={(e) => setPontoAtendimento(e.target.value)} list="sugestoes-ponto" placeholder="Ex: Studio Central" />
            <datalist id="sugestoes-ponto">{sugestoesPonto.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>

          {/* Cliente */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.nome}</label>
            <input type="text" required className="na-input" value={cliente} onChange={(e) => setCliente(e.target.value)} list="sugestoes-cliente" placeholder="Nome completo" />
            <datalist id="sugestoes-cliente">{sugestoesCliente.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>

          {/* Procedimento */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.proc}</label>
            <input type="text" required className="na-input" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} list="sugestoes-procedimento" placeholder="Ex: Limpeza de Pele" />
            <datalist id="sugestoes-procedimento">{sugestoesProcedimento.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>

          {/* Horas */}
          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>{textos.inicio}</label>
              <input type="time" required className="na-input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>{textos.fim}</label>
              <input type="time" required className="na-input" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>

          {/* Preço */}
          <div style={s.fieldGroup}>
            <label style={s.label}>{textos.preco}</label>
            <input type="number" step="0.01" className="na-input" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0.00" />
          </div>

          {/* Botões */}
          <div style={s.row}>
            <button
              type="submit"
              disabled={salvando}
              className="na-btn-save"
              style={{ ...s.btnSave, flex: 2, opacity: salvando ? 0.6 : 1, cursor: salvando ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? 'A guardar...' : (idParaEditar ? textos.btnSalvar : textos.btnConfirmar)}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="na-btn-cancel"
              style={{ ...s.btnCancel, flex: 1 }}
            >
              {textos.btnSair}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const s = {
  page: {
    minHeight: '100vh', backgroundColor: '#f8f7ff',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 20px 60px'
  },
  wrapper: { width: '100%', maxWidth: '500px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  headerIcon: {
    width: '52px', height: '52px', background: '#ede9fe', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0
  },
  titulo: { fontFamily: "'Sora', sans-serif", fontSize: '22px', fontWeight: '800', color: '#1e1b4b' },
  subtitulo: { fontSize: '13px', color: '#94a3b8', marginTop: '3px' },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '7px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.8px' },
  row: { display: 'flex', gap: '14px' },
  btnSave: {
    padding: '15px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
    color: '#fff', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '15px', fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79,70,229,0.3)'
  },
  btnCancel: {
    padding: '15px', background: 'transparent', color: '#64748b',
    border: '1.5px solid #e0e7ff', borderRadius: '12px',
    cursor: 'pointer', fontWeight: '600', fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s'
  }
};

export default NovoAgendamento;