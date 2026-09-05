import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      const type = params.get('type');

      if (type === 'recovery' && accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
          if (!error) setSessaoValida(true);
          setVerificando(false);
        });
        return;
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setSessaoValida(true);
      }
      setVerificando(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessaoValida(true);
      setVerificando(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setMensagem('');

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    setCarregando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      setMensagem('Senha redefinida com sucesso! Redirecionando...');
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setErro('Erro ao redefinir: ' + getErrorMessage(err));
    } finally {
      setCarregando(false);
    }
  };

  const getForcaSenha = (senha: string) => {
    if (!senha) return null;
    if (senha.length < 6) return { nivel: 1, label: 'Fraca', className: 'bg-danger', textClass: 'text-danger' };
    if (senha.length < 8) return { nivel: 2, label: 'Média', className: 'bg-warning', textClass: 'text-warning' };
    if (/[A-Z]/.test(senha) && /[0-9]/.test(senha))
      return { nivel: 4, label: 'Muito forte', className: 'bg-success', textClass: 'text-success' };
    return { nivel: 3, label: 'Boa', className: 'bg-primary', textClass: 'text-primary' };
  };

  const forca = getForcaSenha(novaSenha);

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-5">
        <div className="w-full max-w-[420px] rounded-3xl border border-border bg-card p-11 text-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">A verificar o link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessaoValida) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-5">
        <div className="w-full max-w-[420px] rounded-3xl border border-border bg-card p-11">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle size={26} className="text-warning" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Link inválido ou expirado</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Este link de redefinição já foi usado ou expirou.
              <br />
              Solicite um novo link na página de login.
            </p>
            <Button
              onClick={() => navigate('/')}
              className="mt-2 w-full bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground hover:opacity-90"
            >
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="w-full max-w-[420px] rounded-3xl border border-border bg-card p-11">
        <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          Nova Senha
        </span>

        <h2 className="font-display text-2xl font-bold text-foreground">Crie uma nova senha</h2>
        <p className="mb-7 mt-2 text-sm leading-relaxed text-muted-foreground">
          Escolha uma senha segura para a sua conta.
        </p>

        <form onSubmit={handleReset} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>Nova Senha</Label>
            <div className="relative">
              <Input
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => {
                  setNovaSenha(e.target.value);
                  setErro('');
                }}
                autoComplete="new-password"
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {forca && (
              <div className="mt-2 flex items-center gap-2.5">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${n <= forca.nivel ? forca.className : 'bg-border'}`}
                    />
                  ))}
                </div>
                <span className={`shrink-0 text-[11px] font-bold ${forca.textClass}`}>{forca.label}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Confirmar Senha</Label>
            <div className="relative">
              <Input
                type={mostrarConfirmar ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => {
                  setConfirmarSenha(e.target.value);
                  setErro('');
                }}
                autoComplete="new-password"
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
              >
                {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmarSenha && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {novaSenha === confirmarSenha ? (
                  <CheckCircle2 size={13} className="text-success" />
                ) : (
                  <AlertCircle size={13} className="text-danger" />
                )}
                <span className={`text-xs font-semibold ${novaSenha === confirmarSenha ? 'text-success' : 'text-danger'}`}>
                  {novaSenha === confirmarSenha ? 'Senhas coincidem' : 'Senhas não coincidem'}
                </span>
              </div>
            )}
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {erro}
            </div>
          )}
          {mensagem && (
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-[13px] text-success">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              {mensagem}
            </div>
          )}

          <Button
            type="submit"
            disabled={carregando}
            className="w-full bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
          >
            {carregando ? 'A guardar...' : 'Salvar nova senha'}
          </Button>
        </form>

        <span
          onClick={() => navigate('/')}
          className="mt-5 block cursor-pointer text-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Voltar para o login
        </span>
      </div>
    </div>
  );
};

export default ResetPassword;