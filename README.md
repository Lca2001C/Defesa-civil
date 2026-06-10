# Plataforma Defesa Civil MG

Plataforma institucional da Coordenadoria Estadual de Defesa Civil de Minas
Gerais (CEDEC-MG). Este repositorio e um **monorepo** que reune o frontend
(SPA React), o backend (API NestJS) e os contratos compartilhados de tipos.

Esta entrega corresponde ao **passo 1 do roadmap de arquitetura** (Fase 1 — a
fundacao do monorepo, containers e tooling).

## Arquitetura em alto nivel

```
+----------------------------------------------------------+
|                        Navegador                         |
+----------------------------------------------------------+
                 |  HTTP (porta do host)
                 v
+----------------------------------------------------------+
|  web  (Nginx)  — serve a SPA e faz proxy reverso          |
|   /            -> arquivos estaticos da SPA               |
|   /api         -> api:4000                                |
|   /socket.io   -> api:4000 (WebSocket)                    |
+----------------------------------------------------------+
                 |
                 v
+----------------------------------------------------------+
|  api  (NestJS)  — escuta na porta 4000, prefixo /api      |
+----------------------------------------------------------+
        |                         |
        v                         v
+----------------+        +----------------+
| postgres :5432 |        |  redis :6379   |
+----------------+        +----------------+
```

### Workspaces

| Pacote               | Caminho               | Descricao                          |
| -------------------- | --------------------- | ---------------------------------- |
| `@dcmg/web`          | `apps/web`            | SPA React + Vite + MUI             |
| `@dcmg/api`          | `apps/api`            | API NestJS (REST + WebSocket)      |
| `@dcmg/contracts`    | `packages/contracts`  | Tipos e contratos compartilhados   |

## Pre-requisitos

- **Docker** e **Docker Compose** (para subir a stack completa).
- **Node 20** (use a versao do arquivo `.nvmrc`).
- **pnpm** habilitado via **corepack** (acompanha o Node 20):

  ```bash
  corepack enable
  corepack prepare pnpm@9.12.3 --activate
  ```

## Configuracao de ambiente

1. Copie o arquivo de exemplo e ajuste o que precisar:

   ```bash
   cp .env.example .env
   ```

2. Em qualquer ambiente real, **troque os segredos** (`JWT_*`, senhas de banco,
   token do Ngrok). O `.env` **nao e versionado**.

## Subir a Fase 1 (stack completa via Docker)

```bash
docker compose up --build
```

Servicos e portas publicadas:

| Servico    | Imagem / build                | Porta do host        | Observacao                                |
| ---------- | ----------------------------- | -------------------- | ----------------------------------------- |
| `web`      | Nginx (SPA + proxy reverso)   | `${NGINX_HTTP_PORT}` (padrao `8080`) -> 80 | Ponto de entrada da aplicacao |
| `api`      | NestJS                        | `4000` -> 4000       | Healthcheck em `/api/health`              |
| `postgres` | `postgres:16-alpine`          | `5432` -> 5432       | Volume `pg_data`                          |
| `redis`    | `redis:7-alpine`              | `6379` -> 6379       | Volume `redis_data`                       |
| `ngrok`    | `ngrok/ngrok:latest`          | (sem porta de host)  | Apenas com profile `tunnel`               |

Apos subir:

- Aplicacao (SPA): http://localhost:8080
- API (prefixo): http://localhost:8080/api  (ou direto em http://localhost:4000/api)
- Swagger (documentacao da API): http://localhost:8080/api/docs
- Healthcheck da API: http://localhost:8080/api/health

## Expor via Ngrok

Ha duas formas de criar um tunel publico:

1. **Profile `tunnel` do Compose** (recomendado, sobe junto com a stack):

   ```bash
   # defina NGROK_AUTHTOKEN no .env
   docker compose --profile tunnel up --build
   ```

   O servico `ngrok` executa `http web:80`, expondo o Nginx (e, portanto, a SPA,
   a API e o WebSocket, todos na mesma origem).

