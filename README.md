# Plataforma Defesa Civil MG

Plataforma institucional da Coordenadoria Estadual de Defesa Civil de Minas
Gerais (CEDEC-MG). O repositório é um **monorepo** (`pnpm workspaces`) com:

- **Frontend** — SPA React (painel estadual, formulários dinâmicos, submissões)
- **Backend** — API REST NestJS com RBAC multi-tenant
- **Contratos** — tipos TypeScript compartilhados entre API e web

A plataforma cobre os **853 municípios de Minas Gerais** (código IBGE como
chave territorial), competências de coleta, motor de formulários versionado e
fluxo de submissões com revisão estadual.

---

## Funcionalidades principais

| Área | Descrição |
| ---- | --------- |
| **Painel estadual** | Mapa de MG (GeoJSON + Leaflet) com status por município/competência |
| **Competências** | Períodos de coleta (planejada, aberta, encerrada) |
| **Formulários** | Builder visual, versões publicadas, schema JSONB validado |
| **Submissões** | Rascunho → envio → correção → revisão → validação/rejeição; protocolo |
| **Municípios / COMPDEC** | Cadastro territorial e dados da coordenadoria municipal |
| **Dashboard** | Resumo, timeline e agregações por regional/formulário |
| **Relatórios** | Exportação de submissões (Excel) |
| **Usuários e RBAC** | Perfis, permissões granulares, escopo ESTADUAL / REGIONAL / MUNICIPAL |
| **Auditoria** | Log de mutações com campos sensíveis redactados (LGPD) |
| **Auth** | JWT (access + refresh), recuperação de senha por e-mail (SMTP) |
| **Anexos** | Upload local (dev) ou Azure Blob (produção), com SAS no browser |

---

## Stack tecnológica

### Runtime e tooling

| Tecnologia | Versão / nota |
| ---------- | ------------- |
| **Node.js** | `>= 20` (ver `.nvmrc`) |
| **pnpm** | `9.12.3` (`packageManager` na raiz) |
| **TypeScript** | `5.5` |
| **Docker Compose** | PostgreSQL + API + Nginx (dev/prod) |

### Backend (`apps/api`)

| Camada | Tecnologia |
| ------ | ---------- |
| Framework | **NestJS 10** (REST, guards, interceptors, Swagger) |
| ORM | **Prisma 5** + **PostgreSQL 16** |
| Validação | **class-validator**, **Zod** (env), **Zod** nos contratos |
| Auth | **JWT** (`@nestjs/jwt`), senhas com **Argon2id** |
| Cache / rate limit | **Cache em memória** (`CacheService`) — instância única, sem Redis |
| Arquivos | Disco local ou **Azure Blob Storage** (`@azure/storage-blob`) |
| E-mail | **Nodemailer** (SMTP opcional) |
| Relatórios | **ExcelJS**, **PDFKit** |
| Segurança | **Helmet**, CORS configurável, throttle por IP |
| Testes | **Jest** (serviços críticos) |

### Frontend (`apps/web`)

| Camada | Tecnologia |
| ------ | ---------- |
| UI | **React 18** + **Vite 5** |
| Componentes | **MUI 5** + **Emotion** |
| Rotas | **React Router 6** |
| Dados | **TanStack React Query 5** |
| Formulários | **React Hook Form** + **Zod** |
| Mapa | **Leaflet** + **react-leaflet** + GeoJSON dos 853 municípios |
| Builder | **@dnd-kit** (ordenar perguntas) |
| Contratos | `@dcmg/contracts` (alias Vite → `packages/contracts/src` em dev) |

### Pacote compartilhado (`packages/contracts`)

Tipos de domínio exportados: **RBAC**, **competência**, **submissão**,
**formulário** (schema do motor), **painel**.

### Infraestrutura

| Componente | Uso |
| ---------- | --- |
| **Nginx** | SPA estática + proxy `/api` → API (container `web`) |
| **PostgreSQL** | Dados transacionais (dev: Docker `5436`; prod: Azure Flexible Server) |
| **Azure Blob** | Anexos em produção (upload direto do browser via SAS) |

> **Arquitetura simplificada (instância única):** não há Redis, filas BullMQ nem
> WebSocket no código atual. O painel atualiza via **polling** (React Query).
> Rate limit, cache de leitura e lockout de login usam memória do processo Node.

---

## Arquitetura em alto nível

```
┌─────────────────────────────────────────────────────────────┐
│                        Navegador                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP(S)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  web (Nginx) — porta host: NGINX_HTTP_PORT (padrão 8080)    │
│    /          → SPA (build Vite)                            │
│    /api       → api:4000                                    │
│    /env.js    → runtime config (API_BASE_URL=/api)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  api (NestJS) — porta 4000, prefixo global /api            │
│    Guards: throttle → JWT → RBAC                            │
│    Interceptor: auditoria (POST/PUT/PATCH/DELETE)             │
└───────────────┬─────────────────────────────┬─────────────────┘
                │                             │
                ▼                             ▼
     ┌──────────────────┐          ┌──────────────────┐
     │ PostgreSQL       │          │ Azure Blob       │
     │ (ou Docker dev)  │          │ (prod, anexos)   │
     └──────────────────┘          └──────────────────┘
```

