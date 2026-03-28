import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Páginas
import Agenda from '../pages/Agenda';
import Procedimentos from '../pages/Procedimentos';
import Relatorios from '../pages/Relatorios';
import NovoAgendamento from '../pages/NovoAgendamento';
import Porcentagem from '../pages/Porcentagem'; // Adicionada a nova tela

// Componentes Globais
import NavbarLateral from '../components/NavbarLateral';

const AppRoutes = () => {
  // Simulação de autenticação (Pode ser melhorado com Supabase Auth depois)
  // const isAuth = localStorage.getItem('user_authenticated') === 'true'; // Removed unused variable

  return (
    <Router>
      <div className="app-layout" style={styles.appLayout}>
        
        {/* Menu Lateral - Agora ele controla sua própria visibilidade */}
        <NavbarLateral />

        {/* Área Principal do Conteúdo */}
        <main style={styles.mainContent}>
          <div className="container-agenda">
            <div className="card-branco">
              <Routes>
                {/* Redirecionamento Inicial */}
                <Route path="/" element={<Navigate to="/agenda" />} />
                
                {/* Rotas Principais */}
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/procedimentos" element={<Procedimentos />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/porcentagem" element={<Porcentagem />} />
                <Route path="/novo-agendamento" element={<NovoAgendamento />} />

                {/* Rota de "Não Encontrado" */}
                <Route path="*" element={<Navigate to="/agenda" />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
};

const styles = {
  appLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f0f2f5', // Cor de fundo suave
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    // No Desktop, dá espaço para a Sidebar. No Mobile (via CSS externo), seria 0.
    marginLeft: 'var(--sidebar-width, 260px)', 
    transition: 'margin 0.3s ease',
  }
};

export default AppRoutes;