// "Os meus dados": exportar tudo (portabilidade, RGPD art. 20.º).
// A eliminação de conta está desativada até ser revista: os pedidos de
// eliminação são tratados por email (EMPRESA.email).
import { useState } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import { EMPRESA } from '@/lib/empresa';
import { Download, Loader2 } from 'lucide-react';

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Descarregue uma cópia de todos os seus dados (clientes, agendamentos, custos, etc.) em formato JSON.
        </p>
        <Button size="sm" variant="outline" onClick={exportar} disabled={exportando} className="shrink-0 gap-1.5">
          {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Para eliminar a sua conta e todos os dados, escreva para{' '}
        <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
          {EMPRESA.email}
        </a>
        .
      </p>
      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
