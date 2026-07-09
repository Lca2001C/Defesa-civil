// Tema MUI escuro institucional da Defesa Civil MG.
// Aplica as cores EXATAS do SPEC e sobrescreve os componentes-chave
// (AppBar laranja, Drawer e Card com os fundos institucionais).

import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { cores } from "./tokens";

const temaBase = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: cores.laranjaPrimario,
      contrastText: "#0B1730",
    },
    background: {
      default: cores.fundoPadrao,
      paper: cores.fundoCartao,
    },
    success: { main: cores.verdeSucesso },
    warning: { main: cores.amareloAtencao },
    error: { main: cores.vermelhoErro },
    text: {
      primary: cores.textoPrimario,
      secondary: cores.textoSecundario,
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      '"Roboto","Segoe UI","Helvetica","Arial",sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: cores.fundoPadrao,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: "primary", elevation: 0 },
      styleOverrides: {
        colorPrimary: {
          backgroundColor: cores.laranjaPrimario,
          color: "#0B1730",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: cores.fundoSidebar,
          borderRight: "1px solid rgba(148, 163, 184, 0.12)",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: cores.fundoCartao,
          border: "1px solid rgba(148, 163, 184, 0.12)",
        },
      },
    },
    // Textos de ajuda/descricao dos formularios dinamicos podem ser longos
    // (ex.: consequencias por tipo de evento): exibir integralmente, com
    // quebra de linha, em vez de cortar visualmente.
    MuiFormHelperText: {
      styleOverrides: {
        root: { whiteSpace: "pre-wrap" },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: { whiteSpace: "normal", wordBreak: "break-word" },
      },
    },
  },
});

// responsiveFontSizes ajusta automaticamente o tamanho dos headings por
// breakpoint (ex.: os numeros "h3" dos cards do dashboard encolhem no celular),
// evitando titulos grandes demais e quebras de layout em telas pequenas.
export const tema = responsiveFontSizes(temaBase);
