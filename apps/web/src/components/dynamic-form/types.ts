import type { ControllerRenderProps, FieldError } from "react-hook-form";
import type { Pergunta } from "@dcmg/contracts";

export interface ArquivoUploadado {
  id: string;
  nome: string;
  tamanhoKb?: number;
}

/** Props compartilhadas por todos os componentes de campo. */
export interface FieldProps {
  campo: Pergunta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, any>;
  error?: FieldError;
  /** Callback de upload real — disponível apenas no contexto de submissão (não no preview). */
  onUpload?: (file: File, perguntaCodigo: string) => Promise<ArquivoUploadado>;
}
