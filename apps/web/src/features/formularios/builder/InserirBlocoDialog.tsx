import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Box,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import type { ConteudoBloco, Pergunta } from "@dcmg/contracts";
import { api } from "../../../lib/api";

interface Bloco {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  conteudo: ConteudoBloco;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Recebe as perguntas do bloco (com códigos já tornados únicos). */
  onInserir: (perguntas: Pergunta[]) => void;
}

let seq = 0;
function codigoUnico(base: string): string {
  seq += 1;
  return `${base}_${Date.now().toString(36)}_${seq}`;
}

export function InserirBlocoDialog({ aberto, onFechar, onInserir }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: blocos, isLoading } = useQuery({
    queryKey: ["blocos"],
    queryFn: () => api.get<Bloco[]>("/formularios/blocos"),
    enabled: aberto,
  });

  function inserir(bloco: Bloco) {
    const perguntas = (bloco.conteudo.perguntas ?? []).map((p) => {
      const novoCodigo = codigoUnico(p.codigo);
      const regras = (p.regras ?? []).map((r) => ({ ...r }));
      return { ...p, codigo: novoCodigo, regras } as Pergunta;
    });
    onInserir(perguntas);
    onFechar();
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        Inserir bloco reutilizável
        <IconButton onClick={onFechar} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {blocos?.map((b) => (
              <ListItemButton key={b.id} onClick={() => inserir(b)}>
                <ListItemText
                  primary={b.nome}
                  secondary={
                    <>
                      {b.descricao}
                      <Typography component="span" variant="caption" sx={{ display: "block" }}>
                        {b.conteudo.perguntas?.length ?? 0} pergunta(s)
                      </Typography>
                    </>
                  }
                />
              </ListItemButton>
            ))}
            {blocos?.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum bloco disponível.
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
