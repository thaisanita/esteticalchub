// Ficheiro único de traduções (PT/EN/ES) para todo o EstetiCalcHub.
// Antes, cada página mantinha o seu próprio dicionário separado — o que
// tornava fácil um ficheiro ficar desatualizado em relação aos outros.
// Agora todas as traduções vivem aqui, organizadas por página.

export type Idioma = 'Português (PT)' | 'English (US)' | 'Español (ES)';

export const IDIOMA_PADRAO: Idioma = 'Português (PT)';

export function obterIdiomaAtual(): Idioma {
  return (localStorage.getItem('config_idioma') as Idioma) || IDIOMA_PADRAO;
}

// ---------- NavbarLateral ----------
export interface TextosNavbar {
  agenda: string;
  procedimentos: string;
  porcentagem: string;
  relatorios: string;
  custos: string;
  clientes: string;
  pagamentos: string;
  kanban: string;
  configuracoes: string;
  sair: string;
}

export const textosNavbar: Record<Idioma, TextosNavbar> = {
  'Português (PT)': {
    agenda: 'Agenda', procedimentos: 'Procedimentos',
    porcentagem: 'Comissão', relatorios: 'Relatórios e Ganhos',
    custos: 'Custos', clientes: 'Clientes', pagamentos: 'Pagamentos', kanban: 'Planeamento',
    configuracoes: 'Configurações', sair: 'Sair',
  },
  'English (US)': {
    agenda: 'Schedule', procedimentos: 'Procedures',
    porcentagem: 'Commission', relatorios: 'Reports & Earnings',
    custos: 'Costs', clientes: 'Clients', pagamentos: 'Payments', kanban: 'Planning',
    configuracoes: 'Settings', sair: 'Logout',
  },
  'Español (ES)': {
    agenda: 'Agenda', procedimentos: 'Procedimientos',
    porcentagem: 'Comisión', relatorios: 'Informes y Ganancias',
    custos: 'Costos', clientes: 'Clientes', pagamentos: 'Pagos', kanban: 'Planificación',
    configuracoes: 'Configuración', sair: 'Salir',
  },
};

// ---------- Config ----------
export interface TextosConfig {
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

export const textosConfig: Record<Idioma, TextosConfig> = {
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
    agendaSub: 'Conectar com Google Calendar',
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
    agendaSub: 'Connect with Google Calendar',
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
    agendaSub: 'Conectar con Google Calendar',
    btnAgenda: 'Conectar Google',
    btnSalvar: 'Guardar Cambios',
    btnVoltar: 'Volver a la Agenda',
    alerta: '¡Configuraciones guardadas con éxito!',
  },
};

// ---------- Procedimentos ----------
export interface TextosProcedimentos {
  titulo: string;
  encontrado: string;
  encontrados: string;
  vazio: string;
  faltou: string;
  editar: string;
  total: string;
  btnVoltar: string;
  btnNovo: string;
  confFalta: string;
  confExcluir: string;
  formatoData: string;
  selecione: string;
}

export const textosProcedimentos: Record<Idioma, TextosProcedimentos> = {
  'Português (PT)': {
    titulo: 'Atendimentos do Dia', encontrado: 'agendamento', encontrados: 'agendamentos',
    vazio: 'Nenhum agendamento para esta data.', faltou: 'Falta', editar: 'Editar', total: 'Total Faturado no Dia',
    btnVoltar: 'Voltar à Agenda', btnNovo: 'Novo Agendamento',
    confFalta: 'Confirmar falta? O valor deste atendimento será zerado.',
    confExcluir: 'Tem certeza que deseja excluir este atendimento?', formatoData: 'pt-PT', selecione: 'Selecione uma data',
  },
  'English (US)': {
    titulo: 'Appointments of the Day', encontrado: 'appointment', encontrados: 'appointments',
    vazio: 'No appointments scheduled for this day.', faltou: 'No-show', editar: 'Edit', total: 'Total Daily Revenue',
    btnVoltar: 'Back to Schedule', btnNovo: 'New Appointment',
    confFalta: 'Mark as no-show? The amount for this service will be zeroed.',
    confExcluir: 'Are you sure you want to delete this appointment?', formatoData: 'en-US', selecione: 'Select a date',
  },
  'Español (ES)': {
    titulo: 'Citas del Día', encontrado: 'cita', encontrados: 'citas',
    vazio: 'No hay citas para este día.', faltou: 'Faltó', editar: 'Editar', total: 'Total Realizado del Día',
    btnVoltar: 'Volver a la Agenda', btnNovo: 'Nueva Cita',
    confFalta: '¿Marcar como falta? El valor se ajustará a cero.',
    confExcluir: '¿Está seguro de que desea eliminar esta cita?', formatoData: 'es-ES', selecione: 'Seleccione un día',
  },
};

