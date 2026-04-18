import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import PropTypes from 'prop-types';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
  .assistente-wrapper { margin: 1rem auto; max-width: 720px; font-family: 'DM Sans', sans-serif; padding: 0 20px; position: relative; z-index: 100; }
  .assistente-header { display: flex; align-items: center; gap: 12px; margin-bottom: 1.2rem; padding-top: 10px; }
  .assistente-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #a78bfa, #c4b5fd); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 12px rgba(167,139,250,0.3); }
  .assistente-titulo { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 300; color: #4c1d95; margin: 0; }
  .assistente-subtitulo { font-size: 0.75rem; color: #7c3aed; margin: 0; }
  .assistente-chat { background: #fdfaff; border: 1px solid #ddd6fe; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(124,58,237,0.08); }
  .chat-mensagens { height: 340px; overflow-y: auto; padding: 1.2rem; display: flex; flex-direction: column; gap: 12px; }
  .mensagem { display: flex; gap: 8px; }
  .mensagem.usuario { flex-direction: row-reverse; }
  .mensagem-balao { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 0.875rem; line-height: 1.55; white-space: pre-wrap; }
  .mensagem.ia .mensagem-balao { background: white; border: 1px solid #ede9fe; color: #1e1b4b; }
  .mensagem.usuario .mensagem-balao { background: #4c1d95; color: white; }
  .chat-input-area { display: flex; gap: 8px; padding: 1rem 1.2rem; border-top: 1px solid #ede9fe; background: white; }
  .chat-input { flex: 1; border: 1px solid #ddd6fe; border-radius: 24px; padding: 9px 16px; outline: none; background: #fdfaff; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: #1e1b4b; }
  .chat-input::placeholder { color: #a78bfa; }
  .chat-send-btn { width: 38px; height: 38px; border-radius: 50%; background: #7c3aed; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
  .chat-send-btn:hover:not(:disabled) { background: #6d28d9; transform: scale(1.05); }
  .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sugestao-btn { border: 1px solid #ddd6fe; border-radius: 20px; padding: 5px 12px; font-size: 0.75rem; color: #6d28d9; cursor: pointer; background: white; margin: 2px; transition: 0.2s; font-family: 'DM Sans', sans-serif; }
  .sugestao-btn:hover { background: #f5f3ff; border-color: #a78bfa; }
  .dot { width: 6px; height: 6px; background: #a78bfa; border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite; margin: 0 2px; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
`;

function AssistenteIA({ onClose }) {
  const [mensagens, setMensagens] = useState([{
    tipo: 'ia',
    texto: 'Olá! 💅 Sou sua assistente virtual. Posso te ajudar com agendamentos, comissões, dias livres e muito mais. O que precisas?'
  }]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const fimRef = useRef(null);

  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.textContent = styles;
    document.head.appendChild(estilo);

    async function carregarDados() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('usuario_id', user.id);
          setAgendamentos(data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar agendamentos:', err);
      }
    }

    carregarDados();
    return () => document.head.removeChild(estilo);
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const construirContexto = () => {
    const hoje = new Date().toISOString().split('T')[0];
    const agendamentosHoje = agendamentos.filter(a => a.data === hoje);
    const mesAtual = hoje.substring(0, 7);
    const agendamentosMes = agendamentos.filter(a => a.data?.startsWith(mesAtual));

    const comissaoTotal = agendamentosMes.reduce((acc, a) => {
      const valor = parseFloat(a.valor || a.preco || a.price || 0);
      const pct = parseFloat(a.comissao || a.porcentagem || 50) / 100;
      return acc + (valor * pct);
    }, 0);

    const diasLivres = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dataStr = d.toISOString().split('T')[0];
      if (!agendamentos.some(a => a.data === dataStr)) diasLivres.push(dataStr);
    }

    return `
Você é uma assistente virtual gentil e profissional de um app de agenda de estética.
Responda SEMPRE em português brasileiro, de forma simpática e direta.
Pode responder qualquer pergunta, não apenas sobre a agenda.

DADOS DA AGENDA:
- Hoje: ${hoje}
- Agendamentos hoje: ${agendamentosHoje.length}
${agendamentosHoje.map(a => `  • ${a.nome_cliente || a.cliente || 'Cliente'} às ${a.horario || a.hora || '?'} — ${a.procedimento || a.servico || 'Serviço'}`).join('\n') || '  • Nenhum agendamento hoje'}
- Dias livres nos próximos 7 dias: ${diasLivres.length > 0 ? diasLivres.join(', ') : 'Nenhum'}
- Agendamentos este mês: ${agendamentosMes.length}
- Comissão estimada do mês: R$ ${comissaoTotal.toFixed(2)}
- Total de registos: ${agendamentos.length}
    `.trim();
  };

  const enviarMensagem = async (texto) => {
    const msg = texto || input.trim();
    if (!msg || carregando) return;

    setInput('');
    setMensagens(p => [...p, { tipo: 'usuario', texto: msg }]);
    setCarregando(true);

    try {
      // Chama a função serverless da Vercel — a chave fica segura no servidor
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: msg,
          contexto: construirContexto()
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`);

      setMensagens(p => [...p, { tipo: 'ia', texto: data.resposta }]);

    } catch (err) {
      console.error('Erro:', err);
      setMensagens(p => [...p, {
        tipo: 'ia',
        texto: `Ops! Não consegui responder agora. 💕\nDetalhe: ${err.message}`
      }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="assistente-wrapper">
      <div className="assistente-header">
        <div className="assistente-avatar">✨</div>
        <div style={{ flex: 1 }}>
          <p className="assistente-titulo">Assistente IA</p>
          <p className="assistente-subtitulo">Sua agenda inteligente</p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '20px' }}
        >
          ✕
        </button>
      </div>

      <div className="assistente-chat">
        <div className="chat-mensagens">
          {mensagens.map((m, i) => (
            <div key={i} className={`mensagem ${m.tipo}`}>
              <div className="mensagem-balao">{m.texto}</div>
            </div>
          ))}
          {carregando && (
            <div className="mensagem ia">
              <div className="mensagem-balao">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        <div style={{ padding: '0 1.2rem 1rem' }}>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Quem tem agendamento hoje?')}>📅 Hoje</button>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Qual minha comissão do mês?')}>💰 Comissão</button>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Quais dias estão livres essa semana?')}>🗓️ Dias livres</button>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Quantos clientes tenho?')}>👥 Clientes</button>
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
            placeholder="Pergunte algo..."
            disabled={carregando}
          />
          <button
            className="chat-send-btn"
            onClick={() => enviarMensagem()}
            disabled={carregando || !input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

AssistenteIA.propTypes = { onClose: PropTypes.func.isRequired };

export default AssistenteIA;