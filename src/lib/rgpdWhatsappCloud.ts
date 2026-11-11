// RGPD — dados da integração WhatsApp Cloud API (preparado, DESLIGADO).
//
// Enquanto EXPORTACAO_WHATSAPP_CLOUD_ATIVA = false, a exportação de dados
// ("Os meus dados") comporta-se exatamente como hoje. Ligar só DEPOIS de a
// migration supabase_migration_whatsapp_cloud.sql estar aplicada.
//
// Eliminação: as tabelas novas ligam-se a auth.users / clientes com
// ON DELETE CASCADE, por isso a eliminação de conta atual (excluir-conta →
// auth.admin.deleteUser) já as apaga. Existe ainda a função
// whatsapp_cloud_eliminar_dados_profissional(uuid) para uso explícito.
import type { SupabaseClient } from '@supabase/supabase-js';

export const EXPORTACAO_WHATSAPP_CLOUD_ATIVA = false;

/** Devolve { adesao, consentimentos, envios } da profissional autenticada, ou null. */
export async function exportarDadosWhatsappCloud(cliente: SupabaseClient): Promise<unknown | null> {
  if (!EXPORTACAO_WHATSAPP_CLOUD_ATIVA) return null;
  const { data, error } = await cliente.rpc('whatsapp_cloud_exportar_meus_dados');
  return error ? null : data;
}