// ---------- Kanban ----------
export interface TextosKanban {
  titulo: string;
  subtitulo: string;
  novoQuadro: string;
  novoQuadroTitulo: string;
  nomeQuadroPlaceholder: string;
  criar: string;
  cancelar: string;
  novaLista: string;
  nomeListaPlaceholder: string;
  adicionarCartao: string;
  tituloCartaoPlaceholder: string;
  descricaoPlaceholder: string;
  vazio: string;
  vazioSub: string;
  confExcluirQuadro: string;
  confExcluirLista: string;
  confExcluirCartao: string;
}

export const textosKanban: Record<Idioma, TextosKanban> = {
  'Português (PT)': {
    titulo: 'Planeamento', subtitulo: 'Organize ideias, tarefas e projetos do seu negócio.',
    novoQuadro: 'Novo Quadro', novoQuadroTitulo: 'Criar novo quadro', nomeQuadroPlaceholder: 'Ex.: Marketing',
    criar: 'Criar', cancelar: 'Cancelar',
    novaLista: 'Nova lista', nomeListaPlaceholder: 'Nome da lista',
    adicionarCartao: '+ Adicionar cartão', tituloCartaoPlaceholder: 'Título do cartão',
    descricaoPlaceholder: 'Descrição (opcional)...',
    vazio: 'Ainda não tem nenhum quadro.', vazioSub: 'Crie um quadro para começar a organizar as suas ideias.',
    confExcluirQuadro: 'Excluir este quadro e todo o seu conteúdo?',
    confExcluirLista: 'Excluir esta lista e todos os seus cartões?',
    confExcluirCartao: 'Excluir este cartão?',
  },
  'English (US)': {
    titulo: 'Planning', subtitulo: 'Organize ideas, tasks and projects for your business.',
    novoQuadro: 'New Board', novoQuadroTitulo: 'Create new board', nomeQuadroPlaceholder: 'E.g.: Marketing',
    criar: 'Create', cancelar: 'Cancel',
    novaLista: 'New list', nomeListaPlaceholder: 'List name',
    adicionarCartao: '+ Add card', tituloCartaoPlaceholder: 'Card title',
    descricaoPlaceholder: 'Description (optional)...',
    vazio: "You don't have any boards yet.", vazioSub: 'Create a board to start organizing your ideas.',
    confExcluirQuadro: 'Delete this board and all its content?',
    confExcluirLista: 'Delete this list and all its cards?',
    confExcluirCartao: 'Delete this card?',
  },
  'Español (ES)': {
    titulo: 'Planificación', subtitulo: 'Organice ideas, tareas y proyectos de su negocio.',
    novoQuadro: 'Nuevo Tablero', novoQuadroTitulo: 'Crear nuevo tablero', nomeQuadroPlaceholder: 'Ej.: Marketing',
    criar: 'Crear', cancelar: 'Cancelar',
    novaLista: 'Nueva lista', nomeListaPlaceholder: 'Nombre de la lista',
    adicionarCartao: '+ Añadir tarjeta', tituloCartaoPlaceholder: 'Título de la tarjeta',
    descricaoPlaceholder: 'Descripción (opcional)...',
    vazio: 'Aún no tiene ningún tablero.', vazioSub: 'Cree un tablero para empezar a organizar sus ideas.',
    confExcluirQuadro: '¿Eliminar este tablero y todo su contenido?',
    confExcluirLista: '¿Eliminar esta lista y todas sus tarjetas?',
    confExcluirCartao: '¿Eliminar esta tarjeta?',
  },
};
