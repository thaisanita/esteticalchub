import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getErrorMessage, cn } from '@/lib/utils';
import { obterIdiomaAtual, textosKanban, type TextosKanban } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutDashboard,
  Plus,
  Trash2,
  X,
  GripVertical,
  ChevronDown,
} from 'lucide-react';

interface Quadro {
  id: string;
  nome: string;
  cor: string | null;
}

interface Lista {
  id: string;
  quadro_id: string;
  nome: string;
  ordem: number;
}

interface Cartao {
  id: string;
  lista_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  concluido: boolean;
}

const CORES_QUADRO = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export default function Kanban() {
  const idioma = obterIdiomaAtual();
  const t = textosKanban[idioma] ?? textosKanban['Português (PT)'];

  const [loading, setLoading] = useState(true);
  const [quadros, setQuadros] = useState<Quadro[]>([]);
  const [quadroAtualId, setQuadroAtualId] = useState<string | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [colunas, setColunas] = useState<Record<string, Cartao[]>>({});

  // Diálogo "Novo Quadro"
  const [novoQuadroAberto, setNovoQuadroAberto] = useState(false);
  const [nomeNovoQuadro, setNomeNovoQuadro] = useState('');
  const [corNovoQuadro, setCorNovoQuadro] = useState(CORES_QUADRO[0]);
  const [salvandoQuadro, setSalvandoQuadro] = useState(false);

  // Nova lista (inline)
  const [novaListaAberta, setNovaListaAberta] = useState(false);
  const [nomeNovaLista, setNomeNovaLista] = useState('');

  // Novo cartão (inline, por lista)
  const [listaAdicionandoCartao, setListaAdicionandoCartao] = useState<string | null>(null);
  const [tituloNovoCartao, setTituloNovoCartao] = useState('');

  // Cartões com a descrição expandida
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [cartaoArrastando, setCartaoArrastando] = useState<Cartao | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ---------------------------------------------------------------------
  // Carregamento de dados
  // ---------------------------------------------------------------------
  const carregarQuadros = useCallback(async () => {
    const { data } = await supabase
      .from('quadros_kanban')
      .select('id, nome, cor')
      .order('criado_em', { ascending: true });

    const listaQuadros = data || [];
    setQuadros(listaQuadros);
    setQuadroAtualId((atual) => atual ?? listaQuadros[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarQuadros();
  }, [carregarQuadros]);

  const carregarQuadro = useCallback(async (quadroId: string) => {
    const [{ data: listasData }, { data: cartoesData }] = await Promise.all([
      supabase
        .from('listas_kanban')
        .select('id, quadro_id, nome, ordem')
        .eq('quadro_id', quadroId)
        .order('ordem', { ascending: true }),
      supabase
        .from('cartoes_kanban')
        .select('id, lista_id, titulo, descricao, ordem, concluido, listas_kanban!inner(quadro_id)')
        .eq('listas_kanban.quadro_id', quadroId)
        .order('ordem', { ascending: true }),
    ]);

    const listasCarregadas: Lista[] = listasData || [];
    setListas(listasCarregadas);

    const agrupado: Record<string, Cartao[]> = {};
    for (const lista of listasCarregadas) agrupado[lista.id] = [];
    for (const c of (cartoesData || []) as Cartao[]) {
      if (!agrupado[c.lista_id]) agrupado[c.lista_id] = [];
      agrupado[c.lista_id].push({
        id: c.id,
        lista_id: c.lista_id,
        titulo: c.titulo,
        descricao: c.descricao,
        ordem: c.ordem,
        concluido: c.concluido,
      });
    }
    setColunas(agrupado);
  }, []);

  useEffect(() => {
    if (quadroAtualId) carregarQuadro(quadroAtualId);
  }, [quadroAtualId, carregarQuadro]);

  // ---------------------------------------------------------------------
  // Quadros
  // ---------------------------------------------------------------------
  const criarQuadro = async () => {
    if (!nomeNovoQuadro.trim() || salvandoQuadro) return;
    setSalvandoQuadro(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entre novamente.');

      const { data, error } = await supabase
        .from('quadros_kanban')
        .insert([{ nome: nomeNovoQuadro.trim(), cor: corNovoQuadro, usuario_id: user.id }])
        .select('id, nome, cor')
        .single();

      if (error) throw error;

      setQuadros((prev) => [...prev, data]);
      setQuadroAtualId(data.id);
      setNomeNovoQuadro('');
      setCorNovoQuadro(CORES_QUADRO[0]);
      setNovoQuadroAberto(false);
    } catch (err) {
      alert(`Erro ao criar quadro: ${getErrorMessage(err)}`);
    } finally {
      setSalvandoQuadro(false);
    }
  };

  const excluirQuadro = async (quadroId: string) => {
    if (!window.confirm(t.confExcluirQuadro)) return;
    const { error } = await supabase.from('quadros_kanban').delete().eq('id', quadroId);
    if (error) {
      alert(`Erro ao excluir quadro: ${getErrorMessage(error)}`);
      return;
    }
    const restantes = quadros.filter((q) => q.id !== quadroId);
    setQuadros(restantes);
    setQuadroAtualId(restantes[0]?.id ?? null);
    if (restantes.length === 0) {
      setListas([]);
      setColunas({});
    }
  };

  // ---------------------------------------------------------------------
  // Listas
  // ---------------------------------------------------------------------
  const criarLista = async () => {
    if (!nomeNovaLista.trim() || !quadroAtualId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entre novamente.');

      const proximaOrdem = listas.length > 0 ? Math.max(...listas.map((l) => l.ordem)) + 1 : 0;

      const { data, error } = await supabase
        .from('listas_kanban')
        .insert([{
          nome: nomeNovaLista.trim(),
          quadro_id: quadroAtualId,
          ordem: proximaOrdem,
          usuario_id: user.id,
        }])
        .select('id, quadro_id, nome, ordem')
        .single();

      if (error) throw error;

      setListas((prev) => [...prev, data]);
      setColunas((prev) => ({ ...prev, [data.id]: [] }));
      setNomeNovaLista('');
      setNovaListaAberta(false);
    } catch (err) {
      alert(`Erro ao criar lista: ${getErrorMessage(err)}`);
    }
  };

  const excluirLista = async (listaId: string) => {
    if (!window.confirm(t.confExcluirLista)) return;
    const { error } = await supabase.from('listas_kanban').delete().eq('id', listaId);
    if (error) {
      alert(`Erro ao excluir lista: ${getErrorMessage(error)}`);
      return;
    }
    setListas((prev) => prev.filter((l) => l.id !== listaId));
    setColunas((prev) => {
      const copia = { ...prev };
      delete copia[listaId];
      return copia;
    });
  };

  // ---------------------------------------------------------------------
  // Cartões
  // ---------------------------------------------------------------------
  const criarCartao = async (listaId: string) => {
    if (!tituloNovoCartao.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entre novamente.');

      const cartoesAtuais = colunas[listaId] || [];
      const proximaOrdem = cartoesAtuais.length > 0 ? Math.max(...cartoesAtuais.map((c) => c.ordem)) + 1 : 0;

      const { data, error } = await supabase
        .from('cartoes_kanban')
        .insert([{
          titulo: tituloNovoCartao.trim(),
          lista_id: listaId,
          ordem: proximaOrdem,
          usuario_id: user.id,
        }])
        .select('id, lista_id, titulo, descricao, ordem, concluido')
        .single();

      if (error) throw error;

      setColunas((prev) => ({ ...prev, [listaId]: [...(prev[listaId] || []), data] }));
      setTituloNovoCartao('');
    } catch (err) {
      alert(`Erro ao criar cartão: ${getErrorMessage(err)}`);
    }
  };

  const alternarConcluido = async (cartao: Cartao) => {
    const novoValor = !cartao.concluido;
    setColunas((prev) => ({
      ...prev,
      [cartao.lista_id]: prev[cartao.lista_id].map((c) =>
        c.id === cartao.id ? { ...c, concluido: novoValor } : c
      ),
    }));
    await supabase.from('cartoes_kanban').update({ concluido: novoValor }).eq('id', cartao.id);
  };

  const excluirCartao = async (cartao: Cartao) => {
    if (!window.confirm(t.confExcluirCartao)) return;
    setColunas((prev) => ({
      ...prev,
      [cartao.lista_id]: prev[cartao.lista_id].filter((c) => c.id !== cartao.id),
    }));
    await supabase.from('cartoes_kanban').delete().eq('id', cartao.id);
  };

  const alternarExpandido = (cartaoId: string) => {
    setExpandidos((prev) => {
      const copia = new Set(prev);
      if (copia.has(cartaoId)) copia.delete(cartaoId);
      else copia.add(cartaoId);
      return copia;
    });
  };

  // ---------------------------------------------------------------------
  // Arrastar-e-largar entre colunas
  // ---------------------------------------------------------------------
  const encontrarContainer = useCallback(
    (id: string): string | undefined => {
      if (id in colunas) return id;
      return Object.keys(colunas).find((listaId) => colunas[listaId].some((c) => c.id === id));
    },
    [colunas]
  );

  const persistirOrdem = async (listaId: string, cartoesLista: Cartao[]) => {
    await Promise.all(
      cartoesLista.map((c, idx) =>
        supabase.from('cartoes_kanban').update({ ordem: idx, lista_id: listaId }).eq('id', c.id)
      )
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const container = encontrarContainer(event.active.id as string);
    if (!container) return;
    const cartao = colunas[container]?.find((c) => c.id === event.active.id);
    setCartaoArrastando(cartao ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const containerAtivo = encontrarContainer(activeId);
    const containerDestino = encontrarContainer(overId);

    if (!containerAtivo || !containerDestino || containerAtivo === containerDestino) return;

    setColunas((prev) => {
      const itensAtivo = prev[containerAtivo];
      const itensDestino = prev[containerDestino];
      const indiceAtivo = itensAtivo.findIndex((c) => c.id === activeId);
      if (indiceAtivo === -1) return prev;

      const indiceDestino = itensDestino.findIndex((c) => c.id === overId);
      const novoIndice = indiceDestino >= 0 ? indiceDestino : itensDestino.length;

      const cartaoMovido = { ...itensAtivo[indiceAtivo], lista_id: containerDestino };

      return {
        ...prev,
        [containerAtivo]: itensAtivo.filter((c) => c.id !== activeId),
        [containerDestino]: [
          ...itensDestino.slice(0, novoIndice),
          cartaoMovido,
          ...itensDestino.slice(novoIndice),
        ],
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setCartaoArrastando(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const containerAtivo = encontrarContainer(activeId);
    const containerDestino = encontrarContainer(overId);
    if (!containerAtivo || !containerDestino) return;

    if (containerAtivo === containerDestino) {
      const itens = colunas[containerAtivo];
      const indiceAntigo = itens.findIndex((c) => c.id === activeId);
      const indiceNovo = itens.findIndex((c) => c.id === overId);
      if (indiceAntigo === -1 || indiceNovo === -1 || indiceAntigo === indiceNovo) return;

      const reordenado = arrayMove(itens, indiceAntigo, indiceNovo);
      setColunas((prev) => ({ ...prev, [containerAtivo]: reordenado }));
      await persistirOrdem(containerAtivo, reordenado);
    } else {
      await Promise.all([
        persistirOrdem(containerAtivo, colunas[containerAtivo] || []),
        persistirOrdem(containerDestino, colunas[containerDestino] || []),
      ]);
    }
  };

  // ---------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-medium text-muted-foreground">
        A carregar...
      </div>
    );
  }

  const quadroAtual = quadros.find((q) => q.id === quadroAtualId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitulo}</p>
        </div>
        <Button onClick={() => setNovoQuadroAberto(true)} className="gap-1.5">
          <Plus size={14} /> {t.novoQuadro}
        </Button>
      </div>

      {/* Abas dos quadros */}
      {quadros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quadros.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuadroAtualId(q.id)}
              className={cn(
                'group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all',
                q.id === quadroAtualId
                  ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: q.cor || CORES_QUADRO[0] }}
              />
              {q.nome}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  excluirQuadro(q.id);
                }}
                className="ml-1 rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      {quadros.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center shadow-lg shadow-black/10">
          <LayoutDashboard size={32} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{t.vazio}</p>
          <p className="text-sm text-muted-foreground">{t.vazioSub}</p>
          <Button onClick={() => setNovoQuadroAberto(true)} className="mt-2 gap-1.5">
            <Plus size={14} /> {t.novoQuadro}
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {listas.map((lista) => (
              <ColunaLista
                key={lista.id}
                lista={lista}
                cartoes={colunas[lista.id] || []}
                corQuadro={quadroAtual?.cor || CORES_QUADRO[0]}
                expandidos={expandidos}
                onExcluirLista={() => excluirLista(lista.id)}
                onAlternarConcluido={alternarConcluido}
                onExcluirCartao={excluirCartao}
                onAlternarExpandido={alternarExpandido}
                adicionandoCartao={listaAdicionandoCartao === lista.id}
                tituloNovoCartao={tituloNovoCartao}
                onTituloNovoCartaoChange={setTituloNovoCartao}
                onIniciarAdicionarCartao={() => {
                  setListaAdicionandoCartao(lista.id);
                  setTituloNovoCartao('');
                }}
                onCancelarAdicionarCartao={() => setListaAdicionandoCartao(null)}
                onConfirmarAdicionarCartao={() => criarCartao(lista.id)}
                textos={t}
              />
            ))}

            {/* Nova lista */}
            <div className="w-72 shrink-0 rounded-2xl border border-dashed border-border bg-card/50 p-3">
              {novaListaAberta ? (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder={t.nomeListaPlaceholder}
                    value={nomeNovaLista}
                    onChange={(e) => setNomeNovaLista(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') criarLista();
                      if (e.key === 'Escape') setNovaListaAberta(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={criarLista}>{t.criar}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNovaListaAberta(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNovaListaAberta(true)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus size={15} /> {t.novaLista}
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {cartaoArrastando ? <CartaoPreview cartao={cartaoArrastando} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Diálogo: novo quadro */}
      <Dialog open={novoQuadroAberto} onOpenChange={setNovoQuadroAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.novoQuadroTitulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder={t.nomeQuadroPlaceholder}
              value={nomeNovoQuadro}
              onChange={(e) => setNomeNovoQuadro(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && criarQuadro()}
            />
            <div className="flex gap-2">
              {CORES_QUADRO.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCorNovoQuadro(cor)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-transform',
                    corNovoQuadro === cor && 'scale-110 ring-2 ring-offset-2 ring-offset-popover'
                  )}
                  style={{ backgroundColor: cor, ...(corNovoQuadro === cor ? { boxShadow: `0 0 0 2px ${cor}` } : {}) }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoQuadroAberto(false)}>{t.cancelar}</Button>
            <Button onClick={criarQuadro} disabled={salvandoQuadro || !nomeNovoQuadro.trim()}>
              {t.criar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coluna (Lista)
// ---------------------------------------------------------------------------
function ColunaLista({
  lista,
  cartoes,
  corQuadro,
  expandidos,
  onExcluirLista,
  onAlternarConcluido,
  onExcluirCartao,
  onAlternarExpandido,
  adicionandoCartao,
  tituloNovoCartao,
  onTituloNovoCartaoChange,
  onIniciarAdicionarCartao,
  onCancelarAdicionarCartao,
  onConfirmarAdicionarCartao,
  textos,
}: {
  lista: Lista;
  cartoes: Cartao[];
  corQuadro: string;
  expandidos: Set<string>;
  onExcluirLista: () => void;
  onAlternarConcluido: (cartao: Cartao) => void;
  onExcluirCartao: (cartao: Cartao) => void;
  onAlternarExpandido: (cartaoId: string) => void;
  adicionandoCartao: boolean;
  tituloNovoCartao: string;
  onTituloNovoCartaoChange: (valor: string) => void;
  onIniciarAdicionarCartao: () => void;
  onCancelarAdicionarCartao: () => void;
  onConfirmarAdicionarCartao: () => void;
  textos: TextosKanban;
}) {
  const { setNodeRef } = useDroppable({ id: lista.id });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-card shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corQuadro }} />
          <h3 className="truncate text-sm font-semibold text-foreground">{lista.nome}</h3>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {cartoes.length}
          </span>
        </div>
        <button onClick={onExcluirLista} className="shrink-0 text-muted-foreground/60 hover:text-danger">
          <Trash2 size={13} />
        </button>
      </div>

      <div ref={setNodeRef} className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-3">
        <SortableContext items={cartoes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cartoes.map((cartao) => (
            <CartaoItem
              key={cartao.id}
              cartao={cartao}
              expandido={expandidos.has(cartao.id)}
              onAlternarConcluido={() => onAlternarConcluido(cartao)}
              onExcluir={() => onExcluirCartao(cartao)}
              onAlternarExpandido={() => onAlternarExpandido(cartao.id)}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-3 pt-0">
        {adicionandoCartao ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              placeholder={textos.tituloCartaoPlaceholder}
              value={tituloNovoCartao}
              onChange={(e) => onTituloNovoCartaoChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onConfirmarAdicionarCartao();
                }
                if (e.key === 'Escape') onCancelarAdicionarCartao();
              }}
              rows={2}
              className="w-full rounded-lg border border-border bg-background/50 p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={onConfirmarAdicionarCartao}>{textos.criar}</Button>
              <Button size="sm" variant="ghost" onClick={onCancelarAdicionarCartao}>
                <X size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={onIniciarAdicionarCartao}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-muted-foreground hover:bg-background/50 hover:text-foreground"
          >
            {textos.adicionarCartao}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------
function CartaoItem({
  cartao,
  expandido,
  onAlternarConcluido,
  onExcluir,
  onAlternarExpandido,
}: {
  cartao: Cartao;
  expandido: boolean;
  onAlternarConcluido: () => void;
  onExcluir: () => void;
  onAlternarExpandido: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cartao.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-xl border border-border bg-background/60 p-2.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>

        <input
          type="checkbox"
          checked={cartao.concluido}
          onChange={onAlternarConcluido}
          className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
        />

        <div className="min-w-0 flex-1">
          <p
            onClick={() => cartao.descricao && onAlternarExpandido()}
            className={cn(
              'text-sm font-medium leading-snug text-foreground',
              cartao.descricao && 'cursor-pointer',
              cartao.concluido && 'text-muted-foreground line-through opacity-60'
            )}
          >
            {cartao.titulo}
          </p>

          {cartao.descricao && (
            <button
              onClick={onAlternarExpandido}
              className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown size={11} className={cn('transition-transform', expandido && 'rotate-180')} />
              {expandido ? 'Ocultar' : 'Ver descrição'}
            </button>
          )}

          {expandido && cartao.descricao && (
            <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{cartao.descricao}</p>
          )}
        </div>

        <button
          onClick={onExcluir}
          className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function CartaoPreview({ cartao }: { cartao: Cartao }) {
  return (
    <div className="w-64 rounded-xl border border-primary/30 bg-background p-2.5 shadow-lg shadow-black/20">
      <p className="text-sm font-medium text-foreground">{cartao.titulo}</p>
    </div>
  );
}
