import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { EVENTO_PAGAMENTO_REGISTADO } from '@/lib/eventos';
import { confirmar } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { textosProcedimentos, obterIdiomaAtual } from '@/lib/i18n';
import { parseMoeda, formatarHora, atendeDomicilio, linkGoogleMaps } from '@/lib/utils';
import {
  Clock,
  User,
  Sparkles as SparklesIcon,
  MapPin,
  Trash2,
  CalendarX,
  ArrowLeft,
  Plus,
  Pencil,
  UserX,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { SkeletonLinhas } from '@/components/ui/skeleton';

interface Atendimento {
  id: string | number;
  hora: string;
  hora_fim?: string;
  cliente: string;
  procedimento: string;
  data: string;
  valor?: number | string;
  preco?: number | string;
  ponto_atendimento?: string;
  pontoAtendimento?: string;
  faltou?: boolean;
  agenda_id?: string;
}

const Procedimentos = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  // Só para saber se cada agenda atende ao domicílio (mostrar o link do mapa) —
  // não repete a consulta de membros/cores que a página da Agenda já faz.
  const [tipoPorAgenda, setTipoPorAgenda] = useState<Record<string, string>>({});
  // Moradas truncadas com "title" não aparecem ao toque no telemóvel — clicar
  // no nome da cliente mostra a morada completa (cidade ou rua).
  const [moradasAbertas, setMoradasAbertas] = useState<Set<string | number>>(new Set());
  const alternarMorada = (id: string | number) => {
    setMoradasAbertas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const dataSelecionada = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const idioma = obterIdiomaAtual();
  const textos = textosProcedimentos[idioma] || textosProcedimentos['Português (PT)'];

  const buscarAtendimentos = useCallback(async () => {
    if (!dataSelecionada) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('data', dataSelecionada)
      .order('hora', { ascending: true });

    if (error) {
      console.error('Erro ao buscar atendimentos:', error.message);
    } else {
      const ordenados = [...(data || [])].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      setAgendamentos(ordenados);
    }
    setLoading(false);
  }, [dataSelecionada]);

  useEffect(() => {
    buscarAtendimentos();
    window.addEventListener(EVENTO_PAGAMENTO_REGISTADO, buscarAtendimentos);
    return () => window.removeEventListener(EVENTO_PAGAMENTO_REGISTADO, buscarAtendimentos);
  }, [dataSelecionada, buscarAtendimentos]);

  useEffect(() => {
    supabase
      .from('agendas')
      .select('id, tipo_atendimento')
      .then(({ data }) => {
        if (data) setTipoPorAgenda(Object.fromEntries(data.map((a) => [a.id, a.tipo_atendimento])));
      });
  }, []);

  const marcarFalta = async (id: string | number) => {
    const ok = await confirmar(textos.confFalta);
    if (!ok) return;

    const { error } = await supabase.from('agendamentos').update({ faltou: true }).eq('id', id);
    if (!error) {
      toast.success('Falta registada.');
      buscarAtendimentos();
    } else {
      toast.error('Erro ao registar falta: ' + error.message);
    }
  };

  const desfazerFalta = async (id: string | number) => {
    const { error } = await supabase.from('agendamentos').update({ faltou: false }).eq('id', id);
    if (!error) {
      toast.success('Falta desfeita.');
      buscarAtendimentos();
    } else {
      toast.error('Erro ao desfazer falta: ' + error.message);
    }
  };

  const excluirAgendamento = async (id: string | number) => {
    const ok = await confirmar({ descricao: textos.confExcluir, destrutivo: true, textoConfirmar: 'Eliminar' });
    if (!ok) return;
    const { error } = await supabase.from('agendamentos').delete().eq('id', id);
    if (!error) {
      toast.success('Atendimento eliminado.');
      buscarAtendimentos();
    } else {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const totalFaturado = agendamentos.reduce((acc, item) => {
    if (item.faltou) return acc;
    const valor = parseMoeda(item.preco ?? item.valor ?? 0);
    return acc + (valor || 0);
  }, 0);

  // Formatação segura de data sem distorção de fuso horário (UTC)
  const formatarDataCabecalho = () => {
    if (!dataSelecionada) return textos.selecione;
    const [ano, mes, dia] = dataSelecionada.split('-').map(Number);
    const dataLocal = new Date(ano, mes - 1, dia);
    return dataLocal.toLocaleDateString(textos.formatoData, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  if (loading && dataSelecionada) {
    return (
      <SkeletonLinhas linhas={4} />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {textos.titulo}
        </h2>
        <p className="text-sm font-medium capitalize text-primary">
          {formatarDataCabecalho()}
        </p>
        {agendamentos.length > 0 && (
          <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary border border-primary/20">
            {agendamentos.length} {agendamentos.length === 1 ? textos.encontrado : textos.encontrados}
          </span>
        )}
      </div>

      {/* Lista de Atendimentos */}
      <div className="space-y-3">
        {agendamentos.length === 0 && !loading && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-lg shadow-black/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <CalendarX size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{textos.vazio}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clica no botão abaixo para adicionar o primeiro atendimento deste dia.
              </p>
            </div>
          </div>
        )}

        {agendamentos.map((item) => {
          const valorNum = parseMoeda(item.preco ?? item.valor ?? 0);
          const isFalta = !!item.faltou;
          const localAtendimento = item.ponto_atendimento || item.pontoAtendimento;

          return (
            <div
              key={item.id}
              className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 bg-card p-5 shadow-md shadow-black/10 ${
                isFalta ? 'border-border opacity-60' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Informações Principais: nome primeiro (é o que se reconhece de
                    relance), local por último e discreto — importante sobretudo
                    para quem atende ao domicílio e precisa de abrir o mapa. */}
                <div className="min-w-0 space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
                    <User size={15} className="text-primary shrink-0" />
                    {localAtendimento ? (
                      <button type="button" onClick={() => alternarMorada(item.id)} className="hover:underline" title="Ver morada">
                        {item.cliente}
                      </button>
                    ) : (
                      item.cliente
                    )}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted-foreground border border-border">
                      <Clock size={12} className="text-primary" />
                      {formatarHora(item.hora)}{item.hora_fim ? ` - ${formatarHora(item.hora_fim)}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">
                      <SparklesIcon size={12} className="text-primary/70 shrink-0" />
                      {item.procedimento}
                    </span>
                  </div>

                  {localAtendimento && (
                    <p className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin size={11} className="mt-0.5 shrink-0" />
                      <span className={moradasAbertas.has(item.id) ? '' : 'truncate'}>{localAtendimento}</span>
                      {item.agenda_id && atendeDomicilio(tipoPorAgenda[item.agenda_id]) && (
                        <a
                          href={linkGoogleMaps(localAtendimento)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary hover:underline"
                        >
                          Abrir no mapa <ExternalLink size={10} />
                        </a>
                      )}
                    </p>
                  )}
                </div>

                {/* Valor e Ações */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border gap-2">
                  <div className="text-left sm:text-right">
                    <span className={`font-display text-xl font-bold tabular-nums ${isFalta ? 'text-muted-foreground line-through' : 'text-emerald-500'}`}>
                      € {valorNum.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isFalta ? (
                      <button
                        onClick={() => desfazerFalta(item.id)}
                        title="Desfazer falta"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        <UserX size={12} />
                        <span className="hidden sm:inline">Desfazer</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarFalta(item.id)}
                        title={textos.confFalta}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/20"
                      >
                        <UserX size={12} />
                        <span className="hidden sm:inline">{textos.faltou}</span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/novo-agendamento?date=${dataSelecionada}&edit=${item.id}`)}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <Pencil size={12} />
                      <span className="hidden sm:inline">{textos.editar}</span>
                    </button>
                    <button
                      onClick={() => excluirAgendamento(item.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totalizador de Faturação do Dia */}
      {agendamentos.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-center justify-between shadow-lg shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                {textos.total}
              </span>
              <p className="text-[11px] text-muted-foreground">Somatório líquido das sessões confirmadas</p>
            </div>
          </div>
          <span className="font-display text-2xl font-bold text-emerald-500 tabular-nums">
            € {totalFaturado.toFixed(2)}
          </span>
        </div>
      )}

      {/* Ações Inferiores */}
      <div className="flex items-center gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')} 
          className="flex-1 h-11 border-border rounded-xl gap-2 font-medium"
        >
          <ArrowLeft size={16} />
          {textos.btnVoltar}
        </Button>
        <Button
          onClick={() => navigate(`/novo-agendamento?date=${dataSelecionada}`)}
          className="flex-1 h-11 bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 rounded-xl gap-2"
        >
          <Plus size={16} />
          {textos.btnNovo}
        </Button>
      </div>
    </div>
  );
};

export default Procedimentos;