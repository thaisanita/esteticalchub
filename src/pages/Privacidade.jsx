import React from 'react';
import { useNavigate } from 'react-router-dom';

const Privacidade = () => {
  const navigate = useNavigate();

  const sections = [
    {
      number: '01',
      title: '1. Coleta de Dados',
      content: 'O EstetiCalcHub coleta apenas as informações necessárias para a gestão da sua clínica, como e-mail e nome do negócio, fornecidos voluntariamente via cadastro direto ou Google Auth.'
    },
    {
      number: '02',
      title: '2. Uso das Informações',
      content: 'Seus dados e os dados de suas clientes são utilizados exclusivamente para o funcionamento da agenda e relatórios financeiros. Não compartilhamos dados com terceiros.'
    },
    {
      number: '03',
      title: '3. Segurança (Google & Supabase)',
      content: (
        <>
          Utilizamos a infraestrutura do <strong>Supabase</strong> e autenticação do <strong>Google</strong> para garantir que as senhas e informações sensíveis sejam criptografadas e protegidas contra acessos não autorizados.
        </>
      )
    },
    {
      number: '04',
      title: '4. Seus Direitos',
      content: 'A qualquer momento, o usuário pode solicitar a exclusão de sua conta e de todos os dados armazenados em nossa base através das configurações do sistema.'
    }
  ];

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .priv-nav-btn:hover { background: #4f46e5 !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.3) !important; }
        .priv-section { transition: transform 0.2s, box-shadow 0.2s; }
        .priv-section:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(79,70,229,0.08) !important; }
        .priv-back:hover { color: #4f46e5 !important; }
      `}</style>

      {/* Navbar */}
      <nav style={s.navbar}>
        <div style={s.logo} onClick={() => navigate('/')}>
          Esteti<span style={{color:'#4f46e5'}}>Calc</span><span style={{color:'#a5b4fc'}}>Hub</span>
        </div>
        <button
          className="priv-nav-btn"
          style={s.navBtn}
          onClick={() => navigate('/')}
        >
          ← Voltar para o Login
        </button>
      </nav>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroBadge}>Documento Legal</div>
        <h1 style={s.heroTitle}>Política de Privacidade<br />e Segurança</h1>
        <p style={s.heroDate}>Última atualização: Fevereiro de 2026</p>
        <div style={s.heroLine} />
      </div>

      {/* Content */}
      <main style={s.main}>
        {sections.map((sec) => (
          <div key={sec.number} className="priv-section" style={s.section}>
            <div style={s.sectionNumber}>{sec.number}</div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>{sec.title}</h2>
              <p style={s.sectionText}>{sec.content}</p>
            </div>
          </div>
        ))}

        {/* Trust badges */}
        <div style={s.trustRow}>
          {['🔒 SSL Encriptado', '🛡️ RGPD Conforme', '🚫 Sem Anúncios'].map(badge => (
            <div key={badge} style={s.trustBadge}>{badge}</div>
          ))}
        </div>

        <p
          className="priv-back"
          style={s.backLink}
          onClick={() => navigate('/')}
        >
          ← Voltar ao sistema
        </p>
      </main>

      <footer style={s.footer}>
        © 2026 EstetiCalcHub — Compromisso com a Transparência.
      </footer>
    </div>
  );
};

const s = {
  page: { backgroundColor: '#f8f7ff', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" },
  navbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 8%', backgroundColor: '#fff',
    borderBottom: '1px solid #ede9fe', position: 'sticky', top: 0, zIndex: 100
  },
  logo: { fontSize: '21px', fontWeight: '800', color: '#1e1b4b', cursor: 'pointer', fontFamily: "'Sora', sans-serif" },
  navBtn: {
    padding: '9px 18px', backgroundColor: '#4f46e5', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '13px',
    transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(79,70,229,0.2)'
  },
  hero: { padding: '60px 8% 40px', maxWidth: '860px', margin: '0 auto' },
  heroBadge: {
    display: 'inline-block', background: '#ede9fe', color: '#4f46e5',
    fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px',
    textTransform: 'uppercase', padding: '5px 14px', borderRadius: '20px', marginBottom: '20px'
  },
  heroTitle: {
    fontFamily: "'Sora', sans-serif", fontSize: '38px', fontWeight: '800',
    color: '#1e1b4b', lineHeight: '1.15', marginBottom: '14px'
  },
  heroDate: { color: '#94a3b8', fontSize: '13px', fontWeight: '500', marginBottom: '30px' },
  heroLine: { height: '3px', width: '60px', background: 'linear-gradient(90deg,#4f46e5,#a5b4fc)', borderRadius: '2px' },
  main: { maxWidth: '860px', margin: '0 auto', padding: '0 8% 60px' },
  section: {
    display: 'flex', gap: '24px', backgroundColor: '#fff',
    borderRadius: '16px', padding: '28px 30px', marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(79,70,229,0.05)', border: '1px solid #ede9fe',
    cursor: 'default'
  },
  sectionNumber: {
    fontFamily: "'Sora', sans-serif", fontSize: '32px', fontWeight: '800',
    color: '#ede9fe', lineHeight: '1', flexShrink: 0, paddingTop: '2px'
  },
  sectionBody: { flex: 1 },
  sectionTitle: {
    fontFamily: "'Sora', sans-serif", fontSize: '16px', fontWeight: '700',
    color: '#1e1b4b', marginBottom: '10px'
  },
  sectionText: { fontSize: '14px', color: '#475569', lineHeight: '1.75' },
  trustRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '30px 0 20px' },
  trustBadge: {
    background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
    borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: '600'
  },
  backLink: {
    fontSize: '14px', color: '#94a3b8', cursor: 'pointer',
    fontWeight: '500', transition: 'color 0.2s', display: 'inline-block', marginTop: '10px'
  },
  footer: {
    textAlign: 'center', padding: '28px', color: '#94a3b8',
    fontSize: '12px', borderTop: '1px solid #ede9fe',
    fontFamily: "'DM Sans', sans-serif"
  }
};

export default Privacidade;