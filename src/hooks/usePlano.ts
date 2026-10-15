import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';

export type Plano = 'free' | 'pro';

/**
 * As únicas funções exclusivas do plano Pro. Tudo o resto da app é
 * grátis e sem limites — não adicionar mais nada aqui sem atualizar
 * também o texto de /planos.
 */
export const PRO_FEATURES = ['assistente_ia', 'lembretes_whatsapp'] as const;
export type ProFeature = (typeof PRO_FEATURES)[number];

/**
 * Interruptor geral: enquanto a configuração do Stripe/WhatsApp não estiver
 * pronta, desliga aqui o Assistente IA, os lembretes automáticos por
 * WhatsApp e a página /planos — ficam completamente escondidos de quem usa
 * a app, mas o código continua todo cá para retomares a configuração depois.
 * Para reativar, troca para `true`.
 */
export const FUNCIONALIDADES_PRO_ATIVAS = false;

/**
 * Plano atual da profissional logada. Único sítio que lê profiles.plan —
 * qualquer verificação de "isto é Pro?" na app passa por aqui.
 */
export function usePlano() {
  const [plano, setPlano] = useState<Plano>('free');
  const [loading, setLoading] = useState(true);

  // Nome de canal único por instância: usePlano() é chamado em vários
  // sítios ao mesmo tempo, e o cliente do Supabase devolve o MESMO canal
  // quando dois sítios pedem o mesmo nome (dá erro ao subscrever duas vezes).
  const nomeCanalRef = useRef(`use-plano-${Math.random().toString(36).slice(2)}`);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    if (error) console.error('Erro ao carregar plano:', error.message);
    // Sem linha em profiles = conta nunca assinou nada = plano grátis.
    setPlano((data?.plan as Plano) ?? 'free');
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();

    // Tempo real: atualiza assim que o webhook do Stripe mudar profiles.plan,
    // sem precisar de recarregar a página.
    const canal = supabase
      .channel(nomeCanalRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, carregar)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  return { plano, isPro: plano === 'pro', loading };
}
