import { cn } from '@/lib/utils';

/** Bloco cinzento que pulsa, base de todos os estados de carregamento. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted/60', className)} />;
}

/** Linhas de lista ou tabela, para páginas que mostram registos. */
export function SkeletonLinhas({ linhas = 5, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-2xl border border-border bg-card p-5', className)} aria-busy="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2 opacity-70" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Cartões de números (KPIs), para o topo de páginas com resumo. */
export function SkeletonCartoes({ quantidade = 4, className }: { quantidade?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)} aria-busy="true">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-2.5 w-1/3 opacity-70" />
        </div>
      ))}
    </div>
  );
}

/** Campos de formulário, para ecrãs de configuração. */
export function SkeletonFormulario({ campos = 4, className }: { campos?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)} aria-busy="true">
      {Array.from({ length: campos }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Colunas de quadro (Kanban), com cartões em cada coluna. */
export function SkeletonColunas({ colunas = 3 }: { colunas?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy="true">
      {Array.from({ length: colunas }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/2" />
          {Array.from({ length: 3 }).map((__, j) => (
            <Skeleton key={j} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}
