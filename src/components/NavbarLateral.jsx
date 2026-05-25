import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

const NavbarLateral = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ativo = (rota) => location.pathname === rota;

  const [nomeNegocio, setNomeNegocio] = useState('Meu Négocio');
  const [aberto, setAberto] = useState(false);

  const idioma = localStorage.getItem('config_idioma') || 'Português (PT)';

  const textos = {
    'Português (PT)': {
      agenda: 'Agenda', procedimentos: 'Procedimentos',
      porcentagem: 'Porcentagem', relatorios: 'Relatórios e Ganhos',
      configuracoes: 'Configurações', sair: 'Sair'
    },
    'English (US)': {
      agenda: 'Schedule', procedimentos: 'Procedures',
      porcentagem: 'Percentage', relatorios: 'Reports & Earnings',
      configuracoes: 'Settings', sair: 'Logout'
    },
    'Español (ES)': {
      agenda: 'Agenda', procedimentos: 'Procedimientos',
      porcentagem: 'Porcentaje', relatorios: 'Informes y Ganancias',
      configuracoes: 'Configuraciones', sair: 'Salir'
    }
  }[idioma] || {};

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('nome_negocio');
    if (nomeSalvo) setNomeNegocio(nomeSalvo);
  }, []);

  const irPara = (rota) => {
    navigate(rota);
    setAberto(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error("Erro ao sair:", error);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const sidebarStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    width: '280px',
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(10px)',
    zIndex: 1000,
    transform: aberto ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '10px 0 30px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    padding: '30px 20px'
  };

  const navItemStyle = (rota) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '14px 18px',
    borderRadius: '16px',
    border: 'none',
    background: ativo(rota) ? '#f0f0ff' : 'transparent',
    color: ativo(rota) ? '#4f46e5' : '#64748b',
    fontSize: '16px',
    fontWeight: ativo(rota) ? '700' : '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: '0.3s',
    marginBottom: '8px',
    width: '100%'
  });

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          position: 'fixed', top: '20px', left: '20px', zIndex: 1001,
          width: '45px', height: '45px', borderRadius: '12px',
          border: 'none', background: '#4f46e5', color: 'white',
          fontSize: '20px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {aberto ? '✕' : '☰'}
      </button>

      {/* Barra Lateral */}
      <div style={sidebarStyle}>
        <div style={{ padding: '20px 0 40px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>✨</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{nomeNegocio}</span>
        </div>

        <nav style={{ flex: 1 }}>
          <button style={navItemStyle('/')} onClick={() => irPara('/')}>
            <span style={{ fontSize: '20px' }}>📅</span> {textos.agenda}
          </button>

          <button style={navItemStyle('/procedimentos')} onClick={() => irPara('/procedimentos')}>
            <span style={{ fontSize: '20px' }}>📋</span> {textos.procedimentos}
          </button>

          <button style={navItemStyle('/porcentagem')} onClick={() => irPara('/porcentagem')}>
            <span style={{ fontSize: '20px' }}>💰</span> {textos.porcentagem}
          </button>

          <button style={navItemStyle('/relatorios')} onClick={() => irPara('/relatorios')}>
            <span style={{ fontSize: '20px' }}>📈</span> {textos.relatorios}
          </button>
        </nav>

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
          <button style={navItemStyle('/configuracoes')} onClick={() => irPara('/configuracoes')}>
            <span style={{ fontSize: '20px' }}>⚙️</span> {textos.configuracoes}
          </button>

          <button
            style={{ ...navItemStyle('/sair'), color: '#ef4444', background: 'transparent' }}
            onClick={handleLogout}
          >
            <span style={{ fontSize: '20px' }}>🚪</span> {textos.sair}
          </button>
        </div>
      </div>

      {/* Fundo escurecido */}
      {aberto && (
        <div
          onClick={() => setAberto(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(4px)', zIndex: 999, transition: '0.3s'
          }}
        />
      )}
    </>
  );
};

export default NavbarLateral;