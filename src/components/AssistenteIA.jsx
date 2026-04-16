import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import PropTypes from 'prop-types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
  .assistente-wrapper { margin: 2rem auto; max-width: 720px; font-family: 'DM Sans', sans-serif; }
  .assistente-header { display: flex; align-items: center; gap: 12px; margin-bottom: 1.2rem; }
  .assistente-avatar { 
    width: 42px; height: 42px; border-radius: 50%; 
    background: linear-gradient(135deg, #a78bfa, #c4b5fd); 
    display: flex; align-items: center; justify-content: center; 
    font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 12px rgba(167, 139, 250, 0.3); 
  }
  .assistente-titulo { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 300; color: #4c1d95; margin: 0; }
  .assistente-subtitulo { font-size: 0.75rem; color: #7c3aed; margin: 0; }
  .assistente-chat { background: #fdfaff; border: 1px solid #ddd6fe; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(124, 58, 237, 0.08); }
  .chat-mensagens { height: 340px; overflow-y: auto; padding: 1.2rem; display: flex; flex-direction: column; gap: 12px; }
  .mensagem { display: flex; gap: 8px; }
  .mensagem.usuario { flex-direction: row-reverse; }
  .mensagem-balao { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 0.875rem; line-height: 1.55; }
  .mensagem.ia .mensagem-balao { background: white; border: 1px solid #ede9fe; color: #1e1b4b; }
  .mensagem.usuario .mensagem-balao { background: #4c1d95; color: white; }
  .chat-input-area { display: flex; gap: 8px; padding: 1rem 1.2rem; border-top: 1px solid #ede9fe; background: white; }
  .chat-input { flex: 1; border: 1px solid #ddd6fe; border-radius: 24px; padding: 9px 16px; outline: none; background: #fdfaff; }
  .chat-send-btn { width: 38px; height: 38px; border-radius: 50%; background: #7c3aed; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .sugestao-btn { border: 1px solid #ddd6fe; border-radius: 20px; padding: 5px 12px; font-size: 0.75rem; color: #6d28d9; cursor: pointer; background: white; margin: 2px; transition: 0.2s; }
  .sugestao-btn:hover { background: #f5f3ff; border-color: #a78bfa; }
`;

const mensagemBoasVindas = {
  tipo: 'ia',
  texto: 'Olá! 💅 Sou sua assistente virtual. Como posso te ajudar hoje com sua agenda?'
};

export default function AssistenteIA({ onClose }) {
  const [mensagens, setMensagens] = useState([mensagemBoasVindas]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const fimRef = useRef(null);

  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.textContent = styles;
    document.head.appendChild(estilo);
    
    const carregarDados = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('agendamentos').select('*').eq('usuario_id', user.id);
          setAgendamentos(data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      }
    };

    carregarDados();
    return () => document.head.removeChild(estilo);
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const enviarMensagem = async (texto) => {
    const msg = texto || input.trim();
    if (!msg || carregando) return;

    setInput('');
    setMensagens(p => [...p, { tipo: 'usuario', texto: msg }]);
    setCarregando(true);

    try {
      // Usando a variável agendamentos para criar contexto para a IA
      const contexto = `Você é uma assistente de estética. O usuário possui ${agendamentos.length} agendamentos cadastrados.`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${contexto} Pergunta: ${msg}` }] }]
        })
      });

      const data = await response.json();
      const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setMensagens(p => [...p, { tipo: 'ia', texto: resposta || 'Não consegui processar sua resposta.' }]);
    } catch (err) {
      console.error(err);
      setMensagens(p => [...p, { tipo: 'ia', texto: 'Ops, tive um erro ao conectar com a IA.' }]);
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
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '18px' }}>✕</button>
      </div>

      <div className="assistente-chat">
        <div className="chat-mensagens">
          {mensagens.map((m, i) => (
            <div key={i} className={`mensagem ${m.tipo}`}>
              <div className="mensagem-balao">{m.texto}</div>
            </div>
          ))}
          {carregando && <div className="mensagem ia"><div className="mensagem-balao">Digitando...</div></div>}
          <div ref={fimRef} />
        </div>

        <div style={{ padding: '0 1.2rem 1rem' }}>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Quem tem agendamento hoje?')}>📅 Hoje</button>
          <button className="sugestao-btn" onClick={() => enviarMensagem('Qual minha comissão?')}>💰 Comissão</button>
        </div>

        <div className="chat-input-area">
          <input 
            className="chat-input" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
            placeholder="Pergunte algo..." 
          />
          <button className="chat-send-btn" onClick={() => enviarMensagem()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

AssistenteIA.propTypes = {
  onClose: PropTypes.func.isRequired,
};