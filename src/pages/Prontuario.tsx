import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import {
  ArrowLeft,
  Camera,
  FileText,
  Upload,
  ShieldCheck,
  User,
  Loader2,
} from 'lucide-react';

interface Anamnese {
  alergias?: string;
  condicoes_pele?: string;
  gravidez_amamentacao?: boolean;
  medicacao_atual?: string;
  doencas_autoimunes_cronicas?: string;
  cirurgia_recente?: boolean;
  cirurgia_recente_detalhes?: string;
  acidos_tratamentos_ativos?: boolean;
  acidos_tratamentos_detalhes?: string;
  procedimento_anterior_reacao?: string;
}

const BUCKET = 'prontuarios';

export default function Prontuario() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [nomeCliente, setNomeCliente] = useState('');
  const [prontuarioId, setProntuarioId] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<Anamnese>({});
  const [consentimento, setConsentimento] = useState(false);

  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [contratoPath, setContratoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [contratoUrl, setContratoUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [enviandoContrato, setEnviandoContrato] = useState(false);

  const gerarUrlAssinado = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return data?.signedUrl || null;
  };

  const carregarDados = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);

    const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', clienteId).maybeSingle();
    setNomeCliente(cliente?.nome || '');

    const { data: prontuario } = await supabase
      .from('prontuarios')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (prontuario) {
      setProntuarioId(prontuario.id);
      setAnamnese(prontuario.anamnese || {});
      setConsentimento(prontuario.consentimento_confirmado || false);
      setFotoPath(prontuario.foto_url || null);
      setContratoPath(prontuario.contrato_url || null);
      setFotoUrl(await gerarUrlAssinado(prontuario.foto_url));
      setContratoUrl(await gerarUrlAssinado(prontuario.contrato_url));
    }

    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleUpload = async (file: File, tipo: 'foto' | 'contrato') => {
    const setEnviando = tipo === 'foto' ? setEnviandoFoto : setEnviandoContrato;
    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const extensao = file.name.split('.').pop() || 'jpg';
      const caminho = `${user.id}/${clienteId}/${tipo}-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage.from(BUCKET).upload(caminho, file, { upsert: true });
      if (error) throw error;

      const url = await gerarUrlAssinado(caminho);
      if (tipo === 'foto') {
        setFotoPath(caminho);
        setFotoUrl(url);
      } else {
        setContratoPath(caminho);
        setContratoUrl(url);
      }
    } catch (err) {
      alert('Erro ao enviar ficheiro: ' + getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const payload = {
        cliente_id: clienteId,
        anamnese,
        foto_url: fotoPath,
        contrato_url: contratoPath,
        consentimento_confirmado: consentimento,
        consentimento_em: consentimento ? new Date().toISOString() : null,
      };

      const { error } = prontuarioId
        ? await supabase.from('prontuarios').update(payload).eq('id', prontuarioId)
        : await supabase.from('prontuarios').insert([payload]);

      if (error) throw error;
      alert('Prontuário guardado com sucesso.');
      carregarDados();
    } catch (err) {
      alert('Erro ao guardar prontuário: ' + getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const atualizarAnamnese = (campo: keyof Anamnese, valor: string | boolean) => {
    setAnamnese((prev) => ({ ...prev, [campo]: valor }));
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        A carregar prontuário...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/clientes')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Voltar a Clientes
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <User size={20} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Prontuário</h2>
          <p className="text-sm text-muted-foreground">{nomeCliente}</p>
        </div>
      </div>

      {/* Foto e Contrato */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Camera size={15} className="text-primary" /> Foto
          </h3>
          {fotoUrl && <img src={fotoUrl} alt="Foto da cliente" className="w-full h-40 object-cover rounded-xl border border-border" />}
          <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs font-medium text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
            {enviandoFoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {fotoUrl ? 'Substituir foto' : 'Tirar ou carregar foto'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'foto')}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={15} className="text-primary" /> Contrato Digitalizado
          </h3>
          {contratoUrl && (
            <a href={contratoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-border p-3 text-xs text-primary hover:bg-primary/5">
              <FileText size={14} /> Ver contrato guardado
            </a>
          )}
          <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs font-medium text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
            {enviandoContrato ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {contratoUrl ? 'Substituir contrato' : 'Digitalizar ou carregar contrato'}
            <input
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'contrato')}
            />
          </label>
        </div>
      </div>

      {/* Ficha de Anamnese */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-md shadow-black/10 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Ficha de Anamnese</h3>

        <CampoTexto label="Alergias conhecidas (produtos, cosméticos, anestésicos, látex)" valor={anamnese.alergias} onChange={(v) => atualizarAnamnese('alergias', v)} />
        <CampoTexto label="Condições de pele (eczema, psoríase, dermatite, acne ativa)" valor={anamnese.condicoes_pele} onChange={(v) => atualizarAnamnese('condicoes_pele', v)} />
        <CampoSimNao label="Está grávida ou a amamentar?" valor={anamnese.gravidez_amamentacao} onChange={(v) => atualizarAnamnese('gravidez_amamentacao', v)} />
        <CampoTexto label="Medicação atual (ex: anticoagulantes, isotretinoína/roacutan)" valor={anamnese.medicacao_atual} onChange={(v) => atualizarAnamnese('medicacao_atual', v)} />
        <CampoTexto label="Doenças autoimunes ou crónicas (diabetes, coagulação, etc.)" valor={anamnese.doencas_autoimunes_cronicas} onChange={(v) => atualizarAnamnese('doencas_autoimunes_cronicas', v)} />

        <CampoSimNao label="Fez alguma cirurgia nos últimos 6 meses?" valor={anamnese.cirurgia_recente} onChange={(v) => atualizarAnamnese('cirurgia_recente', v)} />
        {anamnese.cirurgia_recente && (
          <CampoTexto label="Detalhes da cirurgia" valor={anamnese.cirurgia_recente_detalhes} onChange={(v) => atualizarAnamnese('cirurgia_recente_detalhes', v)} />
        )}

        <CampoSimNao label="Usa ácidos ou tratamentos dermatológicos ativos na zona a tratar?" valor={anamnese.acidos_tratamentos_ativos} onChange={(v) => atualizarAnamnese('acidos_tratamentos_ativos', v)} />
        {anamnese.acidos_tratamentos_ativos && (
          <CampoTexto label="Quais tratamentos" valor={anamnese.acidos_tratamentos_detalhes} onChange={(v) => atualizarAnamnese('acidos_tratamentos_detalhes', v)} />
        )}

        <CampoTexto label="Já fez este procedimento antes? Teve alguma reação?" valor={anamnese.procedimento_anterior_reacao} onChange={(v) => atualizarAnamnese('procedimento_anterior_reacao', v)} />
      </div>

      {/* Consentimento */}
      <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={consentimento}
          onChange={(e) => setConsentimento(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="text-xs text-foreground flex items-start gap-1.5">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
          A cliente confirma que as informações acima são verdadeiras, foi informada dos riscos do procedimento, e autoriza o registo destes dados de saúde para este atendimento.
        </span>
      </label>

      <Button onClick={handleSalvar} disabled={salvando} className="w-full">
        {salvando ? 'A guardar...' : 'Guardar Prontuário'}
      </Button>
    </div>
  );
}

function CampoTexto({ label, valor, onChange }: { label: string; valor?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <textarea
        value={valor || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Não relatado / Não aplicável"
        className="w-full rounded-md border border-border bg-background/50 p-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function CampoSimNao({ label, valor, onChange }: { label: string; valor?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${valor === true ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${valor === false ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
        >
          Não
        </button>
      </div>
    </div>
  );
}
