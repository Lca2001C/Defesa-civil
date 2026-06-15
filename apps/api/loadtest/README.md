# Testes de carga — Defesa Civil MG

Valida que a API aguenta muitos usuários simultâneos e dados dos 853 municípios.

## Pré-requisitos

1. **Popular dados de carga** (submissões nos 853 municípios):
   ```bash
   pnpm --filter @dcmg/api seed:carga
   # Volume maior:
   SUBMISSOES_POR_MUNICIPIO=50 HISTORICO_MULT=4 pnpm --filter @dcmg/api seed:carga
   ```
2. **Subir a API** (e Redis/Postgres): `pnpm --filter @dcmg/api start:dev`.
3. **Obter um access token** (login) e o **competenciaId** da competência ABERTA.

## Opção A — k6 (cenários completos + thresholds)

Instale o binário k6 (não é dependência npm):
```bash
winget install k6           # Windows
# ou: choco install k6 / brew install k6
```

Rode os cenários:
```bash
k6 run -e BASE=http://localhost:3000/api -e TOKEN=<token> -e COMP=<competenciaId> apps/api/loadtest/painel.js
k6 run -e BASE=http://localhost:3000/api -e TOKEN=<token> -e COMP=<competenciaId> apps/api/loadtest/export.js
```

**Thresholds** (o teste falha se violados):
- `painel.js`: p95 < 800ms, taxa de erro < 1% (rampa 50 → 200 VUs).
- `export.js`: taxa de erro < 1% (10 exports simultâneos).

## Opção B — autocannon (smoke, sem instalar binário)

```bash
TOKEN=<token> COMP=<competenciaId> pnpm --filter @dcmg/api loadtest:smoke
# Customizável: PATH_TESTE, CONN (conexões), DUR (segundos)
TOKEN=<token> COMP=<id> CONN=100 DUR=30 PATH_TESTE="/dashboard/resumo?competenciaId=<id>" \
  pnpm --filter @dcmg/api loadtest:smoke
```

## O que observar

- **Latência do painel** antes/depois do cache (Workstream C): a 2ª chamada da mesma
  competência deve ser muito mais rápida (cache hit em Redis).
- **Memória da API** durante o `export.js`: deve permanecer estável (geração em
  streaming com leitura em lotes por cursor), mesmo com centenas de milhares de linhas.
