import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import CustosFixos from './CustosFixos';
import CustosEstoque from './CustosEstoque';

type Aba = 'fixos' | 'variaveis';

export default function Custos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abaInicial: Aba = searchParams.get('aba') === 'variaveis' ? 'variaveis' : 'fixos';
  const [aba, setAba] = useState<Aba>(abaInicial);

  const mudarAba = (novaAba: Aba) => {
    setAba(novaAba);
    setSearchParams({ aba: novaAba });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Custos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tudo o que a empresa gasta — o que se repete todos os meses e o que varia
        </p>
      </div>

      {/* Seletor de abas */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => mudarAba('fixos')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
            aba === 'fixos'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Target size={15} /> Custos Fixos
        </button>
        <button
          onClick={() => mudarAba('variaveis')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
            aba === 'variaveis'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Boxes size={15} /> Variáveis e Estoque
        </button>
      </div>

      {aba === 'fixos' ? <CustosFixos /> : <CustosEstoque />}
    </div>
  );
}
