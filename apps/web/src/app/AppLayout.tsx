// Layout principal da aplicacao: AppBar (header laranja) + Drawer permanente
// (barra lateral institucional) e a area de conteudo (Outlet) sobre o fundo
// escuro. Os itens da sidebar sao placeholders da Fase 1.

import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ShieldIcon from "@mui/icons-material/Shield";
import { Outlet } from "react-router-dom";
import { type ReactNode } from "react";
import { cores } from "../theme/tokens";

const LARGURA_SIDEBAR = 248;

interface ItemMenu {
  rotulo: string;
  icone: ReactNode;
}

const itensMenu: ItemMenu[] = [
  { rotulo: "Painel", icone: <DashboardIcon /> },
  { rotulo: "Formularios", icone: <DescriptionIcon /> },
  { rotulo: "Importacao", icone: <UploadFileIcon /> },
  { rotulo: "Municipios", icone: <LocationCityIcon /> },
  { rotulo: "Admin", icone: <AdminPanelSettingsIcon /> },
];

export default function AppLayout() {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <ShieldIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            Defesa Civil MG
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: LARGURA_SIDEBAR,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: LARGURA_SIDEBAR,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto", py: 1 }}>
          <List>
            {itensMenu.map((item, indice) => (
              <ListItemButton
                key={item.rotulo}
                selected={indice === 0}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    backgroundColor: "rgba(249, 115, 22, 0.16)",
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: "rgba(249, 115, 22, 0.24)",
                  },
                }}
              >
                <ListItemIcon sx={{ color: cores.laranjaPrimario, minWidth: 40 }}>
                  {item.icone}
                </ListItemIcon>
                <ListItemText primary={item.rotulo} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: cores.fundoPadrao,
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
