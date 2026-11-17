import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AgendamentoFinanceiro, CustoFixo, Despesa } from '@/lib/lucro';

export interface DadosFinanceiros {
  agendamentos: AgendamentoFinanceiro[];
  custosFixos: CustoFixo[];
  despesas: Despesa[];
}

const VAZIO: DadosFinanceiros = { agendamentos: [], custosFixos: [], despesas: [] };

/** Agendamentos da utilizadora desde uma data, em páginas de 1000. */
export async function buscarAgendamentosFinanceiros(usuarioId: string, desde: string): Promise<AgendamentoFinanceiro[]> {
  const todos: AgendamentoFinanceiro[] = [];
  const TAMANHO = 1000;
  for (let inicio = 0; inicio < 20000; inicio += TAMANHO) {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('id, data, valor, preco, faltou, pago, custo_produtos')
      .eq('usuario_id', usuarioId)
      .gte('data', desde)
      .order('data', { ascending: true })
      .range(inicio, inicio + TAMANHO - 1);
    if (error || !data) break;
    todos.push(...data);
    if (data.length < TAMANHO) break;
  }
  return todos;
}

/**
 * Tudo o que a fórmula do lucro precisa: agendamentos (desde 1 de janeiro do
 * ano anterior), custos fixos e despesas da utilizadora.
 */
export function useDadosFinanceiros() {
  const [dados, setDados] = useState<DadosFinanceiros>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }
    const desde = `${new Date().getFullYear() - 1}-01-01`;
    const [agendamentos, fixos, despesas] = await Promise.all([
      buscarAgendamentosFinanceiros(user.id, desde),
      supabase.from('custos_fixos').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }),
      supabase.from('se_custos').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (fixos.error || despesas.error) {
      setErro((fixos.error || despesas.error)?.message ?? 'Erro ao carregar os custos.');
    } else {
      setErro(null);
    }
    setDados({
      agendamentos,
      custosFixos: (fixos.data as CustoFixo[]) ?? [],
      despesas: (despesas.data as Despesa[]) ?? [],
    });
    setCarregando(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, carregando, erro, recarregar, setDados };
}
