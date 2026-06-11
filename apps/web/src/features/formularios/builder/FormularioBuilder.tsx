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
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import type { Pergunta, SchemaFormulario, SecaoFormulario, TipoPergunta } from "@dcmg/contracts";
import { criarPergunta, criarSecao, normalizarIds } from "./tipos";
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
  const [secoes, setSecoes] = useState<SecaoFormulario[]>(() =>
    normalizarIds(schemaInicial.secoes ?? []),
  );
  const [preview, setPreview] = useState(false);
  const [blocoSecaoId, setBlocoSecaoId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const todasPerguntas = useMemo(() => secoes.flatMap((s) => s.perguntas), [secoes]);

  const schemaAtual: SchemaFormulario = useMemo(
    () => ({
      versao: schemaInicial.versao,
      titulo: schemaInicial.titulo,
      descricao: schemaInicial.descricao,
      secoes: secoes.map((s, i) => ({
        ...s,
        ordem: i,
        perguntas: s.perguntas.map((p, j) => ({ ...p, ordem: j })),
      })),
    }),
    [secoes, schemaInicial],
  );

  function setSecao(id: string, nova: SecaoFormulario) {
    setSecoes((prev) => prev.map((s) => (s.id === id ? nova : s)));
  }
  function removerSecao(id: string) {
    setSecoes((prev) => prev.filter((s) => s.id !== id));
  }
  function addSecao() {
    setSecoes((prev) => [...prev, criarSecao()]);
  }
  function addPergunta(secaoId: string, tipo: TipoPergunta) {
    setSecoes((prev) =>
      prev.map((s) => (s.id === secaoId ? { ...s, perguntas: [...s.perguntas, criarPergunta(tipo)] } : s)),
    );
  }
  function inserirBloco(perguntas: Pergunta[]) {
    if (!blocoSecaoId) return;
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === blocoSecaoId ? { ...s, perguntas: [...s.perguntas, ...perguntas] } : s,
      ),
    );
  }

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
    if (!over) return;
    if (active.data.current?.type !== "pergunta") return;

    const origemId = active.data.current.secaoId as string;
    const destinoId = alvoSecaoId(String(over.id), over.data.current as Record<string, unknown>);
    if (!destinoId || origemId === destinoId) return;

    setSecoes((prev) => {
      const origem = prev.find((s) => s.id === origemId);
      const destino = prev.find((s) => s.id === destinoId);
      if (!origem || !destino) return prev;
      const movida = origem.perguntas.find((p) => p.codigo === active.id);
      if (!movida) return prev;
      return prev.map((s) => {
        if (s.id === origemId) return { ...s, perguntas: s.perguntas.filter((p) => p.codigo !== active.id) };
        if (s.id === destinoId) return { ...s, perguntas: [...s.perguntas, movida] };
        return s;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const tipo = active.data.current?.type;

    if (tipo === "secao" && over.data.current?.type === "secao" && active.id !== over.id) {
      setSecoes((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        return oldIndex >= 0 && newIndex >= 0 ? arrayMove(prev, oldIndex, newIndex) : prev;
      });
      return;
    }

    if (tipo === "pergunta") {
      const secao = secaoDe(String(active.id));
      if (!secao) return;
      if (over.data.current?.type === "pergunta" && active.id !== over.id) {
        const mesmaSecao = secao.perguntas.some((p) => p.codigo === over.id);
        if (mesmaSecao) {
          setSecoes((prev) =>
            prev.map((s) => {
              if (s.id !== secao.id) return s;
              const oldIndex = s.perguntas.findIndex((p) => p.codigo === active.id);
              const newIndex = s.perguntas.findIndex((p) => p.codigo === over.id);
              return { ...s, perguntas: arrayMove(s.perguntas, oldIndex, newIndex) };
            }),
          );
        }
      }
    }
  }

  return (
    <Box>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
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
              onChange={(nova) => setSecao(s.id!, nova)}
              onRemover={() => removerSecao(s.id!)}
              onAddPergunta={(tipo) => addPergunta(s.id!, tipo)}
              onInserirBloco={() => setBlocoSecaoId(s.id!)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {secoes.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nenhuma seção ainda. Comece adicionando uma seção.
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
