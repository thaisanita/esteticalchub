import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, LogOut, Settings, AlertTriangle, CalendarClock, UserX } from 'lucide-react';
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

interface Notificacao {
  id: string;
  icone: typeof AlertTriangle;
  texto: string;
  rota: string;
}

const TopBar = () => {
  const navigate = useNavigate();
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [cargo, setCargo] = useState('Profissional');
  const [searchTerm, setSearchTerm] = useState('');
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const carregarNotificacoes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hojeStr = new Date().toISOString().split('T')[0];
    const lista: Notificacao[] = [];

    // 1. Agendamentos que já passaram e ainda não foram marcados como pagos
    const { data: naoPagos } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('pago', false)
      .lt('data', hojeStr);

    if (naoPagos && naoPagos.length > 0) {
      lista.push({
        id: 'nao-pagos',
        icone: AlertTriangle,
        texto: `${naoPagos.length} atendimento${naoPagos.length > 1 ? 's' : ''} sem pagamento registado`,
        rota: '/pagamentos',
      });
    }

    // 2. Clientes com retorno previsto nos próximos 7 dias
    const em7Dias = new Date();
    em7Dias.setDate(em7Dias.getDate() + 7);
    const em7DiasStr = em7Dias.toISOString().split('T')[0];

    const { data: retornos } = await supabase
      .from('clientes')
      .select('id')
      .eq('usuario_id', user.id)
      .not('retorno_previsto', 'is', null)
      .gte('retorno_previsto', hojeStr)
      .lte('retorno_previsto', em7DiasStr);

    if (retornos && retornos.length > 0) {
      lista.push({
        id: 'retornos',
        icone: CalendarClock,
        texto: `${retornos.length} cliente${retornos.length > 1 ? 's' : ''} com retorno previsto esta semana`,
        rota: '/clientes',
      });
    }

    // 3. Clientes inativas há mais de 6 meses (com pelo menos uma visita registada)
    const seiseMesesAtras = new Date();
    seiseMesesAtras.setMonth(seiseMesesAtras.getMonth() - 6);
    const { data: agendamentosAntigos } = await supabase
      .from('agendamentos')
      .select('cliente_id, data')
      .eq('usuario_id', user.id)
      .not('cliente_id', 'is', null);

    if (agendamentosAntigos) {
      const ultimaPorCliente: Record<string, string> = {};
      agendamentosAntigos.forEach((a) => {
        if (!a.cliente_id) return;
        if (!ultimaPorCliente[a.cliente_id] || a.data > ultimaPorCliente[a.cliente_id]) {
          ultimaPorCliente[a.cliente_id] = a.data;
        }
      });
      const inativas = Object.values(ultimaPorCliente).filter(
        (d) => d < seiseMesesAtras.toISOString().split('T')[0]
      );
      if (inativas.length > 0) {
        lista.push({
          id: 'inativas',
          icone: UserX,
          texto: `${inativas.length} cliente${inativas.length > 1 ? 's' : ''} inativa${inativas.length > 1 ? 's' : ''} há mais de 6 meses`,
          rota: '/clientes',
        });
      }
    }

    setNotificacoes(lista);
  }, []);

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
    carregarNotificacoes();
  }, [carregarNotificacoes]);

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
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              type="button"
              className="relative flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              title="Notificações"
            >
              <Bell size={17} />
              {notificacoes.length > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {notificacoes.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                Sem novidades por agora.
              </div>
            ) : (
              notificacoes.map((n, i) => {
                const Icone = n.icone;
                return (
                  <div key={n.id}>
                    <DropdownMenuItem onClick={() => navigate(n.rota)} className="cursor-pointer items-start gap-2.5 py-2.5">
                      <Icone size={15} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-xs leading-snug">{n.texto}</span>
                    </DropdownMenuItem>
                    {i < notificacoes.length - 1 && <DropdownMenuSeparator />}
                  </div>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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