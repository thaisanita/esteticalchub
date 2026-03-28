import React from 'react';
import Relatorios from '../components/Relatorios';
import NavbarLateral from '../components/NavbarLateral';

export default function Reports() {
  return (
    <div style={styles.layout}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <NavbarLateral />

      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerIconWrap}>📊</div>
          <div>
            <h1 style={styles.titulo}>Relatórios e Ganhos</h1>
            <p style={styles.subtitulo}>Acompanhe sua evolução financeira ✨</p>
          </div>
        </header>

        <section style={styles.section}>
          <Relatorios />
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
    display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px'
  },
  headerIconWrap: {
    width: '54px', height: '54px', background: '#ede9fe', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', flexShrink: 0
  },
  titulo: {
    fontFamily: "'Sora', sans-serif", fontSize: '26px', fontWeight: '800',
    color: '#1e1b4b', margin: 0
  },
  subtitulo: { color: '#94a3b8', fontSize: '14px', marginTop: '4px' },
  section: { maxWidth: '1000px' }
};