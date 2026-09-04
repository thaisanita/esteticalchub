import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Link2, 
  ChevronRight, 
  Calendar, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Save
} from 'lucide-react';

interface Usuario {
  email: string;
  displayName: string;
  photoURL?: string;
}

interface TextosConfig {
  titulo: string;
  subtitulo: string;
  perfilStatus: string;
  idiomaLabel: string;
  idiomaSub: string;
  whatsappLabel: string;
  whatsappSub: string;
  whatsappInputLabel: string;
  whatsappPlaceholder: string;
  statusConectado: string;
  statusDesconectado: string;
  statusConectadoSub: string;
  statusDesconectadoSub: string;
  btnSalvarNumero: string;
  compartilhar: string;
  compartilharSub: string;
  agendaLabel: string;
  agendaSub: string;
  btnAgenda: string;
  btnSalvar: string;
  btnVoltar: string;
  alerta: string;
}

const textosPorIdioma: Record<string, TextosConfig> = {
  'Português (PT)': {
    titulo: 'Configurações',
    subtitulo: 'Personalize a sua experiência',
    perfilStatus: 'Conectado',
    idiomaLabel: 'Idioma',
    idiomaSub: 'Selecione sua região',
    whatsappLabel: 'WhatsApp de Envio de Mensagens',
    whatsappSub: 'Cadastre o seu número para enviar os lembretes e confirmações automáticos',
    whatsappInputLabel: 'Seu WhatsApp (com DDI e DDD)',
    whatsappPlaceholder: '+351 912 345 678 ou +55 11 99999-9999',
    statusConectado: 'WhatsApp Configurado',
    statusDesconectado: 'Número não configurado',
    statusConectadoSub: 'Seu número está pronto para enviar notificações para os clientes.',
    statusDesconectadoSub: 'Insira e salve o seu número de WhatsApp abaixo.',
    btnSalvarNumero: 'Salvar Número',
    compartilhar: 'Compartilhar Link',
    compartilharSub: 'Copiar URL do aplicativo',
    agendaLabel: 'Sincronização de Agenda',
    agendaSub: 'Conectar com Google Calendar / TimeTree',
    btnAgenda: 'Conectar Google',
    btnSalvar: 'Salvar Alterações',
    btnVoltar: 'Voltar para Agenda',
    alerta: 'Configurações salvas com sucesso!',
  },
  'English (US)': {
    titulo: 'Settings',
    subtitulo: 'Customize your experience',
    perfilStatus: 'Connected',
    idiomaLabel: 'Language',
    idiomaSub: 'Select your region',
    whatsappLabel: 'WhatsApp Messaging Number',
    whatsappSub: 'Register your number to send automatic reminders and confirmations',
    whatsappInputLabel: 'Your WhatsApp (with country and area code)',
    whatsappPlaceholder: '+1 123 456 7890',
    statusConectado: 'WhatsApp Configured',
    statusDesconectado: 'Number not configured',
    statusConectadoSub: 'Your number is ready to send notifications to clients.',
    statusDesconectadoSub: 'Enter and save your WhatsApp number below.',
    btnSalvarNumero: 'Save Number',
    compartilhar: 'Share Link',
    compartilharSub: 'Copy app URL',
    agendaLabel: 'Calendar Sync',
    agendaSub: 'Connect with Google Calendar / TimeTree',
    btnAgenda: 'Connect Google',
    btnSalvar: 'Save Changes',
    btnVoltar: 'Back to Schedule',
    alerta: 'Settings saved successfully!',
  },
  'Español (ES)': {
    titulo: 'Configuraciones',
    subtitulo: 'Personalice su experiencia',
    perfilStatus: 'Conectado',
    idiomaLabel: 'Idioma',
    idiomaSub: 'Seleccione su región',
    whatsappLabel: 'WhatsApp de Envío de Mensajes',
    whatsappSub: 'Registre su número para enviar recordatorios y confirmaciones automáticas',
    whatsappInputLabel: 'Su WhatsApp (con código de país y área)',
    whatsappPlaceholder: '+34 612 345 678',
    statusConectado: 'WhatsApp Configurado',
    statusDesconectado: 'Número no configurado',
    statusConectadoSub: 'Su número está listo para enviar notificaciones a los clientes.',
    statusDesconectadoSub: 'Ingrese y guarde su número de WhatsApp a continuación.',
    btnSalvarNumero: 'Guardar Número',
    compartilhar: 'Compartir Enlace',
    compartilharSub: 'Copiar URL de la aplicación',
    agendaLabel: 'Sincronización de Agenda',
    agendaSub: 'Conectar con Google Calendar / TimeTree',
    btnAgenda: 'Conectar Google',
    btnSalvar: 'Guardar Cambios',
    btnVoltar: 'Volver a la Agenda',
    alerta: '¡Configuraciones guardadas con éxito!',
  },
};

