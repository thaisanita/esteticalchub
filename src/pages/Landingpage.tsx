import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import Footer from './Footer';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  ShieldCheck,
  Calendar, 
  TrendingUp, 
  Receipt, 
  ArrowRight,
  Clock,
  DollarSign,
  Users,
  ChevronRight
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Direciona para a tela de Login normal
  const irParaLogin = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Direciona direto para a aba de Cadastro
  const irParaRegistro = async () => {
    await supabase.auth.signOut();
    navigate('/login?modo=registro');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      <style>{`
        @keyframes ech-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(24px, -18px) scale(1.06); }
        }
        @keyframes ech-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 20px) scale(1.08); }
        }
        .ech-orb-a { animation: ech-drift 12s ease-in-out infinite; }
        .ech-orb-b { animation: ech-drift-2 14s ease-in-out infinite; }
      `}</style>

      {/* Glow Ambient Orbs */}
      <div
        className="ech-orb-a pointer-events-none absolute left-[-100px] top-[-50px] h-[500px] w-[500px] rounded-full opacity-20 blur-[130px]"
        style={{ background: '#7C3AED' }}
      />
      <div
        className="ech-orb-b pointer-events-none absolute right-[-100px] top-[250px] h-[450px] w-[450px] rounded-full opacity-15 blur-[120px]"
        style={{ background: '#EC4899' }}
      />

      {/* Navbar Minimalista */}
      <nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-border/60 bg-background/70 px-6 sm:px-[8%] py-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover shadow-md shadow-primary/20">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Esteti<span className="text-primary">Calc</span>Hub
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={irParaLogin}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Entrar
          </Button>
          <Button 
            onClick={irParaRegistro}
            className="text-xs font-semibold bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md shadow-primary/25 hover:opacity-95 transition-all rounded-xl px-4 py-2 cursor-pointer"
          >
            Experimentar Grátis
          </Button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 sm:pt-20 pb-12 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold tracking-wide">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>Software de Gestão Especializado para Estética</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12] max-w-4xl mx-auto">
          Sua clínica organizada, agendamentos pontuais e{' '}
          <span className="bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#F59E0B] bg-clip-text text-transparent">
            lucro real sob controle.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Centralize o cálculo exato de custos de insumos, comissões, faturamento e agenda em uma única plataforma feita para profissionais independentes e clínicas.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Button 
            onClick={irParaRegistro}
            className="w-full sm:w-auto h-12 px-8 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground font-semibold text-sm shadow-xl shadow-primary/25 hover:opacity-90 flex items-center justify-center gap-2 rounded-xl transition-transform active:scale-95 cursor-pointer"
          >
            Criar Conta Grátis <ArrowRight size={16} />
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Sem necessidade de cartão de crédito</span>
          </div>
        </div>

        {/* MOCKUP DO SISTEMA */}
        <div className="pt-8">
          <div className="relative mx-auto max-w-4xl rounded-2xl border border-border bg-card/90 p-3 shadow-2xl shadow-primary/10 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 px-3 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-400/80" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground/70">app.esteticalchub.com</span>
              <div className="w-12" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left p-1 sm:p-2">
              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Faturamento Mensal</span>
                  <DollarSign size={16} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-display text-foreground">€ 4.850,00</div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                  <TrendingUp size={13} />
                  <span>+18.4% vs. mês anterior</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Próximo Atendimento</span>
                  <Clock size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Microblading Tebori</div>
                  <div className="text-xs text-muted-foreground">Cliente: Maria Silva • 14:30</div>
                </div>
                <span className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  Confirmado
                </span>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Lucro Líquido Calculado</span>
                  <Receipt size={16} className="text-pink-500" />
                </div>
                <div className="text-2xl font-bold font-display text-foreground">68.5%</div>
                <div className="text-[11px] text-muted-foreground">
                  Descontados materiais, custos fixos e impostos
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL / MÉTRICAS */}
      <section className="border-y border-border bg-card/40 py-8 relative z-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">+100%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Precisão nos Custos</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
            <div className="text-xs text-muted-foreground mt-0.5">Agenda Acessível</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">0 min</div>
            <div className="text-xs text-muted-foreground mt-0.5">Tempo Perdido com Papel</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">100%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Na Nuvem e Seguro</div>
          </div>
        </div>
      </section>

      {/* RECURSOS EM BENTO GRID */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Funcionalidades Essenciais</span>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-foreground">
            Desenhado para a rotina real de estética
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/30 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Calendar size={20} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">Agenda Visual e Inteligente</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Visualize seus compromissos por dia ou mês. Evite choques de horário e acompanhe o status de cada cliente (confirmado, finalizado ou cancelado) instantaneamente.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/50 p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>Organização simplificada de horários</span>
              <ChevronRight size={16} className="text-primary" />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/30 transition-colors space-y-4">
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Custo por Procedimento</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Descubra quanto custa cada ml de pigmento, lâmina de tebori ou insumo utilizado. Nunca mais cobres abaixo do valor correto.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/30 transition-colors space-y-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Relatórios de Lucro Real</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Saiba exatamente quanto entra de lucro limpo e quanto deve ser separado para contas fixas, impostos e reposição de estoque.
            </p>
          </div>

          <div className="md:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-sm hover:border-primary/30 transition-colors space-y-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Users size={20} />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Divisão de Porcentagens & Parcerias</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Se você trabalha em espaço compartilhado ou tem parceiros na clínica, o sistema calcula a divisão percentual exata de cada procedimento automaticamente.
            </p>
          </div>
        </div>
      </section>

      {/* BANNER CTA FINAL */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20 text-center">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent p-8 sm:p-12 space-y-5 backdrop-blur-md">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-foreground">
            Comece a organizar sua clínica hoje
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Crie sua conta em segundos e tenha total controle dos seus agendamentos e finanças.
          </p>
          <Button 
            onClick={irParaRegistro}
            className="h-11 px-8 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground font-semibold text-xs shadow-lg shadow-primary/30 hover:opacity-90 rounded-xl cursor-pointer"
          >
            Criar Conta Gratuitamente
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}