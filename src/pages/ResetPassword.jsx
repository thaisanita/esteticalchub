import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const EyeIcon = ({ visible }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {visible ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

EyeIcon.propTypes = { visible: Boolean };

export default function ResetPassword() {
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
    // 1. Extrai o token do hash da URL: #access_token=...&type=recovery
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      const type = params.get('type');

      if (type === 'recovery' && accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (!error) setSessaoValida(true);
            setVerificando(false);
          });
        return; // Não precisa continuar
      }
    }

    // 2. Escuta evento PASSWORD_RECOVERY (caso o Supabase já processe internamente)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setSessaoValida(true);
      }
      setVerificando(false);
    });

    // 3. Fallback: sessão já ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessaoValida(true);
      setVerificando(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e) => {
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
      setErro('Erro ao redefinir: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Força de senha
  const getForcaSenha = (senha) => {
    if (!senha) return null;
    if (senha.length < 6) return { nivel: 1, label: 'Fraca', color: '#ef4444' };
    if (senha.length < 8) return { nivel: 2, label: 'Média', color: '#f59e0b' };
    if (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) return { nivel: 4, label: 'Muito forte', color: '#059669' };
    return { nivel: 3, label: 'Boa', color: '#3b82f6' };
  };

  const forca = getForcaSenha(novaSenha);

  if (verificando) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.loadingWrap}>
            <div style={s.spinner} />
            <p style={s.loadingText}>A verificar o link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessaoValida) {
    return (
      <div style={s.page}>
        <style>{cssReset}</style>
        <div style={s.card}>
          <div style={s.invalidWrap}>
            <div style={s.invalidIcon}>⚠️</div>
            <h2 style={s.invalidTitle}>Link inválido ou expirado</h2>
            <p style={s.invalidText}>
              Este link de redefinição já foi usado ou expirou.<br />
              Solicite um novo link na página de login.
            </p>
            <button className="rp-btn-primary" style={s.btnPrimary} onClick={() => navigate('/')}>
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <style>{cssReset}</style>

      <div style={s.card}>
        {/* Badge */}
        <span style={s.badge}>Nova Senha</span>

        {/* Título */}
        <h2 style={s.titulo}>Crie uma nova senha</h2>
        <p style={s.subtitulo}>Escolha uma senha segura para a sua conta.</p>

        <form onSubmit={handleReset} style={s.form}>
          {/* Nova senha */}
          <div style={s.fieldGroup}>
            <label style={s.label}>NOVA SENHA</label>
            <div style={s.inputWrap}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                className="rp-input"
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => { setNovaSenha(e.target.value); setErro(''); }}
                autoComplete="new-password"
                required
              />
              <button type="button" className="rp-eye" onClick={() => setMostrarSenha(!mostrarSenha)} tabIndex="-1">
                <EyeIcon visible={mostrarSenha} />
              </button>
            </div>

            {/* Barra de força */}
            {forca && (
              <div style={s.forcaWrap}>
                <div style={s.forcaBar}>
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} style={{ ...s.forcaSegmento, background: n <= forca.nivel ? forca.color : '#e2e8f0' }} />
                  ))}
                </div>
                <span style={{ ...s.forcaLabel, color: forca.color }}>{forca.label}</span>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div style={s.fieldGroup}>
            <label style={s.label}>CONFIRMAR SENHA</label>
            <div style={s.inputWrap}>
              <input
                type={mostrarConfirmar ? 'text' : 'password'}
                className="rp-input"
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => { setConfirmarSenha(e.target.value); setErro(''); }}
                autoComplete="new-password"
                required
              />
              <button type="button" className="rp-eye" onClick={() => setMostrarConfirmar(!mostrarConfirmar)} tabIndex="-1">
                <EyeIcon visible={mostrarConfirmar} />
              </button>
            </div>
            {/* Match indicator */}
            {confirmarSenha && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px' }}>{novaSenha === confirmarSenha ? '✅' : '❌'}</span>
                <span style={{ fontSize: '12px', color: novaSenha === confirmarSenha ? '#059669' : '#ef4444', fontWeight: '600' }}>
                  {novaSenha === confirmarSenha ? 'Senhas coincidem' : 'Senhas não coincidem'}
                </span>
              </div>
            )}
          </div>

          {/* Erro */}
          {erro && <div style={s.erroBox}>{erro}</div>}

          {/* Sucesso */}
          {mensagem && <div style={s.sucessoBox}>✅ {mensagem}</div>}

          <button
            type="submit"
            className="rp-btn-primary"
            style={{ ...s.btnPrimary, opacity: carregando ? 0.7 : 1, cursor: carregando ? 'not-allowed' : 'pointer' }}
            disabled={carregando}
          >
            {carregando ? 'A guardar...' : 'Salvar nova senha'}
          </button>
        </form>

        <span style={s.backLink} onClick={() => navigate('/')}>
          ← Voltar para o login
        </span>
      </div>
    </div>
  );
}

