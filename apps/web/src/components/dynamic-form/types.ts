import type { ControllerRenderProps, FieldError } from "react-hook-form";
import type { CampoFormulario } from "@dcmg/contracts";

/** Props compartilhadas por todos os componentes de campo. */
export interface FieldProps {
  campo: CampoFormulario;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, any>;
  error?: FieldError;
}
