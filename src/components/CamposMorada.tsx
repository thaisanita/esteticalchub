import { useEffect, useId, useRef } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  useCodigoPostal,
  mascaraCodigoPostal,
  normalizarCodigoPostal,
  localidadeComConcelho,
} from '@/hooks/useCodigoPostal';

interface CamposMoradaProps {
  codigoPostal: string;
  onCodigoPostalChange: (v: string) => void;
  /** Rua e número. Nas clientes antigas é a morada completa em texto livre. */
  morada: string;
  onMoradaChange: (v: string) => void;
  localidade: string;
  onLocalidadeChange: (v: string) => void;
  /** Título por cima dos campos. */
  titulo?: string;
  /** Classes extra dos campos, para combinar com o resto do formulário. */
  classeInput?: string;
}

const classeLabel = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * Código postal + Rua e número + Localidade. Com um código válido, preenche a
 * localidade ("Localidade, Concelho") e sugere as ruas desse código. Tudo
 * continua editável à mão, e funciona sem a API.
 *
 * Montar com `key` diferente por cliente: o código com que o componente abre
 * conta como "já preenchido", para não apagar a localidade guardada (que pode
 * ter sido corrigida à mão) só por abrir a ficha.
 */
export default function CamposMorada({
  codigoPostal,
  onCodigoPostalChange,
  morada,
  onMoradaChange,
  localidade,
  onLocalidadeChange,
  titulo = 'Morada',
  classeInput,
}: CamposMoradaProps) {
  const id = useId();
  const idLista = `${id}-ruas`;
  const idEstado = `${id}-estado`;
  const { estado, dados } = useCodigoPostal(codigoPostal);

  const codigoJaPreenchido = useRef<string | null>(
    localidade.trim() ? normalizarCodigoPostal(codigoPostal) : null,
  );

  // Só preenche a localidade quando chega o resultado de um código novo.
  // Editar a localidade à mão depois disso não é desfeito.
  useEffect(() => {
    if (dados && dados.codigo !== codigoJaPreenchido.current) {
      codigoJaPreenchido.current = dados.codigo;
      const sugestao = localidadeComConcelho(dados);
      if (sugestao) onLocalidadeChange(sugestao);
    }
  }, [dados, onLocalidadeChange]);

  const ruas = estado === 'encontrado' && dados ? dados.ruas : [];

  return (
    <div className="space-y-2 sm:col-span-2">
      <p className={`${classeLabel} flex items-center gap-1.5`}>
        <MapPin size={12} className="text-primary" />
        {titulo}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
        <div className="space-y-1">
          <label htmlFor={`${id}-cp`} className={classeLabel}>
            Código postal
          </label>
          <Input
            className={classeInput}
            id={`${id}-cp`}
            placeholder="0000-000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={codigoPostal}
            onChange={(e) => onCodigoPostalChange(mascaraCodigoPostal(e.target.value))}
            aria-describedby={idEstado}
            aria-invalid={estado === 'nao_encontrado' || undefined}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-rua`} className={classeLabel}>
            Rua e número
          </label>
          <Input
            className={classeInput}
            id={`${id}-rua`}
            placeholder={ruas.length ? 'Escolhe a rua e acrescenta o número' : 'Rua, número, andar'}
            autoComplete="off"
            list={ruas.length ? idLista : undefined}
            value={morada}
            onChange={(e) => onMoradaChange(e.target.value)}
          />
          {ruas.length > 0 && (
            <datalist id={idLista}>
              {ruas.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={`${id}-localidade`} className={classeLabel}>
            Localidade
          </label>
          <Input
            className={classeInput}
            id={`${id}-localidade`}
            placeholder="Localidade, Concelho"
            autoComplete="off"
            value={localidade}
            onChange={(e) => onLocalidadeChange(e.target.value)}
          />
        </div>
      </div>
      <p id={idEstado} aria-live="polite" className="min-h-4 text-xs">
        {estado === 'a_procurar' && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> A procurar o código postal…
          </span>
        )}
        {estado === 'nao_encontrado' && <span className="text-rose-500">Código postal não encontrado</span>}
        {estado === 'erro' && (
          <span className="text-muted-foreground">
            Não foi possível procurar o código postal agora. Podes preencher a morada à mão.
          </span>
        )}
        {estado === 'encontrado' && ruas.length > 0 && (
          <span className="text-muted-foreground">
            {ruas.length === 1 ? '1 rua sugerida' : `${ruas.length} ruas sugeridas`} no campo «Rua e número».
          </span>
        )}
      </p>
    </div>
  );
}
