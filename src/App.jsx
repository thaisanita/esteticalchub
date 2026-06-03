import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase'; 

import Agenda from './pages/Agenda';
import NovoAgendamento from './pages/NovoAgendamento';
import Procedimentos from './pages/Procedimentos';
import Relatorios from './pages/Relatorios';
import Porcentagem from './pages/Porcentagem'; 
import Config from './pages/Config'; 
import Login from './pages/Login'; 
import Privacidade from './pages/Privacidade';
import ResetPassword from './pages/ResetPassword'; 
import NavbarLateral from './components/NavbarLateral';
import Footer from './pages/Footer';

export default function App() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [logado, setLogado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const dadosSalvos = JSON.parse(localStorage.getItem('agendamentos_locais') || '[]');
    setAgendamentos(dadosSalvos);

    const verificarSessao = async () => {
      const timeout = setTimeout(() => {
        setCarregando(false);
      }, 3000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setLogado(!!session);
      } catch (err) {
        console.error("Erro na sessão:", err);
        setLogado(false);
      } finally {
        clearTimeout(timeout);
        setCarregando(false);
      }
    };

    verificarSessao();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLogado(false);
        setCarregando(false);
        return;
      }
      setLogado(!!session);
      setCarregando(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const atualizarAgendamentos = (novosDados) => {
    setAgendamentos(novosDados);
    localStorage.setItem('agendamentos_locais', JSON.stringify(novosDados));
  };

  const handleLogin = (status) => {
    setLogado(status);
  };

  return (
    <BrowserRouter>
      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b' }}>
          Carregando...
        </div>
      ) : (
        <Routes>
          {/* ROTAS PÚBLICAS — acessíveis sem login */}
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos-de-uso" element={<Privacidade />} /> {/* ← ADICIONADO AQUI PARA NÃO DAR ERRO NO BUILD */}
          <Route path="/reset-password" element={<ResetPassword />} /> 

          {/* LÓGICA DE LOGIN / APP */}
          <Route 
            path="*" 
            element={
              !logado ? (
                <Login onLogin={handleLogin} />
              ) : (
                <div className="site-wrapper" style={{ display: 'flex' }}>
                  <NavbarLateral />
                  <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                    <div style={{ flex: 1 }}>
                      <Routes>
                        <Route path="/" element={<Agenda agendamentos={agendamentos} setAgendamentos={atualizarAgendamentos} />} />
                        <Route path="/novo-agendamento" element={<NovoAgendamento setAgendamentos={atualizarAgendamentos} />} />
                        <Route path="/relatorios" element={<Relatorios agendamentos={agendamentos} />} />
                        <Route path="/procedimentos" element={<Procedimentos />} />
                        <Route path="/porcentagem" element={<Porcentagem />} />
                        <Route path="/configuracoes" element={<Config />} />
                        <Route path="*" element={<Agenda agendamentos={agendamentos} setAgendamentos={atualizarAgendamentos} />} />
                      </Routes>
                    </div>
                    
                    <Footer /> 
                  </main>
                </div>
              )
            } 
          />
        </Routes>
      )}
    </BrowserRouter>
  );
}