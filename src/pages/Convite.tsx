import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';

type Estado = 'a-verificar' | 'por-autenticar' | 'a-aceitar' | 'aceite' | 'erro';

/** Página pública de convite para a equipa (link gerado em Configurações). */
export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('a-verificar');
  const [erro, setErro] = useState<string | null>(null);

  const aceitar = async () => {
    setEstado('a-aceitar');
    setErro(null);
    const { error } = await supabase.rpc('aceitar_convite', { p_token: token });
    if (error) {
      setErro(error.message);
      setEstado('erro');
      return;
    }
    setEstado('aceite');
    setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
  };

  useEffect(() => {
    if (!token) {
      setErro('Link de convite inválido.');
      setEstado('erro');
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        aceitar();
      } else {
        setEstado('por-autenticar');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const entrarComGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/convite/${token}` },
    });
    if (error) setErro('Erro ao ligar com o Google: ' + error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-xl shadow-black/20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
          <Sparkles size={22} />
        </div>

        {estado === 'a-verificar' && (
          <p className="text-sm text-muted-foreground">A verificar o convite…</p>
        )}

        {estado === 'por-autenticar' && (
          <>
            <h1 className="mb-1 font-display text-lg font-bold text-foreground">Convite para a equipa</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Entra com o Google para aceitares o convite e passares a partilhar a agenda e as clientes com a
              equipa.
            </p>
            <Button onClick={entrarComGoogle} className="w-full">
              Continuar com Google
            </Button>
          </>
        )}

        {estado === 'a-aceitar' && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> A aceitar o convite…
          </p>
        )}

        {estado === 'aceite' && (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 size={16} /> Bem-vinda à equipa! A abrir a agenda…
          </p>
        )}

        {estado === 'erro' && (
          <>
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-danger">
              <AlertTriangle size={16} /> Não foi possível aceitar o convite
            </p>
            <p className="text-xs text-muted-foreground">{erro}</p>
          </>
        )}
      </div>
    </div>
  );
}
