// Painel "Tráfego pago" em Configurações — a profissional liga a sua conta
// de anúncios da Meta (Facebook/Instagram Ads) para ver o detalhe por
// campanha em /trafego-pago. O token de acesso fica como secret da Edge
// Function (META_ACCESS_TOKEN), nunca nesta tabela.
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/utils';
import { confirmar } from '@/components/ConfirmDialog';
import { Loader2, Plus, Trash2, Megaphone } from 'lucide-react';

interface ContaAds {
  id: string;
  ad_account_id: string;
  nome: string | null;
}

export default function TrafegoPagoConfig() {
  const [contas, setContas] = useState<ContaAds[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [adAccountId, setAdAccountId] = useState('');
  const [nome, setNome] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('meta_ads_contas')
      .select('id, ad_account_id, nome')
      .order('criado_em', { ascending: false });

    if (!error) setContas(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ligarConta = async () => {
    setErro(null);
    const idLimpo = adAccountId.trim().replace(/\D/g, '');
    if (!idLimpo) {
      setErro('Indica o ID da conta de anúncios (só números, sem "act_").');
      return;
    }
    setAGuardar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { error } = await supabase.from('meta_ads_contas').insert({
        user_id: user.id,
        ad_account_id: idLimpo,
        nome: nome.trim() || null,
      });
      if (error) throw error;

      setAdAccountId('');
      setNome('');
      await carregar();
      toast.success('Conta de anúncios ligada.');
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setAGuardar(false);
    }
  };

  const removerConta = async (id: string) => {
    const ok = await confirmar({ descricao: 'Desligar esta conta de anúncios?', destrutivo: true, textoConfirmar: 'Desligar' });
    if (!ok) return;
    const { error } = await supabase.from('meta_ads_contas').delete().eq('id', id);
    if (!error) {
      setContas((prev) => prev.filter((c) => c.id !== id));
      toast.success('Conta desligada.');
    } else {
      toast.error('Erro ao desligar: ' + error.message);
    }
  };

  if (carregando) {
    return <Loader2 size={16} className="animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-3">
      {contas.length > 0 && (
        <div className="space-y-1.5">
          {contas.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <Megaphone size={14} className="text-primary" />
                <span className="font-medium text-foreground">{c.nome || 'Conta de anúncios'}</span>
                <span className="text-xs text-muted-foreground">act_{c.ad_account_id}</span>
              </div>
              <button
                onClick={() => removerConta(c.id)}
                className="text-muted-foreground hover:text-danger"
                aria-label="Desligar conta"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            ID da conta de anúncios
          </label>
          <Input
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value)}
            placeholder="Ex.: 839558773956570"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nome (opcional)
          </label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Estúdio Lumi" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Encontras o ID em Gestor de Anúncios → nome da conta → só os números, sem o prefixo "act_".
      </p>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <Button onClick={ligarConta} disabled={aGuardar} size="sm" className="gap-1.5">
        {aGuardar ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Ligar conta
      </Button>
    </div>
  );
}