const cssReset = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .rp-input {
    width: 100%;
    padding: 13px 46px 13px 16px;
    border-radius: 10px;
    border: 1.5px solid #e0e7ff;
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    color: #1e1b4b;
    background: #fdfdff;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .rp-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
  }
  .rp-input::placeholder { color: #c4c9e0; }

  .rp-eye {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #b2bec3;
    display: flex;
    align-items: center;
    padding: 0;
    transition: color 0.2s;
  }
  .rp-eye:hover { color: #4f46e5; }

  .rp-btn-primary {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s;
    box-shadow: 0 4px 14px rgba(79,70,229,0.3);
  }
  .rp-btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(79,70,229,0.4);
  }
`;

const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f8f7ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'DM Sans', sans-serif"
  },
  card: {
    background: '#fff',
    borderRadius: '24px',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(79,70,229,0.12), 0 2px 8px rgba(79,70,229,0.06)',
    border: '1px solid rgba(79,70,229,0.08)'
  },
  badge: {
    display: 'inline-block',
    background: '#ede9fe',
    color: '#4f46e5',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    padding: '5px 12px',
    borderRadius: '20px',
    marginBottom: '16px'
  },
  titulo: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '24px',
    fontWeight: '800',
    color: '#1e1b4b',
    marginBottom: '8px'
  },
  subtitulo: { fontSize: '14px', color: '#94a3b8', marginBottom: '28px', lineHeight: '1.6' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '7px' },
  label: { fontSize: '11px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.8px' },
  inputWrap: { position: 'relative' },
  forcaWrap: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' },
  forcaBar: { display: 'flex', gap: '4px', flex: 1 },
  forcaSegmento: { height: '4px', flex: 1, borderRadius: '2px', transition: 'background 0.3s' },
  forcaLabel: { fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  erroBox: {
    background: '#fff5f5', color: '#c0392b', padding: '11px 14px',
    borderRadius: '8px', fontSize: '13px', border: '1px solid #fdd', lineHeight: '1.5'
  },
  sucessoBox: {
    background: '#f0fdf9', color: '#00897b', padding: '11px 14px',
    borderRadius: '8px', fontSize: '13px', border: '1px solid #b2dfdb', lineHeight: '1.5'
  },
  btnPrimary: { cursor: 'pointer' },
  backLink: {
    display: 'block', textAlign: 'center', marginTop: '20px',
    fontSize: '14px', color: '#94a3b8', cursor: 'pointer',
    fontWeight: '500', transition: 'color 0.2s'
  },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px' },
  spinner: {
    width: '36px', height: '36px', borderRadius: '50%',
    border: '3px solid #ede9fe', borderTopColor: '#4f46e5',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: { color: '#94a3b8', fontSize: '14px' },
  invalidWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' },
  invalidIcon: { fontSize: '40px' },
  invalidTitle: { fontFamily: "'Sora', sans-serif", fontSize: '20px', fontWeight: '800', color: '#1e1b4b' },
  invalidText: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.7' }
};