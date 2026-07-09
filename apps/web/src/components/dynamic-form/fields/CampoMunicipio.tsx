// Campo MUNICIPIO: autocomplete da base oficial (IBGE), evitando divergencia
// de grafia entre bases. O valor persistido e { id, nome } — legivel nos
// relatorios sem lookup e com o id validado no servidor contra a tabela.

import { Autocomplete, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { MunicipiosService } from "../../../features/municipios/services/municipios.service";
import { QUERY_KEYS } from "../../../shared/constants";
import type { FieldProps } from "../types";

interface OpcaoMunicipio {
  id: number;
  nome: string;
}

export function CampoMunicipio({ campo, field, error }: FieldProps) {
  const { data: municipios = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.MUNICIPIOS, "lista-selecao"],
    queryFn: () => MunicipiosService.listarParaSelecao(),
    staleTime: 60 * 60 * 1000, // base oficial: raramente muda dentro da sessão
  });

  const valor = (field.value as OpcaoMunicipio | null) ?? null;

  return (
    <Autocomplete<OpcaoMunicipio>
      options={municipios}
      loading={isLoading}
      value={valor}
      onChange={(_, novo) => field.onChange(novo)}
      getOptionLabel={(o) => o.nome}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      noOptionsText="Nenhum município encontrado"
      renderInput={(params) => (
        <TextField
          {...params}
          label={campo.rotulo}
          required={campo.obrigatorio}
          error={!!error}
          helperText={error?.message ?? campo.ajuda}
          size="small"
        />
      )}
    />
  );
}
