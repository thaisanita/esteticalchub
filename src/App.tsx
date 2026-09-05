import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Imports das páginas reais dentro da pasta src/pages
import LandingPage from './pages/Landingpage';
import Login from './pages/Login';
import Agenda from './pages/Agenda';
import NovoAgendamento from './pages/NovoAgendamento';
import Procedimentos from './pages/Procedimentos';
import Porcentagem from './pages/Porcentagem';
import Relatorios from './pages/Relatorios';
import Custos from './pages/Custos';
import Clientes from './pages/Clientes';
import Pagamentos from './pages/Pagamentos';
import Config from './pages/Config';
import AuthCallback from './pages/AuthCallback';
import ConfirmacaoAtendimento from './pages/ConfirmacaoAtendimento';

// Menu lateral das áreas privadas
import NavbarLateral from './components/NavbarLateral';

function RotaLogin({
  autenticado,
  onLogin
}: {
  autenticado: boolean;
  onLogin: () => void
}) {
  const [searchParams] = useSearchParams();
  const modo = searchParams.get('modo');

  if (autenticado && modo !== 'registro') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Login onLogin={onLogin} />;
}

// Layout que envolve todas as páginas privadas com o menu lateral
function LayoutPrivado() {
  return (
    <div className="flex min-h-screen bg-background">
      <NavbarLateral />
      <main className="flex-1 p-6 sm:p-8 md:ml-[260px]">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAutenticado(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAutenticado(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (autenticado === null) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page na Rota Raiz — redireciona pro dashboard se já estiver logado */}
        <Route
          path="/"
          element={autenticado ? <Navigate to="/dashboard" replace /> : <LandingPage />}
        />

        {/* Rota de Login / Registro */}
        <Route
          path="/login"
          element={
            <RotaLogin
              autenticado={autenticado}
              onLogin={() => setAutenticado(true)}
            />
          }
        />

        {/* Rotas Públicas */}
        <Route path="/confirmacao/:token" element={<ConfirmacaoAtendimento />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Áreas Privadas do App — todas dentro do LayoutPrivado (menu lateral) */}
        <Route
          element={autenticado ? <LayoutPrivado /> : <Navigate to="/login" replace />}
        >
          {/* Dashboard e Agenda */}
          <Route path="/dashboard" element={<Agenda />} />
          <Route path="/novo-agendamento" element={<NovoAgendamento setAgendamentos={() => {}} />} />

          {/* Páginas do Menu */}
          <Route path="/procedimentos" element={<Procedimentos />} />
          <Route path="/porcentagem" element={<Porcentagem />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/custos" element={<Custos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/configuracoes" element={<Config />} />
          <Route path="/config" element={<Navigate to="/configuracoes" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}