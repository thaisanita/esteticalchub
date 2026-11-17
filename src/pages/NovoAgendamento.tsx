import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { getErrorMessage, parseMoeda, atendeDomicilio, moradaCompleta, formatarEuro, formatarData } from '@/lib/utils';
import { confirmar } from '@/components/ConfirmDialog';
import CamposMorada from '@/components/CamposMorada';
import { normalizarCodigoPostal } from '@/hooks/useCodigoPostal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LEMBRETES_WHATSAPP_ATIVOS } from '@/hooks/usePlano';
import {
  Calendar, 
  Pencil, 
  User, 
  Sparkles, 
  MapPin, 
  Clock, 
  Euro, 
  ArrowLeft, 
  Save, 
  History,
  Phone,
  Mail,
  Bell,
  FileHeart,
  Wand2,
  Package,
  Target,
  Building2,
  Home,
} from 'lucide-react';
import { URL_PUBLICO } from '@/lib/empresa';
import { isoDia, totaisDoMes, totalCustosFixosMensais, type CustoFixo } from '@/lib/lucro';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MoradaCliente = { morada: string | null; codigo_postal: string | null; localidade: string | null };
type ClienteDb = { id: string; nome: string; telefone: string | null; email: string | null } & MoradaCliente;
const VAZIA: MoradaCliente = { morada: null, codigo_postal: null, localidade: null };

const limpo = (v: string | null | undefined) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
/** Mesma morada nos três campos (ignora maiúsculas e espaços a mais). */
function mesmaMorada(a: MoradaCliente, b: MoradaCliente): boolean {
  return (
    limpo(a.morada) === limpo(b.morada) &&
    limpo(normalizarCodigoPostal(a.codigo_postal || '') ?? a.codigo_postal) ===
      limpo(normalizarCodigoPostal(b.codigo_postal || '') ?? b.codigo_postal) &&
    limpo(a.localidade) === limpo(b.localidade)
  );
}

interface NovoAgendamentoProps {
  setAgendamentos?: (novosDados: unknown[]) => void;
}

