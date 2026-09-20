// Estrutura comum das páginas legais (Termos de Uso, Política de Privacidade).
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { DATA_ATUALIZACAO_LEGAL, EMPRESA, identificacaoPrestador } from '@/lib/empresa';

export interface SecaoLegal {
  titulo: string;
  conteudo: ReactNode;
}

interface Props {
  titulo: string;
  secoes: SecaoLegal[];
  /** Blocos extra (ex.: anexo, tabelas) mostrados depois das secções numeradas. */
  extra?: ReactNode;
}

export default function PaginaLegal({ titulo, secoes, extra }: Props) {
  const navigate = useNavigate();
  const identificacao = identificacaoPrestador();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-border bg-background/80 px-[6%] py-4 backdrop-blur-md">
        <div onClick={() => navigate('/')} className="flex cursor-pointer items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover">
            <Sparkles size={16} className="text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">
            Esteti<span className="text-primary">Calc</span>Hub
          </span>
        </div>
        <Button
          onClick={() => navigate('/')}
          size="sm"
          className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground hover:opacity-90"
        >
          ← Voltar
        </Button>
      </nav>

      <div className="mx-auto max-w-3xl px-[6%] pb-8 pt-12">
        <span className="mb-5 inline-block rounded-full bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
          Documento Legal
        </span>
        <h1 className="font-display mb-3.5 text-[34px] leading-[1.15] text-foreground">{titulo}</h1>
        <p className="mb-5 text-[13px] font-medium text-muted-foreground">
          Última atualização: {DATA_ATUALIZACAO_LEGAL}
        </p>
        <div className="h-[3px] w-[60px] rounded bg-gradient-to-r from-primary to-primary-hover" />
      </div>

      <main className="mx-auto max-w-3xl px-[6%] pb-16">
        {secoes.map((sec, i) => (
          <section key={sec.titulo} className="mb-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display mb-2.5 text-base font-bold text-foreground">
              {i + 1}. {sec.titulo}
            </h2>
            <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">{sec.conteudo}</div>
          </section>
        ))}

        {extra}

        <p
          onClick={() => navigate('/')}
          className="mt-4 inline-block cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Voltar ao sistema
        </p>
      </main>

      <footer className="border-t border-border px-4 py-7 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} {EMPRESA.nomeComercial}
          {identificacao && <> — {identificacao}</>}
        </p>
        <p className="mt-1">
          <a href={`mailto:${EMPRESA.email}`} className="hover:text-primary">
            {EMPRESA.email}
          </a>
        </p>
      </footer>
    </div>
  );
}
