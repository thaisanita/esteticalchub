import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmar } from '@/components/ConfirmDialog';
import { cn, getErrorMessage, parseMoeda } from '@/lib/utils';
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_MATERIAL,
  contaNoLucro,
  dataCurta,
  dataDaDespesa,
  ehMaterial,
  euro,
  isoDia,
  nomeMes,
  pareceCustoFixoRepetido,
  rotuloCategoriaDespesa,
  type CustoFixo,
  type Despesa,
} from '@/lib/lucro';

interface Props {
  /** 'pontuais' = impostos, cursos, equipamento…; 'material' = compras de material. */
  modo: 'pontuais' | 'material';
  mes: string;
  despesas: Despesa[];
  custosFixos: CustoFixo[];
  /** Volta a carregar os dados; espera-se por ele antes de mostrar a mensagem. */
  onMudou: () => void | Promise<void>;
}

const classeCampo = 'h-10 bg-background/50 text-sm';
const classeLabel = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

export const TEXTO_REPETIDO =
  'Este lançamento parece um custo fixo que também está em Custos fixos. Queres que não conte duas vezes?';

export default function ListaDespesas({ modo, mes, despesas, custosFixos, onMudou }: Props) {
  const material = modo === 'material';
  const hoje = isoDia(new Date());
  // Data por omissão: hoje, se o mês escolhido é o atual; senão o dia 1 desse mês.
  const dataInicial = hoje.startsWith(mes) ? hoje : `${mes}-01`;

  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0].value);
  const [valor, setValor] = useState('');
  const [estado, setEstado] = useState<'pago' | 'pendente'>('pago');
  // Pago: dia do pagamento (vem com hoje). Por pagar: vencimento, começa vazio
  // — a utilizadora tem de o escolher.
  const [dataPagamento, setDataPagamento] = useState(dataInicial);
  const [dataVencimento, setDataVencimento] = useState('');
  const data = estado === 'pago' ? dataPagamento : dataVencimento;
  const setData = estado === 'pago' ? setDataPagamento : setDataVencimento;
  const [salvando, setSalvando] = useState(false);
  const [aMudar, setAMudar] = useState<string | null>(null);

  const doModo = despesas.filter((d) => (material ? ehMaterial(d) : !ehMaterial(d)));
  const doMes = doModo.filter((d) => (dataDaDespesa(d) || '').startsWith(mes));
  const semData = doModo.filter((d) => !dataDaDespesa(d));
  const queContam = doMes.filter(contaNoLucro);
  const total = queContam.reduce((acc, d) => acc + parseMoeda(d.valor), 0);
  const porPagar = queContam.filter((d) => d.status === 'pendente').reduce((acc, d) => acc + parseMoeda(d.valor), 0);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseMoeda(valor);
    if (!titulo.trim() || v <= 0) {
      toast.error('Preenche a descrição e um valor maior que zero.');
      return;
    }
    if (!data) {
      toast.error(estado === 'pago' ? 'Indica a data do pagamento.' : 'Escolhe a data de vencimento: até quando tens de pagar.');
      document.getElementById(`${modo}-data`)?.focus();
      return;
    }
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('se_custos').insert([
      {
        titulo: titulo.trim(),
        categoria: material ? CATEGORIA_MATERIAL : categoria,
        valor: v,
        status: estado,
        data_pagamento: estado === 'pago' ? data : null,
        data_vencimento: estado === 'pendente' ? data : null,
        usuario_id: user?.id,
      },
    ]);
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    setTitulo('');
    setValor('');
    setDataVencimento('');
    await onMudou();
    toast.success(material ? 'Compra guardada.' : 'Despesa guardada.');
    if (!data.startsWith(mes)) toast.info(`Ficou em ${nomeMes(data.slice(0, 7))}, pela data que escolheste.`);
  };

  const atualizar = async (id: string, campos: Partial<Despesa>, sucesso: string) => {
    setAMudar(id);
    const { error } = await supabase.from('se_custos').update(campos).eq('id', id);
    if (error) {
      setAMudar(null);
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    // A mensagem só aparece depois de a lista já estar atualizada.
    await onMudou();
    setAMudar(null);
    toast.success(sucesso);
  };

  const marcarPago = (d: Despesa) =>
    atualizar(d.id, { status: 'pago', data_pagamento: hoje }, 'Marcada como paga.');

  const eliminar = async (d: Despesa) => {
    const ok = await confirmar({
      descricao: `Eliminar "${d.titulo}"? Esta ação não pode ser desfeita.`,
      destrutivo: true,
      textoConfirmar: 'Eliminar',
    });
    if (!ok) return;
    const { error } = await supabase.from('se_custos').delete().eq('id', d.id);
    if (error) {
      toast.error('Não foi possível eliminar: ' + getErrorMessage(error));
      return;
    }
    await onMudou();
    toast.success('Lançamento eliminado.');
  };

  const linha = (d: Despesa) => {
    const conta = contaNoLucro(d);
    const repetido = pareceCustoFixoRepetido(d, custosFixos);
    const dataRef = dataDaDespesa(d);
    return (
      <li key={d.id} className={cn('py-3', !conta && 'opacity-60')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                d.status === 'pago' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500',
              )}
            >
              {d.status === 'pago' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{d.titulo}</p>
              <p className="text-[11px] text-muted-foreground">
                {!material && <>{rotuloCategoriaDespesa(d.categoria)} · </>}
                {dataRef
                  ? d.status === 'pago'
                    ? `Paga a ${dataCurta(d.data_pagamento || dataRef)}`
                    : `Vence a ${dataCurta(dataRef)}`
                  : 'Sem data — não entra em nenhum mês'}
                {!conta && ' · não conta no lucro'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {d.status === 'pendente' && (
              <button
                type="button"
                disabled={aMudar === d.id}
                onClick={() => marcarPago(d)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Check size={12} /> Marcar como paga
              </button>
            )}
            {!conta && (
              <button
                type="button"
                disabled={aMudar === d.id}
                onClick={() => atualizar(d.id, { conta_no_lucro: true }, 'Volta a contar no lucro.')}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw size={12} /> Voltar a contar
              </button>
            )}
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-foreground">{euro(parseMoeda(d.valor))}</p>
              {d.status === 'pago' ? (
                <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                  <CheckCircle2 size={10} /> Paga
                </span>
              ) : (
                <p className="text-[10px] font-semibold text-amber-500">Por pagar</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => eliminar(d)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              aria-label={`Eliminar ${d.titulo}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {repetido && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <p className="flex items-start gap-1.5 text-xs text-amber-500">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {TEXTO_REPETIDO}
            </p>
            <button
              type="button"
              disabled={aMudar === d.id}
              onClick={() => atualizar(d.id, { conta_no_lucro: false }, 'Este lançamento já não conta no lucro.')}
              className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/10"
            >
              Não contar duas vezes
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={guardar} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus size={15} className="text-primary" /> {material ? 'Registar compra de material' : 'Registar despesa'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={cn('space-y-1', material && 'lg:col-span-2')}>
            <label htmlFor={`${modo}-titulo`} className={classeLabel}>Descrição</label>
            <Input
              id={`${modo}-titulo`}
              placeholder={material ? 'Ex.: Lâminas, luvas, creme' : 'Ex.: IRS, curso de microblading'}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={classeCampo}
            />
          </div>
          {!material && (
            <div className="space-y-1">
              <label htmlFor={`${modo}-categoria`} className={classeLabel}>Categoria</label>
              <select
                id={`${modo}-categoria`}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm text-foreground focus:outline-none"
              >
                {CATEGORIAS_DESPESA.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor={`${modo}-valor`} className={classeLabel}>Valor (€)</label>
            <Input
              id={`${modo}-valor`}
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={classeCampo}
            />
          </div>
          <div className="space-y-1">
            <span className={classeLabel}>Estado</span>
            <div className="flex gap-2" role="group" aria-label="Estado do pagamento">
              {(['pago', 'pendente'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={estado === s}
                  onClick={() => setEstado(s)}
                  className={cn(
                    'h-10 flex-1 rounded-md border text-sm font-medium transition-colors',
                    estado === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s === 'pago' ? 'Já paguei' : 'Por pagar'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${modo}-data`} className={classeLabel}>
              {estado === 'pago' ? 'Data do pagamento' : 'Data de vencimento'}
            </label>
            <Input
              id={`${modo}-data`}
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={classeCampo}
              aria-describedby={`${modo}-data-ajuda`}
              aria-required={estado === 'pendente'}
            />
            <p id={`${modo}-data-ajuda`} className="text-[11px] text-muted-foreground">
              {estado === 'pago'
                ? 'O dia em que pagaste.'
                : 'Escolhe até quando tens de pagar. Aparece nos próximos pagamentos e conta no lucro desse mês.'}
            </p>
          </div>
        </div>
        <Button type="submit" disabled={salvando} className="w-full sm:w-auto">
          {salvando ? 'A guardar…' : material ? 'Adicionar compra' : 'Adicionar despesa'}
        </Button>
      </form>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {material ? 'Compras de material' : 'Despesas'} de {nomeMes(mes)}
          </h3>
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{euro(total)}</span>
            {porPagar > 0 && <span className="text-amber-500"> · {euro(porPagar)} por pagar</span>}
          </p>
        </div>
        {doMes.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {material ? 'Nenhuma compra de material neste mês.' : 'Nenhuma despesa neste mês.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">{doMes.map(linha)}</ul>
        )}
        {semData.length > 0 && (
          <div className="border-t border-border pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sem data</p>
            <ul className="divide-y divide-border">{semData.map(linha)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
