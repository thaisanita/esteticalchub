import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Scale, ShieldCheck, Briefcase } from 'lucide-react';

interface TermSection {
  number: string;
  title: string;
  content: React.ReactNode;
}

const sections: TermSection[] = [
  {
    number: '01',
    title: '1. Aceitação dos Termos e Elegibilidade',
    content:
      'Ao criar uma conta e utilizar o EstetiCalcHub, o utilizador concorda expressamente com as regras aqui descritas. O sistema destina-se ao uso profissional de gestão de clínicas e profissionais independentes, sendo o utilizador inteiramente responsável pela veracidade das informações de registo.',
  },
  {
    number: '02',
    title: '2. Limitação de Responsabilidade e Isenção Fiscal',
    content:
      'O EstetiCalcHub é uma ferramenta de apoio à gestão e cálculo de lucros estimados. O utilizador reconhece que a plataforma não substitui serviços de contabilidade certificada. Toda e qualquer obrigação fiscal, declaração de impostos (como o IVA ou IRS/IRC) e a conformidade com as leis em vigor são da exclusiva responsabilidade do utilizador.',
  },
  {
    number: '03',
    title: '3. Propriedade Intelectual e Uso Proibido',
    content: (
      <>
        Todo o código, design, marcas e funcionalidades do <strong>EstetiCalcHub</strong> são propriedade
        intelectual exclusiva do projeto. É estritamente proibido tentar copiar, modificar, sublicenciar,
        fazer engenharia reversa ou utilizar robôs que possam sobrecarregar a estabilidade da nossa
        infraestrutura.
      </>
    ),
  },
  {
    number: '04',
    title: '4. Suspensão de Contas e Modificações',
    content:
      'Reservamos o direito de suspender ou encerrar o acesso à plataforma a qualquer utilizador que viole estas diretrizes ou utilize o sistema para fins fraudulentos. Estes termos podem ser atualizados periodicamente para refletir melhorias no sistema, sendo a versão mais recente sempre pública nesta página.',
  },
];

const Termos = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-border bg-background/80 px-[8%] py-4 backdrop-blur-md">
        <div onClick={() => navigate('/')} className="flex cursor-pointer items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover">
            <Sparkles size={16} className="text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">
            Esteti<span className="text-primary">Calc</span>Hub
          </span>
        </div>
        <Button onClick={() => navigate('/')} size="sm" className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground hover:opacity-90">
          ← Voltar para o Login
        </Button>
      </nav>

      <div className="mx-auto max-w-3xl px-[8%] pb-10 pt-14">
        <span className="mb-5 inline-block rounded-full bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
          Documento Legal
        </span>
        <h1 className="font-display mb-3.5 text-[38px] leading-[1.15] text-foreground">
          Termos de Uso
          <br />e Serviço
        </h1>
        <p className="mb-7 text-[13px] font-medium text-muted-foreground">Última atualização: Junho de 2026</p>
        <div className="h-[3px] w-[60px] rounded bg-gradient-to-r from-primary to-primary-hover" />
      </div>

      <main className="mx-auto max-w-3xl px-[8%] pb-16">
        {sections.map((sec) => (
          <div
            key={sec.number}
            className="mb-4 flex gap-6 rounded-2xl border border-border bg-card p-7 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
          >
            <div className="font-display shrink-0 pt-0.5 text-[32px] font-bold text-border">
              {sec.number}
            </div>
            <div className="flex-1">
              <h2 className="font-display mb-2.5 text-base font-bold text-foreground">{sec.title}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground">{sec.content}</div>
            </div>
          </div>
        ))}

        <div className="my-7 flex flex-wrap gap-3">
          {[
            { icon: Scale, texto: 'Uso Comercial Autorizado' },
            { icon: ShieldCheck, texto: 'Proteção de Conta' },
            { icon: Briefcase, texto: 'Foco Profissional' },
          ].map((badge) => (
            <div
              key={badge.texto}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
            >
              <badge.icon size={13} />
              {badge.texto}
            </div>
          ))}
        </div>

        <p
          onClick={() => navigate('/')}
          className="mt-2.5 inline-block cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Voltar ao sistema
        </p>
      </main>

      <footer className="border-t border-border py-7 text-center text-xs text-muted-foreground">
        © 2026 EstetiCalcHub — Compromisso com a Transparência.
      </footer>
    </div>
  );
};

export default Termos;