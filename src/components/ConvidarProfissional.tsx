import { useEffect, useState } from 'react';
import { Users, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { URL_PUBLICO } from '@/lib/empresa';

/**
 * Convite para a agenda partilhada. Só aparece para a dona da equipa — uma
 * convidada não pode convidar mais ninguém nesta versão.
 */
export default function ConvidarProfissional() {
  const [papel, setPapel] = useState<string | null>(null);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('equipe_membros')
        .select('equipe_id, papel')
        .eq('user_id', user.id)
        .maybeSingle();
      setPapel(data?.papel ?? null);
      setEquipeId(data?.equipe_id ?? null);
    });
  }, []);

  const convidar = async () => {
    if (!equipeId) return;
    setAGerar(true);
    setErro(null);
    setCopiado(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { data, error } = await supabase
        .from('equipe_convites')
        .insert({ equipe_id: equipeId, criado_por: user.id })
        .select('token')
        .single();
      if (error) throw error;

      const novoLink = `${URL_PUBLICO}/convite/${data.token}`;
      setLink(novoLink);
      try {
        await navigator.clipboard.writeText(novoLink);
        setCopiado(true);
      } catch {
        // clipboard pode estar bloqueado; o link continua visível para copiar à mão
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o convite.');
    } finally {
      setAGerar(false);
    }
  };

  // Só a dona da equipa convida — uma convidada não vê nada deste bloco.
  if (papel !== 'dona') return null;

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
          <Users size={18} className="text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">Equipa</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Convida outra profissional para partilhar a agenda e as clientes. Os teus custos, relatórios e metas
            continuam privados.
          </div>
        </div>
      </div>

      <Button onClick={convidar} disabled={aGerar || !equipeId} size="sm" className="gap-1.5">
        {aGerar ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
        {aGerar ? 'A gerar...' : 'Convidar profissional'}
      </Button>

      {link && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 p-2.5 text-xs">
          <span className="flex-1 truncate text-muted-foreground">{link}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
              } catch {
                // ignora
              }
            }}
            title="Copiar link"
            className="flex shrink-0 items-center gap-1 text-primary"
          >
            {copiado ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      {link && (
        <p className="text-[11px] text-muted-foreground">
          Válido por 7 dias. A convidada só consegue aceitar se ainda não tiver clientes nem agendamentos
          próprios.
        </p>
      )}
      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