export default function Config() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [idioma, setIdioma] = useState(
    localStorage.getItem('config_idioma') || 'Português (PT)'
  );
  const [googleConectado, setGoogleConectado] = useState(false);

  // Estados do WhatsApp
  const [telefoneRemetente, setTelefoneRemetente] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  useEffect(() => {
    const carregarDadosUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuario({
          email: user.email ?? '',
          displayName: user.user_metadata?.full_name || 'Usuário',
          photoURL: user.user_metadata?.avatar_url,
        });

        // 1. Verifica sincronização do Google Calendar
        const { data: profile } = await supabase
          .from('profiles')
          .select('google_calendar_connected')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.google_calendar_connected) {
          setGoogleConectado(true);
        }

        // 2. Carrega as configurações de telefone e WhatsApp do usuário
        const { data: configWhatsapp } = await supabase
          .from('configuracoes_usuario')
          .select('telefone_remetente, whatsapp_status')
          .eq('usuario_id', user.id)
          .maybeSingle();

        if (configWhatsapp) {
          setTelefoneRemetente(configWhatsapp.telefone_remetente || '');
          if (configWhatsapp.telefone_remetente?.trim()) {
            setWhatsappStatus('conectado');
          }
        }
      }
    };
    carregarDadosUsuario();
  }, []);

  const t = textosPorIdioma[idioma] || textosPorIdioma['Português (PT)'];

  const conectarGoogleCalendar = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      alert(`Erro ao conectar: ${error.message}`);
    }
  };

  const salvarTelefoneWhatsApp = async () => {
    if (!telefoneRemetente.trim()) {
      alert('Por favor, informe um número de telefone válido.');
      return;
    }

    setSalvandoTelefone(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const { error } = await supabase
        .from('configuracoes_usuario')
        .upsert(
          {
            usuario_id: user.id,
            telefone_remetente: telefoneRemetente.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' }
        );

      if (error) throw error;

      setWhatsappStatus('conectado');
      alert('Número salvo com sucesso!');
    } catch (err: any) {
      alert(`Erro ao salvar número: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvandoTelefone(false);
    }
  };

  const copiarLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    alert('Link do app copiado!');
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

      {/* Bloco WhatsApp / Telefone do Profissional */}
      <div className="mb-3 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{t.whatsappLabel}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.whatsappSub}</div>
          </div>
        </div>

        {/* Input e Ação de Salvar */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-foreground">
            {t.whatsappInputLabel}
          </label>
          <div className="flex gap-2">
            <Input
              type="tel"
              value={telefoneRemetente}
              onChange={(e) => setTelefoneRemetente(e.target.value)}
              placeholder={t.whatsappPlaceholder}
              className="h-10 bg-background/50 border-border"
            />
            <Button
              onClick={salvarTelefoneWhatsApp}
              disabled={salvandoTelefone}
              className="h-10 gap-1.5 px-4 font-semibold"
            >
              {salvandoTelefone ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {t.btnSalvarNumero}
            </Button>
          </div>
        </div>

        {/* Badge Status do WhatsApp */}
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/80">
          {whatsappStatus === 'conectado' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-semibold text-foreground">
              {whatsappStatus === 'conectado' ? t.statusConectado : t.statusDesconectado}
            </p>
            <p className="text-muted-foreground">
              {whatsappStatus === 'conectado' ? t.statusConectadoSub : t.statusDesconectadoSub}
            </p>
          </div>
        </div>
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
        <Select value={idioma} onValueChange={setIdioma}>
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

      {/* Sincronização Google / TimeTree */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg hover:shadow-black/10">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Calendar size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{t.agendaLabel}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.agendaSub}</div>
          </div>
        </div>
        <Button
          onClick={conectarGoogleCalendar}
          variant={googleConectado ? 'secondary' : 'outline'}
          className="border-primary/30 text-primary hover:bg-primary/10 font-bold"
        >
          {googleConectado ? 'Conectado ✓' : t.btnAgenda}
        </Button>
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