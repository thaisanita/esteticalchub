import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';

export type Plano = 'free' | 'pro';

export interface EstadoLimite {
  total: number;
  limite: number | null; // null = sem limite (plano Pro)
  restantes: number | null;
  /** true a partir de 80% do limite (só no plano grátis) */
  showWarning: boolean;
  /** true ao atingir 100% do limite (só no plano grátis) */
  isBlocked: boolean;
}

export const LIMITE_CLIENTES_FREE = 30;
export const LIMITE_AGENDAMENTOS_MES_FREE = 50;
const LIMIAR_AVISO = 0.8;

function calcularEstado(total: number, limite: number | null): EstadoLimite {
  if (limite === null) {
    return { total, limite: null, restantes: null, showWarning: false, isBlocked: false };
  }
  return {
    total,
    limite,
    restantes: Math.max(limite - total, 0),
    showWarning: total >= limite * LIMIAR_AVISO && total < limite,
    isBlocked: total >= limite,
  };
}

/**
 * Plano atual da profissional logada + contadores em tempo real de
 * clientes e agendamentos do mês, com os limites do plano grátis já
 * calculados (aviso a 80%, bloqueio a 100%).
 */
export function usePlan() {
  const [plano, setPlano] = useState<Plano>('free');
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalAgendamentosMes, setTotalAgendamentosMes] = useState(0);
  const [loading, setLoading] = useState(true);

  // Nome de canal único por instância do hook: o usePlan() é chamado em
  // vários sítios ao mesmo tempo (botão do Assistente, Clientes, Agenda,
  // Planos). O cliente do Supabase devolve o MESMO canal quando dois sítios
  // pedem o mesmo nome — o segundo .on() chegava a um canal que o primeiro
  // já tinha subscrito, daí o erro "cannot add postgres_changes callbacks
  // ... after subscribe()". Um nome aleatório por montagem evita a colisão.
  const nomeCanalRef = useRef(`use-plan-${Math.random().toString(36).slice(2)}`);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const fimMes = new Date(inicioMes);
    fimMes.setMonth(fimMes.getMonth() + 1);
    const inicioStr = inicioMes.toISOString().slice(0, 10);
    const fimStr = fimMes.toISOString().slice(0, 10);

    const [perfilResp, clientesResp, agendamentosResp] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('usuario_id', user.id),
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .gte('data', inicioStr)
        .lt('data', fimStr),
    ]);

    // Sem linha em profiles = conta nunca assinou nada = plano grátis.
    setPlano((perfilResp.data?.plan as Plano) ?? 'free');
    setTotalClientes(clientesResp.count ?? 0);
    setTotalAgendamentosMes(agendamentosResp.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();

    // Tempo real: atualiza os contadores sem recarregar a página. Precisa
    // das tabelas clientes/agendamentos/profiles na publicação supabase_realtime
    // (ver o SQL que já foi dado para a "Visão geral" — é a mesma necessidade).
    const canal = supabase
      .channel(nomeCanalRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, carregar)
      .subscribe();

    // Rede de segurança: se o realtime não estiver ativo para estas tabelas,
    // ainda assim atualiza a cada minuto.
    const intervalo = setInterval(carregar, 60_000);

    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
    };
  }, [carregar]);

  const isPro = plano === 'pro';

  const clientes = useMemo(
    () => calcularEstado(totalClientes, isPro ? null : LIMITE_CLIENTES_FREE),
    [totalClientes, isPro]
  );
  const agendamentosMes = useMemo(
    () => calcularEstado(totalAgendamentosMes, isPro ? null : LIMITE_AGENDAMENTOS_MES_FREE),
    [totalAgendamentosMes, isPro]
  );

  return { plano, isPro, loading, clientes, agendamentosMes, recarregar: carregar };
}
