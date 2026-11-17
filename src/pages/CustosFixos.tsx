import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getErrorMessage, parseMoeda } from '@/lib/utils';
import { confirmar } from '@/components/ConfirmDialog';
import { CalendarCheck, Landmark, Pencil, Plus, Power, PowerOff, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import {
  FREQUENCIAS,
  calcularLucroMes,
  chaveMes,
  dataCurta,
  diasAte,
  equivalenteMensal,
  euro,
  mensalDoCusto,
  mesDeInicio,
  mesDeFim,
  custoJaTerminou,
  isoDia,
  nomeMes,
  proximaData,
  proximosPagamentos,
  textoQuando,
  totalCustosFixosMensais,
  valorPorPagamento,
  DIAS_AVISO,
  type CustoFixo,
  type Frequencia,
} from '@/lib/lucro';
import type { DadosFinanceiros } from '@/hooks/useDadosFinanceiros';
import { ListaProximosPagamentos, contarCustosSemData } from '@/components/custos/ProximosPagamentos';

const CATEGORIAS = [
  { value: 'aluguel', label: 'Renda do espaço' },
  { value: 'internet', label: 'Internet e telemóvel' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'seguranca_social', label: 'Segurança Social' },
  { value: 'contabilidade', label: 'Contabilista' },
  { value: 'higiene_seguranca', label: 'Higiene e segurança no trabalho' },
  { value: 'residuos', label: 'Recolha de resíduos' },
  { value: 'luz', label: 'Luz, água e gás' },
  { value: 'software', label: 'Software (apps, assinaturas)' },
  { value: 'outro', label: 'Outro' },
];

const rotuloCategoria = (valor: string) => CATEGORIAS.find((c) => c.value === valor)?.label ?? valor;
const rotuloFrequencia = (f: string | null | undefined) => FREQUENCIAS.find((x) => x.value === f) ?? FREQUENCIAS[0];

const classeCampo = 'h-10 bg-background/50 text-sm';
const classeLabel = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

interface Props {
  dados: DadosFinanceiros;
  /** Volta a carregar os dados; espera-se por ele antes de mostrar a mensagem. */
  onMudou: () => void | Promise<void>;
}

export default function CustosFixos({ dados, onMudou }: Props) {
  const custos = dados.custosFixos;
  const formRef = useRef<HTMLFormElement>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('outro');
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal');
  const [valor, setValor] = useState('');
  const [proximo, setProximo] = useState('');
  const [comecaEm, setComecaEm] = useState('');
  const [terminaEm, setTerminaEm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aMudar, setAMudar] = useState<string | null>(null);

  const valorNum = parseMoeda(valor);
  const freqAtual = rotuloFrequencia(frequencia);

  const limpar = () => {
    setEditandoId(null);
    setNome('');
    setCategoria('outro');
    setFrequencia('mensal');
    setValor('');
    setProximo('');
    setComecaEm('');
    setTerminaEm('');
  };

  const editar = (c: CustoFixo) => {
    setEditandoId(c.id);
    setNome(c.nome);
    setCategoria(c.categoria);
    setFrequencia((c.frequencia as Frequencia) || 'mensal');
    setValor(String(valorPorPagamento(c)).replace('.', ','));
    setProximo(c.proximo_pagamento || '');
    setComecaEm(c.comeca_em || '');
    setTerminaEm(c.termina_em || '');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || valorNum <= 0) {
      toast.error('Preenche o nome e o valor de cada pagamento.');
      return;
    }
    if (comecaEm && terminaEm && terminaEm < comecaEm) {
      toast.error('"Termina em" não pode ser antes de "Começa em".');
      return;
    }
    setSalvando(true);
    const campos = {
      nome: nome.trim(),
      categoria,
      frequencia,
      valor_pagamento: valorNum,
      // O equivalente mensal fica sempre guardado em valor_mensal, para as
      // outras páginas e o Assistente continuarem certos.
      valor_mensal: equivalenteMensal(valorNum, frequencia),
      proximo_pagamento: proximo || null,
      comeca_em: comecaEm || null,
      termina_em: terminaEm || null,
    };
    const { error } = editandoId
      ? await supabase.from('custos_fixos').update({ ...campos, updated_at: new Date().toISOString() }).eq('id', editandoId)
      : await supabase.from('custos_fixos').insert([campos]);
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    const mensagem = editandoId ? 'Custo fixo atualizado.' : 'Custo fixo guardado.';
    limpar();
    await onMudou();
    toast.success(mensagem);
  };

  const paguei = async (c: CustoFixo) => {
    if (!c.proximo_pagamento) return;
    const seguinte = proximaData(c.proximo_pagamento, c.frequencia);
    setAMudar(c.id);
    const { error } = await supabase.from('custos_fixos').update({ proximo_pagamento: seguinte }).eq('id', c.id);
    setAMudar(null);
    if (error) {
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    await onMudou();
    toast.success(`Registado. Próximo pagamento: ${dataCurta(seguinte)}.`);
  };

  // Desativar grava "termina em" = hoje, para o custo continuar a contar nos
  // meses em que existiu (os meses passados não mudam). Ativar volta a deixá-lo
  // sem fim.
  const alternarAtivo = async (c: CustoFixo) => {
    const hoje = isoDia(new Date());
    let campos: Partial<CustoFixo>;
    let mensagem: string;
    if (c.ativo) {
      const inicio = mesDeInicio(c);
      if (inicio && inicio > hoje.slice(0, 7)) {
        // Ainda não tinha começado: não conta em nenhum mês.
        campos = { ativo: false, termina_em: null };
        mensagem = 'Desativado. Como ainda não tinha começado, não conta em nenhum mês.';
      } else {
        // Se já tinha um fim mais cedo, fica esse.
        const fim = c.termina_em && c.termina_em < hoje ? c.termina_em : hoje;
        campos = { ativo: false, termina_em: fim };
        mensagem = `Desativado. Conta até ${nomeMes(fim.slice(0, 7)).toLowerCase()}; os meses anteriores ficam iguais.`;
      }
    } else {
      campos = { ativo: true, termina_em: null };
      mensagem = 'Ativado. Volta a contar todos os meses desde o início.';
    }
    setAMudar(c.id);
    const { error } = await supabase.from('custos_fixos').update(campos).eq('id', c.id);
    if (error) {
      setAMudar(null);
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    // A mensagem só aparece depois de o cartão já estar atualizado.
    await onMudou();
    setAMudar(null);
    toast.success(mensagem);
  };

  const textoPeriodo = (c: CustoFixo) => {
    const inicio = mesDeInicio(c);
    const fim = mesDeFim(c);
    const mesTxt = (m: string) => nomeMes(m).toLowerCase();
    if (!c.ativo && !fim) return 'Desativado · não conta em nenhum mês';
    const desde = inicio ? `desde ${mesTxt(inicio)}` : '';
    if (!c.ativo) return `Desativado · contou ${inicio ? `de ${mesTxt(inicio)} ` : ''}até ${mesTxt(fim!)}`;
    if (fim) return `Conta no lucro ${desde ? `${desde} ` : ''}até ${mesTxt(fim)}`;
    return desde ? `Conta no lucro ${desde}` : '';
  };

  const eliminar = async (c: CustoFixo) => {
    const ok = await confirmar({
      descricao: `Eliminar "${c.nome}"? Se só deixaste de o pagar por uns tempos, podes desativá-lo em vez de eliminar.`,
      destrutivo: true,
      textoConfirmar: 'Eliminar',
    });
    if (!ok) return;
    const { error } = await supabase.from('custos_fixos').delete().eq('id', c.id);
    if (error) {
      toast.error('Não foi possível eliminar: ' + getErrorMessage(error));
      return;
    }
    if (editandoId === c.id) limpar();
    await onMudou();
    toast.success('Custo fixo eliminado.');
  };

  // Ponto de equilíbrio do mês atual: o que está marcado (Previsto) chega para os custos fixos?
  const totalMensal = totalCustosFixosMensais(custos);
  const mesAtual = calcularLucroMes(dados, chaveMes(new Date()));
  const diferenca = mesAtual.previsto - totalMensal;
  const cobre = diferenca >= 0;
  const percentual = totalMensal > 0 ? Math.min((mesAtual.previsto / totalMensal) * 100, 100) : 0;
  const pagamentos = proximosPagamentos(custos, []);

  return (
    <div className="space-y-6">
      {/* Ponto de equilíbrio */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Ponto de equilíbrio</p>
            <p className="text-[11px] text-muted-foreground">Quanto tens de fazer este mês só para pagar os custos fixos.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Custos fixos por mês</p>
            <p className="font-display text-2xl font-bold tabular-nums text-foreground">{euro(totalMensal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Previsto este mês</p>
            <p className="font-display text-2xl font-bold tabular-nums text-foreground">{euro(mesAtual.previsto)}</p>
          </div>
        </div>
        {totalMensal > 0 && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-background">
              <div
                className={cn('h-full rounded-full transition-all duration-500', cobre ? 'bg-emerald-500' : 'bg-primary')}
                style={{ width: `${percentual}%` }}
              />
            </div>
            <p
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-sm font-medium',
                cobre ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-primary/30 bg-primary/5 text-primary',
              )}
            >
              {cobre ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {cobre
                ? 'Com o que tens marcado, já cobriste os custos fixos. Ainda faltam o material e as despesas: vê o resultado no Resumo do mês.'
                : `Faltam ${euro(-diferenca)} em marcações para cobrires os custos fixos deste mês.`}
            </p>
          </>
        )}
      </div>

      {/* Formulário */}
      <form ref={formRef} onSubmit={guardar} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {editandoId ? <Pencil size={15} className="text-primary" /> : <Plus size={15} className="text-primary" />}
          {editandoId ? 'Editar custo fixo' : 'Adicionar custo fixo'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="cf-nome" className={classeLabel}>Nome</label>
            <Input id="cf-nome" placeholder="Ex.: Seguro de responsabilidade civil" value={nome} onChange={(e) => setNome(e.target.value)} className={classeCampo} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-categoria" className={classeLabel}>Categoria</label>
            <select
              id="cf-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm text-foreground focus:outline-none"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              {!CATEGORIAS.some((c) => c.value === categoria) && <option value={categoria}>{categoria}</option>}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <span className={classeLabel}>De quanto em quanto tempo pagas?</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Frequência">
              {FREQUENCIAS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={frequencia === f.value}
                  onClick={() => setFrequencia(f.value)}
                  className={cn(
                    'h-10 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
                    frequencia === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-valor" className={classeLabel}>Valor de cada pagamento (€)</label>
            <Input id="cf-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className={classeCampo} />
            {valorNum > 0 && frequencia !== 'mensal' && (
              <p className="text-[11px] text-primary">
                {euro(valorNum)} {freqAtual.porExtenso} = {euro(equivalenteMensal(valorNum, frequencia))} por mês
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-proximo" className={classeLabel}>Próximo pagamento (opcional)</label>
            <Input id="cf-proximo" type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} className={classeCampo} />
            <p className="text-[11px] text-muted-foreground">Avisamos-te {DIAS_AVISO} dias antes.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-comeca" className={classeLabel}>Começa em (opcional)</label>
            <Input id="cf-comeca" type="date" value={comecaEm} onChange={(e) => setComecaEm(e.target.value)} className={classeCampo} aria-describedby="cf-comeca-ajuda" />
            <p id="cf-comeca-ajuda" className="text-[11px] text-muted-foreground">
              Conta a partir do mês desta data. Vazio: a partir do mês em que o registas.
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-termina" className={classeLabel}>Termina em (opcional)</label>
            <Input id="cf-termina" type="date" value={terminaEm} onChange={(e) => setTerminaEm(e.target.value)} className={classeCampo} aria-describedby="cf-termina-ajuda" />
            <p id="cf-termina-ajuda" className="text-[11px] text-muted-foreground">
              Último mês em que conta (ex.: fim de contrato). Ao desativar, a app preenche-a sozinha.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? 'A guardar…' : editandoId ? 'Guardar alterações' : 'Adicionar'}
          </Button>
          {editandoId && (
            <Button type="button" variant="outline" onClick={limpar}>Cancelar</Button>
          )}
        </div>
      </form>

      <ListaProximosPagamentos pagamentos={pagamentos} custosSemData={contarCustosSemData(custos)} onde="custos-fixos" />

      {/* Lista */}
      <div className="space-y-2">
        {custos.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda não há custos fixos registados. Adiciona o primeiro acima.
          </div>
        )}
        {custos.map((c) => {
          const f = rotuloFrequencia(c.frequencia);
          const dias = c.proximo_pagamento ? diasAte(c.proximo_pagamento) : null;
          return (
            <div
              key={c.id}
              className={cn(
                'rounded-xl border bg-card p-4 shadow-sm',
                c.ativo ? 'border-border' : 'border-border opacity-50',
                editandoId === c.id && 'border-primary',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Landmark size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {rotuloCategoria(c.categoria)} · {f.label}
                    </p>
                    {textoPeriodo(c) && <p className="text-[11px] text-muted-foreground">{textoPeriodo(c)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-display text-base font-bold tabular-nums text-foreground">
                      {euro(valorPorPagamento(c))} <span className="text-xs font-normal text-muted-foreground">{f.porExtenso}</span>
                    </p>
                    {c.frequencia && c.frequencia !== 'mensal' && (
                      <p className="text-[11px] text-muted-foreground">= {euro(mensalDoCusto(c))} por mês</p>
                    )}
                  </div>
                  <button type="button" onClick={() => editar(c)} aria-label={`Editar ${c.nome}`} className="text-muted-foreground transition-colors hover:text-primary">
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={aMudar === c.id}
                    onClick={() => alternarAtivo(c)}
                    aria-label={c.ativo ? `Desativar ${c.nome}` : `Ativar ${c.nome}`}
                    title={c.ativo ? 'Desativar (deixa de contar a partir do próximo mês)' : 'Ativar'}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {c.ativo ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                  <button type="button" onClick={() => eliminar(c)} aria-label={`Eliminar ${c.nome}`} className="text-muted-foreground transition-colors hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {c.ativo && !custoJaTerminou(c) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  {c.proximo_pagamento && dias !== null ? (
                    <>
                      <p className={cn('text-xs', dias < 0 ? 'text-rose-500' : dias <= DIAS_AVISO ? 'text-amber-500' : 'text-muted-foreground')}>
                        Próximo pagamento: {dataCurta(c.proximo_pagamento)} ({textoQuando(dias)})
                      </p>
                      <button
                        type="button"
                        disabled={aMudar === c.id}
                        onClick={() => paguei(c)}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <CalendarCheck size={12} /> Marcar como pago
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => editar(c)} className="text-xs text-primary hover:underline">
                      Acrescenta a data do próximo pagamento
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
