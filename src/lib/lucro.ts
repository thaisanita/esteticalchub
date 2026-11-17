// Contas do dinheiro do negócio — UMA só fórmula para todas as páginas.
//
//   Lucro = Realizado − custos fixos (equivalente mensal) − material gasto − despesas pontuais
//
// Palavras (iguais em toda a app):
//   Previsto  = tudo o que está marcado no mês (sem faltas)
//   Realizado = o que já aconteceu (data até hoje, sem faltas)
//   Recebido  = o que está marcado como pago (sem faltas)
//
// Funções puras (sem Supabase), para se poderem testar.
import { formatarData, formatarEuro, parseMoeda, plural } from './utils';

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local em YYYY-MM-DD (sem passar por UTC). */
export const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Mês em YYYY-MM. */
export const chaveMes = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "2026-11" → "Novembro de 2026". */
export function nomeMes(chave: string): string {
  const [a, m] = chave.split('-').map(Number);
  return `${NOMES_MESES[(m || 1) - 1]} de ${a}`;
}

/** "2026-11-05" → "05/11/2026" (o mesmo formato em toda a app). */
export const dataCurta = (iso: string | null | undefined) => formatarData(iso ? iso.slice(0, 10) : iso);

/** Dias entre hoje e a data (negativo = já passou). */
export function diasAte(iso: string, hoje: Date = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

/** "150,00 €" / "−240,00 €" (o mesmo formato em toda a app). */
export const euro = formatarEuro;

// ---------------------------------------------------------------------------
// Custos fixos
// ---------------------------------------------------------------------------

export type Frequencia = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export const FREQUENCIAS: { value: Frequencia; label: string; meses: number; porExtenso: string }[] = [
  { value: 'mensal', label: 'Mensal', meses: 1, porExtenso: 'por mês' },
  { value: 'trimestral', label: 'Trimestral', meses: 3, porExtenso: 'por trimestre' },
  { value: 'semestral', label: 'Semestral', meses: 6, porExtenso: 'por semestre' },
  { value: 'anual', label: 'Anual', meses: 12, porExtenso: 'por ano' },
];

export function mesesDaFrequencia(f: string | null | undefined): number {
  return FREQUENCIAS.find((x) => x.value === f)?.meses ?? 1;
}

export interface CustoFixo {
  id: string;
  nome: string;
  categoria: string;
  /** Equivalente mensal (o que sempre existiu). */
  valor_mensal: number | string;
  ativo: boolean;
  frequencia?: string | null;
  /** Valor de cada pagamento. Vazio nos custos antigos → usa valor_mensal. */
  valor_pagamento?: number | string | null;
  proximo_pagamento?: string | null;
  /** Quando foi registado. Sem `comeca_em`, o custo conta a partir desse mês. */
  created_at?: string | null;
  /** Conta a partir do mês desta data (opcional). */
  comeca_em?: string | null;
  /** Último mês em que conta (opcional). Gravado ao desativar. */
  termina_em?: string | null;
}

/** Mês (YYYY-MM) a partir do qual o custo conta: "começa em", senão o mês em que foi registado. */
export function mesDeInicio(c: Pick<CustoFixo, 'created_at' | 'comeca_em'>): string | null {
  if (c.comeca_em) return c.comeca_em.slice(0, 7);
  if (!c.created_at) return null;
  const d = new Date(c.created_at);
  return Number.isNaN(d.getTime()) ? null : chaveMes(d);
}

/** Último mês (YYYY-MM) em que o custo conta, ou null se continua. */
export const mesDeFim = (c: Pick<CustoFixo, 'termina_em'>): string | null => (c.termina_em ? c.termina_em.slice(0, 7) : null);

/**
 * O custo conta neste mês?
 *  - entre o mês de início e o de fim (inclusive);
 *  - desativado COM "termina em": continua a contar nos meses até ao fim
 *    (os meses passados não mudam);
 *  - desativado SEM "termina em" (desativado antes de existir esta coluna):
 *    não conta em nenhum mês, como antes.
 */
export function custoContaNoMes(c: Pick<CustoFixo, 'ativo' | 'created_at' | 'comeca_em' | 'termina_em'>, mes: string): boolean {
  const fim = mesDeFim(c);
  if (!c.ativo && !fim) return false;
  const inicio = mesDeInicio(c);
  if (inicio && mes < inicio) return false;
  if (fim && mes > fim) return false;
  return true;
}

/** Ex.: 240 € anual → 20 €/mês. Arredondado ao cêntimo. */
export function equivalenteMensal(valorPagamento: number, frequencia: string | null | undefined): number {
  return Math.round((valorPagamento / mesesDaFrequencia(frequencia)) * 100) / 100;
}

/** Quanto se paga de cada vez. */
export function valorPorPagamento(c: Pick<CustoFixo, 'valor_pagamento' | 'valor_mensal' | 'frequencia'>): number {
  if (c.valor_pagamento !== null && c.valor_pagamento !== undefined && c.valor_pagamento !== '') {
    return parseMoeda(c.valor_pagamento);
  }
  return parseMoeda(c.valor_mensal) * mesesDaFrequencia(c.frequencia);
}

/** O custo já acabou (o mês de "termina em" já passou)? */
export function custoJaTerminou(c: Pick<CustoFixo, 'termina_em'>, hoje: Date = new Date()): boolean {
  const fim = mesDeFim(c);
  return !!fim && fim < chaveMes(hoje);
}

/** Quanto pesa por mês. */
export function mensalDoCusto(c: Pick<CustoFixo, 'valor_pagamento' | 'valor_mensal' | 'frequencia'>): number {
  if (c.valor_pagamento !== null && c.valor_pagamento !== undefined && c.valor_pagamento !== '') {
    return equivalenteMensal(parseMoeda(c.valor_pagamento), c.frequencia);
  }
  return parseMoeda(c.valor_mensal);
}

/** Custos fixos de um mês (por omissão, o mês atual): só os ativos e já criados nesse mês. */
export function totalCustosFixosMensais(custos: CustoFixo[], mes: string = chaveMes(new Date())): number {
  return custos.filter((c) => custoContaNoMes(c, mes)).reduce((acc, c) => acc + mensalDoCusto(c), 0);
}

/** Próxima data depois de pagar: soma os meses da frequência (31 jan + 1 mês = 28/29 fev). */
export function proximaData(iso: string, frequencia: string | null | undefined): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const meses = mesesDaFrequencia(frequencia);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return isoDia(alvo);
}

