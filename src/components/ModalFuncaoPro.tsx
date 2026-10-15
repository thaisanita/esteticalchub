import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock } from 'lucide-react';
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
import type { ProFeature } from '@/hooks/usePlano';

const TEXTOS: Record<ProFeature, { titulo: string; descricao: string }> = {
  assistente_ia: {
    titulo: 'Assistente IA',
    descricao:
      'O assistente responde a perguntas sobre a tua agenda, pagamentos, custos e clientes. Esta função está disponível no plano Pro.',
  },
  lembretes_whatsapp: {
    titulo: 'Lembretes automáticos por WhatsApp',
    descricao:
      'Envia lembretes automáticos às clientes pelo WhatsApp antes do atendimento. Esta função está disponível no plano Pro.',
  },
};

interface ModalFuncaoProProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcao: ProFeature;
}

/** Modal mostrado quando uma conta grátis tenta usar uma das 3 funções exclusivas do Pro. */
export default function ModalFuncaoPro({ open, onOpenChange, funcao }: ModalFuncaoProProps) {
  const navigate = useNavigate();
  const texto = TEXTOS[funcao];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock size={18} />
          </div>
          <AlertDialogTitle>{texto.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{texto.descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Agora não</AlertDialogCancel>
          <AlertDialogAction onClick={() => navigate('/planos')}>
            <Sparkles size={14} /> Ver planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
