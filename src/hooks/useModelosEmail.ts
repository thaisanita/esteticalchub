import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { ModeloGuardado, TipoEmail } from '@/lib/mensagens';

/** Modelos de email guardados pela utilizadora (por tipo) + o nome dela. */
export function useModelosEmail() {
  const [modelos, setModelos] = useState<Partial<Record<TipoEmail, ModeloGuardado>>>({});
  const [nomeProfissional, setNomeProfissional] = useState('');
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }
    const meta = user.user_metadata ?? {};
    setNomeProfissional(String(meta.full_name || meta.name || '').trim());
    const { data } = await supabase
      .from('modelos_mensagem')
      .select('tipo, assunto, texto, ativo, espera_horas, espera_dias, hora_envio, link_avaliacao')
      .eq('usuario_id', user.id)
      .like('tipo', 'email_%');
    const porTipo: Partial<Record<TipoEmail, ModeloGuardado>> = {};
    for (const m of (data as ModeloGuardado[]) ?? []) porTipo[m.tipo as TipoEmail] = m;
    setModelos(porTipo);
    setCarregando(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { modelos, nomeProfissional, carregando, recarregar };
}

/** Grava (cria ou atualiza) o modelo de um tipo. */
export async function guardarModeloEmail(tipo: TipoEmail, campos: Omit<ModeloGuardado, 'tipo'>) {
  const { data: { user } } = await supabase.auth.getUser();
  return supabase
    .from('modelos_mensagem')
    .upsert(
      { usuario_id: user?.id, tipo, ...campos, updated_at: new Date().toISOString() },
      { onConflict: 'usuario_id,tipo' },
    );
}
