import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import { useModeloWhatsApp, definirModeloWhatsApp } from '@/hooks/useModeloWhatsApp';
import {
  MODELO_WHATSAPP_PADRAO,
  TIPO_MODELO_WHATSAPP,
  VARIAVEIS_WHATSAPP,
  preencherModelo,
} from '@/lib/whatsapp';

const EXEMPLO = Object.fromEntries(VARIAVEIS_WHATSAPP.map((v) => [v.chave, v.exemplo]));

/** Configurações → Mensagens automáticas: o texto do botão do WhatsApp de cada marcação. */
export default function MensagensAutomaticas() {
  const guardado = useModeloWhatsApp();
  const [texto, setTexto] = useState(guardado);
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const editado = useRef(false);

  // Quando o modelo guardado chega (ou muda), mostra-o — a não ser que já se esteja a editar.
  useEffect(() => {
    if (!editado.current) setTexto(guardado);
  }, [guardado]);

  const mudar = (v: string) => {
    editado.current = true;
    setTexto(v);
  };

  const inserir = (chave: string) => {
    const el = campo.current;
    const marca = `{${chave}}`;
    if (!el) return mudar(texto + marca);
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + marca + texto.slice(fim);
    mudar(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  const guardar = async () => {
    const limpo = texto.trim();
    if (!limpo) {
      toast.error('Escreve a mensagem antes de guardar.');
      return;
    }
    if (limpo.length > 2000) {
      toast.error('A mensagem pode ter no máximo 2000 caracteres.');
      return;
    }
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('modelos_mensagem')
      .upsert(
        { usuario_id: user?.id, tipo: TIPO_MODELO_WHATSAPP, texto: limpo, updated_at: new Date().toISOString() },
        { onConflict: 'usuario_id,tipo' },
      );
    setSalvando(false);
    if (error) {
      toast.error('Não foi possível guardar a mensagem: ' + getErrorMessage(error));
      return;
    }
    editado.current = false;
    definirModeloWhatsApp(limpo);
    toast.success('Mensagem do WhatsApp guardada.');
  };

  const alterado = texto.trim() !== guardado.trim();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="modelo-whatsapp" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mensagem do WhatsApp de cada marcação
        </label>
        <textarea
          id="modelo-whatsapp"
          ref={campo}
          rows={6}
          value={texto}
          onChange={(e) => mudar(e.target.value)}
          className="w-full rounded-xl border border-border bg-background/50 p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="text-[11px] text-muted-foreground">
          Carrega numa variável para a pôr onde está o cursor. Se uma variável ficar vazia (ex.: marcação sem local), a linha dela não aparece.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Variáveis">
        {VARIAVEIS_WHATSAPP.map((v) => (
          <button
            key={v.chave}
            type="button"
            onClick={() => inserir(v.chave)}
            title={v.descricao}
            className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
          >
            {`{${v.chave}}`} <span className="text-muted-foreground">· {v.descricao}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização (exemplo)</p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{preencherModelo(texto, EXEMPLO) || '—'}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={guardar} disabled={salvando || !alterado}>
          {salvando ? 'A guardar…' : 'Guardar mensagem'}
        </Button>
        <Button type="button" variant="outline" onClick={() => mudar(MODELO_WHATSAPP_PADRAO)} disabled={texto === MODELO_WHATSAPP_PADRAO}>
          Repor texto original
        </Button>
      </div>
    </div>
  );
}
