import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type {
  PaginaFormulario,
  Pergunta,
  SchemaFormulario,
  SecaoFormulario,
  TipoPergunta,
} from "@dcmg/contracts";
import { criarPagina, criarPergunta, criarSecao, normalizarPaginas } from "./tipos";
import { SortableSecao } from "./SortableSecao";
import { PreviewDialog } from "./PreviewDialog";
import { InserirBlocoDialog } from "./InserirBlocoDialog";

interface Props {
  schemaInicial: SchemaFormulario;
  salvando?: boolean;
  erro?: string | null;
  onSalvar: (schema: SchemaFormulario) => void;
}

export function FormularioBuilder({ schemaInicial, salvando, erro, onSalvar }: Props) {
  const [paginas, setPaginas] = useState<PaginaFormulario[]>(() => {
    const iniciais = schemaInicial.paginas?.length
      ? schemaInicial.paginas
      : [{ titulo: "Página 1", secoes: schemaInicial.secoes ?? [] }];
    return normalizarPaginas(iniciais);
  });
  const [paginaAtiva, setPaginaAtiva] = useState(0);
  const [preview, setPreview] = useState(false);
  const [blocoSecaoId, setBlocoSecaoId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const idx = Math.min(paginaAtiva, paginas.length - 1);
  const pagina = paginas[idx];
  const secoes = pagina?.secoes ?? [];

  const todasPerguntas = useMemo(
    () => paginas.flatMap((p) => p.secoes.flatMap((s) => s.perguntas)),
    [paginas],
  );

  const schemaAtual: SchemaFormulario = useMemo(
    () => ({
      versao: schemaInicial.versao,
      titulo: schemaInicial.titulo,
      descricao: schemaInicial.descricao,
      paginas: paginas.map((p, i) => ({
        ...p,
        ordem: i,
        secoes: p.secoes.map((s, j) => ({
          ...s,
          ordem: j,
          perguntas: s.perguntas.map((q, k) => ({ ...q, ordem: k })),
        })),
      })),
    }),
    [paginas, schemaInicial],
  );

  // ── Mutações de página ──────────────────────────────────────────────────
  function setPaginaCampo(patch: Partial<PaginaFormulario>) {
    setPaginas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addPagina() {
    setPaginas((prev) => {
      const nova = [...prev, criarPagina(prev.length)];
      return nova;
    });
    setPaginaAtiva(paginas.length);
  }
  function removerPagina() {
    if (paginas.length <= 1) return;
    setPaginas((prev) => prev.filter((_, i) => i !== idx));
    setPaginaAtiva((p) => Math.max(0, p - 1));
  }
  function moverPagina(delta: number) {
    const destino = idx + delta;
    if (destino < 0 || destino >= paginas.length) return;
    setPaginas((prev) => arrayMove(prev, idx, destino));
    setPaginaAtiva(destino);
  }

  // ── Mutações de seção (na página ativa) ─────────────────────────────────
  function setSecoesPaginaAtiva(novas: SecaoFormulario[]) {
    setPaginas((prev) => prev.map((p, i) => (i === idx ? { ...p, secoes: novas } : p)));
  }
  function setSecao(id: string, nova: SecaoFormulario) {
    setSecoesPaginaAtiva(secoes.map((s) => (s.id === id ? nova : s)));
  }
  function removerSecao(id: string) {
    setSecoesPaginaAtiva(secoes.filter((s) => s.id !== id));
  }
  function addSecao() {
    setSecoesPaginaAtiva([...secoes, criarSecao()]);
  }
  function addPergunta(secaoId: string, tipo: TipoPergunta) {
    setSecoesPaginaAtiva(
      secoes.map((s) => (s.id === secaoId ? { ...s, perguntas: [...s.perguntas, criarPergunta(tipo)] } : s)),
    );
  }
  function inserirBloco(perguntas: Pergunta[]) {
    if (!blocoSecaoId) return;
    setSecoesPaginaAtiva(
      secoes.map((s) => (s.id === blocoSecaoId ? { ...s, perguntas: [...s.perguntas, ...perguntas] } : s)),
    );
  }
  function moverSecaoParaPagina(secaoId: string, destinoPaginaId: string) {
    setPaginas((prev) => {
      const secao = prev[idx]?.secoes.find((s) => s.id === secaoId);
      if (!secao) return prev;
      return prev.map((p, i) => {
        if (i === idx) return { ...p, secoes: p.secoes.filter((s) => s.id !== secaoId) };
        if (p.id === destinoPaginaId) return { ...p, secoes: [...p.secoes, secao] };
        return p;
      });
    });
  }

  // ── DnD (seções e perguntas dentro da página ativa) ─────────────────────
  function secaoDe(codigo: string): SecaoFormulario | undefined {
    return secoes.find((s) => s.perguntas.some((p) => p.codigo === codigo));
  }
  function alvoSecaoId(overId: string, overData: Record<string, unknown> | undefined): string | undefined {
    if (overData?.type === "pergunta") return overData.secaoId as string;
    if (overData?.type === "container") return overData.secaoId as string;
    if (overData?.type === "secao") return overId;
    return undefined;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "pergunta") return;
    const origemId = active.data.current.secaoId as string;
    const destinoId = alvoSecaoId(String(over.id), over.data.current as Record<string, unknown>);
    if (!destinoId || origemId === destinoId) return;

    setSecoesPaginaAtiva(
      ((): SecaoFormulario[] => {
        const movida = secoes.find((s) => s.id === origemId)?.perguntas.find((p) => p.codigo === active.id);
        if (!movida) return secoes;
        return secoes.map((s) => {
          if (s.id === origemId) return { ...s, perguntas: s.perguntas.filter((p) => p.codigo !== active.id) };
          if (s.id === destinoId) return { ...s, perguntas: [...s.perguntas, movida] };
          return s;
        });
      })(),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const tipo = active.data.current?.type;

    if (tipo === "secao" && over.data.current?.type === "secao" && active.id !== over.id) {
      const oldIndex = secoes.findIndex((s) => s.id === active.id);
      const newIndex = secoes.findIndex((s) => s.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) setSecoesPaginaAtiva(arrayMove(secoes, oldIndex, newIndex));
      return;
    }

    if (tipo === "pergunta" && over.data.current?.type === "pergunta" && active.id !== over.id) {
      const secao = secaoDe(String(active.id));
      if (!secao || !secao.perguntas.some((p) => p.codigo === over.id)) return;
      const oldIndex = secao.perguntas.findIndex((p) => p.codigo === active.id);
      const newIndex = secao.perguntas.findIndex((p) => p.codigo === over.id);
      setSecoesPaginaAtiva(
        secoes.map((s) =>
          s.id === secao.id ? { ...s, perguntas: arrayMove(s.perguntas, oldIndex, newIndex) } : s,
        ),
      );
    }
  }

  const outrasPaginas = paginas
    .filter((_, i) => i !== idx)
    .map((p) => ({ id: p.id!, titulo: p.titulo }));

  return (
    <Box>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Button startIcon={<VisibilityIcon />} variant="outlined" onClick={() => setPreview(true)}>
          Pré-visualizar
        </Button>
        <Button
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          variant="contained"
          disabled={salvando}
          onClick={() => onSalvar(schemaAtual)}
        >
          Salvar
        </Button>
      </Stack>

      {/* Abas de páginas */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Tabs
          value={idx}
          onChange={(_, v: number) => setPaginaAtiva(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, borderBottom: 1, borderColor: "divider" }}
        >
          {paginas.map((p, i) => (
            <Tab key={p.id ?? i} label={p.titulo || `Página ${i + 1}`} />
          ))}
        </Tabs>
        <Button startIcon={<AddIcon />} size="small" onClick={addPagina}>
          Página
        </Button>
      </Stack>

      {/* Cabeçalho da página ativa */}
      {pagina && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Título da página"
            value={pagina.titulo}
            onChange={(e) => setPaginaCampo({ titulo: e.target.value })}
            size="small"
            sx={{ flex: 1, width: { xs: "100%", sm: "auto" } }}
          />
          <TextField
            label="Descrição da página (opcional)"
            value={pagina.descricao ?? ""}
            onChange={(e) => setPaginaCampo({ descricao: e.target.value })}
            size="small"
            sx={{ flex: 1, width: { xs: "100%", sm: "auto" } }}
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: "flex-end", sm: "flex-start" }}
          >
            <Tooltip title="Mover página para a esquerda">
              <span>
                <IconButton size="small" disabled={idx === 0} onClick={() => moverPagina(-1)}>
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Mover página para a direita">
              <span>
                <IconButton size="small" disabled={idx === paginas.length - 1} onClick={() => moverPagina(1)}>
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Excluir página">
              <span>
                <IconButton size="small" color="error" disabled={paginas.length <= 1} onClick={removerPagina}>
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={secoes.map((s) => s.id!)} strategy={verticalListSortingStrategy}>
          {secoes.map((s) => (
            <SortableSecao
              key={s.id}
              secao={s}
              todasPerguntas={todasPerguntas}
              outrasPaginas={outrasPaginas}
              onChange={(nova) => setSecao(s.id!, nova)}
              onRemover={() => removerSecao(s.id!)}
              onAddPergunta={(tipo) => addPergunta(s.id!, tipo)}
              onInserirBloco={() => setBlocoSecaoId(s.id!)}
              onMoverParaPagina={(paginaId) => moverSecaoParaPagina(s.id!, paginaId)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {secoes.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nenhuma seção nesta página. Adicione uma seção.
        </Typography>
      )}

      <Button startIcon={<AddIcon />} variant="outlined" onClick={addSecao}>
        Adicionar seção
      </Button>

      <PreviewDialog aberto={preview} schema={schemaAtual} onFechar={() => setPreview(false)} />
      <InserirBlocoDialog
        aberto={!!blocoSecaoId}
        onFechar={() => setBlocoSecaoId(null)}
        onInserir={inserirBloco}
      />
    </Box>
  );
}