const NovoAgendamento: React.FC<NovoAgendamentoProps> = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dataAgendamento, setDataAgendamento] = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );
  const idParaEditar = searchParams.get('edit');

  const [nomeCliente, setNomeCliente] = useState('');
  const [apelidoCliente, setApelidoCliente] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [temProntuario, setTemProntuario] = useState<boolean | null>(null);
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('10:00');
  const [preco, setPreco] = useState('');
  // "Onde é o atendimento?" — escolhido em cada agendamento (já não na agenda).
  // Estúdio: usa o campo Espaço / Local. Domicílio: usa a morada (rua, código
  // postal, localidade), que pode vir da ficha da cliente.
  const [localTipo, setLocalTipo] = useState<'estudio' | 'domicilio'>('estudio');
  const [pontoAtendimento, setPontoAtendimento] = useState('');
  const [moradaDom, setMoradaDom] = useState('');
  const [codigoPostalDom, setCodigoPostalDom] = useState('');
  const [localidadeDom, setLocalidadeDom] = useState('');
  // Muda sempre que a morada é preenchida pela app (ficha da cliente ou
  // agendamento a editar), para o CamposMorada não substituir a localidade
  // guardada pela do código postal.
  const [chaveMorada, setChaveMorada] = useState(0);
  // Em que agenda este agendamento fica guardado (TimeTree-style: várias
  // agendas possíveis, Principal por omissão).
  const [agendaId, setAgendaId] = useState<string>('');
  const [agendas, setAgendas] = useState<
    { id: string; nome: string; cor: string; principal: boolean }[]
  >([]);
  
  // Configurações de Notificação
  const [lembrete1Dia, setLembrete1Dia] = useState(true);
  const [lembrete1Hora, setLembrete1Hora] = useState(true);
  const [canalNotificacao, setCanalNotificacao] = useState<'whatsapp' | 'email'>('whatsapp');

  // Se o canal escolhido ficar sem contacto (ex: apagou o telefone), muda
  // automaticamente para o outro canal, se este tiver contacto preenchido.
  useEffect(() => {
    if (canalNotificacao === 'whatsapp' && !telefoneCliente.trim() && emailCliente.trim()) {
      setCanalNotificacao('email');
    } else if (canalNotificacao === 'email' && !emailCliente.trim() && telefoneCliente.trim()) {
      setCanalNotificacao('whatsapp');
    }
  }, [telefoneCliente, emailCliente, canalNotificacao]);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [sugestoesCliente, setSugestoesCliente] = useState<string[]>([]);
  const [sugestoesProcedimento, setSugestoesProcedimento] = useState<string[]>([]);
  const [sugestoesPonto, setSugestoesPonto] = useState<string[]>([]);
  const [sugestaoInteligente, setSugestaoInteligente] = useState<{ preco: number; duracaoMin: number } | null>(null);
  const [historicoProcedimento, setHistoricoProcedimento] = useState<{ vezes: number; produtos: { nome: string; vezes: number }[] } | null>(null);
  const [custosFixosMes, setCustosFixosMes] = useState<number | null>(null);
  const [faturamentoMesAtual, setFaturamentoMesAtual] = useState<number>(0);
  const [clientesDb, setClientesDb] = useState<ClienteDb[]>([]);
  // Morada guardada na ficha da cliente selecionada: preenche os campos de
  // domicílio e serve para perguntar se a ficha deve ser atualizada.
  const [moradaClienteAtual, setMoradaClienteAtual] = useState<MoradaCliente | null>(null);
  // Morada com que o agendamento a editar foi aberto: guardar sem lhe mexer
  // não volta a perguntar pela ficha da cliente.
  const [moradaCarregada, setMoradaCarregada] = useState<MoradaCliente | null>(null);

  // Nome completo, combinado a partir dos dois campos, usado para guardar
  // e comparar com o resto do site (Clientes, Prontuário, etc. continuam a
  // guardar um único campo "nome").
  const cliente = `${nomeCliente} ${apelidoCliente}`.trim();

  const moradaDoAtendimento: MoradaCliente = {
    morada: moradaDom.trim() || null,
    codigo_postal: normalizarCodigoPostal(codigoPostalDom) ?? (codigoPostalDom.trim() || null),
    localidade: localidadeDom.trim() || null,
  };
  // Texto do local usado nos lembretes, no email de confirmação e guardado em
  // ponto_atendimento (o .ics e o Google Calendar leem daí).
  const localTexto =
    localTipo === 'domicilio' ? moradaCompleta(moradaDoAtendimento) : pontoAtendimento.trim();

  const preencherMoradaDaCliente = (m: MoradaCliente | null) => {
    if (!m || !moradaCompleta(m)) return;
    setMoradaDom(m.morada || '');
    setCodigoPostalDom(m.codigo_postal || '');
    setLocalidadeDom(m.localidade || '');
    setChaveMorada((k) => k + 1);
  };
  const camposDomicilioVazios = !moradaDom.trim() && !codigoPostalDom.trim() && !localidadeDom.trim();

  const escolherLocal = (tipo: 'estudio' | 'domicilio') => {
    setLocalTipo(tipo);
    if (tipo === 'domicilio' && camposDomicilioVazios) preencherMoradaDaCliente(moradaClienteAtual);
  };


  // Atualiza a hora de fim automaticamente ao alterar o início
  const handleHoraInicioChange = (novaHoraInicio: string) => {
    setHoraInicio(novaHoraInicio);
    if (!novaHoraInicio) return;
    const [horas, minutos] = novaHoraInicio.split(':').map(Number);
    const novaHoraFim = (horas + 1) % 24;
    const horaFormatada = String(novaHoraFim).padStart(2, '0') + ':' + String(minutos).padStart(2, '0');
    setHoraFim(horaFormatada);
  };

  useEffect(() => {
    setSugestoesCliente(JSON.parse(localStorage.getItem('hist_clientes') || '[]'));
    setSugestoesProcedimento(JSON.parse(localStorage.getItem('hist_procedimentos') || '[]'));
    setSugestoesPonto(JSON.parse(localStorage.getItem('hist_pontos') || '[]'));

    supabase
      .from('clientes')
      .select('id, nome, telefone, email, morada, codigo_postal, localidade')
      .order('nome', { ascending: true })
      .then(({ data }) => setClientesDb(data || []));
  }, []);

  // Sugestões de clientes reais (tabela clientes), com fallback para o histórico local
  // enquanto a lista de clientes ainda está vazia (ex: antes da primeira importação).
  const sugestoesClienteFiltradas = cliente.trim()
    ? clientesDb.filter((c) => c.nome.toLowerCase().includes(cliente.trim().toLowerCase())).slice(0, 5)
    : [];

  // Divide um nome completo em Nome + Apelido, para preencher os dois campos
  const preencherNomeCompleto = (nomeCompleto: string) => {
    const partes = nomeCompleto.trim().split(/\s+/);
    setNomeCliente(partes[0] || '');
    setApelidoCliente(partes.slice(1).join(' '));
  };

  const selecionarClienteExistente = (c: ClienteDb) => {
    preencherNomeCompleto(c.nome);
    setClienteId(c.id);
    if (c.telefone) setTelefoneCliente(c.telefone);
    if (c.email) setEmailCliente(c.email);
    const m = { morada: c.morada, codigo_postal: c.codigo_postal, localidade: c.localidade };
    setMoradaClienteAtual(m);
    // Só no domicílio, e só se os campos ainda estiverem vazios — não apaga
    // nada escrito à mão para este atendimento. O Espaço / Local do estúdio
    // nunca é preenchido com a morada da cliente.
    if (localTipo === 'domicilio' && camposDomicilioVazios) preencherMoradaDaCliente(m);
  };

  // Sugestão inteligente: procura o último atendimento com o mesmo
  // procedimento e sugere o valor e a duração usados da última vez.
  useEffect(() => {
    if (!procedimento.trim() || idParaEditar) {
      setSugestaoInteligente(null);
      return;
    }
    const atraso = setTimeout(async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('preco, valor, hora, hora_fim')
        .ilike('procedimento', procedimento.trim())
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setSugestaoInteligente(null);
        return;
      }

      const valorSugerido = parseMoeda(data.valor ?? data.preco ?? 0);
      let duracaoMin = 60;
      if (data.hora && data.hora_fim) {
        const [h1, m1] = data.hora.split(':').map(Number);
        const [h2, m2] = data.hora_fim.split(':').map(Number);
        duracaoMin = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (duracaoMin <= 0) duracaoMin += 24 * 60;
      }

      if (valorSugerido > 0) {
        setSugestaoInteligente({ preco: valorSugerido, duracaoMin });
      } else {
        setSugestaoInteligente(null);
      }
    }, 500);

    return () => clearTimeout(atraso);
  }, [procedimento, idParaEditar]);

  // Histórico de estoque: quantas vezes já fez este procedimento, e quais
  // produtos foram usados nessas vezes (liga Procedimento ao Estoque).
  useEffect(() => {
    if (!procedimento.trim()) {
      setHistoricoProcedimento(null);
      return;
    }
    const atraso = setTimeout(async () => {
      const { data: agendamentosDoProcedimento } = await supabase
        .from('agendamentos')
        .select('id')
        .ilike('procedimento', procedimento.trim());

      const vezes = agendamentosDoProcedimento?.length || 0;
      if (vezes === 0) {
        setHistoricoProcedimento(null);
        return;
      }

      const ids = agendamentosDoProcedimento!.map((a) => a.id);
      const { data: usos } = await supabase
        .from('produto_usos')
        .select('produto_id, produtos(nome)')
        .in('agendamento_id', ids);

      const contagem: Record<string, number> = {};
      (usos || []).forEach((u: any) => {
        const nomeProduto = u.produtos?.nome || 'Produto';
        contagem[nomeProduto] = (contagem[nomeProduto] || 0) + 1;
      });

      setHistoricoProcedimento({
        vezes,
        produtos: Object.entries(contagem).map(([nome, vezes]) => ({ nome, vezes })),
      });
    }, 500);

    return () => clearTimeout(atraso);
  }, [procedimento]);

  // Ponto de equilíbrio: quanto está marcado este mês (Previsto, sem faltas)
  // e quanto falta para cobrir os custos fixos (equivalente mensal).
  useEffect(() => {
    const buscarPontoEquilibrio = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: fixos } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('usuario_id', user.id);
      setCustosFixosMes(totalCustosFixosMensais((fixos as CustoFixo[]) || []));

      const hoje = new Date();
      const prefixoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const { data: agendamentosDoMes } = await supabase
        .from('agendamentos')
        .select('id, valor, preco, data, faltou')
        .eq('usuario_id', user.id)
        .gte('data', `${prefixoMes}-01`)
        .lte('data', `${prefixoMes}-31`);
      // Ao editar, o próprio agendamento não entra (é somado à parte, com o preço novo).
      const outros = (agendamentosDoMes || []).filter((a) => !idParaEditar || String(a.id) !== String(idParaEditar));
      setFaturamentoMesAtual(totaisDoMes(outros, prefixoMes, isoDia(hoje)).previsto);
    };
    buscarPontoEquilibrio();
  }, [idParaEditar]);

  const aplicarSugestaoInteligente = () => {
    if (!sugestaoInteligente) return;
    setPreco(String(sugestaoInteligente.preco));
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMin = h * 60 + m + sugestaoInteligente.duracaoMin;
    const novaHoraFim = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    setHoraFim(novaHoraFim);
    setSugestaoInteligente(null);
  };


  // Verifica se a cliente selecionada já tem ficha de prontuário preenchida
  useEffect(() => {
    if (!clienteId) {
      setTemProntuario(null);
      return;
    }
    supabase
      .from('prontuarios')
      .select('id')
      .eq('cliente_id', clienteId)
      .maybeSingle()
      .then(({ data }) => setTemProntuario(!!data));
  }, [clienteId]);


  const salvarHistorico = (chave: string, valor: string) => {
    if (!valor.trim()) return;
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');
    const nova = [valor.trim(), ...lista.filter((i: string) => i !== valor.trim())].slice(0, 5);
    localStorage.setItem(chave, JSON.stringify(nova));
  };

  // Lista de agendas a que a profissional pertence, para escolher onde guardar.
  useEffect(() => {
    const buscarAgendas = async () => {
      const { data } = await supabase
        .from('agendas')
        .select('id, nome, cor, principal')
        .order('principal', { ascending: false })
        .order('nome', { ascending: true });
      if (data) {
        setAgendas(data);
        if (!idParaEditar) {
          const principal = data.find((a) => a.principal);
          if (principal) setAgendaId(principal.id);
        }
      }
    };
    buscarAgendas();
  }, [idParaEditar]);

  useEffect(() => {
    const buscarDados = async () => {
      if (idParaEditar) {
        try {
          const { data, error } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('id', idParaEditar)
            .single();

          if (data && !error) {
            preencherNomeCompleto(data.cliente || '');
            setClienteId(data.cliente_id || null);
            setTelefoneCliente(data.telefone_cliente || '');
            setEmailCliente(data.email_cliente || '');
            setProcedimento(data.procedimento || '');
            setPreco(
              data.preco !== undefined && data.preco !== null
                ? String(data.preco)
                : data.valor !== undefined && data.valor !== null
                ? String(data.valor)
                : ''
            );
            const localGuardado: string = data.ponto_atendimento || data.pontoAtendimento || '';
            let eDomicilio = data.local_tipo === 'domicilio';
            if (!data.local_tipo && data.agenda_id) {
              // Agendamento antigo (sem local_tipo): segue o tipo da agenda, como antes.
              const { data: ag } = await supabase
                .from('agendas')
                .select('tipo_atendimento')
                .eq('id', data.agenda_id)
                .maybeSingle();
              eDomicilio = atendeDomicilio(ag?.tipo_atendimento);
            }
            setLocalTipo(eDomicilio ? 'domicilio' : 'estudio');
            if (eDomicilio) {
              // Antigos só têm o texto em ponto_atendimento: vai para "Rua e número".
              const carregada: MoradaCliente = {
                morada: (data.local_tipo ? data.morada : localGuardado) || null,
                codigo_postal: data.codigo_postal || null,
                localidade: data.localidade || null,
              };
              setMoradaCarregada(carregada);
              setMoradaDom(carregada.morada || '');
              setCodigoPostalDom(carregada.codigo_postal || '');
              setLocalidadeDom(carregada.localidade || '');
              setChaveMorada((k) => k + 1);
            } else {
              setPontoAtendimento(localGuardado);
            }
            if (data.cliente_id) {
              const { data: cli } = await supabase
                .from('clientes')
                .select('morada, codigo_postal, localidade')
                .eq('id', data.cliente_id)
                .maybeSingle();
              if (cli) setMoradaClienteAtual(cli);
            }
            if (data.agenda_id) setAgendaId(data.agenda_id);
            setDataAgendamento(data.data || '');
            setHoraInicio(data.hora || '09:00');
            if (data.hora_fim) setHoraFim(data.hora_fim);
            if (data.canal_notificacao === 'email' || data.canal_notificacao === 'whatsapp') {
              setCanalNotificacao(data.canal_notificacao);
            }
            if (typeof data.lembrete_1dia === 'boolean') setLembrete1Dia(data.lembrete_1dia);
            if (typeof data.lembrete_1hora === 'boolean') setLembrete1Hora(data.lembrete_1hora);
          }
        } catch (e) {
          console.error('Erro ao buscar agendamento:', e);
        }
      }
      setLoading(false);
    };
    buscarDados();
  }, [idParaEditar]);

  // Monta o texto do lembrete e "congela-o" na fila, para o worker (Edge
  // Function processar-fila) só ter de enviar. Ver NOTIFICACOES_AUTOMATICAS.md.
  const construirLembrete = (antecedencia: '1_dia' | '1_hora', rodape = '') => {
    const quando = antecedencia === '1_dia' ? 'amanhã' : 'hoje';
    const primeiroNome = (nomeCliente || cliente).split(' ')[0] || 'tudo bem';
    const dataFmt = formatarData(dataAgendamento);
    const local = localTexto ? ` Local: ${localTexto}.` : '';
    const mensagem =
      `Olá, ${primeiroNome}! Passando para lembrar do seu agendamento de ` +
      `${procedimento.trim() || 'atendimento'} ${quando} (${dataFmt}) às ${horaInicio}.${local} ` +
      `Qualquer imprevisto, é só responder. Até breve! ✨${rodape}`;
    const assunto = `Lembrete: ${procedimento.trim() || 'seu atendimento'} ${quando}`;
    return { mensagem, assunto };
  };

  // Email único, disparado assim que a marcação é criada (nunca nas
  // edições — ver "!idParaEditar" em criarFilaNotificacoes).
  const construirConfirmacaoAgendamento = (linkConfirmacao: string, nomeNegocio: string) => {
    const primeiroNome = (nomeCliente || cliente).split(' ')[0] || 'tudo bem';
    const dataFmt = formatarData(dataAgendamento);
    const local = localTexto ? ` Local: ${localTexto}.` : '';
    const comQuem = nomeNegocio ? ` com ${nomeNegocio}` : '';
    const confirmacao = linkConfirmacao ? `\n\nConfirmar presença: ${linkConfirmacao}` : '';
    const mensagem =
      `Olá, ${primeiroNome}! O seu agendamento${comQuem} ficou marcado: ` +
      `${procedimento.trim() || 'atendimento'}, dia ${dataFmt} às ${horaInicio}.${local}${confirmacao}`;
    const assunto = `Agendamento marcado — ${procedimento.trim() || 'seu atendimento'} em ${dataFmt}`;
    return { mensagem, assunto };
  };

  const criarFilaNotificacoes = async (
    agendamentoId: string,
    userId: string,
    clienteIdDaCliente: string | null,
    confirmacaoToken: string | null
  ) => {
    // WhatsApp: junta ao texto a ligação para a cliente deixar de receber lembretes
    // (nos emails, a Edge Function já acrescenta essa ligação sozinha).
    let rodape = '';
    if (canalNotificacao === 'whatsapp' && clienteIdDaCliente) {
      const { data: cli } = await supabase
        .from('clientes')
        .select('opt_out_token')
        .eq('id', clienteIdDaCliente)
        .maybeSingle();
      if (cli?.opt_out_token) {
        rodape = `\n\nPara deixar de receber lembretes: ${URL_PUBLICO}/opt-out?token=${cli.opt_out_token}`;
      }
    }

    const dataHoraAtendimento = new Date(`${dataAgendamento}T${horaInicio}:00`);
    const destino =
      canalNotificacao === 'email'
        ? emailCliente.trim()
        : telefoneCliente.replace(/\D/g, '');
    const notificacoes = [];

    // Lembrete de 1 Dia Antes
    if (lembrete1Dia) {
      const data1Dia = new Date(dataHoraAtendimento.getTime() - 24 * 60 * 60 * 1000);
      if (data1Dia > new Date()) {
        notificacoes.push({
          agendamento_id: agendamentoId,
          usuario_id: userId,
          tipo_destino: 'cliente',
          canal: canalNotificacao,
          antecedencia: '1_dia',
          data_disparo: data1Dia.toISOString(),
          status: 'pendente',
          destino,
          ...construirLembrete('1_dia', rodape),
        });
      }
    }

    // Lembrete de 1 Hora Antes
    if (lembrete1Hora) {
      const data1Hora = new Date(dataHoraAtendimento.getTime() - 60 * 60 * 1000);
      if (data1Hora > new Date()) {
        notificacoes.push({
          agendamento_id: agendamentoId,
          usuario_id: userId,
          tipo_destino: 'cliente',
          canal: canalNotificacao,
          antecedencia: '1_hora',
          data_disparo: data1Hora.toISOString(),
          status: 'pendente',
          destino,
          ...construirLembrete('1_hora', rodape),
        });
      }
    }

    if (notificacoes.length > 0) {
      if (idParaEditar) {
        await supabase
          .from('fila_notificacoes')
          .delete()
          .eq('agendamento_id', agendamentoId)
          .eq('status', 'pendente');
      }

      const { data: resultFila, error } = await supabase
        .from('fila_notificacoes')
        .insert(notificacoes)
        .select();

      if (error) {
        console.error('Erro ao agendar notificações:', error.message);
        toast.error(`Erro ao agendar notificação: ${error.message}`);
      }
    }

    // Confirmação por email: só na criação (nunca nas edições), só se
    // houver email da cliente. Insert próprio e isolado do bloco dos
    // lembretes acima — uma falha aqui não pode impedir os lembretes de
    // serem gravados, e a marcação em si já foi criada antes desta função
    // ser chamada, por isso um erro aqui nunca impede o agendamento de
    // ficar guardado.
    if (!idParaEditar && emailCliente.trim()) {
      const linkConfirmacao = confirmacaoToken
        ? `https://esteticalchub.pt/confirmacao/${confirmacaoToken}`
        : '';

      // Se esta consulta falhar, "data" fica undefined e nomeNegocio vazio —
      // o email sai na mesma, só sem o "com {negócio}" no texto.
      const { data: pagina } = await supabase
        .from('paginas_publicas')
        .select('nome_negocio')
        .eq('usuario_id', userId)
        .maybeSingle();
      const nomeNegocio = pagina?.nome_negocio?.trim() || '';

      const { error: erroConfirmacao } = await supabase.from('fila_notificacoes').insert([{
        agendamento_id: agendamentoId,
        usuario_id: userId,
        tipo_destino: 'cliente',
        tipo: 'confirmacao_agendamento',
        canal: 'email',
        antecedencia: '1_hora', // reaproveitado: ignorado pelo processar-fila quando mensagem/assunto já vêm prontos
        data_disparo: new Date().toISOString(),
        status: 'pendente',
        destino: emailCliente.trim(),
        ...construirConfirmacaoAgendamento(linkConfirmacao, nomeNegocio),
      }]);

      if (erroConfirmacao) {
        console.error('Erro ao agendar email de confirmação:', erroConfirmacao.message);
      }
    }
  };

  const manipularSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('Sua sessão expirou. Por favor, entre novamente no sistema.');
        navigate('/login');
        return;
      }

      const valorFormatado = parseMoeda(preco);

      // Resolve a cliente: usa a selecionada, ou encontra por nome igual, ou cria uma nova.
      // Assim, mesmo digitando o nome à mão, o agendamento fica sempre ligado por ID.
      const eDomicilio = localTipo === 'domicilio';
      const temMoradaDom = eDomicilio && !!moradaCompleta(moradaDoAtendimento);

      let clienteIdFinal = clienteId;
      // Morada na ficha da cliente existente (null = cliente nova).
      let moradaNaFicha: MoradaCliente | null = clienteId ? moradaClienteAtual ?? VAZIA : null;
      if (!clienteIdFinal && cliente.trim()) {
        const { data: existente } = await supabase
          .from('clientes')
          .select('id, morada, codigo_postal, localidade')
          .ilike('nome', cliente.trim())
          .maybeSingle();

        if (existente) {
          clienteIdFinal = existente.id;
          moradaNaFicha = existente;
        } else {
          const { data: novaCliente, error: erroNovaCliente } = await supabase
            .from('clientes')
            .insert([{
              nome: cliente.trim(),
              telefone: telefoneCliente.trim() || null,
              email: emailCliente.trim() || null,
              agenda_id: agendaId || null,
              // Cliente nova num atendimento ao domicílio: a morada fica logo na ficha.
              ...(temMoradaDom ? moradaDoAtendimento : {}),
            }])
            .select('id')
            .single();
          if (!erroNovaCliente) clienteIdFinal = novaCliente.id;
        }
      }

      // Cliente existente com morada diferente da ficha: pergunta antes de mexer
      // na ficha — mas só se a morada foi mudada aqui (não ao reabrir para editar).
      const moradaMudouAqui = !(moradaCarregada && mesmaMorada(moradaCarregada, moradaDoAtendimento));
      if (
        temMoradaDom &&
        clienteIdFinal &&
        moradaNaFicha &&
        moradaMudouAqui &&
        !mesmaMorada(moradaNaFicha, moradaDoAtendimento)
      ) {
        const fichaTemMorada = !!moradaCompleta(moradaNaFicha);
        const atualizar = await confirmar({
          titulo: fichaTemMorada ? 'Atualizar a ficha da cliente?' : 'Guardar a morada na ficha?',
          descricao: fichaTemMorada
            ? `A morada deste atendimento é diferente da que está na ficha de ${cliente.trim()} (${moradaCompleta(moradaNaFicha)}). Queres atualizar a ficha com a nova morada?`
            : `${cliente.trim()} ainda não tem morada na ficha. Queres guardar esta morada na ficha dela?`,
          textoConfirmar: fichaTemMorada ? 'Atualizar ficha' : 'Guardar na ficha',
          textoCancelar: 'Só neste atendimento',
        });
        if (atualizar) {
          const { error: erroFicha } = await supabase
            .from('clientes')
            .update(moradaDoAtendimento)
            .eq('id', clienteIdFinal);
          if (erroFicha) toast.error('Não foi possível atualizar a morada na ficha: ' + getErrorMessage(erroFicha));
        }
      }

      const dadosParaEnviar = {
        cliente: cliente.trim(),
        cliente_id: clienteIdFinal,
        telefone_cliente: telefoneCliente.trim(),
        email_cliente: emailCliente.trim(),
        procedimento: procedimento.trim(),
        data: dataAgendamento,
        hora: horaInicio,
        hora_fim: horaFim,
        preco: valorFormatado,
        valor: valorFormatado,
        ponto_atendimento: localTexto,
        local_tipo: localTipo,
        morada: eDomicilio ? moradaDoAtendimento.morada : null,
        codigo_postal: eDomicilio ? moradaDoAtendimento.codigo_postal : null,
        localidade: eDomicilio ? moradaDoAtendimento.localidade : null,
        agenda_id: agendaId || null,
        usuario_id: user.id,
        canal_notificacao: canalNotificacao,
        lembrete_1dia: lembrete1Dia,
        lembrete_1hora: lembrete1Hora,
      };

      let agendamentoId = idParaEditar;
      let confirmacaoToken: string | null = null;

      if (idParaEditar) {
        const { error } = await supabase
          .from('agendamentos')
          .update(dadosParaEnviar)
          .eq('id', idParaEditar);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('agendamentos')
          .insert([dadosParaEnviar])
          .select('id, confirmacao_token')
          .single();

        if (error) throw error;
        agendamentoId = data.id;
        confirmacaoToken = data?.confirmacao_token ?? null;
      }

      if (agendamentoId) {
        await criarFilaNotificacoes(agendamentoId, user.id, clienteIdFinal, confirmacaoToken);
      }

      salvarHistorico('hist_clientes', cliente);
      salvarHistorico('hist_procedimentos', procedimento);
      if (!eDomicilio) salvarHistorico('hist_pontos', pontoAtendimento);
      toast.success(idParaEditar ? 'Agendamento atualizado.' : 'Agendamento criado.');

      // Redireciona de volta para a lista de procedimentos na data do agendamento
      navigate(`/procedimentos?date=${dataAgendamento}`);
    } catch (err) {
      console.error('Erro ao guardar agendamento:', err);
      toast.error(`Erro ao guardar agendamento: ${getErrorMessage(err)}`);
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar dados do agendamento...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {idParaEditar ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina os detalhes do atendimento e configure os lembretes do cliente
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          {idParaEditar ? <Pencil size={18} /> : <Calendar size={18} />}
        </div>
      </div>

      <form onSubmit={manipularSalvar} className="space-y-4">
        {/* Bloco 1: Quando, Onde e Quem */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-4">
          <div className="space-y-1.5" role="group" aria-labelledby="pergunta-local">
            <p id="pergunta-local" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin size={13} className="text-primary" />
              Onde é o atendimento?
            </p>
            <div className="flex gap-2">
              {([
                { valor: 'estudio', texto: 'Estúdio', Icone: Building2 },
                { valor: 'domicilio', texto: 'Domicílio', Icone: Home },
              ] as const).map(({ valor, texto, Icone }) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={localTipo === valor}
                  onClick={() => escolherLocal(valor)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    localTipo === valor
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <Icone size={14} /> {texto}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                Data
              </label>
              <Input
                type="date"
                required
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium"
              />
            </div>

            {agendas.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={13} className="text-primary" />
                  Agenda
                </label>
                <Select
                  value={agendaId}
                  onValueChange={setAgendaId}
                  items={agendas.map((a) => ({
                    value: a.id,
                    label: (
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: a.cor }}
                        />
                        {a.nome}
                      </span>
                    ),
                  }))}
                >
                  <SelectTrigger className="h-10 bg-background/50 border-border">
                    <SelectValue placeholder="Escolhe a agenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {agendas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: a.cor }}
                          />
                          {a.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {localTipo === 'estudio' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin size={13} className="text-primary" />
                  Espaço / Local
                </label>
                <Input
                  type="text"
                  value={pontoAtendimento}
                  onChange={(e) => setPontoAtendimento(e.target.value)}
                  placeholder="Ex: Sala 1"
                  className="h-10 bg-background/50 border-border"
                />
                {sugestoesPonto.length > 0 && !pontoAtendimento && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sugestoesPonto.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPontoAtendimento(item)}
                        className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors flex items-center gap-1"
                      >
                        <History size={10} />
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <CamposMorada
                  key={chaveMorada}
                  titulo="Morada do atendimento"
                  classeInput="h-10 bg-background/50 border-border"
                  codigoPostal={codigoPostalDom}
                  onCodigoPostalChange={setCodigoPostalDom}
                  morada={moradaDom}
                  onMoradaChange={setMoradaDom}
                  localidade={localidadeDom}
                  onLocalidadeChange={setLocalidadeDom}
                />
                {!clienteId && camposDomicilioVazios && (
                  <p className="text-[11px] text-muted-foreground">
                    Se escolheres uma cliente já registada (mais abaixo), a morada da ficha dela é preenchida aqui.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={13} className="text-primary" />
              Nome*
            </label>
            <Input
              type="text"
              required
              value={nomeCliente}
              onChange={(e) => {
                setNomeCliente(e.target.value);
                setClienteId(null);
              }}
              placeholder="Nome"
              className="h-10 bg-background/50 border-border"
            />
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pt-2">
              Apelido*
            </label>
            <Input
              type="text"
              required
              value={apelidoCliente}
              onChange={(e) => {
                setApelidoCliente(e.target.value);
                setClienteId(null);
              }}
              placeholder="Apelido"
              className="h-10 bg-background/50 border-border"
            />
            {sugestoesClienteFiltradas.length > 0 && !clienteId && (
              <div className="flex flex-col gap-1 mt-1.5 rounded-lg border border-border bg-card overflow-hidden">
                {sugestoesClienteFiltradas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selecionarClienteExistente(c)}
                    className="flex items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-primary/5 transition-colors"
                  >
                    <span className="text-foreground font-medium">{c.nome}</span>
                    {c.telefone && <span className="text-[11px] text-muted-foreground">{c.telefone}</span>}
                  </button>
                ))}
              </div>
            )}
            {sugestoesClienteFiltradas.length === 0 && sugestoesCliente.length > 0 && !cliente && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {sugestoesCliente.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => preencherNomeCompleto(item)}
                    className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {clienteId && temProntuario === false && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-500 font-medium">
                Esta cliente ainda não tem ficha de anamnese. Preenche antes do atendimento.
              </p>
              <button
                type="button"
                onClick={() => window.open(`/prontuario/${clienteId}`, '_blank')}
                className="shrink-0 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors"
              >
                Preencher Ficha
              </button>
            </div>
          )}
          {clienteId && temProntuario === true && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5">
              <FileHeart size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-500 font-medium">Ficha de anamnese já preenchida.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone size={13} className="text-primary" />
                WhatsApp / Telefone
              </label>
              <Input
                type="tel"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                placeholder="+351 912 345 678"
                className="h-10 bg-background/50 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail size={13} className="text-primary" />
                E-mail da Cliente
              </label>
              <Input
                type="email"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
                placeholder="cliente@email.com"
                className="h-10 bg-background/50 border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" />
              Procedimento
            </label>
            <Input
              type="text"
              required
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              placeholder="Ex: Microblading, Limpeza de Pele..."
              className="h-10 bg-background/50 border-border"
            />
            {sugestoesProcedimento.length > 0 && !procedimento && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {sugestoesProcedimento.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProcedimento(item)}
                    className="text-[10px] font-medium bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-0.5 rounded-md border border-border transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            {sugestaoInteligente && (
              <button
                type="button"
                onClick={aplicarSugestaoInteligente}
                className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Wand2 size={13} />
                  Sugestão: {formatarEuro(sugestaoInteligente.preco)} · {sugestaoInteligente.duracaoMin}min (última vez)
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase text-primary">Aplicar</span>
              </button>
            )}
            {historicoProcedimento && (
              <div className="mt-1.5 rounded-xl border border-border bg-background/50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Package size={13} className="text-primary" />
                  Já fizeste este procedimento {historicoProcedimento.vezes}x
                </p>
                {historicoProcedimento.produtos.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Produtos usados: {historicoProcedimento.produtos.map((p) => `${p.nome} (${p.vezes}x)`).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Bloco 2: Horário, Valor e Lembretes */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock size={13} className="text-primary" />
                Início
              </label>
              <Input
                type="time"
                required
                value={horaInicio}
                onChange={(e) => handleHoraInicioChange(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium text-center px-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock size={13} className="text-muted-foreground" />
                Fim
              </label>
              <Input
                type="time"
                required
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="h-10 bg-background/50 border-border font-medium text-center px-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Euro size={13} className="text-emerald-500" />
                Valor (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0.00"
                className="h-10 bg-background/50 border-border font-bold text-emerald-500 text-center"
              />
            </div>
          </div>

          {custosFixosMes !== null && custosFixosMes > 0 && (() => {
            const valorAtendimento = parseMoeda(preco) || 0;
            const percentualAntes = Math.min((faturamentoMesAtual / custosFixosMes) * 100, 100);
            const percentualDepois = Math.min(((faturamentoMesAtual + valorAtendimento) / custosFixosMes) * 100, 100);
            return (
              <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Target size={13} className="text-primary" />
                  Este atendimento ajuda a cobrir os custos fixos do mês
                </p>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${valorAtendimento > 0 ? percentualDepois : percentualAntes}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Com o que está marcado este mês, já cobres {percentualAntes.toFixed(0)}% dos custos fixos
                  {valorAtendimento > 0 && ` — com este atendimento, sobe para ${percentualDepois.toFixed(0)}%`}
                </p>
              </div>
            );
          })()}

          <div className="border-t border-border pt-4 space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Bell size={13} className="text-primary" />
            Lembretes Automáticos de Atendimento
          </label>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Receber por</p>
            <div className="flex gap-2">
              {LEMBRETES_WHATSAPP_ATIVOS && (
                <button
                  type="button"
                  disabled={!telefoneCliente.trim()}
                  onClick={() => setCanalNotificacao('whatsapp')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    canalNotificacao === 'whatsapp'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <Phone size={14} /> WhatsApp
                </button>
              )}
              <button
                type="button"
                disabled={!emailCliente.trim()}
                onClick={() => setCanalNotificacao('email')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  canalNotificacao === 'email'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Mail size={14} /> Email
              </button>
            </div>
            {LEMBRETES_WHATSAPP_ATIVOS
              ? !telefoneCliente.trim() && !emailCliente.trim() && (
                  <p className="text-[11px] text-amber-500">Preenche o WhatsApp ou o email da cliente acima para poderes enviar lembretes.</p>
                )
              : !emailCliente.trim() && (
                  <p className="text-[11px] text-amber-500">Preenche o email da cliente acima para poderes enviar lembretes.</p>
                )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-background/50 border border-border p-3 rounded-xl hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={lembrete1Dia}
                onChange={(e) => setLembrete1Dia(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>1 Dia antes do evento</span>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-background/50 border border-border p-3 rounded-xl hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={lembrete1Hora}
                onChange={(e) => setLembrete1Hora(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>1 Hora antes do evento</span>
            </label>
          </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 h-12 border-border rounded-xl gap-2 font-medium"
          >
            <ArrowLeft size={16} />
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={salvando}
            className="flex-[2] h-12 bg-gradient-to-r from-primary to-primary/90 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 rounded-xl gap-2"
          >
            <Save size={16} />
            {salvando ? 'A guardar...' : idParaEditar ? 'Guardar Alterações' : 'Confirmar Agendamento'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NovoAgendamento;