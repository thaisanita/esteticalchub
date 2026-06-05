import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabase'; 
import Footer from './Footer'; // Garantindo a importação do rodapé novo

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

EyeIcon.propTypes = { visible: PropTypes.bool.isRequired };

const Login = ({ onLogin }) => {
  const [isRegistro, setIsRegistro] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [registrou, setRegistrou] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) onLogin(true);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) onLogin(true);
    });

    return () => subscription.unsubscribe();
  }, [onLogin]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);
    setRegistrou(false);

    try {
      if (isRegistro) {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;

        setMensagem(`Conta criada com sucesso!\n\nEnviamos um email de confirmação para ${email}.\nSe não encontrar, verifique spam ou promoções.\n\nPode levar até 2 minutos.`);
        setRegistrou(true);
        setEmail('');
        setSenha('');

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error("E-mail ou senha incorretos.");
        onLogin(true);
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://esteticalchub.vercel.app/reset-password',
      });
      if (error) throw error;
      setMensagem(`Email de redefinição enviado para ${email}.\nVerifique sua caixa de entrada e spam.`);
    } catch (err) {
      setErro('Erro ao enviar email: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  const loginGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://esteticmanager.vercel.app' }
    });
    if (error) setErro("Erro ao conectar com Google: " + error.message);
  };

  const reenviarEmailConfirmacao = async () => {
    setErro('');
    setMensagem('');
    setCarregando(true);
    try {
      const { error } = await supabase.auth.api.resendVerificationEmailForEmail(email);
      if (error) throw error;
      setMensagem('Email de confirmação reenviado! Verifique seu spam ou promoções.');
    } catch (err) {
      setErro('Erro ao reenviar o email: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  const resetState = () => {
    setErro('');
    setMensagem('');
    setRegistrou(false);
    setMostrarSenha(false);
  };

  return (
    <div style={styles.pageWrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #f9f8ff; }

        .input-field {
          width: 100%;
          padding: 14px 16px;
          margin-bottom: 14px;
          border-radius: 10px;
          border: 1.5px solid #e8e3ff;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          color: #2d3436;
          background: #fdfdff;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .input-field:focus {
          border-color: #6c5ce7;
          box-shadow: 0 0 0 3px rgba(108,92,231,0.12);
          background: #fff;
        }
        .input-field::placeholder { color: #b2bec3; }

        .password-wrapper {
          position: relative;
          margin-bottom: 14px;
        }
        .password-wrapper .input-field {
          margin-bottom: 0;
          padding-right: 48px;
        }
        .eye-btn {
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
        .eye-btn:hover { color: #6c5ce7; }

        .btn-primary {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #6c5ce7, #a29bfe);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.3px;
          transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(108,92,231,0.35);
          margin-top: 4px;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(108,92,231,0.45);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-google {
          width: 100%;
          padding: 13px;
          background: white;
          color: #2d3436;
          border: 1.5px solid #e8e3ff;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .btn-google:hover {
          background: #faf9ff;
          border-color: #a29bfe;
          box-shadow: 0 2px 10px rgba(108,92,231,0.1);
        }

        .btn-resend {
          margin-top: 10px;
          width: 100%;
          padding: 13px;
          background: #0984e3;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          transition: opacity 0.2s;
        }
        .btn-resend:hover:not(:disabled) { opacity: 0.88; }
        .btn-resend:disabled { opacity: 0.6; cursor: not-allowed; }

        .toggle-link {
          margin-top: 22px;
          font-size: 14px;
          cursor: pointer;
          color: #6c5ce7;
          text-align: center;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: opacity 0.2s;
        }
        .toggle-link:hover { opacity: 0.75; }

        .forgot-link {
          display: block;
          text-align: right;
          font-size: 13px;
          color: #6c5ce7;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 16px;
          font-family: 'DM Sans', sans-serif;
          transition: opacity 0.2s;
        }
        .forgot-link:hover { opacity: 0.75; }

        .back-link {
          display: block;
          text-align: center;
          font-size: 13px;
          color: #636e72;
          cursor: pointer;
          margin-top: 18px;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.2s;
        }
        .back-link:hover { color: #6c5ce7; }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          color: #4a4067;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          padding: 10px 0;
          border-bottom: 1px solid rgba(108,92,231,0.08);
        }
        .feature-item:last-child { border-bottom: none; }
        .feature-dot {
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #6c5ce7, #a29bfe);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .card-badge {
          display: inline-block;
          background: rgba(108,92,231,0.08);
          color: #6c5ce7;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 20px;
          margin-bottom: 16px;
          font-family: 'DM Sans', sans-serif;
        }

        .divider {
          margin: 20px 0;
          display: flex;
          align-items: center;
          color: #c7bfea;
          font-size: 13px;
          gap: 10px;
          font-family: 'DM Sans', sans-serif;
        }
        .divider hr { flex: 1; border: none; border-top: 1px solid #ede8ff; }

        @media (max-width: 768px) {
          .hero-section { display: none; }
          .main-content { padding: 30px 5% !important; }
          .login-card { max-width: 100% !important; }
        }
      `}</style>

      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.logo}>
          Esteti<span style={{ color: '#6c5ce7' }}>Calc</span><span style={{ color: '#a29bfe' }}>Hub</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a29bfe" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span style={styles.navItem}>Segurança Certificada</span>
        </div>
      </nav>

      {/* Main */}
      <div style={styles.mainContent} className="main-content">

        {/* Hero */}
        <section style={styles.heroSection} className="hero-section">
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: '#a29bfe', fontFamily: "'DM Sans', sans-serif" }}>
              Plataforma Profissional
            </span>
          </div>
          <h1 style={styles.heroTitle}>
            Gestão inteligente para sua{' '}
            <em style={{ color: '#6c5ce7', fontStyle: 'italic' }}>Clínica de Estética.</em>
          </h1>
          <p style={styles.heroSub}>
            Organize agendamentos, clients e finanças em um só lugar. 
            Acesse de onde estiver com total segurança.
          </p>
          <div style={{ marginTop: '36px' }}>
            <div className="feature-item"><span className="feature-dot" /><span>Agenda Online 24h</span></div>
            <div className="feature-item"><span className="feature-dot" /><span>Fichas de Anamnese Digitais</span></div>
            <div className="feature-item"><span className="feature-dot" /><span>Controle de Faturamento</span></div>
          </div>
          <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(108,92,231,0.06)', borderRadius: '14px', border: '1px solid rgba(108,92,231,0.12)' }}>
            <div style={{ fontSize: '13px', color: '#6c5ce7', fontWeight: '700', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px' }}>+2.400 profissionais</div>
            <div style={{ fontSize: '13px', color: '#636e72', fontFamily: "'DM Sans', sans-serif" }}>já confiam no EstetiCalcHub para gerenciar suas clínicas</div>
          </div>
        </section>

        {/* Card */}
        <section style={styles.loginCard} className="login-card">
          {isForgotPassword ? (
            <>
              <span className="card-badge">Recuperar Acesso</span>
              <h2 style={styles.cardTitle}>Esqueceu a senha?</h2>
              <p style={{ fontSize: '14px', color: '#636e72', fontFamily: "'DM Sans', sans-serif", marginTop: '10px', marginBottom: '24px', lineHeight: '1.6' }}>
                Digite seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
              <form onSubmit={handleForgotPassword}>
                <input
                  type="email"
                  placeholder="Seu e-mail cadastrado"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErro(''); }}
                  className="input-field"
                  autoComplete="email"
                  required
                />
                {erro && <div style={styles.errorBox}>{erro}</div>}
                {mensagem && <div style={styles.successBox}>{mensagem}</div>}
                <button type="submit" className="btn-primary" disabled={carregando}>
                  {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>
              <span className="back-link" onClick={() => { setIsForgotPassword(false); resetState(); }}>
                ← Voltar para o login
              </span>
            </>
          ) : (
            <>
              <span className="card-badge">{isRegistro ? 'Novo Cadastro' : 'Área Restrita'}</span>
              <h2 style={styles.cardTitle}>{isRegistro ? 'Criar Conta' : 'Bem-vindo de volta'}</h2>

              <form onSubmit={handleAuth} style={{ marginTop: '24px' }} autoComplete="on">
                <input
                  type="email"
                  name="email"
                  placeholder="E-mail profissional"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErro(''); }}
                  className="input-field"
                  autoComplete="email"
                  required
                />

                <div className="password-wrapper">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    name="password"
                    placeholder="Sua senha"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); setErro(''); }}
                    className="input-field"
                    autoComplete={isRegistro ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    tabIndex="-1"
                    title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    <EyeIcon visible={mostrarSenha} />
                  </button>
                </div>

                {!isRegistro && (
                  <span className="forgot-link" onClick={() => { setIsForgotPassword(true); resetState(); }}>
                    Esqueci minha senha
                  </span>
                )}

                {erro && <div style={styles.errorBox}>{erro}</div>}
                {mensagem && <div style={styles.successBox}>{mensagem}</div>}

                <button type="submit" className="btn-primary" disabled={carregando}>
                  {carregando ? 'Processando...' : (isRegistro ? 'Criar minha conta' : 'Entrar na plataforma')}
                </button>
              </form>

              {isRegistro && registrou && (
                <button
                  className="btn-resend"
                  onClick={reenviarEmailConfirmacao}
                  disabled={carregando || !email}
                >
                  Reenviar email de confirmação
                </button>
              )}

              <div className="divider">
                <hr /> <span>ou continue com</span> <hr />
              </div>

              <button onClick={loginGoogle} className="btn-google">
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  style={{ width: '18px', marginRight: '10px' }}
                />
                Continuar com Google
              </button>

              <p className="toggle-link" onClick={() => { setIsRegistro(!isRegistro); resetState(); }}>
                {isRegistro ? 'Já tem uma conta? Entre' : 'Não tem conta? Registre-se gratuitamente'}
              </p>
            </>
          )}
        </section>
      </div>

      {/* O componente de Rodapé Reutilizável */}
      <Footer />
    </div>
  );
};

Login.propTypes = { onLogin: PropTypes.func.isRequired };
export default Login;

const styles = {
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#f9f8ff',
    fontFamily: "'DM Sans', sans-serif",
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 8%',
    backgroundColor: '#fff',
    borderBottom: '1px solid #ede8ff',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(8px)',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#2d3436',
    fontFamily: "'DM Serif Display', serif",
    letterSpacing: '-0.5px',
  },
  navItem: {
    fontSize: '11px',
    color: '#a29bfe',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  mainContent: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: '70px 8%',
    gap: '60px',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'calc(100vh - 140px)',
  },
  heroSection: {
    flex: '1',
    minWidth: '300px',
    maxWidth: '480px',
  },
  heroTitle: {
    fontSize: '40px',
    color: '#1a1a2e',
    lineHeight: '1.15',
    marginBottom: '18px',
    fontFamily: "'DM Serif Display', serif",
    letterSpacing: '-0.5px',
  },
  heroSub: {
    fontSize: '16px',
    color: '#636e72',
    lineHeight: '1.7',
  },
  loginCard: {
    background: 'white',
    padding: '44px 40px',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '410px',
    boxShadow: '0 20px 60px rgba(108,92,231,0.12), 0 2px 8px rgba(108,92,231,0.06)',
    border: '1px solid rgba(108,92,231,0.08)',
  },
  cardTitle: {
    color: '#1a1a2e',
    textAlign: 'left',
    fontSize: '24px',
    fontFamily: "'DM Serif Display', serif",
    fontWeight: '400',
    letterSpacing: '-0.3px',
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    color: '#c0392b',
    padding: '11px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '14px',
    border: '1px solid #fdd',
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: '1.5',
  },
  successBox: {
    backgroundColor: '#f0fdf9',
    color: '#00897b',
    padding: '11px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '14px',
    whiteSpace: 'pre-line',
    border: '1px solid #b2dfdb',
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: '1.6',
  }
};