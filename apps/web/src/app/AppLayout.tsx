// Layout principal da aplicacao: AppBar (header laranja) + barra lateral
// institucional e a area de conteudo (Outlet) sobre o fundo escuro.
//
// Responsivo: em telas md+ a sidebar e um Drawer PERMANENTE; em telas menores
// vira um Drawer TEMPORARIO (aberto pelo botao hamburguer na AppBar). O padrao
// segue o "ResponsiveDrawer" do MUI (dois Drawers alternados por breakpoint,
// sem flash de useMediaQuery no SSR/hidratacao).

import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MapIcon from "@mui/icons-material/Map";
import BarChartIcon from "@mui/icons-material/BarChart";
import DescriptionIcon from "@mui/icons-material/Description";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { NavLink, Outlet } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { cores } from "../theme/tokens";
import { useAuth } from "../lib/auth-context";

const LARGURA_SIDEBAR = 248;

interface ItemMenu {
  rotulo: string;
  icone: ReactNode;
  path: string;
  nivelMinimo?: number;
  permissao?: string;
}

const itensMenu: ItemMenu[] = [
  { rotulo: "Painel", icone: <MapIcon />, path: "/" },
  { rotulo: "Dashboard", icone: <BarChartIcon />, path: "/dashboard" },
  { rotulo: "Formulários", icone: <DescriptionIcon />, path: "/formularios" },
  { rotulo: "Submissões", icone: <AssignmentIcon />, path: "/submissoes" },
  { rotulo: "Competências", icone: <EventIcon />, path: "/competencias" },
  { rotulo: "Municípios", icone: <LocationCityIcon />, path: "/municipios", nivelMinimo: 50 },
  { rotulo: "Admin", icone: <AdminPanelSettingsIcon />, path: "/admin", permissao: "usuarios.gerenciar" },
  { rotulo: "Meu Perfil", icone: <AccountCircleIcon />, path: "/perfil" },
];

const SELECTED_SX = {
  backgroundColor: "rgba(249, 115, 22, 0.16)",
  "&:hover": { backgroundColor: "rgba(249, 115, 22, 0.24)" },
};

export default function AppLayout() {
  const { usuario, fazerLogout } = useAuth();
  const [mobileAberto, setMobileAberto] = useState(false);

  const itensVisiveis = itensMenu.filter((item) => {
    if (item.nivelMinimo && (usuario?.perfilNivel ?? 0) < item.nivelMinimo) return false;
    if (item.permissao && !usuario?.permissoes?.includes(item.permissao)) return false;
    return true;
  });

  // Conteudo do Drawer, compartilhado pelas versoes permanente e temporaria.
  const conteudoDrawer = (
    <>
      <Toolbar />
      {/* logo + nome na sidebar */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box component="img" src="/logo.svg" alt="logo" sx={{ width: 28, height: 28 }} />
        <Typography variant="caption" sx={{ color: cores.textoSecundario, lineHeight: 1.2 }}>
          Plataforma<br />
          <strong style={{ color: cores.textoPrimario }}>Defesa Civil MG</strong>
        </Typography>
      </Box>
      <Box sx={{ overflow: "auto", py: 1 }}>
        <List>
          {itensVisiveis.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={() => setMobileAberto(false)}
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
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            {/* Hamburguer: so aparece abaixo de md, onde o Drawer e temporario. */}
            <IconButton
              color="inherit"
              aria-label="Abrir menu"
              edge="start"
              onClick={() => setMobileAberto((v) => !v)}
              sx={{ display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Box
              component="img"
              src="/logo.svg"
              alt="Defesa Civil MG"
              sx={{ width: 34, height: 34, flexShrink: 0 }}
            />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
              Defesa Civil MG
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {usuario && (
              <Typography
                variant="body2"
                noWrap
                sx={{ opacity: 0.85, display: { xs: "none", sm: "block" }, maxWidth: 220 }}
              >
                {usuario.email}
              </Typography>
            )}
            <Button color="inherit" size="small" startIcon={<LogoutIcon />} onClick={fazerLogout}>
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navegacao lateral: temporaria (mobile) + permanente (md+). */}
      <Box component="nav" sx={{ width: { md: LARGURA_SIDEBAR }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileAberto}
          onClose={() => setMobileAberto(false)}
          ModalProps={{ keepMounted: true }} // melhor performance de abertura no mobile
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: LARGURA_SIDEBAR, boxSizing: "border-box" },
          }}
        >
          {conteudoDrawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: LARGURA_SIDEBAR, boxSizing: "border-box" },
          }}
        >
          {conteudoDrawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // minWidth:0 e essencial: sem isso um filho largo (tabela) faz o flex
          // item estourar e cria scroll horizontal na PAGINA inteira. Com 0, o
          // overflow fica contido no proprio TableContainer.
          minWidth: 0,
          p: { xs: 2, sm: 3 },
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
