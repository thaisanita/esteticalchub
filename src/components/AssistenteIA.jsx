import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');

  .assistente-wrapper {
    margin: 2rem auto;
    max-width: 720px;
    font-family: 'DM Sans', sans-serif;
  }

  .assistente-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 1.2rem;
  }

  .assistente-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #c9a882, #e8d5b7);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(201,168,130,0.3);
  }

  .assistente-titulo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.4rem;
    font-weight: 300;
    color: #3d2c1e;
    letter-spacing: 0.02em;
    margin: 0;
  }

  .assistente-subtitulo {
    font-size: 0.75rem;
    color: #a08060;
    margin: 0;
    font-weight: 300;
  }

  .assistente-chat {
    background: #fdf9f5;
    border: 1px solid #e8ddd0;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(180,140,100,0.08);
  }

  .chat-mensagens {
    height: 340px;
    overflow-y: auto;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
  }

  .chat-mensagens::-webkit-scrollbar {
    width: 4px;
  }

  .chat-mensagens::-webkit-scrollbar-track {
    background: transparent;
  }

  .chat-mensagens::-webkit-scrollbar-thumb {
    background: #e0cdb8;
    border-radius: 4px;
  }

  .mensagem {
    display: flex;
    gap: 8px;
    animation: fadeSlideIn 0.3s ease;
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mensagem.usuario {
    flex-direction: row-reverse;
  }

  .mensagem-icone {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .mensagem-icone.ia {
    background: linear-gradient(135deg, #c9a882, #e8d5b7);
  }

  .mensagem-icone.user {
    background: #3d2c1e;
    color: #fdf9f5;
    font-size: 11px;
    font-weight: 500;
  }

  .mensagem-balao {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.875rem;
    line-height: 1.55;
    color: #3d2c1e;
  }

  .mensagem.ia .mensagem-balao {
    background: white;
    border: 1px solid #ede4d8;
    border-bottom-left-radius: 4px;
  }

  .mensagem.usuario .mensagem-balao {
    background: #3d2c1e;
    color: #fdf9f5;
    border-bottom-right-radius: 4px;
  }

  .mensagem-digitando {
    display: flex;
    gap: 4px;
    padding: 12px 14px;
    align-items: center;
  }

  .dot {
    width: 6px;
    height: 6px;
    background: #c9a882;
    border-radius: 50%;
    animation: bounce 1.2s infinite;
  }

  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }

  .chat-sugestoes {
    display: flex;
    gap: 8px;
    padding: 0 1.2rem 1rem;
    flex-wrap: wrap;
  }

  .sugestao-btn {
    background: white;
    border: 1px solid #e0cdb8;
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 0.75rem;
    color: #7a5c3e;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
  }

  .sugestao-btn:hover {
    background: #f5ede3;
    border-color: #c9a882;
    color: #3d2c1e;
  }

  .chat-input-area {
    display: flex;
    gap: 8px;
    padding: 1rem 1.2rem;
    border-top: 1px solid #ede4d8;
    background: white;
  }

  .chat-input {
    flex: 1;
    border: 1px solid #e0cdb8;
    border-radius: 24px;
    padding: 9px 16px;
    font-size: 0.875rem;
    font-family: 'DM Sans', sans-serif;
    color: #3d2c1e;
    background: #fdf9f5;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-input:focus {
    border-color: #c9a882;
  }

  .chat-input::placeholder {
    color: #b8a090;
  }

  .chat-send-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #c9a882, #a07040);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: transform 0.2s, box-shadow 0.2s;
    flex-shrink: 0;
  }

  .chat-send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(160,112,64,0.3);
  }

  .chat-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const sugestoes = [
  '📅 Quem tem agendamento hoje?',
  '🗓️ Dias livres essa semana',
  '💰 Minha comissão do mês',
  '👥 Total de clientes',
];

const mensagemBoasVindas = {
  tipo: 'ia',
  texto: 'Olá! 💅 Sou sua assistente virtual. Posso te ajudar a ver seus agendamentos, dias livres, comissões e muito mais. Como posso te ajudar hoje?'
};