2. **Ngrok local na sua maquina** (sem container), apontando para a porta do host:

   ```bash
   ngrok http 8080
   ```

> Como tudo passa pela mesma origem (Nginx), o tunel unico cobre SPA, `/api` e
> `/socket.io` sem configuracao extra.

## Desenvolvimento com HMR

Para iterar rapido com hot reload, suba apenas a infraestrutura no Docker e rode
os apps localmente:

```bash
# 1) infraestrutura (banco + cache)
docker compose up postgres redis

# 2) em outro terminal — API NestJS com watch
pnpm --filter @dcmg/api start:dev

# 3) em outro terminal — SPA com Vite/HMR
pnpm --filter @dcmg/web dev
```

> Em dev, o pacote `@dcmg/contracts` e consumido direto do codigo-fonte:
> a `web` usa alias do Vite e a `api` usa os `paths` do TypeScript apontando
> para `packages/contracts/src` — sem precisar de build intermediario.

## Scripts da raiz

| Comando                  | O que faz                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| `pnpm build`             | `pnpm -r build` — build de todos os pacotes em ordem topologica  |
| `pnpm typecheck`         | `pnpm -r typecheck` — checagem de tipos em todos os pacotes       |
| `pnpm dev`               | `pnpm -r --parallel dev` — sobe os apps em modo dev               |
| `pnpm prisma:generate`   | Gera o Prisma Client (delegado ao `@dcmg/api`)                    |
| `pnpm prisma:migrate`    | Roda as migracoes do Prisma (delegado ao `@dcmg/api`)             |

## Estrutura de pastas

```
defesa-civil-mg/
├─ apps/
│  ├─ api/                 # API NestJS (@dcmg/api)
│  └─ web/                 # SPA React + Vite (@dcmg/web)
├─ packages/
│  └─ contracts/           # Tipos/contratos compartilhados (@dcmg/contracts)
├─ infra/
│  ├─ docker/              # Dockerfiles (api.Dockerfile, web.Dockerfile)
│  └─ nginx/               # Configuracao do Nginx e entrypoint de runtime
├─ docker-compose.yml      # Topologia dos servicos
├─ pnpm-workspace.yaml     # Definicao dos workspaces
├─ tsconfig.base.json      # Config base de TypeScript (estendida pelos apps)
├─ .env.example            # Modelo de variaveis de ambiente
└─ README.md
```

## Principio: Build Once, Deploy Anywhere

A mesma imagem Docker roda em qualquer ambiente; **toda** a configuracao vem de
variaveis de ambiente — nao ha host nem porta fixos no codigo.

- A SPA fala com a API por caminho **relativo** `/api` e com o WebSocket em
  `/socket.io`, sempre na **mesma origem** (resolvida pelo Nginx). A URL da API
  **nao** e fixada em tempo de build.
- No boot do container `web`, um entrypoint gera o arquivo `/env.js` (via
  `envsubst`) definindo `window.__ENV__` com `APP_ENV`, `API_BASE_URL` (`/api`)
  e `SOCKET_PATH` (`/socket.io`). O `index.html` carrega `/env.js` **antes** do
  bundle da aplicacao, de modo que a configuracao e resolvida em **runtime**.
- As imagens Docker sao **multi-stage** e executam como **usuario nao-root**.

## Identidade visual

Tema MUI escuro institucional (sem template admin generico). Paleta principal:

| Uso                         | Cor       |
| --------------------------- | --------- |
| Fundo (background.default)  | `#050B1A` |
| Cartoes / paper             | `#111D3B` |
| Sidebar / Drawer            | `#0B1730` |
| Header / AppBar / primary   | `#F97316` |
| Sucesso                     | `#22C55E` |
| Atencao                     | `#EAB308` |
| Erro                        | `#EF4444` |