**Desenvolvimento local (sem Nginx):** Vite em `http://localhost:3000` com
proxy de `/api` → `http://localhost:4000`. A API deve estar rodando na porta
4000; só o frontend ativo gera erro 500 no login (falha do proxy).

---

## Workspaces

| Pacote | Caminho | Descrição |
| ------ | ------- | --------- |
| `@dcmg/web` | `apps/web` | SPA React + Vite + MUI |
| `@dcmg/api` | `apps/api` | API NestJS (REST) |
| `@dcmg/contracts` | `packages/contracts` | Tipos e contratos compartilhados |

---

## Estrutura do repositório

```
defesa-civil-mg/
├── apps/
│   ├── api/                    # NestJS (@dcmg/api)
│   │   ├── prisma/             # schema, migrations, seed, data/
│   │   └── src/
│   │       ├── common/           # guards, filters, DTOs, decorators
│   │       ├── config/           # validação de env (Zod)
│   │       ├── infra/            # prisma, cache, storage, middleware
│   │       └── modules/
│   │           ├── auth/
│   │           ├── competencias/
│   │           ├── formularios/
│   │           ├── submissoes/
│   │           ├── painel/
│   │           ├── dashboard/
│   │           ├── relatorios/
│   │           ├── usuarios/
│   │           ├── localidades/
│   │           ├── auditoria/
│   │           ├── notificacoes/
│   │           └── health/
│   └── web/                    # React (@dcmg/web)
│       ├── public/             # logo, municipios-mg.geojson
│       ├── geo-src/            # GeoJSON fonte (simplificação via mapshaper)
│       └── src/
│           ├── app/            # layout, router, rotas protegidas
│           ├── components/     # dynamic-form, UI compartilhada
│           ├── features/       # painel, formularios, submissoes, admin…
│           └── lib/            # api, auth, runtimeConfig
├── packages/
│   └── contracts/              # tipos compartilhados (@dcmg/contracts)
├── infra/
│   ├── docker/                 # api.Dockerfile, web.Dockerfile
│   ├── nginx/                  # nginx.conf, entrypoint, TLS prod
│   └── scripts/                # backup, restore, start-prod
├── docker-compose.yml          # dev: postgres + api + web
├── docker-compose.prod.yml     # prod: api + web (Postgres na Azure)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── start-dev.sh / stop-dev.sh  # bootstrap automatizado (Linux/macOS/WSL)
├── .env.example
└── README.md
```

### Rotas da SPA (principais)

| Rota | Página |
| ---- | ------ |
| `/` | Painel estadual (mapa MG) |
| `/formularios` | Lista e builder de formulários |
| `/submissoes` | Submissões do escopo do usuário |
| `/dashboard` | Indicadores e gráficos |
| `/competencias` | Gestão de competências |
| `/municipios` | Lista dos municípios MG |
| `/admin` | Usuários e auditoria |
| `/perfil` | Dados do usuário logado |
| `/login`, `/recuperar-senha`, `/redefinir-senha` | Autenticação |

### API REST (prefixo `/api`)

Documentação interativa: **`/api/docs`** (Swagger).

Módulos expostos via controllers em `apps/api/src/modules/*` — auth, health,
competencias, formularios, submissoes, painel, dashboard, relatorios, usuarios,
municipios/regionais (localidades), auditoria.

---

## Pré-requisitos

- **Docker** e **Docker Compose** (PostgreSQL local e stack containerizada)
- **Node.js 20+**
- **pnpm** via corepack:

  ```bash
  corepack enable
  corepack prepare pnpm@9.12.3 --activate
  ```

---

## Configuração de ambiente

1. Copie o exemplo e ajuste os valores:

   ```bash
   cp .env.example .env
   ```

2. Para a API local com Docker, use `DATABASE_URL` apontando a
   `localhost:5436` (porta publicada do Postgres no compose).

3. Sincronize o `.env` na pasta da API quando rodar Prisma manualmente:

   ```bash
   cp .env apps/api/.env
   ```

4. Em ambientes reais, **troque todos os segredos** (`JWT_*`, senhas, SMTP,
   Azure). O arquivo `.env` **não é versionado**.

Variáveis principais (ver `.env.example` completo):

