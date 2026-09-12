import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { textosConfig, obterIdiomaAtual, type Idioma } from '@/lib/i18n';
import ConectarWhatsAppBot from '@/components/ConectarWhatsAppBot';
import PaginaPublicaConfig from '@/components/PaginaPublicaConfig';
import { CHAVE_BANNER_INSTALAR_FECHADO } from '@/components/BannerInstalarApp';

interface Usuario {
  email: string;
  displayName: string;
  photoURL?: string;
}


export default function Config() {
  const navigate = useNavigate();
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
    navigator.clipboard.writeText(window.location.origin);
    alert('Link do app copiado!');
  };

  const mostrarAvisoInstalarNovamente = () => {
    localStorage.removeItem(CHAVE_BANNER_INSTALAR_FECHADO);
    window.location.href = '/dashboard';
  };

  const salvarConfiguracoes = () => {
    localStorage.setItem('config_idioma', idioma);
    alert(t.alerta);
    window.location.href = '/';
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

      {/* Bloco WhatsApp — conectar o robô automático */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">WhatsApp</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Ligue o seu WhatsApp para enviar lembretes automáticos às clientes.
            </div>
          </div>
        </div>

        <ConectarWhatsAppBot />
      </div>

      {/* Página Pública (captação de leads via anúncios) */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <Globe2 size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Página Pública</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Uma página pra receber tráfego de anúncios — a visitante escolhe falar no WhatsApp ou deixar os dados.
            </div>
          </div>
        </div>

        <PaginaPublicaConfig />
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

      {/* Compartilhar */}
      <button
        onClick={copiarLink}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-card p-5 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Link2 size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-primary">{t.compartilhar}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.compartilharSub}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-primary" />
      </button>

      {/* Aviso de instalar app (útil pra testar de novo) */}
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
    </div>
  );
}