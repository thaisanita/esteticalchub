// Página pública para a cliente deixar de receber lembretes automáticos
// (email/WhatsApp). O link vem nos próprios lembretes: /opt-out?token=...
// Exige um clique de confirmação (para o link não ser acionado sozinho por
// antivírus/pré-visualizadores de email).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { BellOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { EMPRESA } from '@/lib/empresa';

export default function OptOut() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'feito' | 'erro'>('inicio');

  const confirmar = async () => {
    if (!token) return;
    setEstado('enviando');
    const { data, error } = await supabase.rpc('optout_lembretes', { p_token: token });
    setEstado(error || !data ? 'erro' : 'feito');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-lg shadow-black/10">
        {!token || estado === 'erro' ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-danger" />
            <h1 className="text-lg font-bold text-foreground">Ligação inválida</h1>
            <p className="text-sm text-muted-foreground">
              Não foi possível processar este pedido. Se quiser deixar de receber lembretes, responda à mensagem
              ou escreva para{' '}
              <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
                {EMPRESA.email}
              </a>
              .
            </p>
          </>
        ) : estado === 'feito' ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-bold text-foreground">Pedido registado</h1>
            <p className="text-sm text-muted-foreground">
              Não voltará a receber lembretes automáticos por email ou WhatsApp desta profissional.
            </p>
          </>
        ) : (
          <>
            <BellOff className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Deixar de receber lembretes?</h1>
            <p className="text-sm text-muted-foreground">
              Confirme para deixar de receber lembretes automáticos dos seus atendimentos por email e WhatsApp.
            </p>
            <button
              onClick={confirmar}
              disabled={estado === 'enviando'}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {estado === 'enviando' && <Loader2 size={16} className="animate-spin" />}
              Confirmar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
