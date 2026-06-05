import React from 'react';
import { useNavigate } from 'react-router-dom';

const Termos = () => {
  const navigate = useNavigate();

  const sections = [
    {
      number: '01',
      title: '1. Aceitação dos Termos e Elegibilidade',
      content: 'Ao criar uma conta e utilizar o EstetiCalcHub, o utilizador concorda expressamente com as regras aqui descritas. O sistema destina-se ao uso profissional de gestão de clínicas e profissionais independentes, sendo o utilizador inteiramente responsável pela veracidade das informações de registo.'
    },
    {
      number: '02',
      title: '2. Limitação de Responsabilidade e Isenção Fiscal',
      content: 'O EstetiCalcHub é uma ferramenta de apoio à gestão e cálculo de lucros estimados. O utilizador reconhece que a plataforma não substitui serviços de contabilidade certificada. Toda e qualquer obrigação fiscal, declaração de impostos (como o IVA ou IRS/IRC) e a conformidade com as leis em vigor são da exclusiva responsabilidade do utilizador.'
    },
    {
      number: '03',
      title: '3. Propriedade Intelectual e Uso Proibido',
      content: (
        <>
          Todo o código, design, marcas e funcionalidades do <strong>EstetiCalcHub</strong> são propriedade intelectual exclusiva do projeto. É estritamente proibido tentar copiar, modificar, sublicenciar, fazer engenharia reversa ou utilizar robôs que possam sobrecarregar a estabilidade da nossa infraestrutura.
        </>
      )
    },
    {
      number: '04',
      title: '4. Suspensão de Contas e Modificações',
      content: 'Reservamos o direito de suspender ou encerrar o acesso à plataforma a qualquer utilizador que viole estas diretrizes ou utilize o sistema para fins fraudulentos. Estes termos podem ser atualizados periodicamente para refletir melhorias no sistema, sendo a versão mais recente sempre pública nesta página.'
    }
  ];

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .term-nav-btn:hover { background: #4f46e5 !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.3) !important; }
        .term-section { transition: transform 0.2s, box-shadow 0.2s; }
        .term-section:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(79,70,229,0.08) !important; }
        .term-back:hover { color: #4f46e5 !important; }
      `}</style>

      {/* Navbar */}
      <nav style={s.navbar}>
        <div style={s.logo} onClick={() => navigate('/')}>
          Esteti<span style={{color:'#4f46e5'}}>Calc</span><span style={{color:'#a5b4fc'}}>Hub</span>
        </div>
        <button
          className="term-nav-btn"
          style={s.navBtn}
          onClick={() => navigate('/')}
        >
          ← Voltar para o Login
        </button>
      </nav>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroBadge}>Documento Legal</div>
        <h1 style={s.heroTitle}>Termos de Uso<br />e Serviço</h1>
        <p style={s.heroDate}>Última atualização: Junho de 2026</p>
        <div style={s.heroLine} />
      </div>

      {/* Content */}
      <main style={s.main}>
        {sections.map((sec) => (
          <div key={sec.number} className="term-section" style={s.section}>
            <div style={s.sectionNumber}>{sec.number}</div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>{sec.title}</h2>
              <p style={s.sectionText}>{sec.content}</p>
            </div>
          </div>
        ))}

        {/* Trust badges */}
        <div style={s.trustRow}>
          {['⚖️ Uso Comercial Autorizado', '🛡️ Proteção de Conta', '💼 Foco Profissional'].map(badge => (
            <div key={badge} style={s.trustBadge}>{badge}</div>
          ))}
        </div>

        <p
          className="term-back"
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
    background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
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

export default Termos;