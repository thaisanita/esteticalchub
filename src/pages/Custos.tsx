import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, CalendarRange, Landmark, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chaveMes } from '@/lib/lucro';
import { useDadosFinanceiros } from '@/hooks/useDadosFinanceiros';
import { SkeletonLinhas } from '@/components/ui/skeleton';
import SeletorMes from '@/components/custos/SeletorMes';
import ResumoMes from '@/components/custos/ResumoMes';
import ListaDespesas from '@/components/custos/ListaDespesas';
import CustosFixos from './CustosFixos';
import Produtos from './Produtos';

type Aba = 'resumo' | 'fixos' | 'despesas' | 'stock';

const ABAS: { id: Aba; texto: string; Icone: typeof Receipt; explicacao: string; comMes: boolean }[] = [
  {
    id: 'resumo',
    texto: 'Resumo do mês',
    Icone: CalendarRange,
    explicacao: 'O que fizeste no mês, menos tudo o que o negócio gastou. O resultado é o teu lucro real.',
    comMes: true,
  },
  {
    id: 'fixos',
    texto: 'Custos fixos',
    Icone: Landmark,
    explicacao: 'O que pagas sempre, todos os meses ou de tempos a tempos (renda, seguro, contabilista). A app reparte cada valor pelos meses.',
    comMes: false,
  },
  {
    id: 'despesas',
    texto: 'Despesas pontuais',
    Icone: Receipt,
    explicacao: 'Gastos que não se repetem: impostos, cursos, equipamento. Contam no lucro do mês da data.',
    comMes: true,
  },
  {
    id: 'stock',
    texto: 'Produtos e Stock',
    Icone: Boxes,
    explicacao: 'O material que compras e os produtos que tens em stock. As compras contam no lucro como material gasto.',
    comMes: true,
  },
];

/** Links antigos (?aba=variaveis / ?aba=produtos) continuam a funcionar. */
function abaDoUrl(valor: string | null): Aba {
  if (valor === 'fixos' || valor === 'despesas' || valor === 'stock' || valor === 'resumo') return valor;
  if (valor === 'variaveis' || valor === 'produtos') return 'stock';
  return 'resumo';
}

export default function Custos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState<Aba>(abaDoUrl(searchParams.get('aba')));
  const [mes, setMes] = useState(chaveMes(new Date()));
  const { dados, carregando, erro, recarregar } = useDadosFinanceiros();

  const mudarAba = (nova: Aba, novoMes?: string) => {
    setAba(nova);
    if (novoMes) setMes(novoMes);
    setSearchParams({ aba: nova });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const atual = ABAS.find((a) => a.id === aba)!;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Custos</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Descobre quanto ganhas de verdade em cada atendimento.</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-border" role="tablist">
          {ABAS.map(({ id, texto, Icone }) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              onClick={() => mudarAba(id)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                aba === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icone size={15} /> {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">{atual.explicacao}</p>
        {atual.comMes && <SeletorMes mes={mes} onChange={setMes} />}
      </div>

      {erro && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-500">
          Não foi possível carregar os custos: {erro}
        </p>
      )}

      {carregando ? (
        <SkeletonLinhas linhas={5} />
      ) : aba === 'resumo' ? (
        <ResumoMes mes={mes} dados={dados} irPara={mudarAba} />
      ) : aba === 'fixos' ? (
        <CustosFixos dados={dados} onMudou={recarregar} />
      ) : aba === 'despesas' ? (
        <ListaDespesas key={`p-${mes}`} modo="pontuais" mes={mes} despesas={dados.despesas} custosFixos={dados.custosFixos} onMudou={recarregar} />
      ) : (
        <div className="space-y-8">
          <ListaDespesas key={`m-${mes}`} modo="material" mes={mes} despesas={dados.despesas} custosFixos={dados.custosFixos} onMudou={recarregar} />
          <Produtos />
        </div>
      )}
    </div>
  );
}