// ---------------------------------------------------------------------------
// Despesas (tabela se_custos): despesas pontuais + compras de material
// ---------------------------------------------------------------------------

export interface Despesa {
  id: string;
  titulo: string;
  categoria: string;
  valor: number | string;
  data_pagamento: string | null;
  data_vencimento: string | null;
  status: string; // 'pago' | 'pendente'
  conta_no_lucro?: boolean | null;
}

export const CATEGORIA_MATERIAL = 'material_estoque';
/** Categoria antiga: custos fixos lançados como despesa antes de existir a aba Custos fixos. */
export const CATEGORIA_FIXO_ANTIGO = 'fixo_recorrente';

export const CATEGORIAS_DESPESA: { value: string; label: string }[] = [
  { value: 'imposto_taxa', label: 'Impostos e taxas' },
  { value: 'formacao', label: 'Cursos e formação' },
  { value: 'equipamento', label: 'Equipamento e manutenção' },
  { value: 'outro', label: 'Outro' },
];

export function rotuloCategoriaDespesa(cat: string): string {
  if (cat === CATEGORIA_MATERIAL) return 'Material';
  if (cat === CATEGORIA_FIXO_ANTIGO) return 'Custo fixo (lançamento antigo)';
  return CATEGORIAS_DESPESA.find((c) => c.value === cat)?.label ?? cat.replace(/_/g, ' ');
}

export const ehMaterial = (d: Pick<Despesa, 'categoria'>) => d.categoria === CATEGORIA_MATERIAL;

/** Data que põe a despesa num mês (a mesma regra de sempre: vencimento, senão pagamento). */
export const dataDaDespesa = (d: Pick<Despesa, 'data_vencimento' | 'data_pagamento'>) =>
  (d.data_vencimento || d.data_pagamento || '').slice(0, 10) || null;

export const contaNoLucro = (d: Pick<Despesa, 'conta_no_lucro'>) => d.conta_no_lucro !== false;

/**
 * Lançamento que parece repetir um custo fixo. Aparece quando, ao mesmo tempo:
 *  1. é da categoria antiga "custo fixo" (fixo_recorrente — já não se cria);
 *  2. ainda conta no lucro (a utilizadora não escolheu "não contar");
 *  3. no mês desse lançamento já há custos fixos a contar (ativos e criados
 *     até esse mês) — só aí é que o mesmo gasto entra duas vezes.
 * A app só avisa; quem decide é a utilizadora.
 */
