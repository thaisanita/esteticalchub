// Emails automáticos: tipos, textos e definições por omissão.
// Os mesmos textos por omissão estão em supabase/functions/processar-fila
// (EMAILS_PADRAO) — um teste confirma que não divergem.
import { formatarData, formatarHora } from './utils';
import { URL_PUBLICO } from './empresa';

export type TipoEmail = 'email_confirmacao' | 'email_cuidados' | 'email_avaliacao' | 'email_retoque';

export interface DefinicaoEmail {
  tipo: TipoEmail;
  titulo: string;
  explicacao: string;
  /** Ligado quando a utilizadora ainda não guardou nada. */
  ativoPorOmissao: boolean;
  assunto: string;
  texto: string;
  espera_horas: number | null;
  espera_dias: number | null;
  hora_envio: string | null;
}

export const EMAILS: DefinicaoEmail[] = [
  {
    tipo: 'email_confirmacao',
    titulo: 'Confirmação da marcação',
    explicacao: 'Sai logo que crias a marcação, se a cliente tiver email.',
    ativoPorOmissao: true,
    assunto: 'Agendamento marcado — {procedimento} em {dia}',
    texto: [
      'Olá, {cliente}! O seu agendamento ficou marcado: {procedimento}, dia {dia} às {hora}.',
      'Local: {local}',
      '',
      'Confirmar presença: {link_confirmacao}',
    ].join('\n'),
    espera_horas: null,
    espera_dias: null,
    hora_envio: null,
  },
  {
    tipo: 'email_cuidados',
    titulo: 'Cuidados depois do atendimento',
    explicacao: 'Sai algumas horas depois do fim do atendimento, com os cuidados a ter.',
    ativoPorOmissao: false,
    assunto: 'Cuidados depois de {procedimento}',
    texto: [
      'Olá, {cliente}! Obrigada pela visita.',
      'Para o resultado de {procedimento} durar mais, nas próximas 24 a 48 horas:',
      '• evite molhar e tocar na zona tratada;',
      '• não aplique maquilhagem nem cremes na zona;',
      '• evite sol direto, sauna e piscina.',
      'Se notar alguma reação, responda a este email.',
    ].join('\n'),
    espera_horas: 2,
    espera_dias: null,
    hora_envio: null,
  },
  {
    tipo: 'email_avaliacao',
    titulo: 'Pedido de avaliação',
    explicacao: 'Sai no dia seguinte, a pedir à cliente uma avaliação no teu link (por exemplo, Google).',
    ativoPorOmissao: false,
    assunto: 'Como correu o atendimento de {procedimento}?',
    texto: [
      'Olá, {cliente}! Espero que tenha gostado do atendimento de {procedimento}.',
      'A sua opinião ajuda muito o meu trabalho. Pode deixar uma avaliação aqui (demora 1 minuto):',
      '{link_avaliacao}',
      'Obrigada! {profissional}',
    ].join('\n'),
    espera_horas: null,
    espera_dias: 1,
    hora_envio: '10:00',
  },
  {
    tipo: 'email_retoque',
    titulo: 'Lembrete de retoque',
    explicacao: 'Sai N dias depois, só nas marcações em que ligares o retoque (no Novo Agendamento).',
    ativoPorOmissao: false,
    assunto: 'Está na altura do retoque de {procedimento}',
    texto: [
      'Olá, {cliente}! Já passaram algumas semanas desde o atendimento de {procedimento} ({dia}).',
      'Está na altura ideal para o retoque. Responda a este email para marcarmos.',
      'Até breve! {profissional}',
    ].join('\n'),
    espera_horas: null,
    espera_dias: 30,
    hora_envio: '10:00',
  },
];

export const definicaoEmail = (tipo: TipoEmail) => EMAILS.find((e) => e.tipo === tipo)!;

/** Variáveis dos emails (as do WhatsApp + profissional + link de avaliação). */
export const VARIAVEIS_EMAIL: { chave: string; descricao: string; exemplo: string }[] = [
  { chave: 'cliente', descricao: 'Primeiro nome da cliente', exemplo: 'Ana' },
  { chave: 'procedimento', descricao: 'Procedimento', exemplo: 'Pestanas' },
  { chave: 'dia', descricao: 'Dia da marcação', exemplo: '21/11/2026' },
  { chave: 'hora', descricao: 'Hora', exemplo: '10:00' },
  { chave: 'local', descricao: 'Local ou morada', exemplo: 'Sala 1' },
  { chave: 'link_confirmacao', descricao: 'Link para confirmar', exemplo: `${URL_PUBLICO}/confirmacao/…` },
  { chave: 'profissional', descricao: 'O teu nome', exemplo: 'Thais' },
  { chave: 'link_avaliacao', descricao: 'O teu link de avaliação', exemplo: 'https://g.page/r/…' },
];

/** Linha guardada em modelos_mensagem (só os campos usados pela app). */
export interface ModeloGuardado {
  tipo: string;
  assunto: string | null;
  texto: string;
  ativo: boolean;
  espera_horas: number | null;
  espera_dias: number | null;
  hora_envio: string | null;
  link_avaliacao: string | null;
}

/** Definições efetivas de um email: as guardadas, ou as por omissão. */
export function modeloEfetivo(tipo: TipoEmail, guardado?: ModeloGuardado | null) {
  const d = definicaoEmail(tipo);
  return {
    guardado: !!guardado,
    ativo: guardado ? guardado.ativo : d.ativoPorOmissao,
    assunto: guardado?.assunto ?? d.assunto,
    texto: guardado?.texto ?? d.texto,
    espera_horas: guardado?.espera_horas ?? d.espera_horas,
    espera_dias: guardado?.espera_dias ?? d.espera_dias,
    hora_envio: (guardado?.hora_envio ?? d.hora_envio)?.slice(0, 5) ?? null,
    link_avaliacao: guardado?.link_avaliacao ?? null,
  };
}

/** Valores das variáveis de um email. */
export function valoresEmail(m: {
  cliente?: string | null;
  procedimento?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  linkConfirmacao?: string | null;
  profissional?: string | null;
  linkAvaliacao?: string | null;
}): Record<string, string> {
  return {
    cliente: String(m.cliente || '').trim().split(/\s+/)[0] || '',
    procedimento: String(m.procedimento || '').trim() || 'atendimento',
    dia: m.data ? formatarData(m.data.slice(0, 10)) : '',
    hora: m.hora ? formatarHora(m.hora) : '',
    local: String(m.local || '').trim(),
    link_confirmacao: String(m.linkConfirmacao || '').trim(),
    profissional: String(m.profissional || '').trim(),
    link_avaliacao: String(m.linkAvaliacao || '').trim(),
  };
}

/** "Quando sai", em texto, para os cartões. */
export function textoQuandoSai(tipo: TipoEmail, m: { espera_horas: number | null; espera_dias: number | null; hora_envio: string | null }): string {
  switch (tipo) {
    case 'email_confirmacao':
      return 'Logo ao marcar';
    case 'email_cuidados':
      return `${m.espera_horas ?? 2} h depois do fim do atendimento`;
    case 'email_avaliacao': {
      const d = m.espera_dias ?? 1;
      return `${d === 1 ? 'No dia seguinte' : `${d} dias depois`}, às ${m.hora_envio ?? '10:00'}`;
    }
    case 'email_retoque':
      return `${m.espera_dias ?? 30} dias depois (por omissão), às ${m.hora_envio ?? '10:00'}`;
  }
}
