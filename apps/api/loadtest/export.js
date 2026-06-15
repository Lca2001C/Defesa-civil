// Teste de carga — fluxo de export assíncrono (enfileira → polling → download).
// Requer o binário k6 e dados de carga (pnpm seed:carga).
//
// Uso:
//   k6 run -e BASE=http://localhost:3000/api \
//          -e TOKEN=<access_token> \
//          -e COMP=<competenciaId> \
//          apps/api/loadtest/export.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:3000/api";
const TOKEN = __ENV.TOKEN || __ENV.K6_TOKEN || "";
const COMP = __ENV.COMP || "";

export const options = {
  scenarios: {
    export_concorrente: {
      executor: "per-vu-iterations",
      vus: 10, // 10 exports simultâneos
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const params = { headers: { Authorization: `Bearer ${TOKEN}` } };

export default function () {
  // 1) Enfileira
  const enq = http.post(`${BASE}/relatorios/submissoes/export?competenciaId=${COMP}`, null, params);
  check(enq, { "enfileirou (201/200)": (r) => r.status === 200 || r.status === 201 });
  const jobId = enq.json("jobId");
  if (!jobId) return;

  // 2) Polling até completar
  let concluido = false;
  for (let i = 0; i < 120; i++) {
    const st = http.get(`${BASE}/relatorios/export/${jobId}`, params);
    const estado = st.json("estado");
    if (estado === "completed") {
      concluido = true;
      break;
    }
    if (estado === "failed") break;
    sleep(1);
  }
  check(null, { "export concluído": () => concluido });

  // 3) Download
  if (concluido) {
    const dl = http.get(`${BASE}/relatorios/export/${jobId}/download`, params);
    check(dl, { "download 200": (r) => r.status === 200 });
  }
}
