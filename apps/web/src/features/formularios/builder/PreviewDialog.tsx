import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import type { SchemaFormulario } from "@dcmg/contracts";
import { DynamicForm } from "../../../components/dynamic-form";

interface Props {
  aberto: boolean;
  schema: SchemaFormulario;
  onFechar: () => void;
}

export function PreviewDialog({ aberto, schema, onFechar }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        Pré-visualização — {schema.titulo ?? "Formulário"}
        <IconButton onClick={onFechar} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <DynamicForm schema={schema} onSubmit={() => {}} preview />
      </DialogContent>
    </Dialog>
  );
}
