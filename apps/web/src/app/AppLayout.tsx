// Layout principal da aplicacao: AppBar (header laranja) + Drawer permanente
// (barra lateral institucional) e a area de conteudo (Outlet) sobre o fundo
// escuro. Os itens da sidebar sao placeholders da Fase 1.

import {
  AppBar,
  Box,
  Button,
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
import LogoutIcon from "@mui/icons-material/Logout";
import { NavLink, Outlet } from "react-router-dom";
import { type ReactNode } from "react";
import { cores } from "../theme/tokens";
import { useAuth } from "../lib/auth-context";

const LARGURA_SIDEBAR = 248;

interface ItemMenu {
  rotulo: string;
  icone: ReactNode;
  path: string;
}

const itensMenu: ItemMenu[] = [
  { rotulo: "Painel", icone: <DashboardIcon />, path: "/" },
  { rotulo: "Formulários", icone: <DescriptionIcon />, path: "/formularios" },
  { rotulo: "Importação", icone: <UploadFileIcon />, path: "/importacao" },
  { rotulo: "Municípios", icone: <LocationCityIcon />, path: "/municipios" },
  { rotulo: "Admin", icone: <AdminPanelSettingsIcon />, path: "/admin" },
];

const SELECTED_SX = {
  backgroundColor: "rgba(249, 115, 22, 0.16)",
  "&:hover": { backgroundColor: "rgba(249, 115, 22, 0.24)" },
};

export default function AppLayout() {
  const { usuario, fazerLogout } = useAuth();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <ShieldIcon sx={{ mr: 1.5 }} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              Defesa Civil MG
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {usuario && (
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {usuario.email}
              </Typography>
            )}
            <Button
              color="inherit"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={fazerLogout}
            >
              Sair
            </Button>
          </Box>
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
            {itensMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {({ isActive }) => (
                  <ListItemButton
                    selected={isActive}
                    sx={{
                      mx: 1,
                      borderRadius: 2,
                      mb: 0.5,
                      ...(isActive ? SELECTED_SX : {}),
                    }}
                  >
                    <ListItemIcon sx={{ color: cores.laranjaPrimario, minWidth: 40 }}>
                      {item.icone}
                    </ListItemIcon>
                    <ListItemText primary={item.rotulo} />
                  </ListItemButton>
                )}
              </NavLink>
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
