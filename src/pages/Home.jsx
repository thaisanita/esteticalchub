import React from 'react';
import Graficos from './Graficos';
import NavbarLateral from './NavbarLateral';

export default function Home() {
  const nomeNegocio = localStorage.getItem('nome_negocio') || 'EstetiCalcHub';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div style={styles.layout}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .atalho-btn:hover { background: #4f46e5 !important; color: #fff !important; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79,70,229,0.25) !important; }
        .atalho-btn:hover span { color: #fff !important; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(79,70,229,0.1) !important; }
      `}</style>

      <NavbarLateral />

      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <p style={styles.saudacaoTexto}>{saudacao} 👋</p>
            <h1 style={styles.titulo}>{nomeNegocio}</h1>
            <p style={styles.subtitulo}>Bem-vinda ao seu sistema de gestão.✨</p>
          </div>
          <div style={styles.dataBadge}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </header>

        {/* Grid */}
        <section style={styles.grid}>
          {/* Gráfico */}
          <div style={styles.cardGrande}>
            <Graficos />
          </div>

          {/* Atalhos */}
          <div style={styles.cardPequeno}>
            <div style={styles.atalhoHeader}>
              <span style={styles.atalhoIcon}>⚡</span>
              <h3 style={styles.atalhoTitulo}>Atalhos Rápidos</h3>
            </div>
            <div style={styles.atalhoList}>
              <button
                className="atalho-btn"
                style={styles.atalhoBtn}
                onClick={() => window.location.href='/novo-agendamento'}
              >
                <span style={styles.atalhoBtnIcon}>➕</span>
                <div>
                  <div style={styles.atalhoBtnLabel}>Novo Agendamento</div>
                  <span style={styles.atalhoBtnSub}>Adicionar cliente</span>
                </div>
              </button>
              <button
                className="atalho-btn"
                style={styles.atalhoBtn}
                onClick={() => window.location.href='/procedimentos'}
              >
                <span style={styles.atalhoBtnIcon}>📋</span>
                <div>
                  <div style={styles.atalhoBtnLabel}>Ver Procedimentos</div>
                  <span style={styles.atalhoBtnSub}>Atendimentos do dia</span>
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex', minHeight: '100vh', backgroundColor: '#f8f7ff',
    fontFamily: "'DM Sans', sans-serif"
  },
  main: {
    flex: 1, padding: '36px 36px 60px', marginLeft: '260px'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '32px', flexWrap: 'wrap', gap: '16px'
  },
  saudacaoTexto: { fontSize: '13px', color: '#94a3b8', fontWeight: '500', marginBottom: '4px' },
  titulo: {
    fontFamily: "'Sora', sans-serif", fontSize: '28px', fontWeight: '800',
    color: '#1e1b4b', margin: 0
  },
  subtitulo: { color: '#94a3b8', fontSize: '14px', marginTop: '4px' },
  dataBadge: {
    background: '#fff', border: '1px solid #ede9fe', borderRadius: '10px',
    padding: '10px 18px', fontSize: '13px', color: '#4f46e5', fontWeight: '600',
    boxShadow: '0 2px 8px rgba(79,70,229,0.06)', textTransform: 'capitalize'
  },
  grid: {
    display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start'
  },
  cardGrande: {
    background: '#fff', borderRadius: '18px', padding: '8px',
    boxShadow: '0 2px 16px rgba(79,70,229,0.06)', border: '1px solid #ede9fe'
  },
  cardPequeno: {
    background: '#fff', borderRadius: '18px', padding: '24px',
    boxShadow: '0 2px 16px rgba(79,70,229,0.06)', border: '1px solid #ede9fe'
  },
  atalhoHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  atalhoIcon: { fontSize: '20px' },
  atalhoTitulo: {
    fontFamily: "'Sora', sans-serif", fontSize: '15px', fontWeight: '700', color: '#1e1b4b'
  },
  atalhoList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  atalhoBtn: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 16px', borderRadius: '12px',
    background: '#f8f7ff', border: '1px solid #ede9fe',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(79,70,229,0.06)'
  },
  atalhoBtnIcon: { fontSize: '20px', flexShrink: 0 },
  atalhoBtnLabel: {
    fontSize: '13px', fontWeight: '700', color: '#1e1b4b',
    fontFamily: "'Sora', sans-serif"
  },
  atalhoBtnSub: { fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }
};