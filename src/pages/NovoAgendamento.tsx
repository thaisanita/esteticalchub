import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { getErrorMessage, parseMoeda } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Target
} from 'lucide-react';

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
  const [pontoAtendimento, setPontoAtendimento] = useState('');
  
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
  const [clientesDb, setClientesDb] = useState<{ id: string; nome: string; telefone: string | null; email: string | null }[]>([]);

  // Nome completo, combinado a partir dos dois campos, usado para guardar
  // e comparar com o resto do site (Clientes, Prontuário, etc. continuam a
  // guardar um único campo "nome").
  const cliente = `${nomeCliente} ${apelidoCliente}`.trim();


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
      .select('id, nome, telefone, email')
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

  const selecionarClienteExistente = (c: { id: string; nome: string; telefone: string | null; email: string | null }) => {
    preencherNomeCompleto(c.nome);
    setClienteId(c.id);
    if (c.telefone) setTelefoneCliente(c.telefone);
    if (c.email) setEmailCliente(c.email);
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

  // Ponto de equilíbrio: quanto já foi faturado este mês, e quanto falta
  // para cobrir os custos fixos (renda, contas, etc.)
  useEffect(() => {
    const buscarPontoEquilibrio = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: fixos } = await supabase
        .from('custos_fixos')
        .select('valor_mensal, ativo')
        .eq('usuario_id', user.id);
      const totalFixos = (fixos || []).filter((c) => c.ativo).reduce((acc, c) => acc + parseMoeda(c.valor_mensal), 0);
      setCustosFixosMes(totalFixos);

      const hoje = new Date();
      const prefixoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const { data: agendamentosDoMes } = await supabase
        .from('agendamentos')
        .select('valor, preco, data')
        .eq('usuario_id', user.id);
      const totalFaturado = (agendamentosDoMes || [])
        .filter((a) => a.data && a.data.startsWith(prefixoMes))
        .reduce((acc, a) => acc + parseMoeda(a.valor ?? a.preco ?? 0), 0);
      setFaturamentoMesAtual(totalFaturado);
    };
    buscarPontoEquilibrio();
  }, []);

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
            setPontoAtendimento(data.ponto_atendimento || data.pontoAtendimento || '');
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
  const construirLembrete = (antecedencia: '1_dia' | '1_hora') => {
    const quando = antecedencia === '1_dia' ? 'amanhã' : 'hoje';
    const primeiroNome = (nomeCliente || cliente).split(' ')[0] || 'tudo bem';
    const dataFmt = new Date(`${dataAgendamento}T00:00:00`).toLocaleDateString('pt-BR');
    const local = pontoAtendimento.trim() ? ` Local: ${pontoAtendimento.trim()}.` : '';
    const mensagem =
      `Olá, ${primeiroNome}! Passando para lembrar do seu agendamento de ` +
      `${procedimento.trim() || 'atendimento'} ${quando} (${dataFmt}) às ${horaInicio}.${local} ` +
      `Qualquer imprevisto, é só responder. Até breve! ✨`;
    const assunto = `Lembrete: ${procedimento.trim() || 'seu atendimento'} ${quando}`;
    return { mensagem, assunto };
  };

  const criarFilaNotificacoes = async (agendamentoId: string, userId: string) => {
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
          ...construirLembrete('1_dia'),
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
          ...construirLembrete('1_hora'),
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
        alert(`Erro ao agendar notificação: ${error.message}`);
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
        alert('Sua sessão expirou. Por favor, entre novamente no sistema.');
        navigate('/login');
        return;
      }

      const valorFormatado = parseMoeda(preco);

      // Resolve a cliente: usa a selecionada, ou encontra por nome igual, ou cria uma nova.
      // Assim, mesmo digitando o nome à mão, o agendamento fica sempre ligado por ID.
      let clienteIdFinal = clienteId;
      if (!clienteIdFinal && cliente.trim()) {
        const { data: existente } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', cliente.trim())
          .maybeSingle();

        if (existente) {
          clienteIdFinal = existente.id;
        } else {
          const { data: novaCliente, error: erroNovaCliente } = await supabase
            .from('clientes')
            .insert([{
              nome: cliente.trim(),
              telefone: telefoneCliente.trim() || null,
              email: emailCliente.trim() || null,
            }])
            .select('id')
            .single();
          if (!erroNovaCliente) clienteIdFinal = novaCliente.id;
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
        ponto_atendimento: pontoAtendimento.trim(),
        usuario_id: user.id,
        canal_notificacao: canalNotificacao,
        lembrete_1dia: lembrete1Dia,
        lembrete_1hora: lembrete1Hora,
      };

      let agendamentoId = idParaEditar;

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
          .select('id')
          .single();

        if (error) throw error;
        agendamentoId = data.id;
      }

      if (agendamentoId) {
        await criarFilaNotificacoes(agendamentoId, user.id);
      }

      salvarHistorico('hist_clientes', cliente);
      salvarHistorico('hist_procedimentos', procedimento);
      salvarHistorico('hist_pontos', pontoAtendimento);
      
      // Redireciona de volta para a lista de procedimentos na data do agendamento
      navigate(`/procedimentos?date=${dataAgendamento}`);
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err);
      alert(`Erro ao salvar agendamento: ${getErrorMessage(err)}`);
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

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />
                Espaço / Local
              </label>
              <Input
                type="text"
                value={pontoAtendimento}
                onChange={(e) => setPontoAtendimento(e.target.value)}
                placeholder="Ex: Studio Central"
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
                  Sugestão: € {sugestaoInteligente.preco.toFixed(2)} · {sugestaoInteligente.duracaoMin}min (última vez)
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
                  Já cobriste {percentualAntes.toFixed(0)}% dos custos fixos este mês
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
            {!telefoneCliente.trim() && !emailCliente.trim() && (
              <p className="text-[11px] text-amber-500">Preenche o WhatsApp ou o email da cliente acima para poderes enviar lembretes.</p>
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
            {salvando ? 'A guardar...' : idParaEditar ? 'Salvar Alterações' : 'Confirmar Agendamento'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NovoAgendamento;