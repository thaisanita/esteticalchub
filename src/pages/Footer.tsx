import { useNavigate } from 'react-router-dom';
import { EMPRESA, identificacaoPrestador } from '@/lib/empresa';

const linkClasses =
  'text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary outline-none focus-visible:underline';

const Footer = () => {
  const navigate = useNavigate();
  const identificacao = identificacaoPrestador();

  return (
    <footer className="flex w-full flex-col items-center justify-center gap-3 border-t border-border px-5 py-10">
      {/* Links de Navegação */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={() => navigate('/privacidade')} className={linkClasses}>
          Política de Privacidade
        </button>

        <span className="select-none text-xs text-border">•</span>

        <button type="button" onClick={() => navigate('/termos-de-uso')} className={linkClasses}>
          Termos de Uso
        </button>

        <span className="select-none text-xs text-border">•</span>

        <a href={`mailto:${EMPRESA.email}`} className={linkClasses}>
          Contacto
        </a>

        {EMPRESA.livroReclamacoesUrl && (
          <>
            <span className="select-none text-xs text-border">•</span>
            <a href={EMPRESA.livroReclamacoesUrl} target="_blank" rel="noopener noreferrer" className={linkClasses}>
              Livro de Reclamações
            </a>
          </>
        )}
      </div>

      {/* Identificação do prestador (Decreto-Lei n.º 7/2004, art. 10.º) */}
      {identificacao && (
        <p className="max-w-xl text-center text-[11px] leading-relaxed text-muted-foreground">{identificacao}</p>
      )}

      {/* Copyright */}
      <div className="flex items-center justify-center text-xs tracking-wide text-muted-foreground">
        <span>
          © {new Date().getFullYear()}{' '}
          <strong className="font-bold text-foreground">
            Esteti<span className="text-primary">Calc</span>Hub
          </strong>
        </span>
        <span className="mx-2 text-border">•</span>
        <span>Sistema de Gestão Profissional</span>
      </div>

      <p className="max-w-md text-center text-[11px] leading-relaxed text-muted-foreground/80">
        Usamos apenas armazenamento estritamente necessário (sessão e preferências). Sem cookies de publicidade
        ou análise.
      </p>
    </footer>
  );
};

export default Footer;
