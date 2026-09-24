// Cálculos da página "Visão geral" (funções puras, testáveis).
export interface Atendimento {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string | null;
  valor: number;
  cliente_id: string | null;
  cliente: string;
  procedimento: string;
}

export interface Dados {
  atendimentos: Atendimento[];
  custosFixosMensais: number;
  clientesNovasMes: number;
  clientesNovasMesAnterior: number;
  leads7d: number;
  metaAtendimentos: number;
}

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DIAS_CLIENTE_EM_RISCO = 90;

export const pad = (n: number) => String(n).padStart(2, '0');
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function calcularVisao(dados: Dados, agoraData: Date = new Date()) {
    const hoje = agoraData;
    const hojeISO = isoLocal(hoje);
    const ano = hoje.getFullYear();
    const mes0 = hoje.getMonth();
    const diaHoje = hoje.getDate();
    const diasNoMes = new Date(ano, mes0 + 1, 0).getDate();
    const chaveMes = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const chaveAtual = chaveMes(new Date(ano, mes0, 1));
    const chaveAnterior = chaveMes(new Date(ano, mes0 - 1, 1));

    // Série dos últimos 12 meses (realizado + ainda agendado)
    const serie = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(ano, mes0 - 11 + i, 1);
      return { chave: chaveMes(d), mes: MESES_CURTOS[d.getMonth()], realizado: 0, agendado: 0 };
    });
    const idxSerie = new Map(serie.map((s, i) => [s.chave, i]));

    let fatAteHoje = 0, nAteHoje = 0, fatAgendado = 0, nAgendado = 0;
    let fatAntMesmoPeriodo = 0, nAntMesmoPeriodo = 0;
    let fatHoje = 0, nHoje = 0;
    let proximo: Atendimento | null = null;
    const agora = hoje.toTimeString().slice(0, 5);

    const acumAtual = new Array(diasNoMes + 1).fill(0);
    const diasMesAnterior = new Date(ano, mes0, 0).getDate();
    const acumAnterior = new Array(diasMesAnterior + 1).fill(0);
    const porProcedimento = new Map<string, number>();
    const ultimaVisita = new Map<string, { data: string; nome: string }>();

    for (const a of dados.atendimentos) {
      const chave = a.data.slice(0, 7);
      const dia = parseInt(a.data.slice(8, 10), 10);
      const passado = a.data <= hojeISO;

      const i = idxSerie.get(chave);
      if (i !== undefined) {
        if (passado) serie[i].realizado += a.valor;
        else serie[i].agendado += a.valor;
      }

      if (chave === chaveAtual) {
        if (passado) {
          fatAteHoje += a.valor;
          nAteHoje += 1;
          acumAtual[dia] += a.valor;
        } else {
          fatAgendado += a.valor;
          nAgendado += 1;
        }
        porProcedimento.set(a.procedimento, (porProcedimento.get(a.procedimento) ?? 0) + a.valor);
      } else if (chave === chaveAnterior) {
        acumAnterior[dia] += a.valor;
        if (dia <= diaHoje) {
          fatAntMesmoPeriodo += a.valor;
          nAntMesmoPeriodo += 1;
        }
      }

      if (a.data === hojeISO) {
        fatHoje += a.valor;
        nHoje += 1;
      }
      if (
        (a.data > hojeISO || (a.data === hojeISO && (a.hora ?? '') > agora)) &&
        (!proximo || a.data + (a.hora ?? '') < proximo.data + (proximo.hora ?? ''))
      ) {
        proximo = a;
      }

      if (passado && a.cliente_id) {
        const atual = ultimaVisita.get(a.cliente_id);
        if (!atual || a.data > atual.data) ultimaVisita.set(a.cliente_id, { data: a.data, nome: a.cliente });
      }
    }

    // Acumulados por dia do mês (linha "ao vivo" vs mês passado)
    const ritmo = Array.from({ length: Math.max(diasNoMes, diasMesAnterior) }, (_, i) => {
      const dia = i + 1;
      let somaAtual = 0;
      let somaAnterior = 0;
      for (let d = 1; d <= dia; d++) {
        somaAtual += acumAtual[d] ?? 0;
        somaAnterior += acumAnterior[d] ?? 0;
      }
      return {
        dia,
        atual: dia <= diaHoje ? somaAtual : null,
        anterior: dia <= diasMesAnterior ? somaAnterior : null,
      };
    });

    // Clientes que não voltam há mais de 90 dias
    const limite = isoLocal(new Date(hoje.getTime() - DIAS_CLIENTE_EM_RISCO * 24 * 60 * 60 * 1000));
    const emRisco = [...ultimaVisita.entries()]
      .filter(([, v]) => v.data < limite)
      .map(([id, v]) => ({
        id,
        nome: v.nome,
        data: v.data,
        dias: Math.floor((hoje.getTime() - new Date(v.data + 'T00:00:00').getTime()) / 86400000),
      }))
      .sort((a, b) => a.dias - b.dias);

    const topProcedimentos = [...porProcedimento.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, valor]) => ({ nome, valor }));

    const fatMesTotal = fatAteHoje + fatAgendado;
    const ticket = nAteHoje ? fatAteHoje / nAteHoje : 0;
    const ticketAnt = nAntMesmoPeriodo ? fatAntMesmoPeriodo / nAntMesmoPeriodo : 0;

    return {
      diaHoje,
      fatAteHoje, nAteHoje, fatAgendado, nAgendado, fatMesTotal,
      fatAntMesmoPeriodo, nAntMesmoPeriodo,
      ticket, ticketAnt,
      fatHoje, nHoje, proximo,
      serie, ritmo, emRisco, topProcedimentos,
      totalGeral: dados.atendimentos.length,
    };
}

export type Visao = ReturnType<typeof calcularVisao>;
