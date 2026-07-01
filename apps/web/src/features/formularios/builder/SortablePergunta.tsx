import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Pergunta } from "@dcmg/contracts";
import { ROTULO_TIPO } from "./tipos";
import { PerguntaEditor } from "./PerguntaEditor";

interface Props {
  pergunta: Pergunta;
  secaoId: string;
  outras: Pergunta[];
  onChange: (p: Pergunta) => void;
  onRemover: () => void;
}

export function SortablePergunta({ pergunta, secaoId, outras, onChange, onRemover }: Props) {
  const [aberto, setAberto] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pergunta.codigo,
    data: { type: "pergunta", secaoId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: "grab" }}>
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {pergunta.rotulo || "(sem rótulo)"}
              {pergunta.obrigatorio && <span style={{ color: "#F97316" }}> *</span>}
            </Typography>
          </Box>
          <Chip
            label={ROTULO_TIPO[pergunta.tipo]}
            size="small"
            variant="outlined"
            sx={{ flexShrink: 0, maxWidth: { xs: 110, sm: "none" } }}
          />
          <IconButton size="small" onClick={() => setAberto((v) => !v)}>
            {aberto ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" color="error" onClick={onRemover}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Collapse in={aberto} unmountOnExit>
          <PerguntaEditor pergunta={pergunta} outras={outras} onChange={onChange} />
        </Collapse>
      </CardContent>
    </Card>
  );
}
