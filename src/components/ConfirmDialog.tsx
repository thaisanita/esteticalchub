// Substituto do window.confirm() nativo, que bloqueia a página. Uso:
//   import { confirmar } from '@/components/ConfirmDialog';
//   if (!(await confirmar('Eliminar este registo?'))) return;
// O <ConfirmDialogHost /> é montado uma única vez em App.tsx.
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface OpcoesConfirmar {
  titulo?: string;
  descricao: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  destrutivo?: boolean;
}

type PedidoConfirmacao = OpcoesConfirmar & { resolver: (valor: boolean) => void };

let abrirExterno: ((pedido: PedidoConfirmacao) => void) | null = null;

export function confirmar(opcoes: string | OpcoesConfirmar): Promise<boolean> {
  const normalizado: OpcoesConfirmar = typeof opcoes === 'string' ? { descricao: opcoes } : opcoes;
  return new Promise((resolve) => {
    if (!abrirExterno) {
      // Rede de segurança: se o host ainda não montou, não bloqueia a ação.
      resolve(window.confirm(normalizado.descricao));
      return;
    }
    abrirExterno({ ...normalizado, resolver: resolve });
  });
}

export default function ConfirmDialogHost() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    abrirExterno = (novoPedido) => {
      setPedido(novoPedido);
      setOpen(true);
    };
    return () => {
      abrirExterno = null;
    };
  }, []);

  const responder = (valor: boolean) => {
    pedido?.resolver(valor);
    setOpen(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(novoOpen) => {
        if (!novoOpen) responder(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.titulo || 'Confirmar ação'}</AlertDialogTitle>
          <AlertDialogDescription>{pedido?.descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => responder(false)}>
            {pedido?.textoCancelar || 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={pedido?.destrutivo ? 'destructive' : 'default'}
            onClick={() => responder(true)}
          >
            {pedido?.textoConfirmar || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
