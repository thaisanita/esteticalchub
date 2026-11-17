import { AlertTriangle, CalendarCheck, CalendarDays, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calcularLucroMes,
  dataDaDespesa,
  euro,
  nomeMes,
  pareceCustoFixoRepetido,
  proximosPagamentos,
  rotuloResultado,
  textoAtendimentos,
  textoResultado,
} from '@/lib/lucro';
import type { DadosFinanceiros } from '@/hooks/useDadosFinanceiros';
import { AvisoPagamentos, ListaProximosPagamentos, contarCustosSemData } from './ProximosPagamentos';

interface Props {
  mes: string;
  dados: DadosFinanceiros;
  /** Muda de aba; com `mes`, muda também o mês mostrado. */
  irPara: (aba: 'fixos' | 'despesas' | 'stock', mes?: string) => void;
}

function Cartao({
  titulo, valor, detalhe, Icone,
}: { titulo: string; valor: string; detalhe: string; Icone: typeof Wallet }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-lg shadow-black/10">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icone size={13} className="text-primary" /> {titulo}
      </p>
      <p className="mt-2 font-display text-xl font-bold tabular-nums text-foreground">{valor}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function Linha({ rotulo, valor, sinal, nota, onClick }: {
  rotulo: string; valor: number; sinal: '' | '−'; nota?: string; onClick?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div>
        {onClick ? (
          <button type="button" onClick={onClick} className="text-left text-sm text-foreground hover:text-primary hover:underline">
            {sinal && `${sinal} `}{rotulo}
          </button>
        ) : (
          <span className="text-sm text-foreground">{sinal && `${sinal} `}{rotulo}</span>
        )}
        {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{euro(valor)}</span>
    </div>
  );
}

export default function ResumoMes({ mes, dados, irPara }: Props) {
  const r = calcularLucroMes(dados, mes);
  const pagamentos = proximosPagamentos(dados.custosFixos, dados.despesas);
  const repetidos = dados.despesas.filter((d) => pareceCustoFixoRepetido(d, dados.custosFixos));
  // "Ver e decidir" abre o mês do primeiro lançamento, onde está o botão.
  const mesDoPrimeiroRepetido = repetidos
    .map((d) => (dataDaDespesa(d) || '').slice(0, 7))
    .filter(Boolean)
    .sort()[0];
  const futuro = r.quando === 'futuro';
  const lucroMostrado = futuro ? r.lucroPrevisto : r.lucro;
  const mostrarPrevisto = r.quando === 'atual' && r.previsto !== r.realizado;

  return (
    <div className="space-y-5">
      <AvisoPagamentos pagamentos={pagamentos} onAbrir={() => irPara('fixos')} />

      {repetidos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {repetidos.length === 1
              ? 'Há 1 despesa que parece um custo fixo que também está em Custos fixos. Pode estar a contar duas vezes.'
              : `Há ${repetidos.length} despesas que parecem custos fixos que também estão em Custos fixos. Podem estar a contar duas vezes.`}
          </p>
          <button type="button" onClick={() => irPara('despesas', mesDoPrimeiroRepetido)} className="text-xs font-semibold underline">
            Ver e decidir
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-foreground">
          <span className="font-semibold">Atendimentos:</span> {textoAtendimentos(r)}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cartao titulo="Previsto" Icone={CalendarDays} valor={euro(r.previsto)} detalhe="Tudo o que está marcado no mês" />
          <Cartao
            titulo="Realizado"
            Icone={CalendarCheck}
            valor={euro(r.realizado)}
            detalhe={futuro ? 'Este mês ainda não começou' : 'O que já foi feito, até hoje'}
          />
          <Cartao titulo="Recebido" Icone={Wallet} valor={euro(r.recebido)} detalhe="O que está marcado como pago" />
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-lg shadow-black/10">
        <h3 className="text-sm font-semibold text-foreground">A conta do lucro — {nomeMes(mes)}</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          {futuro
            ? 'Este mês ainda não começou: a conta usa o que já está marcado.'
            : 'O que já fizeste, menos tudo o que o negócio gastou neste mês. As faltas não contam.'}
        </p>
        <div className="divide-y divide-border">
          <Linha rotulo={futuro ? 'Previsto' : 'Realizado'} valor={futuro ? r.previsto : r.realizado} sinal="" />
          <Linha
            rotulo="Custos fixos"
            valor={r.custosFixos}
            sinal="−"
            nota={`O valor de cada mês (um seguro anual de ${euro(240)} conta ${euro(20)} por mês). Cada custo conta a partir de «Começa em» (ou do mês em que o registaste, se ficar vazio).`}
            onClick={() => irPara('fixos')}
          />
          <Linha
            rotulo="Material gasto"
            valor={r.material}
            sinal="−"
            nota="Compras de material registadas neste mês."
            onClick={() => irPara('stock')}
          />
          <Linha
            rotulo="Despesas pontuais"
            valor={r.despesasPontuais}
            sinal="−"
            nota={r.porPagar > 0 ? `Inclui ${euro(r.porPagar)} ainda por pagar.` : 'Impostos, cursos, equipamento…'}
            onClick={() => irPara('despesas')}
          />
          <div className="flex items-baseline justify-between gap-3 pt-3">
            <span className="text-base font-bold text-foreground">
              = {rotuloResultado(lucroMostrado)} {futuro ? 'previsto' : 'do mês'}
            </span>
            <span
              className={cn(
                'font-display text-2xl font-bold tabular-nums',
                lucroMostrado > 0 ? 'text-emerald-500' : lucroMostrado < 0 ? 'text-rose-500' : 'text-foreground',
              )}
            >
              {/* Prejuízo aparece sem sinal: "Prejuízo do mês 45,00 €" */}
              {euro(Math.abs(lucroMostrado))}
            </span>
          </div>
          {lucroMostrado < 0 && (
            <p className="pt-1 text-right text-xs text-rose-500">
              Este mês o negócio gastou mais do que fizeste: {textoResultado(lucroMostrado)}.
            </p>
          )}
        </div>

        {mostrarPrevisto && (
          <p className="mt-2 text-xs text-muted-foreground">
            Se tudo o que está marcado acontecer, o mês fecha com{' '}
            <span className={cn('font-semibold', r.lucroPrevisto >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
              {textoResultado(r.lucroPrevisto)}
            </span>
            .
          </p>
        )}
        {r.porPagar > 0 && (
          <p className="mt-1 text-xs text-amber-500">Ainda tens {euro(r.porPagar)} de despesas deste mês por pagar.</p>
        )}
        {r.naoContam > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {r.naoContam === 1
              ? '1 lançamento deste mês não conta, porque escolheste não o contar duas vezes.'
              : `${r.naoContam} lançamentos deste mês não contam, porque escolheste não os contar duas vezes.`}
          </p>
        )}
        {lucroMostrado > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Dica: guarda pelo menos 20% do lucro ({euro(lucroMostrado * 0.2)}) para impostos e imprevistos.
          </p>
        )}
      </div>

      <ListaProximosPagamentos pagamentos={pagamentos} custosSemData={contarCustosSemData(dados.custosFixos)} onde="resumo" />
    </div>
  );
}
