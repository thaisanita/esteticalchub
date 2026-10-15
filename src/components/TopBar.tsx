import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Bell, LogOut, Settings, AlertTriangle, CalendarClock, UserX, User, CalendarDays, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatarHora } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ResultadoCliente {
  id: string;
  nome: string;
  telefone: string | null;
}

interface ResultadoAgendamento {
  id: string | number;
  cliente: string | null;
  procedimento: string | null;
  data: string;
  hora: string | null;
}

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
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [clientesEncontrados, setClientesEncontrados] = useState<ResultadoCliente[]>([]);
  const [agendamentosEncontrados, setAgendamentosEncontrados] = useState<ResultadoAgendamento[]>([]);
  const buscaRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Busca global com debounce: clientes (nome) e agendamentos (cliente/procedimento).
  useEffect(() => {
    const termo = searchTerm.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (termo.length < 2) {
      setClientesEncontrados([]);
      setAgendamentosEncontrados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const [resClientes, resAgendamentos] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nome, telefone')
          .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
          .limit(5),
        supabase
          .from('agendamentos')
          .select('id, cliente, procedimento, data, hora')
          .or(`cliente.ilike.%${termo}%,procedimento.ilike.%${termo}%`)
          .order('data', { ascending: false })
          .limit(5),
      ]);
      setClientesEncontrados(resClientes.data || []);
      setAgendamentosEncontrados(resAgendamentos.data || []);
      setBuscando(false);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaAberta(false);
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const irParaCliente = (cliente: ResultadoCliente) => {
    setBuscaAberta(false);
    setSearchTerm('');
    navigate(`/prontuario/${cliente.id}`);
  };

  const irParaAgendamento = (ag: ResultadoAgendamento) => {
    setBuscaAberta(false);
    setSearchTerm('');
    navigate(`/procedimentos?date=${ag.data.slice(0, 10)}`);
  };

  const temResultados = clientesEncontrados.length > 0 || agendamentosEncontrados.length > 0;

  const iniciais = nomeUsuario
    ? nomeUsuario.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/login'); // Garante o redirecionamento após deslogar
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (clientesEncontrados[0]) irParaCliente(clientesEncontrados[0]);
      else if (agendamentosEncontrados[0]) irParaAgendamento(agendamentosEncontrados[0]);
    } else if (e.key === 'Escape') {
      setBuscaAberta(false);
    }
  };

  return (
    <div className="no-print flex w-full items-center justify-between gap-4 border-b border-border px-10 py-[18px]">
      {/* Campo de Busca */}
      <div ref={buscaRef} className="relative w-full max-w-[320px]">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5">
          {buscando ? (
            <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search size={15} className="shrink-0 text-muted-foreground" />
          )}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setBuscaAberta(true)}
            onKeyDown={handleSearchSubmit}
            placeholder="Buscar clientes, agendamentos..."
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {buscaAberta && searchTerm.trim().length >= 2 && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-[1000] w-full min-w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
            {!temResultados && !buscando ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                Sem resultados para "{searchTerm.trim()}".
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto py-1.5">
                {clientesEncontrados.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Clientes
                    </p>
                    {clientesEncontrados.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => irParaCliente(c)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-primary/5"
                      >
                        <User size={14} className="shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-foreground">{c.nome}</span>
                        {c.telefone && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{c.telefone}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {agendamentosEncontrados.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Agendamentos
                    </p>
                    {agendamentosEncontrados.map((ag) => (
                      <button
                        key={ag.id}
                        onClick={() => irParaAgendamento(ag)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-primary/5"
                      >
                        <CalendarDays size={14} className="shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {ag.cliente || 'Cliente'} — {ag.procedimento || 'Atendimento'}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {ag.data.split('-').reverse().join('/')}
                          {ag.hora ? ` ${formatarHora(ag.hora)}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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