export function pareceCustoFixoRepetido(d: Despesa, custosFixos: CustoFixo[]): boolean {
  if (d.categoria !== CATEGORIA_FIXO_ANTIGO || !contaNoLucro(d)) return false;
  const data = dataDaDespesa(d);
  const mes = data ? data.slice(0, 7) : chaveMes(new Date());
  return custosFixos.some((c) => custoContaNoMes(c, mes));
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

export interface AgendamentoFinanceiro {
  data?: string | null;
  valor?: number | string | null;
  preco?: number | string | null;
  faltou?: boolean | null;
  pago?: boolean | null;
  custo_produtos?: number | string | null;
}

export const valorDoAgendamento = (a: AgendamentoFinanceiro) => parseMoeda(a.valor ?? a.preco ?? 0);

export interface TotaisAgendamentos {
  previsto: number;
  realizado: number;
  recebido: number;
  nPrevisto: number;
  nRealizado: number;
  nRecebido: number;
  nFaltas: number;
  /** Custo de produtos já lançado nos atendimentos realizados (Fase 3). */
  materialRealizado: number;
  materialPrevisto: number;
}

export function totaisDoMes(agendamentos: AgendamentoFinanceiro[], mes: string, hojeISO: string): TotaisAgendamentos {
  const t: TotaisAgendamentos = {
    previsto: 0, realizado: 0, recebido: 0, nPrevisto: 0, nRealizado: 0, nRecebido: 0, nFaltas: 0,
    materialRealizado: 0, materialPrevisto: 0,
  };
  for (const a of agendamentos) {
    const data = (a.data || '').slice(0, 10);
    if (!data.startsWith(mes)) continue;
    if (a.faltou) {
      t.nFaltas += 1;
      continue;
    }
    const v = valorDoAgendamento(a);
    const custo = parseMoeda(a.custo_produtos ?? 0);
    t.previsto += v;
    t.nPrevisto += 1;
    t.materialPrevisto += custo;
    if (data <= hojeISO) {
      t.realizado += v;
      t.nRealizado += 1;
      t.materialRealizado += custo;
    }
    if (a.pago) {
      t.recebido += v;
      t.nRecebido += 1;
    }
  }
  return t;
}

/** "3 realizados · 5 previstos" (+ " · 1 falta"). As mesmas palavras em toda a app. */
export function textoAtendimentos(t: Pick<TotaisAgendamentos, 'nRealizado' | 'nPrevisto' | 'nFaltas'>): string {
  const partes = [plural(t.nRealizado, 'realizado', 'realizados'), plural(t.nPrevisto, 'previsto', 'previstos')];
  if (t.nFaltas > 0) partes.push(plural(t.nFaltas, 'falta', 'faltas'));
  return partes.join(' · ');
}

// ---------------------------------------------------------------------------
// Lucro do mês
// ---------------------------------------------------------------------------

export interface LucroMes extends TotaisAgendamentos {
  mes: string;
  /** 'passado' | 'atual' | 'futuro' em relação a hoje. */
  quando: 'passado' | 'atual' | 'futuro';
  custosFixos: number;
  /** Compras de material do mês + custo de produtos dos atendimentos. */
  material: number;
  comprasMaterial: number;
  despesasPontuais: number;
  /** Despesas do mês (que contam) ainda por pagar — já incluídas acima. */
  porPagar: number;
  /** Lançamentos do mês que a utilizadora escolheu não contar. */
  naoContam: number;
  lucro: number;
  lucroPrevisto: number;
}

export function calcularLucroMes(
  { agendamentos, custosFixos, despesas }: {
    agendamentos: AgendamentoFinanceiro[];
    custosFixos: CustoFixo[];
    despesas: Despesa[];
  },
  mes: string,
  hoje: Date = new Date(),
): LucroMes {
  const hojeISO = isoDia(hoje);
  const atual = chaveMes(hoje);
  const quando = mes < atual ? 'passado' : mes > atual ? 'futuro' : 'atual';

  const t = totaisDoMes(agendamentos, mes, hojeISO);
  const fixos = totalCustosFixosMensais(custosFixos, mes);

  let comprasMaterial = 0;
  let despesasPontuais = 0;
  let porPagar = 0;
  let naoContam = 0;
  for (const d of despesas) {
    const data = dataDaDespesa(d);
    if (!data || !data.startsWith(mes)) continue;
    const v = parseMoeda(d.valor);
    if (!contaNoLucro(d)) {
      naoContam += 1;
      continue;
    }
    if (ehMaterial(d)) comprasMaterial += v;
    else despesasPontuais += v;
    if (d.status === 'pendente') porPagar += v;
  }

  const material = comprasMaterial + t.materialRealizado;
  const materialPrevisto = comprasMaterial + t.materialPrevisto;
  const lucro = t.realizado - fixos - material - despesasPontuais;
  const lucroPrevisto = t.previsto - fixos - materialPrevisto - despesasPontuais;

  return {
    ...t,
    mes,
    quando,
    custosFixos: fixos,
    material,
    comprasMaterial,
    despesasPontuais,
    porPagar,
    naoContam,
    lucro: arred(lucro),
    lucroPrevisto: arred(lucroPrevisto),
  };
}

const arred = (n: number) => Math.round(n * 100) / 100;

/** "Lucro" ou "Prejuízo", conforme o sinal (para títulos: "Lucro do mês" / "Prejuízo do mês"). */
export const rotuloResultado = (n: number) => (arred(n) < 0 ? 'Prejuízo' : 'Lucro');

/** "lucro de 45,00 €" / "prejuízo de 45,00 €" — o prejuízo nunca aparece como "lucro −45". */
export const textoResultado = (n: number) =>
  arred(n) < 0 ? `prejuízo de ${euro(-n)}` : `lucro de ${euro(n)}`;

/** Lucro de cada mês do ano, de janeiro até ao mês atual (ou dezembro, se o ano já passou). */
export function lucroDoAno(
  dados: { agendamentos: AgendamentoFinanceiro[]; custosFixos: CustoFixo[]; despesas: Despesa[] },
  ano: number,
  hoje: Date = new Date(),
): { meses: LucroMes[]; lucro: number; realizado: number } {
  const ultimoMes = ano < hoje.getFullYear() ? 12 : ano > hoje.getFullYear() ? 0 : hoje.getMonth() + 1;
  const meses: LucroMes[] = [];
  for (let m = 1; m <= ultimoMes; m++) meses.push(calcularLucroMes(dados, `${ano}-${pad(m)}`, hoje));
  return {
    meses,
    lucro: arred(meses.reduce((acc, x) => acc + x.lucro, 0)),
    realizado: arred(meses.reduce((acc, x) => acc + x.realizado, 0)),
  };
}

// ---------------------------------------------------------------------------
// Próximos pagamentos (custos fixos com data + despesas pendentes)
// ---------------------------------------------------------------------------

export const DIAS_AVISO = 7;

export interface Pagamento {
  tipo: 'fixo' | 'despesa';
  id: string;
  nome: string;
  valor: number;
  data: string;
  dias: number;
}

export function proximosPagamentos(
  custosFixos: CustoFixo[],
  despesas: Despesa[],
  hoje: Date = new Date(),
  limiteDias = 42, // 6 semanas
): Pagamento[] {
  const lista: Pagamento[] = [];
  for (const c of custosFixos) {
    if (!c.ativo || !c.proximo_pagamento || custoJaTerminou(c, hoje)) continue;
    // Pagamento depois do mês em que o custo termina: já não é para pagar.
    const fim = mesDeFim(c);
    if (fim && c.proximo_pagamento.slice(0, 7) > fim) continue;
    const dias = diasAte(c.proximo_pagamento, hoje);
    if (dias <= limiteDias) {
      lista.push({ tipo: 'fixo', id: c.id, nome: c.nome, valor: valorPorPagamento(c), data: c.proximo_pagamento, dias });
    }
  }
  for (const d of despesas) {
    if (d.status !== 'pendente' || !d.data_vencimento) continue;
    const dias = diasAte(d.data_vencimento, hoje);
    if (dias <= limiteDias) {
      lista.push({ tipo: 'despesa', id: d.id, nome: d.titulo, valor: parseMoeda(d.valor), data: d.data_vencimento, dias });
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Pagamentos em atraso ou nos próximos DIAS_AVISO dias. */
export const pagamentosAAvisar = (lista: Pagamento[]) => lista.filter((p) => p.dias <= DIAS_AVISO);

export function textoQuando(dias: number): string {
  if (dias < -1) return `atrasado ${-dias} dias`;
  if (dias === -1) return 'atrasado 1 dia';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `daqui a ${dias} dias`;
}
