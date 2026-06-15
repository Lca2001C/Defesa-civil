// Teste de carga — endpoints quentes do painel/dashboard.
// Requer o binário k6 (https://k6.io) e dados de carga (pnpm seed:carga).
//
// Uso:
//   k6 run -e BASE=http://localhost:3000/api \
//          -e TOKEN=<access_token> \
//          -e COMP=<competenciaId> \
//          apps/api/loadtest/painel.js
//
// Rampa: 50 → 200 VUs (usuários virtuais simultâneos).

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:3000/api";
const TOKEN = __ENV.TOKEN || __ENV.K6_TOKEN || "";
const COMP = __ENV.COMP || "";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

const params = { headers: { Authorization: `Bearer ${TOKEN}` } };

export default function () {
  const reqs = [
    ["GET", `${BASE}/painel/status?competenciaId=${COMP}`, null, params],
    ["GET", `${BASE}/painel/stats?competenciaId=${COMP}`, null, params],
    ["GET", `${BASE}/dashboard/resumo?competenciaId=${COMP}`, null, params],
    ["GET", `${BASE}/submissoes?competenciaId=${COMP}&porPagina=50`, null, params],
  ];

  const respostas = http.batch(reqs);
  for (const r of respostas) {
    check(r, { "status 200": (res) => res.status === 200 });
  }
  sleep(1);
}
