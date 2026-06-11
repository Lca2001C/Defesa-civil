import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import type { Pergunta, SecaoFormulario, TipoPergunta } from "@dcmg/contracts";
import { TIPOS } from "./tipos";
import { SortablePergunta } from "./SortablePergunta";

interface Props {
  secao: SecaoFormulario;
  todasPerguntas: Pergunta[];
  onChange: (s: SecaoFormulario) => void;
  onRemover: () => void;
  onAddPergunta: (tipo: TipoPergunta) => void;
  onInserirBloco: () => void;
}

export function SortableSecao({
  secao,
  todasPerguntas,
  onChange,
  onRemover,
  onAddPergunta,
  onInserirBloco,
}: Props) {
  const sid = secao.id!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sid,
    data: { type: "secao" },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `container:${sid}`,
    data: { type: "container", secaoId: sid },
  });

  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  function setPergunta(codigo: string, p: Pergunta) {
    onChange({ ...secao, perguntas: secao.perguntas.map((q) => (q.codigo === codigo ? p : q)) });
  }
  function removerPergunta(codigo: string) {
    onChange({ ...secao, perguntas: secao.perguntas.filter((q) => q.codigo !== codigo) });
  }

  return (
    <Card ref={setNodeRef} style={style} sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: "grab" }}>
            <DragIndicatorIcon />
          </IconButton>
          <TextField
            value={secao.titulo}
            onChange={(e) => onChange({ ...secao, titulo: e.target.value })}
            variant="standard"
            placeholder="Título da seção"
            sx={{ flex: 1 }}
            InputProps={{ style: { fontSize: 18, fontWeight: 600 } }}
          />
          <IconButton size="small" color="error" onClick={onRemover}>
            <DeleteIcon />
          </IconButton>
        </Stack>

        <TextField
          value={secao.descricao ?? ""}
          onChange={(e) => onChange({ ...secao, descricao: e.target.value })}
          variant="standard"
          placeholder="Descrição da seção (opcional)"
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        <Box ref={setDropRef} sx={{ minHeight: 8 }}>
          <SortableContext
            items={secao.perguntas.map((p) => p.codigo)}
            strategy={verticalListSortingStrategy}
          >
            {secao.perguntas.map((p) => (
              <SortablePergunta
                key={p.codigo}
                pergunta={p}
                secaoId={sid}
                outras={todasPerguntas.filter((q) => q.codigo !== p.codigo)}
                onChange={(np) => setPergunta(p.codigo, np)}
                onRemover={() => removerPergunta(p.codigo)}
              />
            ))}
          </SortableContext>
          {secao.perguntas.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", py: 1 }}>
              Sem perguntas. Adicione abaixo ou insira um bloco.
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button startIcon={<AddIcon />} size="small" onClick={(e) => setMenuEl(e.currentTarget)}>
            Adicionar pergunta
          </Button>
          <Button startIcon={<LibraryAddIcon />} size="small" onClick={onInserirBloco}>
            Inserir bloco
          </Button>
        </Stack>

        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
          {TIPOS.map((t) => (
            <MenuItem
              key={t.tipo}
              onClick={() => {
                onAddPergunta(t.tipo);
                setMenuEl(null);
              }}
            >
              {t.rotulo}
            </MenuItem>
          ))}
        </Menu>
      </CardContent>
    </Card>
  );
}
