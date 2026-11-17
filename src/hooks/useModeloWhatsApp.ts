import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MODELO_WHATSAPP_PADRAO, TIPO_MODELO_WHATSAPP } from '@/lib/whatsapp';

// O modelo é lido uma vez e partilhado por todos os botões da página.
let emCache: string | null = null;
let pedido: Promise<string> | null = null;
const ouvintes = new Set<(t: string) => void>();

async function carregar(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return MODELO_WHATSAPP_PADRAO;
  const { data, error } = await supabase
    .from('modelos_mensagem')
    .select('texto')
    .eq('usuario_id', user.id)
    .eq('tipo', TIPO_MODELO_WHATSAPP)
    .maybeSingle();
  // Sem modelo guardado (ou tabela ainda por criar): texto por omissão.
  if (error || !data?.texto?.trim()) return MODELO_WHATSAPP_PADRAO;
  return data.texto;
}

/** Atualiza o modelo em todos os botões abertos (depois de guardar nas Configurações). */
export function definirModeloWhatsApp(texto: string) {
  emCache = texto;
  ouvintes.forEach((f) => f(texto));
}

/** Modelo da mensagem do WhatsApp da marcação (o guardado, ou o texto por omissão). */
export function useModeloWhatsApp(): string {
  const [modelo, setModelo] = useState<string>(emCache ?? MODELO_WHATSAPP_PADRAO);

  useEffect(() => {
    ouvintes.add(setModelo);
    if (emCache === null) {
      pedido ??= carregar();
      pedido.then((t) => {
        emCache = t;
        setModelo(t);
      });
    }
    return () => {
      ouvintes.delete(setModelo);
    };
  }, []);

  return modelo;
}
