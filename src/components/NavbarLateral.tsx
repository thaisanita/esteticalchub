import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import {
  Sparkles,
  Calendar,
  ClipboardList,
  Wallet,
  TrendingUp,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CalendarDays,
  CalendarPlus,
  Users,
  HandCoins,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { textosNavbar, obterIdiomaAtual } from '@/lib/i18n';

interface SubItem {
  rota: string;
  texto: string;
  Icone: LucideIcon;
}

interface MenuItem {
  rota?: string;
  texto: string;
  Icone: LucideIcon;
  subItems?: SubItem[];
}

const NavbarLateral = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [nomeNegocio, setNomeNegocio] = useState('Meu Negócio');
  const [aberto, setAberto] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Mantém o submenu aberto se estiver na tela de Dashboard ou Novo Agendamento
  const [submenuAgendaAberto, setSubmenuAgendaAberto] = useState(
    location.pathname === '/dashboard' || location.pathname === '/novo-agendamento'
  );

  const idioma = obterIdiomaAtual();
  const textos = textosNavbar[idioma] ?? textosNavbar['Português (PT)'];

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('nome_negocio');
    if (nomeSalvo) setNomeNegocio(nomeSalvo);

    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/novo-agendamento') {
      setSubmenuAgendaAberto(true);
    }
  }, [location.pathname]);

  const irPara = (rota: string) => {
    navigate(rota);
    setAberto(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
    } catch (error) {
      console.error('Erro ao sair:', error);
      localStorage.clear();
    }
  };

  const mostrarSidebar = !isMobile || aberto;

  const menuItems: MenuItem[] = [
    {
      texto: textos.agenda,
      Icone: Calendar,
      subItems: [
        { rota: '/dashboard', texto: 'Ver Agenda', Icone: CalendarDays },
        { rota: '/novo-agendamento', texto: 'Novo Agendamento', Icone: CalendarPlus },
      ],
    },
    { rota: '/procedimentos', texto: textos.procedimentos, Icone: ClipboardList },
    { rota: '/porcentagem', texto: textos.porcentagem, Icone: Wallet },
    { rota: '/relatorios', texto: textos.relatorios, Icone: TrendingUp },
    { rota: '/custos', texto: textos.custos, Icone: Receipt },
    { rota: '/clientes', texto: textos.clientes, Icone: Users },
    { rota: '/pagamentos', texto: textos.pagamentos, Icone: HandCoins },
  ];

  const itemClasses = (isAtivo: boolean) =>
    cn(
      'relative flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 select-none cursor-pointer',
      isAtivo
        ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-sm'
        : 'text-muted-foreground hover:bg-card hover:text-foreground'
    );

  return (
    <>
      {/* Botão Hambúrguer Mobile */}
      {isMobile && (
        <Button
          onClick={() => setAberto(!aberto)}
          size="icon"
          className="fixed left-4 top-4 z-[1001] h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90"
        >
          {aberto ? <X size={20} /> : <Menu size={20} />}
        </Button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-[1000] flex h-screen w-[260px] flex-col border-r border-border bg-card/95 p-5 backdrop-blur-xl transition-transform duration-300 ease-in-out shadow-2xl shadow-black/10',
          mostrarSidebar ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logótipo e Nome do Negócio (Clicável -> vai para Dashboard) */}
        <div
          onClick={() => irPara('/dashboard')}
          className="group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all duration-200 hover:bg-primary/5"
          title="Ir para a Agenda"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
            <Sparkles size={18} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-xs font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
              {nomeNegocio}
            </span>
            <span className="text-[10px] text-muted-foreground">Estética & Gestão</span>
          </div>
        </div>

        <div className="my-4 h-px w-full bg-border" />

        {/* Links do Menu */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {menuItems.map((item, idx) => {
            const temSubmenu = !!item.subItems;

            if (!temSubmenu && item.rota) {
              const isAtivo = location.pathname === item.rota;
              const Icone = item.Icone;
              return (
                <button
                  key={item.rota}
                  onClick={() => irPara(item.rota!)}
                  className={itemClasses(isAtivo)}
                >
                  <Icone size={18} className={isAtivo ? 'text-primary' : ''} />
                  {item.texto}
                </button>
              );
            }

            const submenuAtivo = item.subItems?.some((sub) => location.pathname === sub.rota);
            const Icone = item.Icone;

            return (
              <div key={`menu-${idx}`} className="space-y-1">
                <button
                  onClick={() => setSubmenuAgendaAberto((prev) => !prev)}
                  className={cn(
                    itemClasses(!!submenuAtivo),
                    'justify-between'
                  )}
                >
                  <span className="flex items-center gap-3.5">
                    <Icone size={18} className={submenuAtivo ? 'text-primary' : ''} />
                    {item.texto}
                  </span>
                  <ChevronDown
                    size={15}
                    className={cn(
                      'text-muted-foreground transition-transform duration-200',
                      submenuAgendaAberto && 'rotate-180'
                    )}
                  />
                </button>

                {/* Submenu Retrátil */}
                <div
                  className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    submenuAgendaAberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 my-1 flex flex-col gap-1 border-l-2 border-border pl-3">
                      {item.subItems!.map((sub) => {
                        const SubIcone = sub.Icone;
                        const subAtivo = location.pathname === sub.rota;
                        return (
                          <button
                            key={sub.rota}
                            onClick={() => irPara(sub.rota)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer',
                              subAtivo
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            )}
                          >
                            <SubIcone size={14} className={subAtivo ? 'text-primary' : ''} />
                            {sub.texto}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="my-3 h-px w-full bg-border" />

        {/* Rodapé: Configurações e Sair */}
        <div className="space-y-1">
          <button
            onClick={() => irPara('/config')}
            className={itemClasses(location.pathname === '/config' || location.pathname === '/configuracoes')}
          >
            <Settings size={18} />
            {textos.configuracoes}
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 cursor-pointer"
          >
            <LogOut size={18} />
            {textos.sair}
          </button>
        </div>
      </aside>

      {/* Overlay Escuro para Mobile */}
      {isMobile && aberto && (
        <div
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity"
        />
      )}
    </>
  );
};

export default NavbarLateral;