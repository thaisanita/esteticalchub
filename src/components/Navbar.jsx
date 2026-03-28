import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Função que verifica se a página está aberta para pintar de azul
  const ativo = (rota) => location.pathname === rota;

  return (
    <div className="nav-inferior">
      <button className={`nav-item ${ativo('/') ? 'active' : ''}`} onClick={() => navigate('/')}>
        <span>📅</span>
        <label>Agenda</label>
      </button>

      <button className={`nav-item ${ativo('/procedimentos') ? 'active' : ''}`} onClick={() => navigate('/procedimentos')}>
        <span>📋</span>
        <label>Atendimentos</label>
      </button>

      <button className={`nav-item ${ativo('/relatorios') ? 'active' : ''}`} onClick={() => navigate('/relatorios')}>
        <span>💰</span>
        <label>Ganhos</label>
      </button>
    </div>
  );
};

export default Navbar;