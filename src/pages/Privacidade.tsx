import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, ShieldCheck, Ban } from 'lucide-react';

const sections = [
  {
    number: '01',
    title: '1. Recolha de Dados',
    content:
      'O EstetiCalcHub recolhe apenas as informações estritamente necessárias para a gestão do seu negócio, como e-mail e nome da clínica, fornecidos voluntariamente através do registo direto ou via Google Auth.',
  },
  {
    number: '02',
    title: '2. Utilização e Salvaguarda dos Dados',
    content:
      'Os seus dados e os dados de agendamentos introduzidos na plataforma são utilizados exclusivamente para o funcionamento da agenda e geração automática de relatórios financeiros. O EstetiCalcHub atua como mero processador destes dados e garante que não partilha, vende ou cede qualquer informação a terceiros.',
  },
  {
    number: '03',
    title: '3. Segurança (Google & Supabase)',
    content: (
      <>
        Utilizamos a infraestrutura tecnológica do <strong>Supabase</strong> e a autenticação segura da{' '}
        <strong>Google</strong> para garantir que as credenciais e todas as informações sensíveis sejam
        encriptadas e protegidas contra acessos não autorizados.
      </>
    ),
  },
  {
    number: '04',
    title: '4. Os Seus Direitos (RGPD)',
    content:
      'Em conformidade com o RGPD, o utilizador tem total controlo sobre os seus dados. A qualquer momento, poderá solicitar ou realizar a eliminação definitiva da sua conta e de todos os registos associados através das definições do sistema. Para qualquer questão, contacte-nos em: suporte.esteticalchub@gmail.com',
  },
];

const Privacidade = () => {
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
          Política de Privacidade
          <br />e Segurança
        </h1>
        <p className="mb-7 text-[13px] font-medium text-muted-foreground">Última atualização: Fevereiro de 2026</p>
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
              <p className="text-sm leading-relaxed text-muted-foreground">{sec.content}</p>
            </div>
          </div>
        ))}

        <div className="my-7 flex flex-wrap gap-3">
          {[
            { icon: Lock, texto: 'SSL Encriptado' },
            { icon: ShieldCheck, texto: 'RGPD Conforme' },
            { icon: Ban, texto: 'Sem Anúncios' },
          ].map((badge) => (
            <div
              key={badge.texto}
              className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-xs font-semibold text-success"
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

export default Privacidade;