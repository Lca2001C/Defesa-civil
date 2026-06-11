import { useState } from "react";
import { Box, Card, CardContent, Tab, Tabs, Typography } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import HistoryIcon from "@mui/icons-material/History";
import { useAuth } from "../../lib/auth-context";
import UsuariosTab from "./UsuariosTab";
import AuditoriaTab from "./AuditoriaTab";

export default function AdminPage() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState(0);

  const podeGerenciarUsuarios = usuario?.permissoes.includes("usuarios.gerenciar") ?? false;
  const podeLerAuditoria = usuario?.permissoes.includes("auditoria.ler") ?? false;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Administração</Typography>
        <Typography variant="body2" color="text.secondary">
          Gestão de usuários e log de auditoria do sistema
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={aba} onChange={(_, v: number) => setAba(v)}>
            {podeGerenciarUsuarios && (
              <Tab icon={<PeopleIcon />} iconPosition="start" label="Usuários" />
            )}
            {podeLerAuditoria && (
              <Tab icon={<HistoryIcon />} iconPosition="start" label="Auditoria" />
            )}
          </Tabs>
        </Box>
        <CardContent>
          {aba === 0 && podeGerenciarUsuarios && <UsuariosTab />}
          {aba === (podeGerenciarUsuarios ? 1 : 0) && podeLerAuditoria && <AuditoriaTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
