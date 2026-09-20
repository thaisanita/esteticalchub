// "Os meus dados": exportar tudo (portabilidade, RGPD art. 20.º) e eliminar a
// conta com todos os dados (apagamento, art. 17.º). A eliminação é feita pela
// Edge Function `excluir-conta`.
import { useState } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/utils';
import { Download, Trash2, Loader2 } from 'lucide-react';

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
  const [confirmacao, setConfirmacao] = useState('');
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

  const eliminar = async () => {
    if (confirmacao !== 'ELIMINAR') return;
    setEliminando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke(FUNCAO_EXCLUIR_CONTA);
      if (error) {
        // O supabase-js só diz "non-2xx": vamos buscar a resposta verdadeira da função.
        let detalhe = error.message;
        const resp = (error as { context?: Response }).context;
        if (resp && typeof resp.text === 'function') {
          const texto = await resp.text().catch(() => '');
          try {
            const corpo = JSON.parse(texto);
            detalhe = corpo.erro
              ? `${corpo.erro}${Array.isArray(corpo.falhas) && corpo.falhas.length ? ' (' + corpo.falhas.join('; ') + ')' : ''}`
              : corpo.message || texto;
          } catch {
            detalhe = `HTTP ${resp.status}${texto ? ': ' + texto.slice(0, 200) : ''}`;
          }
        }
        throw new Error(detalhe);
      }
      if (data?.erro) throw new Error(data.erro);

      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (e) {
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
        <div className="flex gap-2">
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder='Escreva ELIMINAR para confirmar'
            className="h-9 text-xs"
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={eliminar}
            disabled={confirmacao !== 'ELIMINAR' || eliminando}
            className="shrink-0 gap-1.5"
          >
            {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Eliminar
          </Button>
        </div>
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
