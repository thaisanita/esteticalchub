// "Os meus dados": exportar tudo (portabilidade, RGPD art. 20.º) e eliminar a
// conta com todos os dados (apagamento, art. 17.º). A eliminação é feita pela
// Edge Function `excluir-conta`.
import { useState } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/utils';
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';

// Nome (slug) com que a função foi publicada no Supabase. O código dela está em
// supabase/functions/excluir-conta/index.ts — o painel do Supabase gerou este nome.
const FUNCAO_EXCLUIR_CONTA = 'rapid-worker';

const TABELAS_EXPORTAVEIS = [
  'clientes',
  'agendamentos',
  'prontuarios',
  'custos_fixos',
  'se_custos',
  'produtos',
  'produto_usos',
  'fechamentos',
  'metas_mensais',
  'quadros_kanban',
  'listas_kanban',
  'cartoes_kanban',
  'fila_notificacoes',
  'paginas_publicas',
  'configuracoes_usuario',
];

export default function DadosEConta() {
  const [exportando, setExportando] = useState(false);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [emailConta, setEmailConta] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exportar = async () => {
    setExportando(true);
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entre novamente.');

      const dados: Record<string, unknown> = {
        exportado_em: new Date().toISOString(),
        conta: { email: user.email, id: user.id },
      };
      for (const tabela of TABELAS_EXPORTAVEIS) {
        const { data, error } = await supabase.from(tabela).select('*');
        if (!error && data) dados[tabela] = data;
      }

      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estetichub-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(getErrorMessage(e));
    } finally {
      setExportando(false);
    }
  };

  const abrirDialogo = async () => {
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    setEmailConta(user?.email ?? '');
    setDialogoAberto(true);
  };

  const eliminar = async () => {
    setEliminando(true);
    setErro(null);
    try {
      // Chamada direta (em vez de supabase.functions.invoke) para vermos sempre a
      // resposta verdadeira da função, mesmo quando falha.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Entre novamente.');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCAO_EXCLUIR_CONTA}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });
      const texto = await resp.text();
      let corpo: { erro?: string; falhas?: string[]; ok?: boolean; message?: string } = {};
      try {
        corpo = JSON.parse(texto);
      } catch {
        // resposta que não é JSON: mostramos o texto cru abaixo
      }

      if (!resp.ok || !corpo.ok) {
        const falhas = corpo.falhas?.length ? ` (${corpo.falhas.join('; ')})` : '';
        throw new Error(
          `[HTTP ${resp.status}] ${corpo.erro || corpo.message || texto.slice(0, 300) || 'sem resposta'}${falhas}`
        );
      }

      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (e) {
      setDialogoAberto(false);
      setErro(`Não foi possível eliminar a conta: ${getErrorMessage(e)}. Se o problema continuar, escreva para o suporte.`);
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Descarregue uma cópia de todos os seus dados (clientes, agendamentos, custos, etc.) em formato JSON.
        </p>
        <Button size="sm" variant="outline" onClick={exportar} disabled={exportando} className="shrink-0 gap-1.5">
          {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
        <p className="text-xs font-semibold text-danger">Eliminar conta</p>
        <p className="text-[11px] text-muted-foreground">
          Apaga definitivamente a sua conta e todos os dados (clientes, agendamentos, prontuários, ficheiros e
          ligação ao WhatsApp). Não pode ser desfeito. Exporte primeiro, se quiser guardar uma cópia.
        </p>
        <Button size="sm" variant="destructive" onClick={abrirDialogo} className="gap-1.5">
          <Trash2 size={14} />
          Eliminar conta
        </Button>
      </div>

      <Dialog open={dialogoAberto} onOpenChange={(aberto) => !eliminando && setDialogoAberto(aberto)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle size={16} /> Tem certeza que quer eliminar a conta?
            </DialogTitle>
            <DialogDescription>
              Vai apagar <strong className="text-foreground">{emailConta || 'esta conta'}</strong> e todos os dados
              dela, definitivamente. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAberto(false)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={eliminar} disabled={eliminando} className="gap-1.5">
              {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Sim, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
