import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer style={s.footer}>
      {/* Estilos CSS injetados para lidar com transições e hovers limpos */}
      <style>{`
        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: color 0.2s ease, transform 0.2s ease;
          cursor: pointer;
        }
        .footer-link:hover {
          color: #4f46e5;
        }
        .footer-divider {
          color: #e2e8f0;
          user-select: none;
          font-size: 12px;
        }
      `}</style>

      {/* Links de Navegação */}
      <div style={s.linksRow}>
        {/* CORRIGIDO: Rota alterada de '/politica-de-privacidade' para '/privacidade' para bater com o App.jsx */}
        <span className="footer-link" onClick={() => navigate('/privacidade')}>
          Política de Privacidade
        </span>
        
        <span className="footer-divider">•</span>
        
        {/* Mantido /termos-de-uso (adicionei a rota correspondente no App.jsx abaixo para não dar erro) */}
        <span className="footer-link" onClick={() => navigate('/termos-de-uso')}>
          Termos de Uso
        </span>
        
        <span className="footer-divider">•</span>
        
        <span className="footer-link" onClick={() => window.location.href = 'mailto:suporte.esteticalchub@gmail.com'}>
          Suporte
        </span>
      </div>

      {/* Linha de Copyright e Assinatura */}
      <div style={s.copyrightRow}>
        <span>© 2026 <strong>Esteti<span style={{color: '#4f46e5'}}>Calc</span>Hub</strong></span>
        <span style={s.bulletSpacer}>•</span>
        <span style={s.tagline}>Sistema de Gestão Profissional</span>
      </div>
    </footer>
  );
};

const s = {
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 20px',
    backgroundColor: '#ffffff', 
    borderTop: '1px solid #ede9fe',
    fontFamily: "'DM Sans', sans-serif",
    width: '100%',
  },
  linksRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  copyrightRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#64748b',
    letterSpacing: '0.2px',
  },
  bulletSpacer: {
    margin: '0 8px',
    color: '#cbd5e1',
  },
  tagline: {
    color: '#94a3b8',
    fontWeight: '400',
  }
};

export default Footer;