| Grupo | Exemplos |
| ----- | -------- |
| App | `PORT`, `API_PREFIX`, `CORS_ORIGINS`, `PUBLIC_BASE_URL` |
| Banco | `DATABASE_URL`, `POSTGRES_*` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_*_TTL` |
| Storage | `STORAGE_DRIVER` (`local` \| `azure`), `AZURE_STORAGE_*` |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Limites | `MAX_UPLOAD_MB`, `RATE_LIMIT_TTL`, `RATE_LIMIT_LIMIT` |
| Web | `NGINX_HTTP_PORT` |

---

## Desenvolvimento local

### Opção A — `pnpm dev` (recomendado)

```bash
# 1) Infraestrutura
docker compose up -d postgres

# 2) Dependências (primeira vez)
pnpm install

# 3) Banco: client, migrations e seed
pnpm prisma:generate
pnpm prisma:migrate
pnpm --filter @dcmg/api prisma:seed

# 4) API + frontend em paralelo
pnpm dev
```

O script `dev` na raiz:

1. Compila `@dcmg/contracts`
2. Sobe `@dcmg/api` (`nest start --watch`, porta **4000**)
3. Sobe `@dcmg/web` (Vite, porta **3000**)

| Serviço | URL |
| ------- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger | http://localhost:4000/api/docs |
| Health | http://localhost:4000/api/health |

### Opção B — `start-dev.sh`

Script bash que cria `.env`, sobe Postgres, roda migrations e inicia API + Vite:

```bash
./start-dev.sh
```

Para encerrar processos iniciados pelo script: `./stop-dev.sh`

### Opção C — processos separados

```bash
docker compose up -d postgres
pnpm dev:api    # só a API
pnpm dev:web    # só o Vite (requer API na 4000)
```

### Credenciais padrão do seed (desenvolvimento)

| Campo | Valor padrão |
| ----- | ------------ |
| E-mail | `admin@defesacivil.mg.gov.br` |
| Senha | `Defesa@Civil2026!` |

Override via `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA`, etc., antes do seed.

### Carga de teste (opcional)

```bash
pnpm --filter @dcmg/api seed:carga
```

---

## Stack Docker (desenvolvimento)

```bash
docker compose up --build
```

| Serviço | Porta no host | Observação |
| ------- | ------------- | ------------ |
| `web` (Nginx) | `${NGINX_HTTP_PORT}` → **8080** | Entrada da aplicação |
| `api` (NestJS) | **4000** | Health em `/api/health` |
| `postgres` | **5436** → 5432 | Volume `pg_data` |

URLs após subir:

- SPA: http://localhost:8080
- API via proxy: http://localhost:8080/api
- Swagger: http://localhost:8080/api/docs

---

## Produção

Arquivo **standalone**: `docker-compose.prod.yml`

- API + Nginx na VM
- **PostgreSQL gerenciado** (Azure Database for PostgreSQL Flexible Server)
- **Azure Blob** para anexos (`STORAGE_DRIVER=azure`)
- TLS via Certbot / certificados em `infra/nginx/certs`

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Migrações contra o banco de produção (fora do compose):

```bash
pnpm --filter @dcmg/api exec prisma migrate deploy
```

Detalhes: comentários no topo de `docker-compose.prod.yml` e `infra/scripts/start-prod.sh`.

---

## Scripts da raiz

| Comando | Descrição |
| ------- | --------- |
| `pnpm dev` | Build de contracts + API (watch) + web (Vite) |
| `pnpm dev:api` | Apenas a API |
| `pnpm dev:web` | Apenas o frontend |
| `pnpm build` | Build de todos os workspaces |
| `pnpm typecheck` | Checagem TypeScript em todos os pacotes |
| `pnpm prisma:generate` | Gera o Prisma Client |
| `pnpm prisma:migrate` | `prisma migrate dev` na API |

Scripts adicionais em `@dcmg/api`: `prisma:seed`, `seed:carga`, `test`.

No `@dcmg/web`: `geo:simplify` — reduz o GeoJSON do mapa (`mapshaper`).

---

## Princípio: Build Once, Deploy Anywhere

Toda configuração sensível ou ambiental vem de **variáveis de ambiente** — não
há host ou porta fixos no código de produção.

- A SPA consome a API por caminho **relativo** `/api` (mesma origem via Nginx).
- No container `web`, o entrypoint gera `/env.js` com `window.__ENV__`
  (`API_BASE_URL`, `APP_ENV`, etc.) antes do bundle React.
- Imagens Docker são **multi-stage** e rodam como usuário **não-root**.

---

## Identidade visual

Tema MUI escuro institucional CEDEC-MG:

| Uso | Cor |
| --- | --- |
| Fundo | `#050B1A` |
| Cartões / paper | `#111D3B` |
| Sidebar | `#0B1730` |
| Primária / header | `#F97316` |
| Sucesso | `#22C55E` |
| Atenção | `#EAB308` |
| Erro | `#EF4444` |

---

## Licença

Software proprietário da CEDEC-MG. Uso restrito conforme política institucional.
