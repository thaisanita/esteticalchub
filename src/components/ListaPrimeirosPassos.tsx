import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X, ArrowRight } from 'lucide-react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Passos verificados pelos dados reais da conta (não por um botão a marcar).
const PASSOS = [
  { chave: 'procedimento', texto: 'Criar um procedimento', tabela: 'procedimentos', rota: '/procedimentos', acao: 'Abrir procedimentos' },
  { chave: 'cliente', texto: 'Adicionar a primeira cliente', tabela: 'clientes', rota: '/clientes', acao: 'Abrir clientes' },
  { chave: 'agendamento', texto: 'Criar o primeiro agendamento', tabela: 'agendamentos', rota: '/novo-agendamento', acao: 'Criar agendamento' },
  { chave: 'custos', texto: 'Definir os custos fixos', tabela: 'custos_fixos', rota: '/custos', acao: 'Abrir custos' },
] as const;

const chaveDispensa = (usuarioId: string) => `onboarding_dispensado:${usuarioId}`;

/** Lista de primeiros passos da Visão geral. Desaparece quando fica completa ou é dispensada. */
export default function ListaPrimeirosPassos() {
  const navigate = useNavigate();
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<Record<string, boolean> | null>(null);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUsuarioId(user.id);

      let jaDispensado = false;
      try {
        jaDispensado = localStorage.getItem(chaveDispensa(user.id)) === '1';
      } catch {
        // armazenamento bloqueado (ex.: modo privado): mostra a lista na mesma
      }
      setDispensado(jaDispensado);

      const resultados = await Promise.all(
        PASSOS.map(async (passo) => {
          const { count } = await supabase
            .from(passo.tabela)
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', user.id);
          return [passo.chave, (count ?? 0) > 0] as const;
        })
      );
      setFeitos(Object.fromEntries(resultados));
    });
  }, []);

  if (!feitos || dispensado) return null;

  const concluidos = PASSOS.filter((passo) => feitos[passo.chave]).length;
  if (concluidos === PASSOS.length) return null;

  const percentagem = Math.round((concluidos / PASSOS.length) * 100);

  const dispensar = () => {
    if (usuarioId) {
      try {
        localStorage.setItem(chaveDispensa(usuarioId), '1');
      } catch {
        // sem armazenamento, a lista volta a aparecer ao recarregar; não é grave
      }
    }
    setDispensado(true);
  };

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-lg shadow-black/10">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">Primeiros passos</h3>
          <p className="text-xs text-muted-foreground">
            {concluidos} de {PASSOS.length} concluídos
          </p>
        </div>
        <button
          type="button"
          onClick={dispensar}
          title="Dispensar esta lista"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percentagem}%` }} />
      </div>

      <ul className="space-y-2">
        {PASSOS.map((passo) => {
          const feito = feitos[passo.chave];
          return (
            <li key={passo.chave} className="flex items-center justify-between gap-3 text-sm">
              <span className={cn('flex items-center gap-2', feito ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {feito ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-muted-foreground" />}
                {passo.texto}
              </span>
              {!feito && (
                <Button variant="ghost" size="sm" onClick={() => navigate(passo.rota)} className="gap-1 text-xs">
                  {passo.acao} <ArrowRight size={12} />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
