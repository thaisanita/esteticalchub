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
  ChevronDown,
  CalendarDays,
  CalendarPlus,
  Users,
  HandCoins,
  type LucideIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  const [maisAberto, setMaisAberto] = useState(false);
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
      {/* Sidebar — computador */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 z-[1000] flex h-screen w-[260px] flex-col border-r border-border bg-card/95 p-5 backdrop-blur-xl shadow-2xl shadow-black/10">
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
      )}

      {/* Barra inferior — telemóvel */}
      {isMobile && (
        <>
          <nav className="fixed bottom-0 left-0 right-0 z-[1000] flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur-xl shadow-2xl shadow-black/20">
            <button
              onClick={() => irPara('/dashboard')}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium',
                location.pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <CalendarDays size={20} />
              Agenda
            </button>
            <button
              onClick={() => irPara('/clientes')}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium',
                location.pathname === '/clientes' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Users size={20} />
              {textos.clientes}
            </button>

            {/* Botão central em destaque: Novo Agendamento */}
            <button
              onClick={() => irPara('/novo-agendamento')}
              className="flex flex-col items-center gap-0.5 px-2"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-lg shadow-primary/40 -mt-5">
                <CalendarPlus size={20} />
              </span>
            </button>

            <button
              onClick={() => irPara('/custos')}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium',
                location.pathname === '/custos' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Receipt size={20} />
              {textos.custos}
            </button>
            <button
              onClick={() => setMaisAberto(true)}
              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-muted-foreground"
            >
              <Menu size={20} />
              Mais
            </button>
          </nav>

          {/* Painel "Mais" — resto do menu */}
          <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
            <SheetContent side="bottom" className="rounded-t-2xl p-5">
              <SheetHeader>
                <SheetTitle>Mais opções</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 pb-4 pt-2">
                {[
                  { rota: '/procedimentos', texto: textos.procedimentos, Icone: ClipboardList },
                  { rota: '/porcentagem', texto: textos.porcentagem, Icone: Wallet },
                  { rota: '/relatorios', texto: textos.relatorios, Icone: TrendingUp },
                  { rota: '/pagamentos', texto: textos.pagamentos, Icone: HandCoins },
                  { rota: '/configuracoes', texto: textos.configuracoes, Icone: Settings },
                ].map(({ rota, texto, Icone }) => (
                  <button
                    key={rota}
                    onClick={() => {
                      irPara(rota);
                      setMaisAberto(false);
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Icone size={20} />
                    {texto}
                  </button>
                ))}
                <button
                  onClick={() => {
                    handleLogout();
                    setMaisAberto(false);
                    navigate('/login');
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-danger/20 p-3 text-center text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut size={20} />
                  {textos.sair}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
};

export default NavbarLateral;