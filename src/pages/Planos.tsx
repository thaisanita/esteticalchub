import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { usePlan, LIMITE_CLIENTES_FREE, LIMITE_AGENDAMENTOS_MES_FREE } from '@/hooks/usePlan';
import { STRIPE_PRICE_IDS } from '@/config/stripe';

// Só o que está bloqueado por plano no código. Exportar dados é um direito
// (RGPD, portabilidade) e fica sempre disponível, também no grátis.
const BENEFICIOS_PRO = [
  'Clientes e agendamentos ilimitados',
  'Assistente IA',
];

export default function Planos() {
  const { plano, loading: carregandoPlano } = usePlan();
  const [searchParams] = useSearchParams();
  const [expiraEm, setExpiraEm] = useState<string | null>(null);
  const [aCarregarCheckout, setACarregarCheckout] = useState<'mensal' | 'anual' | null>(null);
  const [aAbrirPortal, setAAbrirPortal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('plan_expires_at')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => setExpiraEm(data?.plan_expires_at ?? null));
    });
  }, []);

  const assinar = async (priceId: string, chave: 'mensal' | 'anual') => {
    setErro(null);
    setACarregarCheckout(chave);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase.functions.invoke<{ url?: string; erro?: string }>(
        'stripe-checkout',
        { body: { price_id: priceId, user_id: user.id } }
      );
      if (error) throw new Error(error.message || 'Falha ao iniciar o pagamento.');
      if (data?.erro) throw new Error(data.erro);
      if (!data?.url) throw new Error('O Stripe não devolveu um link de pagamento.');

      window.location.href = data.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar o pagamento.');
      setACarregarCheckout(null);
    }
  };

  const gerirSubscricao = async () => {
    setErro(null);
    setAAbrirPortal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase.functions.invoke<{ url?: string; erro?: string }>(
        'stripe-portal',
        { body: { user_id: user.id } }
      );
      if (error) throw new Error(error.message || 'Falha ao abrir o portal.');
      if (data?.erro) throw new Error(data.erro);
      if (!data?.url) throw new Error('O Stripe não devolveu o link do portal.');

      window.location.href = data.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o portal.');
      setAAbrirPortal(false);
    }
  };

  const ehPro = plano === 'pro';
  const aCarregarAlgumCheckout = aCarregarCheckout !== null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Planos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolhe o plano que melhor se adapta ao teu negócio.
        </p>
      </div>

      {searchParams.get('sucesso') === 'true' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          Pagamento confirmado! O teu plano Pro já está ativo.
        </div>
      )}
      {erro && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {erro}
        </div>
      )}

      {!carregandoPlano && ehPro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Já és Pro 🎉</p>
            {expiraEm && (
              <p className="text-xs text-muted-foreground">
                Renova em {new Date(expiraEm).toLocaleDateString('pt-PT')}
              </p>
            )}
          </div>
          <button
            onClick={gerirSubscricao}
            disabled={aAbrirPortal}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {aAbrirPortal && <Loader2 size={14} className="animate-spin" />}
            Gerir subscrição
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Grátis */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-bold text-foreground">Grátis</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">€0</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-primary" /> Até {LIMITE_CLIENTES_FREE} clientes
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-primary" /> Até {LIMITE_AGENDAMENTOS_MES_FREE}{' '}
              agendamentos/mês
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-primary" /> Exportar os teus dados
            </li>
          </ul>
          <button
            disabled
            className="mt-5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-80"
          >
            {!carregandoPlano && !ehPro ? 'Plano atual' : 'Começar grátis'}
          </button>
        </div>

        {/* Pro Mensal */}
        <div className="flex flex-col rounded-2xl border-2 border-primary bg-card p-6 shadow-lg shadow-primary/10">
          <h3 className="font-display text-lg font-bold text-foreground">Pro Mensal</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            €9,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground">
            {BENEFICIOS_PRO.map((beneficio) => (
              <li key={beneficio} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-primary" /> {beneficio}
              </li>
            ))}
          </ul>
          <button
            onClick={() => assinar(STRIPE_PRICE_IDS.mensal, 'mensal')}
            disabled={ehPro || aCarregarAlgumCheckout}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {aCarregarCheckout === 'mensal' && <Loader2 size={14} className="animate-spin" />}
            {ehPro ? 'Plano atual' : 'Assinar'}
          </button>
        </div>

        {/* Pro Anual */}
        <div className="relative flex flex-col rounded-2xl border border-border bg-card p-6">
          <span className="absolute -top-3 right-5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
            Poupa 33%
          </span>
          <h3 className="font-display text-lg font-bold text-foreground">Pro Anual</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            €79<span className="text-sm font-normal text-muted-foreground">/ano</span>
          </p>
          <p className="text-xs text-muted-foreground">equivalente a €6,60/mês</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-primary" /> Tudo do Pro Mensal
            </li>
          </ul>
          <button
            onClick={() => assinar(STRIPE_PRICE_IDS.anual, 'anual')}
            disabled={ehPro || aCarregarAlgumCheckout}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
          >
            {aCarregarCheckout === 'anual' && <Loader2 size={14} className="animate-spin" />}
            {ehPro ? 'Plano atual' : 'Assinar'}
          </button>
        </div>
      </div>

      {!ehPro && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles size={13} /> Podes cancelar a qualquer momento, sem compromisso.
        </p>
      )}
    </div>
  );
}
