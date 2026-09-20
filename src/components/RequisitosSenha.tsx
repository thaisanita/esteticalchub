import { CheckCircle2, Circle } from 'lucide-react';
import type { AvaliacaoSenha } from '@/lib/senha';

// Lista de requisitos que vai ficando verde à medida que a pessoa escreve.
export default function RequisitosSenha({ avaliacao }: { avaliacao: AvaliacaoSenha }) {
  return (
    <ul className="mt-1 space-y-1">
      {avaliacao.requisitos.map((r) => (
        <li
          key={r.texto}
          className={`flex items-center gap-1.5 text-[11.5px] ${r.ok ? 'text-success' : 'text-muted-foreground'}`}
        >
          {r.ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
          {r.texto}
        </li>
      ))}
    </ul>
  );
}
