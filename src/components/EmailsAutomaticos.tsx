import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getErrorMessage } from '@/lib/utils';
import { preencherModelo } from '@/lib/whatsapp';
import {
  EMAILS,
  VARIAVEIS_EMAIL,
  modeloEfetivo,
  textoQuandoSai,
  type DefinicaoEmail,
  type ModeloGuardado,
} from '@/lib/mensagens';
import { guardarModeloEmail, useModelosEmail } from '@/hooks/useModelosEmail';

const classeLabel = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const classeCampo = 'h-9 bg-background/50 text-sm';

function CartaoEmail({
  def,
  guardado,
  nomeProfissional,
  aoGuardar,
}: {
  def: DefinicaoEmail;
  guardado?: ModeloGuardado;
  nomeProfissional: string;
  aoGuardar: () => Promise<void>;
}) {
  const inicial = modeloEfetivo(def.tipo, guardado);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [assunto, setAssunto] = useState(inicial.assunto);
  const [texto, setTexto] = useState(inicial.texto);
  const [horas, setHoras] = useState(String(inicial.espera_horas ?? ''));
  const [dias, setDias] = useState(String(inicial.espera_dias ?? ''));
  const [hora, setHora] = useState(inicial.hora_envio ?? '');
  const [link, setLink] = useState(inicial.link_avaliacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const id = def.tipo;

  // Quando o guardado muda (depois de gravar), o formulário reflete-o.
  useEffect(() => {
    const m = modeloEfetivo(def.tipo, guardado);
    setAtivo(m.ativo);
    setAssunto(m.assunto);
    setTexto(m.texto);
    setHoras(String(m.espera_horas ?? ''));
    setDias(String(m.espera_dias ?? ''));
    setHora(m.hora_envio ?? '');
    setLink(m.link_avaliacao ?? '');
  }, [guardado, def.tipo]);

  const usaHoras = def.tipo === 'email_cuidados';
  const usaDias = def.tipo === 'email_avaliacao' || def.tipo === 'email_retoque';
  const usaLink = def.tipo === 'email_avaliacao';

  const exemplo = {
    ...Object.fromEntries(VARIAVEIS_EMAIL.map((v) => [v.chave, v.exemplo])),
    profissional: nomeProfissional || 'Thais',
    link_avaliacao: link.trim() || 'https://g.page/r/…',
  };

  const inserir = (chave: string) => {
    const el = campo.current;
    const marca = `{${chave}}`;
    if (!el) return setTexto((t) => t + marca);
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + marca + texto.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  const numero = (v: string, min: number, max: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const guardar = async () => {
    if (!assunto.trim() || !texto.trim()) {
      toast.error('Preenche o assunto e o texto do email.');
      return;
    }
    const espera_horas = usaHoras ? numero(horas, 0, 720) : null;
    const espera_dias = usaDias ? numero(dias, def.tipo === 'email_retoque' ? 1 : 0, 365) : null;
    if (usaHoras && espera_horas === null) return void toast.error('Indica as horas (de 0 a 720).');
    if (usaDias && espera_dias === null) return void toast.error('Indica os dias (até 365).');
    if (usaDias && !/^\d{2}:\d{2}$/.test(hora)) return void toast.error('Indica a hora de envio.');
    const linkLimpo = link.trim();
    if (usaLink && linkLimpo && !/^https?:\/\//i.test(linkLimpo)) {
      return void toast.error('O link de avaliação tem de começar por https://');
    }
    if (usaLink && ativo && !linkLimpo) {
      return void toast.error('Para ligar este email, põe o teu link de avaliação.');
    }
    setSalvando(true);
    const { error } = await guardarModeloEmail(def.tipo, {
      ativo,
      assunto: assunto.trim(),
      texto: texto.trim(),
      espera_horas,
      espera_dias,
      hora_envio: usaDias ? hora : null,
      link_avaliacao: usaLink ? linkLimpo || null : null,
    });
    if (error) {
      setSalvando(false);
      toast.error('Não foi possível guardar: ' + getErrorMessage(error));
      return;
    }
    await aoGuardar();
    setSalvando(false);
    toast.success(`${def.titulo}: guardado${ativo ? ' e ligado' : ' (desligado)'}.`);
  };

  const repor = () => {
    setAssunto(def.assunto);
    setTexto(def.texto);
  };

  const quando = textoQuandoSai(def.tipo, {
    espera_horas: numero(horas, 0, 720),
    espera_dias: numero(dias, 0, 365),
    hora_envio: hora || null,
  });

  return (
    <div className={cn('space-y-3 rounded-xl border p-4', ativo ? 'border-emerald-500/30' : 'border-border')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Mail size={14} className="text-primary" /> {def.titulo}
          </p>
          <p className="text-[11px] text-muted-foreground">{def.explicacao}</p>
          <p className="mt-0.5 text-[11px] font-medium text-primary">Quando sai: {quando}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          aria-label={`${def.titulo}: ${ativo ? 'ligado' : 'desligado'}`}
          onClick={() => setAtivo((v) => !v)}
          className={cn(
            'flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors',
            ativo ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-border text-muted-foreground',
          )}
        >
          <span className={cn('h-2.5 w-2.5 rounded-full', ativo ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
          {ativo ? 'Ligado' : 'Desligado'}
        </button>
      </div>

      {(usaHoras || usaDias || usaLink) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {usaHoras && (
            <div className="space-y-1">
              <label htmlFor={`${id}-horas`} className={classeLabel}>Horas depois do fim</label>
              <Input id={`${id}-horas`} inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value.replace(/\D/g, ''))} className={classeCampo} />
            </div>
          )}
          {usaDias && (
            <>
              <div className="space-y-1">
                <label htmlFor={`${id}-dias`} className={classeLabel}>
                  {def.tipo === 'email_retoque' ? 'Dias (por omissão)' : 'Dias depois'}
                </label>
                <Input id={`${id}-dias`} inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} className={classeCampo} />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${id}-hora`} className={classeLabel}>Hora de envio</label>
                <Input id={`${id}-hora`} type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={classeCampo} />
              </div>
            </>
          )}
          {usaLink && (
            <div className="space-y-1 sm:col-span-3">
              <label htmlFor={`${id}-link`} className={classeLabel}>O teu link de avaliação</label>
              <Input
                id={`${id}-link`}
                type="url"
                placeholder="https://g.page/r/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={classeCampo}
              />
              <p className="text-[11px] text-muted-foreground">Por exemplo, o link de avaliações do teu perfil no Google.</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={`${id}-assunto`} className={classeLabel}>Assunto</label>
        <Input id={`${id}-assunto`} value={assunto} onChange={(e) => setAssunto(e.target.value)} className={classeCampo} maxLength={200} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-texto`} className={classeLabel}>Texto</label>
        <textarea
          id={`${id}-texto`}
          ref={campo}
          rows={6}
          value={texto}
          maxLength={5000}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full rounded-xl border border-border bg-background/50 p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={`Variáveis — ${def.titulo}`}>
        {VARIAVEIS_EMAIL.map((v) => (
          <button
            key={v.chave}
            type="button"
            onClick={() => inserir(v.chave)}
            title={v.descricao}
            className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
          >
            {`{${v.chave}}`}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização (exemplo)</p>
        <p className="text-sm font-semibold text-foreground">{preencherModelo(assunto, exemplo) || '—'}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{preencherModelo(texto, exemplo) || '—'}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          No fim do email aparece sempre «Enviado por {exemplo.profissional} através do EstetiCalcHub» e a ligação para a cliente deixar de receber.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={guardar} disabled={salvando}>
          {salvando ? 'A guardar…' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" onClick={repor} disabled={assunto === def.assunto && texto === def.texto}>
          Repor texto original
        </Button>
      </div>
    </div>
  );
}

/** Configurações → Mensagens automáticas: os 4 emails automáticos. */
export default function EmailsAutomaticos() {
  const { modelos, nomeProfissional, carregando, recarregar } = useModelosEmail();
  if (carregando) return <p className="text-xs text-muted-foreground">A carregar os emails…</p>;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Os emails só saem para clientes com email e que não cancelaram os lembretes. Nunca saem para faltas nem para marcações recusadas pela cliente.
      </p>
      {EMAILS.map((def) => (
        <CartaoEmail key={def.tipo} def={def} guardado={modelos[def.tipo]} nomeProfissional={nomeProfissional} aoGuardar={recarregar} />
      ))}
    </div>
  );
}
