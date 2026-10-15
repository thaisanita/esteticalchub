import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getErrorMessage } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Megaphone, TrendingDown, MousePointerClick, Target } from 'lucide-react';
import { SkeletonLinhas } from '@/components/ui/skeleton';

interface Campanha {
  conta: string;
  campanha: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  resultados: number;
  custoPorResultado: number | null;
}

export default function TrafegoPago() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [periodo, setPeriodo] = useState<'7d' | '30d'>('30d');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase.functions.invoke('meta-ads-insights', {
        body: { periodo },
      });

      if (error) throw error;
      if (data?.erro) throw new Error(data.erro);

      setCampanhas(data?.campanhas || []);
      if (data?.aviso) setAviso(data.aviso);
      if (data?.avisos?.length) setAviso(data.avisos.join(' '));
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalGasto = campanhas.reduce((acc, c) => acc + c.gasto, 0);
  const totalResultados = campanhas.reduce((acc, c) => acc + c.resultados, 0);
  const custoMedioPorResultado = totalResultados > 0 ? totalGasto / totalResultados : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Tráfego Pago
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gasto e resultados das tuas campanhas de Meta Ads, por campanha
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Megaphone size={18} />
          </div>
          <Select
            value={periodo}
            onValueChange={(v) => setPeriodo(v as '7d' | '30d')}
            items={[
              { value: '7d', label: 'Últimos 7 dias' },
              { value: '30d', label: 'Últimos 30 dias' },
            ]}
          >
            <SelectTrigger className="h-9 w-[140px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingDown size={12} /> Gasto total
          </p>
          <p className="font-display text-2xl font-bold text-foreground mt-1">€ {totalGasto.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Target size={12} /> Resultados
          </p>
          <p className="font-display text-2xl font-bold text-foreground mt-1">{totalResultados}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MousePointerClick size={12} /> Custo por resultado
          </p>
          <p className="font-display text-2xl font-bold text-foreground mt-1">
            {custoMedioPorResultado !== null ? `€ ${custoMedioPorResultado.toFixed(2)}` : '—'}
          </p>
        </div>
      </div>

      {erro && (
        <div className="rounded-2xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">
          {erro}
        </div>
      )}

      {aviso && !erro && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-600">
          {aviso}
        </div>
      )}

      {loading ? (
        <SkeletonLinhas linhas={4} />
      ) : campanhas.length === 0 && !erro ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há dados de campanhas para mostrar. Liga uma conta de anúncios em Configurações →
          Tráfego pago.
        </div>
      ) : (
        <div className="space-y-2">
          {campanhas.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.campanha}</p>
                  <p className="text-xs text-muted-foreground">{c.conta}</p>
                </div>
                <p className="font-display text-base font-bold text-foreground tabular-nums shrink-0">
                  € {c.gasto.toFixed(2)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background/50 py-2">
                  <p className="text-sm font-bold text-foreground">{c.impressoes.toLocaleString('pt-PT')}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Impressões</p>
                </div>
                <div className="rounded-lg bg-background/50 py-2">
                  <p className="text-sm font-bold text-foreground">{c.cliques.toLocaleString('pt-PT')}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Cliques</p>
                </div>
                <div className="rounded-lg bg-background/50 py-2">
                  <p className="text-sm font-bold text-primary">{c.resultados}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Resultados</p>
                </div>
              </div>
              {c.custoPorResultado !== null && (
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  € {c.custoPorResultado.toFixed(2)} por resultado
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
