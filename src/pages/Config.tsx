import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Globe,
  Globe2,
  Link2,
  ChevronRight,
  Phone,
  Download,
  ShieldCheck,
  Users,
  Megaphone,
  Lock,
} from 'lucide-react';
import { textosConfig, obterIdiomaAtual, type Idioma } from '@/lib/i18n';
import ConectarWhatsAppBot from '@/components/ConectarWhatsAppBot';
import PaginaPublicaConfig from '@/components/PaginaPublicaConfig';
import TrafegoPagoConfig from '@/components/TrafegoPagoConfig';
import DadosEConta from '@/components/DadosEConta';
import { usePlano, LEMBRETES_WHATSAPP_ATIVOS, type ProFeature } from '@/hooks/usePlano';
import ModalFuncaoPro from '@/components/ModalFuncaoPro';
import SeloPro from '@/components/SeloPro';

import { CHAVE_BANNER_INSTALAR_FECHADO } from '@/components/BannerInstalarApp';
import { URL_PUBLICO } from '@/lib/empresa';

interface Usuario {
  email: string;
  displayName: string;
  photoURL?: string;
}


export default function Config() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const [modalProAberto, setModalProAberto] = useState<ProFeature | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [idioma, setIdioma] = useState<Idioma>(obterIdiomaAtual());

  useEffect(() => {
    const carregarDadosUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuario({
          email: user.email ?? '',
          displayName: user.user_metadata?.full_name || 'Usuário',
          photoURL: user.user_metadata?.avatar_url,
        });
      }
    };
    carregarDadosUsuario();
  }, []);

  const t = textosConfig[idioma] || textosConfig['Português (PT)'];

  const copiarLink = () => {
    navigator.clipboard.writeText(URL_PUBLICO);
    toast.success('Link do app copiado!');
  };

  const mostrarAvisoInstalarNovamente = () => {
    localStorage.removeItem(CHAVE_BANNER_INSTALAR_FECHADO);
    window.location.href = '/dashboard';
  };

  const salvarConfiguracoes = () => {
    localStorage.setItem('config_idioma', idioma);
    toast.success(t.alerta);
    // Pequeno atraso para o toast ser visível antes do recarregamento da página
    // (necessário para o BannerInstalarApp reler o idioma do localStorage).
    setTimeout(() => {
      window.location.href = '/';
    }, 600);
  };

  const iniciais = usuario?.displayName
    ? usuario.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="mx-auto max-w-xl pb-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-primary/10">
          <Settings size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t.titulo}</h1>
          <p className="text-[13px] text-muted-foreground">{t.subtitulo}</p>
        </div>
      </div>

      {/* Perfil */}
      {usuario && (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg hover:shadow-black/10">
          <div className="flex items-center gap-3.5">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={usuario.photoURL} alt={usuario.displayName} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary-hover font-bold text-primary-foreground">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-[15px] font-bold text-foreground">{usuario.displayName}</div>
              <div className="text-xs text-muted-foreground">{usuario.email}</div>
            </div>
          </div>
          <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-bold text-success">
            ● {t.perfilStatus}
          </span>
        </div>
      )}

      {/* Bloco WhatsApp — conectar o robô automático (Pro) */}
      {LEMBRETES_WHATSAPP_ATIVOS && (
        <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
              <Phone size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-foreground">WhatsApp</div>
                {!isPro && <SeloPro />}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Liga o teu WhatsApp para enviar lembretes automáticos às clientes.
              </div>
            </div>
          </div>

          {isPro ? (
            <ConectarWhatsAppBot />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setModalProAberto('lembretes_whatsapp')} className="gap-1.5">
              <Lock size={14} /> Disponível no plano Pro
            </Button>
          )}
        </div>
      )}

      {/* Página Pública (captação de leads via anúncios) */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <Globe2 size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Página Pública</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Uma página para receber tráfego de anúncios — a visitante escolhe falar no WhatsApp ou deixar os dados.
            </div>
          </div>
        </div>

        <PaginaPublicaConfig />
      </div>

      {/* Tráfego pago (contas de Meta Ads ligadas) */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <Megaphone size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Tráfego Pago</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Liga a tua conta de anúncios da Meta para veres o gasto e os resultados por campanha.
            </div>
          </div>
        </div>

        <TrafegoPagoConfig />
      </div>

      {/* Idioma */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg hover:shadow-black/10">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Globe size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{t.idiomaLabel}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.idiomaSub}</div>
          </div>
        </div>
        <Select value={idioma} onValueChange={(valor) => setIdioma(valor as Idioma)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Português (PT)">Português (PT)</SelectItem>
            <SelectItem value="English (US)">English (US)</SelectItem>
            <SelectItem value="Español (ES)">Español (ES)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Partilhar */}
      <button
        onClick={copiarLink}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-card p-5 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Link2 size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-primary">{t.partilhar}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.compartilharSub}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-primary" />
      </button>

      <button
        onClick={() => navigate('/agendas')}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Minhas agendas</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Cria agendas, convida profissionais e gere quem partilha cada uma.
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-primary" />
      </button>

      {/* Os meus dados (RGPD): exportar e eliminar conta */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <ShieldCheck size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Os meus dados</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Exporta uma cópia ou elimina a tua conta e todos os dados.
            </div>
          </div>
        </div>
        <DadosEConta />

        <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">Documentos legais</p>
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={() => navigate('/termos')} className="text-primary underline">
              Termos de Uso
            </button>
            <button type="button" onClick={() => navigate('/privacidade')} className="text-primary underline">
              Política de Privacidade
            </button>
          </div>
        </div>
      </div>

      {/* Aviso de instalar app (útil para testar de novo) */}
      <button
        onClick={mostrarAvisoInstalarNovamente}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Download size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Mostrar aviso de instalar app</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Volta a mostrar o banner de "Instalar App", se já o tiver fechado.
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>

      {/* Ações */}
      <div className="mt-6 flex flex-col gap-2.5">
        <Button
          onClick={salvarConfiguracoes}
          className="w-full bg-gradient-to-br from-primary to-primary-hover py-6 text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
        >
          {t.btnSalvar}
        </Button>
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full py-5 text-sm font-semibold"
        >
          {t.btnVoltar}
        </Button>
      </div>

      {modalProAberto && (
        <ModalFuncaoPro
          open={!!modalProAberto}
          onOpenChange={(open) => !open && setModalProAberto(null)}
          funcao={modalProAberto}
        />
      )}
    </div>
  );
}