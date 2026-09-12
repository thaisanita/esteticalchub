// Painel "Página Pública" em Configurações — a profissional monta a página
// de captação de leads (pensada para tráfego de anúncios), sem precisar
// mexer em código. Ver src/pages/PaginaPublica.tsx (rota pública /p/:slug).
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/utils';
import { Loader2, Save, ExternalLink, ImagePlus, X } from 'lucide-react';

const BUCKET = 'paginas-publicas';

function slugificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (normaliza "é" -> "e" + marca, e tira a marca)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PaginaPublicaConfig() {
  const [carregando, setCarregando] = useState(true);
  const [existe, setExiste] = useState(false);

  const [slug, setSlug] = useState('');
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);
  const [nomeNegocio, setNomeNegocio] = useState('');
  const [descricao, setDescricao] = useState('');
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('paginas_publicas')
      .select('slug, nome_negocio, descricao, telefone_whatsapp, meta_pixel_id, fotos')
      .eq('usuario_id', user.id)
      .maybeSingle();

    if (data) {
      setExiste(true);
      setSlug(data.slug || '');
      setSlugEditadoManualmente(true);
      setNomeNegocio(data.nome_negocio || '');
      setDescricao(data.descricao || '');
      setTelefoneWhatsapp(data.telefone_whatsapp || '');
      setMetaPixelId(data.meta_pixel_id || '');
      setFotos(data.fotos || []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudarNomeNegocio = (valor: string) => {
    setNomeNegocio(valor);
    if (!slugEditadoManualmente) setSlug(slugificar(valor));
  };

  const enviarFoto = async (file: File) => {
    setEnviandoFoto(true);
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const extensao = file.name.split('.').pop() || 'jpg';
      const caminho = `${user.id}/${Date.now()}.${extensao}`;

      const { error } = await supabase.storage.from(BUCKET).upload(caminho, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
      setFotos((prev) => [...prev, urlData.publicUrl]);
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = (url: string) => {
    setFotos((prev) => prev.filter((f) => f !== url));
  };

  const salvar = async () => {
    setErro(null);
    if (!slug.trim() || !nomeNegocio.trim()) {
      setErro('Preenche pelo menos o link (slug) e o nome do negócio.');
      return;
    }
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entra novamente.');

      const { error } = await supabase.from('paginas_publicas').upsert(
        {
          usuario_id: user.id,
          slug: slugificar(slug),
          nome_negocio: nomeNegocio.trim(),
          descricao: descricao.trim() || null,
          telefone_whatsapp: telefoneWhatsapp.trim() || null,
          meta_pixel_id: metaPixelId.trim() || null,
          fotos,
        },
        { onConflict: 'usuario_id' }
      );

      if (error) throw error;
      setSlug(slugificar(slug));
      setExiste(true);
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> A carregar...
      </div>
    );
  }

  const linkPublico = slug ? `${window.location.origin}/p/${slug}` : null;

  return (
    <div className="space-y-3">
      {existe && linkPublico && (
        <a
          href={linkPublico}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 p-3 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          <span className="truncate">{linkPublico}</span>
          <ExternalLink size={14} className="shrink-0" />
        </a>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nome do negócio
          </label>
          <Input value={nomeNegocio} onChange={(e) => mudarNomeNegocio(e.target.value)} placeholder="Ex.: Clínica Bela Pele" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Link (agendaestetica.app/p/...)
          </label>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugEditadoManualmente(true);
              setSlug(slugificar(e.target.value));
            }}
            placeholder="minha-clinica"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Descrição curta
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Uma frase sobre o teu negócio, para quem vem do anúncio."
          className="w-full rounded-lg border border-border bg-background/50 p-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            WhatsApp de contacto
          </label>
          <Input
            type="tel"
            value={telefoneWhatsapp}
            onChange={(e) => setTelefoneWhatsapp(e.target.value)}
            placeholder="+351 912 345 678"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Meta Pixel ID (opcional)
          </label>
          <Input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="123456789012345" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fotos</label>
        <div className="flex flex-wrap gap-2">
          {fotos.map((url) => (
            <div key={url} className="group relative h-16 w-16 shrink-0">
              <img src={url} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
              <button
                onClick={() => removerFoto(url)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary">
            {enviandoFoto ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoFoto}
              onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <Button onClick={salvar} disabled={salvando} size="sm" className="gap-1.5">
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {existe ? 'Guardar alterações' : 'Criar página'}
      </Button>
    </div>
  );
}
