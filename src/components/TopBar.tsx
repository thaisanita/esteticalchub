import { useState, useEffect } from 'react';
import { Search, Bell, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const TopBar = () => {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [cargo, setCargo] = useState('Profissional');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const nome =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuário';
        setNomeUsuario(nome.charAt(0).toUpperCase() + nome.slice(1));

        if (user.user_metadata?.cargo) {
          setCargo(user.user_metadata.cargo);
        }
      }
    };
    carregarUsuario();
  }, []);

  const iniciais = nomeUsuario
    ? nomeUsuario.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/login'); // Garante o redirecionamento após deslogar
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      // Redireciona para a agenda ou página de busca passando a palavra-chave
      navigate(`/agenda?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <div className="flex w-full items-center justify-between gap-4 border-b border-border px-10 py-[18px]">
      {/* Campo de Busca */}
      <div className="flex w-full max-w-[320px] items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchSubmit}
          placeholder="Buscar clientes, agendamentos..."
          className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {/* Ícone de Notificações */}
        <Tooltip>
          <TooltipTrigger>
            <button
              type="button"
              className="relative flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Bell size={17} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Notificações</TooltipContent>
        </Tooltip>

        {/* Dropdown do Perfil */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              type="button"
              className="flex items-center gap-2.5 whitespace-nowrap border-l border-border pl-4 outline-none"
            >
              <Avatar className="h-[34px] w-[34px] shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-hover text-[13px] font-bold text-primary-foreground">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="text-left leading-tight">
                <div className="text-[13px] font-semibold text-foreground">
                  {nomeUsuario || 'Carregando...'}
                </div>
                <div className="text-[11px] text-muted-foreground">{cargo}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="cursor-pointer">
              <Settings size={15} className="mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-rose-500 focus:text-rose-500"
            >
              <LogOut size={15} className="mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default TopBar;