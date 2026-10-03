import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Loader2, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '@/lib/utils';
import { usePlan } from '@/hooks/usePlan';

// supabase/functions/ai-assistant/index.ts — se o painel do Supabase gerar
// um nome diferente ao publicar (como aconteceu com outras funções), troca
// este valor para o nome que aparecer lá.
const FUNCAO_ASSISTENTE_IA = 'ai-assistant';

type Mensagem = {
  id: string;
  autor: 'utilizadora' | 'assistente';
  texto: string;
  erro?: boolean;
};

const MENSAGEM_BOAS_VINDAS: Mensagem = {
  id: 'boas-vindas',
  autor: 'assistente',
  texto: 'Olá! Pergunta-me sobre a tua agenda, pagamentos, custos fixos ou clientes.',
};

export default function AssistenteIA() {
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([MENSAGEM_BOAS_VINDAS]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimDaListaRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberto) fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aberto]);

  // Fecha ao clicar fora da janela (mas não ao clicar no próprio botão, que já alterna).
  useEffect(() => {
    if (!aberto || !isPro) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando) return;

    const minhaMensagem: Mensagem = { id: crypto.randomUUID(), autor: 'utilizadora', texto };
    setMensagens((prev) => [...prev, minhaMensagem]);
    setInput('');
    setEnviando(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase.functions.invoke<{ resposta?: string; erro?: string }>(
        FUNCAO_ASSISTENTE_IA,
        { body: { message: texto, user_id: session.user.id } }
      );

      if (error) throw new Error(error.message || 'Falha ao contactar o assistente.');
      if (data?.erro) throw new Error(data.erro);

      setMensagens((prev) => [
        ...prev,
        { id: crypto.randomUUID(), autor: 'assistente', texto: data?.resposta || 'Sem resposta.' },
      ]);
    } catch (e) {
      setMensagens((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          autor: 'assistente',
          texto: e instanceof Error ? e.message : 'Não foi possível falar com o assistente.',
          erro: true,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const aoPressionarTecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <>
      {/* Botão flutuante: fica por cima do botão de "pagamento rápido".
          No plano grátis fica sempre visível, só que a abrir não o chat,
          mas sim a página de planos (tooltip explica o motivo). */}
      <button
        ref={botaoRef}
        onClick={() => (isPro ? setAberto((v) => !v) : navigate('/planos'))}
        title={isPro ? 'Assistente' : 'Disponível no plano Pro'}
        className={cn(
          'no-print fixed bottom-[9.5rem] right-5 z-[900] flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-[5.5rem] md:right-6',
          isPro
            ? 'bg-gradient-to-br from-primary to-primary-hover shadow-primary/40'
            : 'bg-muted-foreground/50 shadow-black/20'
        )}
      >
        {aberto && isPro ? <X size={22} /> : isPro ? <Sparkles size={22} /> : <Lock size={20} />}
      </button>

      {aberto && isPro && (
        <div
          ref={painelRef}
          className="no-print fixed bottom-[16rem] right-5 z-[900] flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 md:bottom-[9.5rem] md:right-6"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <p className="font-display text-sm font-bold text-foreground">Assistente</p>
            </div>
            <button
              onClick={() => setAberto(false)}
              title="Fechar"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  m.autor === 'utilizadora'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : m.erro
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-muted text-foreground'
                )}
              >
                {m.texto}
              </div>
            ))}
            {enviando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> a escrever...
              </div>
            )}
            <div ref={fimDaListaRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={aoPressionarTecla}
              placeholder="Pergunta algo..."
              rows={1}
              disabled={enviando}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
            />
            <button
              onClick={enviar}
              disabled={enviando || !input.trim()}
              title="Enviar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