export default function AssistenteIA() {
  const [mensagens, setMensagens] = useState([mensagemBoasVindas]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const fimRef = useRef(null);

  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.textContent = styles;
    document.head.appendChild(estilo);
    return () => document.head.removeChild(estilo);
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const carregarDados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('usuario_id', user.id);
      setAgendamentos(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const construirContexto = () => {
    const hoje = new Date().toISOString().split('T')[0];
    const agendamentosHoje = agendamentos.filter(a => a.data === hoje);

    const proximosDias = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dataStr = d.toISOString().split('T')[0];
      const temAgendamento = agendamentos.some(a => a.data === dataStr);
      proximosDias.push({ data: dataStr, livre: !temAgendamento });
    }

    const diasLivres = proximosDias.filter(d => d.livre).map(d => d.data);

    const mesAtual = hoje.substring(0, 7);
    const agendamentosMes = agendamentos.filter(a => a.data?.startsWith(mesAtual));

    const comissaoTotal = agendamentosMes.reduce((acc, a) => {
      const valor = parseFloat(a.valor || a.preco || a.price || 0);
      const pct = parseFloat(a.comissao || a.porcentagem || 50) / 100;
      return acc + (valor * pct);
    }, 0);

    return `
Você é uma assistente virtual gentil e profissional para um app de agenda de estética.
Responda sempre em português, de forma amigável e concisa.

DADOS ATUAIS:
- Data de hoje: ${hoje}
- Agendamentos hoje: ${agendamentosHoje.length} cliente(s)
${agendamentosHoje.map(a => `  • ${a.nome_cliente || a.cliente || 'Cliente'} às ${a.horario || a.hora || '?'} - ${a.procedimento || a.servico || 'Serviço'}`).join('\n')}
- Dias livres nos próximos 7 dias: ${diasLivres.length > 0 ? diasLivres.join(', ') : 'Nenhum dia livre'}
- Total de agendamentos este mês: ${agendamentosMes.length}
- Estimativa de comissão do mês: R$ ${comissaoTotal.toFixed(2)}
- Total de clientes cadastrados: ${agendamentos.length}
    `.trim();
  };

  const enviarMensagem = async (texto) => {
    const msg = texto || input.trim();
    if (!msg || carregando) return;

    setInput('');
    setMensagens(prev => [...prev, { tipo: 'usuario', texto: msg }]);
    setCarregando(true);

    try {
      const contexto = construirContexto();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${contexto}\n\nPergunta da usuária: ${msg}` }]
              }
            ],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
          })
        }
      );

      const data = await response.json();
      const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Não consegui entender. Pode reformular?';
      setMensagens(prev => [...prev, { tipo: 'ia', texto: resposta }]);
    } catch {
      setMensagens(prev => [...prev, { tipo: 'ia', texto: 'Ops! Tive um problema ao responder. Tente novamente 💕' }]);
    } finally {
      setCarregando(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <div className="assistente-wrapper">
      <div className="assistente-header">
        <div className="assistente-avatar">✨</div>
        <div>
          <p className="assistente-titulo">Assistente IA</p>
          <p className="assistente-subtitulo">Sua agenda inteligente</p>
        </div>
      </div>

      <div className="assistente-chat">
        <div className="chat-mensagens">
          {mensagens.map((m, i) => (
            <div key={i} className={`mensagem ${m.tipo}`}>
              <div className={`mensagem-icone ${m.tipo === 'ia' ? 'ia' : 'user'}`}>
                {m.tipo === 'ia' ? '✨' : 'EU'}
              </div>
              <div className="mensagem-balao">{m.texto}</div>
            </div>
          ))}
          {carregando && (
            <div className="mensagem ia">
              <div className="mensagem-icone ia">✨</div>
              <div className="mensagem-balao">
                <div className="mensagem-digitando">
                  <div className="dot" />
                  <div className="dot" />
                  <div className="dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        <div className="chat-sugestoes">
          {sugestoes.map((s, i) => (
            <button key={i} className="sugestao-btn" onClick={() => enviarMensagem(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre sua agenda..."
            disabled={carregando}
          />
          <button className="chat-send-btn" onClick={() => enviarMensagem()} disabled={carregando || !input.trim()}>
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