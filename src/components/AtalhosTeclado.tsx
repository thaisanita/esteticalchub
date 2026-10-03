import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

interface Atalho {
  tecla: string;
  descricao: string;
  rota: string;
}

// Teclas simples (sem modificador) — a react-hotkeys-hook já ignora estes
// atalhos quando o foco está num campo de texto/textarea/select, por isso
// não interferem com o preenchimento de formulários em nenhuma página.
const ATALHOS: Atalho[] = [
  { tecla: 'a', descricao: 'Ir para a Agenda', rota: '/dashboard' },
  { tecla: 'n', descricao: 'Novo Agendamento', rota: '/novo-agendamento' },
  { tecla: 'c', descricao: 'Ir para Clientes', rota: '/clientes' },
  { tecla: 'p', descricao: 'Ir para Planeamento', rota: '/kanban' },
  { tecla: 'v', descricao: 'Ir para Visão geral', rota: '/visao-geral' },
];

/**
 * Atalhos de teclado globais da app: navegação rápida pelas páginas mais
 * usadas, mais o "?" que abre esta lista (como em muitos SaaS). Montado uma
 * única vez em LayoutPrivado.
 */
export default function AtalhosTeclado() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  const rotaPorTecla = useMemo(() => new Map(ATALHOS.map((a) => [a.tecla, a.rota])), []);

  // Uma única chamada ao hook para todas as teclas de navegação — identifica
  // qual foi premida pelo próprio evento, em vez de chamar o hook em loop.
  useHotkeys(
    ATALHOS.map((a) => a.tecla).join(','),
    (evento) => {
      const tecla = evento.key.toLowerCase();
      const rota = rotaPorTecla.get(tecla);
      if (rota) navigate(rota);
    },
    [rotaPorTecla]
  );

  useHotkeys('shift+slash', () => setAberto((v) => !v)); // "?" no teclado PT

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Atalhos de teclado (?)"
        className="flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <Keyboard size={17} />
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard size={16} className="text-primary" /> Atalhos de teclado
            </DialogTitle>
            <DialogDescription>Funcionam em qualquer página (exceto a escrever num campo).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {ATALHOS.map((atalho) => (
              <div key={atalho.rota} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{atalho.descricao}</span>
                <Kbd keys={[atalho.tecla]} listenToKeyboard />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 text-sm">
              <span className="text-foreground">Abrir/fechar esta lista</span>
              <Kbd keys={[{ display: '?', key: 'shift+slash' }]} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
