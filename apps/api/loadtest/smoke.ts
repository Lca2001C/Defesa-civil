// Smoke de carga via autocannon — benchmark rápido de um endpoint, sem k6.
//
// Uso:
//   BASE=http://localhost:3000/api TOKEN=<token> COMP=<competenciaId> \
//     pnpm --filter @dcmg/api loadtest:smoke
//
// Variáveis:
//   BASE  (default http://localhost:3000/api)
//   TOKEN (obrigatório) — access token
//   COMP  (obrigatório) — competenciaId
//   PATH  (default /painel/status?competenciaId=COMP)
//   CONN  (default 50)  — conexões simultâneas
//   DUR   (default 15)  — duração em segundos

import autocannon from "autocannon";

const BASE = process.env["BASE"] ?? "http://localhost:3000/api";
const TOKEN = process.env["TOKEN"] ?? "";
const COMP = process.env["COMP"] ?? "";
const caminho = process.env["PATH_TESTE"] ?? `/painel/status?competenciaId=${COMP}`;
const connections = Number(process.env["CONN"] ?? 50);
const duration = Number(process.env["DUR"] ?? 15);

if (!TOKEN || !COMP) {
  console.error("Defina TOKEN e COMP (competenciaId). Ex.: TOKEN=... COMP=... pnpm loadtest:smoke");
  process.exit(1);
}

const url = `${BASE}${caminho}`;
console.log(`Smoke: ${connections} conexões por ${duration}s em ${url}`);

const instancia = autocannon(
  {
    url,
    connections,
    duration,
    headers: { authorization: `Bearer ${TOKEN}` },
  },
  (err, resultado) => {
    if (err) {
      console.error("Erro no autocannon:", err);
      process.exit(1);
    }
    console.log(autocannon.printResult(resultado));
    const p95 = resultado.latency.p97_5; // aproximação de cauda
    const erros = resultado.non2xx;
    console.log(`\nResumo: req/s=${resultado.requests.average} latência p97.5=${p95}ms non2xx=${erros}`);
    if (erros > 0) process.exit(1);
  },
);

autocannon.track(instancia, { renderProgressBar: true });
