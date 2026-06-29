# Deploy na Azure — VM única (runbook ALTERNATIVO / legado)

> **Atenção:** este é o plano **antigo**, baseado em **uma VM (B2s)** rodando os
> containers via Docker Compose. Continua válido e funcional, mas o plano
> **recomendado** passou a ser o de **3 serviços gerenciados** (Banco + Container
> Registry + Container Apps), em [DEPLOY-AZURE.md](DEPLOY-AZURE.md), que **otimiza
> custo** (escala a zero, TLS gerenciado grátis, zero manutenção de servidor).
> Use este runbook apenas se preferir o controle total de uma VM.

Runbook completo para subir a Plataforma Defesa Civil MG em produção na Azure, na
configuração simplificada (instância única, ≤100 usuários simultâneos).

## Arquitetura alvo

```
                         Internet (HTTPS)
                               │
                    ┌──────────▼───────────┐
                    │   Azure VM  B2s      │   2 vCPU / 4 GB
                    │  ┌────────────────┐  │
                    │  │ web (Nginx)    │  │  :80/:443  → SPA + proxy /api
                    │  │ api (NestJS)   │  │  :4000 (interno)
                    │  └───────┬────────┘  │
                    └──────────┼───────────┘
              ┌────────────────┼────────────────┐
              ▼                                  ▼
  Azure Database for PostgreSQL      Azure Blob Storage
  (Flexible Server, gerenciado)      (container "anexos", upload via SAS)
```

- **VM B2s**: roda só `api` + `web` (containers Docker). Sem Postgres/Redis na VM.
- **Banco**: Azure Database for PostgreSQL **gerenciado** (fora da VM, com backups automáticos).
- **Anexos**: Azure Blob Storage — o navegador envia/baixa **direto** via URL SAS.

> Por que B2s e não B1s? A B1s (1 vCPU / 1 GB) é apertada para Node + Nginx +
> build. A **B2s (2 vCPU / 4 GB)** dá folga confortável para 100 usuários. Se for
> manter o Postgres também na VM (não recomendado), use **B2ms (8 GB)**.

---

## 0. Pré-requisitos

- Conta Azure com permissão de criar recursos e um método de pagamento.
- **Azure CLI** instalado e logado: `az login`.
- Um **domínio** apontável (ex.: `defesacivil.mg.gov.br` ou um subdomínio) para o TLS.
- Chave SSH local (`ssh-keygen` se não tiver).

Defina variáveis reutilizadas nos comandos (ajuste os valores):

```bash
# Identificação
export RG="rg-dcmg-prod"
export LOC="brazilsouth"                 # região (São Paulo)
export PREFIX="dcmg"                      # prefixo de nomes

# Banco
export PG_SERVER="${PREFIX}-pg"           # nome do servidor PostgreSQL
export PG_ADMIN="dcmgadmin"
export PG_PASS="$(openssl rand -base64 24)"   # GUARDE este valor!
export PG_DB="defesacivil"

# Storage (nome 3-24 chars, só minúsculas/números, único globalmente)
export ST_ACCOUNT="${PREFIX}stor$RANDOM"
export ST_CONTAINER="anexos"

# VM
export VM_NAME="${PREFIX}-vm"
export VM_SIZE="Standard_B2s"
export VM_ADMIN="azureuser"

# Domínio público da aplicação
export APP_DOMAIN="defesacivil.exemplo.gov.br"
```

```bash
az group create --name "$RG" --location "$LOC"
```

---

## 1. Banco — Azure Database for PostgreSQL (Flexible Server)

```bash
# Cria o servidor (Burstable B1ms: 1 vCPU / 2 GB — suficiente p/ esta escala).
az postgres flexible-server create \
  --resource-group "$RG" \
  --name "$PG_SERVER" \
  --location "$LOC" \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --version 16 \
  --storage-size 32 \
  --admin-user "$PG_ADMIN" \
  --admin-password "$PG_PASS" \
  --public-access 0.0.0.0 \
  --yes

# Cria o banco da aplicação.
az postgres flexible-server db create \
  --resource-group "$RG" \
  --server-name "$PG_SERVER" \
  --database-name "$PG_DB"
```

> `--public-access 0.0.0.0` cria a regra "Permitir serviços do Azure". Depois de
> criar a VM, **restrinja** liberando só o IP público dela (passo 4) e remova a
> regra ampla, ou use VNet/Private Endpoint para o nível mais seguro.

A `DATABASE_URL` ficará assim (use no `.env` do passo 5):

```
postgresql://<PG_ADMIN>:<PG_PASS>@<PG_SERVER>.postgres.database.azure.com:5432/<PG_DB>?sslmode=require
```

> O `?sslmode=require` é **obrigatório** no Azure PostgreSQL.

---

## 2. Storage — Azure Blob (anexos via SAS)

```bash
# Conta de storage (Standard LRS é o mais barato e suficiente).
az storage account create \
  --resource-group "$RG" \
  --name "$ST_ACCOUNT" \
  --location "$LOC" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Connection string (GUARDE — vai no .env como AZURE_STORAGE_CONNECTION_STRING).
export ST_CONN="$(az storage account show-connection-string \
  --resource-group "$RG" --name "$ST_ACCOUNT" --query connectionString -o tsv)"

# Container privado dos anexos.
az storage container create \
  --name "$ST_CONTAINER" \
  --connection-string "$ST_CONN" \
  --public-access off
```

### CORS do Blob (essencial p/ upload/download direto do navegador)

O navegador faz `PUT`/`GET` direto no Blob via SAS, então a conta precisa
liberar a origem da aplicação:

```bash
az storage cors add \
  --services b \
  --methods GET PUT \
  --origins "https://$APP_DOMAIN" \
  --allowed-headers "x-ms-blob-type" "content-type" "x-ms-blob-content-type" \
  --exposed-headers "*" \
  --max-age 3600 \
  --connection-string "$ST_CONN"
```

> Se for testar localmente apontando para o Blob, acrescente também
> `http://localhost:3000` em `--origins`.

---

## 3. Criar a VM (B2s, Ubuntu)

```bash
az vm create \
  --resource-group "$RG" \
  --name "$VM_NAME" \
  --image Ubuntu2204 \
  --size "$VM_SIZE" \
  --admin-username "$VM_ADMIN" \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --os-disk-size-gb 32

# Abre as portas HTTP/HTTPS (a 22/SSH já vem aberta).
az vm open-port --resource-group "$RG" --name "$VM_NAME" --port 80 --priority 1001
az vm open-port --resource-group "$RG" --name "$VM_NAME" --port 443 --priority 1002

# IP público da VM:
export VM_IP="$(az vm show -d -g "$RG" -n "$VM_NAME" --query publicIps -o tsv)"
echo "IP da VM: $VM_IP"
```

### Restringir o banco ao IP da VM (recomendado)

```bash
az postgres flexible-server firewall-rule create \
  --resource-group "$RG" --name "$PG_SERVER" \
  --rule-name "allow-vm" --start-ip-address "$VM_IP" --end-ip-address "$VM_IP"
```

---

## 4. DNS

No seu provedor de DNS, crie um registro **A** apontando o domínio para o IP da VM:

```
defesacivil.exemplo.gov.br.   A   <VM_IP>
```

Aguarde a propagação (`nslookup $APP_DOMAIN` deve retornar o IP da VM) antes do TLS.

---

## 5. Preparar a VM (Docker + código)

```bash
ssh "$VM_ADMIN@$VM_IP"
```

Dentro da VM:

```bash
# Docker Engine + plugin compose (script oficial).
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # aplica o grupo sem relogar

# Código (use o método que preferir: git clone ou rsync/scp).
git clone <URL_DO_REPO> dcmg
cd dcmg
```

### Criar o `.env` de produção

```bash
cp .env.example .env
nano .env
```

Preencha **no mínimo**:

```dotenv
NODE_ENV=production
APP_ENV=production

# Origens permitidas (OBRIGATÓRIO em prod — sem isto a API não sobe)
CORS_ORIGINS=https://defesacivil.exemplo.gov.br
PUBLIC_BASE_URL=https://defesacivil.exemplo.gov.br

# Banco gerenciado (passo 1) — com sslmode=require
DATABASE_URL=postgresql://dcmgadmin:SENHA@dcmg-pg.postgres.database.azure.com:5432/defesacivil?sslmode=require
# POSTGRES_* não são usados em prod (banco gerenciado); deixe placeholders.
POSTGRES_USER=na
POSTGRES_PASSWORD=na
POSTGRES_DB=na

# JWT — gere dois segredos fortes e DISTINTOS (>=32 chars):
#   openssl rand -hex 32
JWT_ACCESS_SECRET=<cole-aqui-32+chars>
JWT_REFRESH_SECRET=<cole-OUTRO-32+chars>
JWT_ACCESS_TTL=900s
JWT_REFRESH_TTL=7d

# Storage Azure Blob (passo 2)
STORAGE_DRIVER=azure
AZURE_STORAGE_CONNECTION_STRING=<connection string da conta>
AZURE_STORAGE_CONTAINER=anexos

MAX_UPLOAD_MB=50
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=120
LOG_LEVEL=info

# SMTP (opcional — notificações e recuperação de senha). Em branco = desabilitado.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Defesa Civil MG" <noreply@defesacivil.mg.gov.br>
```

> `.env` contém segredos — confirme que está no `.gitignore` (está) e nunca o comite.

---

## 6. Migrações + usuário admin (banco Azure)

As migrações criam o schema; o seed cria perfis/permissões e o **SUPER_ADMIN**.

O seed usa `tsx` (devDependency), que **não existe na imagem de runtime** (deps de
prod). Então rode migração + seed a partir de uma máquina com o repo e dependências
completas, apontando `DATABASE_URL` para o Azure. Pode ser a própria VM (instale
Node 20 temporariamente) ou seu computador de desenvolvimento.

```bash
# Numa máquina com Node 20 + repo:
corepack enable
corepack pnpm install            # instala devDeps (inclui tsx + prisma CLI)

export DATABASE_URL="postgresql://dcmgadmin:SENHA@dcmg-pg.postgres.database.azure.com:5432/defesacivil?sslmode=require"

# Credenciais do admin inicial (defina antes do seed!)
export SEED_ADMIN_EMAIL="admin@defesacivil.mg.gov.br"
export SEED_ADMIN_SENHA="<senha-forte-unica>"
export SEED_ADMIN_CPF="<cpf-sem-pontuacao>"
export SEED_ADMIN_NOME="Administrador"

corepack pnpm --filter @dcmg/api exec prisma migrate deploy
corepack pnpm --filter @dcmg/api exec prisma db seed
```

> ⚠️ **Segurança:** o seed tem uma senha padrão de DEV (`Defesa@Civil2026!`).
> SEMPRE defina `SEED_ADMIN_SENHA` em produção, e troque a senha no primeiro login.
>
> Alternativa só para as **migrações** (sem seed), direto pelo container já no ar
> (passo 7): `docker compose -f docker-compose.prod.yml exec -w /app/apps/api api \
> /app/node_modules/.bin/prisma migrate deploy`.

---

## 7. Build e subida dos containers

Na VM, na raiz do repo:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api   # acompanhar o boot
```

Teste o health (interno, sem TLS ainda):

```bash
curl -i http://localhost/api/health      # liveness via Nginx
```

> O `docker-compose.prod.yml` é **standalone** (só `api` + `web`). A API valida o
> `.env` no boot: se `CORS_ORIGINS` ou os segredos JWT estiverem ausentes/fracos,
> ela **não sobe** — confira os logs.

---

## 8. TLS (HTTPS) com Let's Encrypt

O `web` (Nginx) usa `infra/nginx/nginx.prod.conf`, que espera os certificados em
`infra/nginx/certs/{fullchain.pem,privkey.pem}`. Gere-os com Certbot:

```bash
# Pare o web temporariamente para liberar a porta 80 (modo standalone do certbot).
docker compose -f docker-compose.prod.yml stop web

sudo docker run --rm -p 80:80 \
  -v "$PWD/infra/nginx/certs:/etc/letsencrypt/live-out" \
  certbot/certbot certonly --standalone \
  -d "$APP_DOMAIN" --agree-tos -m "admin@defesacivil.mg.gov.br" --non-interactive

# O certbot grava em /etc/letsencrypt/live/<dominio>/. Copie para o caminho esperado:
sudo cp /etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem infra/nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/$APP_DOMAIN/privkey.pem   infra/nginx/certs/privkey.pem
sudo chown $USER:$USER infra/nginx/certs/*.pem

docker compose -f docker-compose.prod.yml up -d web
```

> O Nginx roda como usuário não-root (uid 101) — garanta que os `.pem` sejam
> legíveis por ele (o `chown` acima resolve em geral).

Teste: `https://defesacivil.exemplo.gov.br` deve carregar a SPA com cadeado válido.

### Renovação automática (cron, a cada 60-90 dias)

```bash
# Exemplo de cron (sudo crontab -e):
0 3 1 * * cd /home/azureuser/dcmg && docker compose -f docker-compose.prod.yml stop web && docker run --rm -p 80:80 -v "$PWD/infra/nginx/certs:/etc/letsencrypt/live-out" certbot/certbot certonly --standalone -d defesacivil.exemplo.gov.br --agree-tos -m admin@defesacivil.mg.gov.br --non-interactive && cp /etc/letsencrypt/live/defesacivil.exemplo.gov.br/*.pem infra/nginx/certs/ && docker compose -f docker-compose.prod.yml up -d web
```

---

## 8.1 CI/CD (GitHub Actions)

O repositório já inclui dois workflows:

- **`.github/workflows/ci.yml`** — em cada PR/push para `main`/`dev`: ESLint, `prisma
  generate`/`validate`, build dos contratos, typecheck, testes e build (incl. das
  imagens Docker).
- **`.github/workflows/deploy.yml`** — em push para `main` (ou manual): builda e
  **publica as imagens no GHCR** e faz SSH na VM para `docker compose pull && up -d`
  + `prisma migrate deploy`. **Não builda na VM** (poupa a B2).

Para o deploy automático funcionar, configure os secrets em **Settings → Secrets
and variables → Actions**:

| Secret | Descrição |
|---|---|
| `DEPLOY_HOST` | IP/host da VM |
| `DEPLOY_USER` | usuário SSH (ex.: `azureuser`) |
| `DEPLOY_SSH_KEY` | chave **privada** SSH |
| `DEPLOY_PORT` | (opcional) porta SSH; padrão 22 |
| `DEPLOY_PATH` | (opcional) caminho do repo na VM; padrão `$HOME/dcmg` |
| `GHCR_USER` | usuário GitHub para a VM logar no GHCR |
| `GHCR_TOKEN` | PAT com escopo `read:packages` (login do Docker na VM) |

> Pré-requisitos na VM: repositório clonado em `DEPLOY_PATH`, `.env` de produção
> preenchido e certificados TLS presentes. As imagens GHCR podem ser tornadas
> **públicas** (Packages → Package settings) para dispensar `GHCR_USER`/`GHCR_TOKEN`.

Sem os secrets de deploy, o job é **pulado** (o CI continua verde).

## 9. Pós-deploy (checklist)

- [ ] `https://<dominio>` abre a SPA com TLS válido.
- [ ] Login com o admin do seed; **trocar a senha** imediatamente.
- [ ] `curl https://<dominio>/api/health` → `200`.
- [ ] Criar uma submissão de teste e **anexar um arquivo** (valida o fluxo Blob/SAS + CORS).
- [ ] Exportar Excel no painel/submissões (valida o export síncrono).
- [ ] Conferir os logs sem erros: `docker compose -f docker-compose.prod.yml logs --tail=100`.
- [ ] Remover a regra de firewall ampla do Postgres (deixar só o IP da VM).
- [ ] Confirmar backups automáticos do PostgreSQL no portal (retenção padrão 7 dias).

---

## 10. Operação do dia a dia

| Ação | Comando (na raiz do repo, na VM) |
|---|---|
| Ver logs | `docker compose -f docker-compose.prod.yml logs -f api` |
| Reiniciar | `docker compose -f docker-compose.prod.yml restart` |
| Atualizar (deploy) | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Aplicar nova migração | rodar `prisma migrate deploy` (passo 6) com a `DATABASE_URL` do Azure |
| Parar tudo | `docker compose -f docker-compose.prod.yml down` |
| Uso de recursos | `docker stats` |

> **Refresh tokens** ficam no Postgres (sessões sobrevivem a deploys). **Cache,
> rate-limit e lockout de login** são em memória → zeram a cada restart do container
> (comportamento aceitável nesta escala).

---

## 11. Custo mensal aproximado (referência)

| Recurso | SKU | Ordem de grandeza |
|---|---|---|
| VM | B2s (2 vCPU / 4 GB) | ~US$ 30–40 |
| PostgreSQL | Flexible B1ms + 32 GB | ~US$ 15–25 |
| Storage | Blob Standard LRS | ~US$ 1–5 (uso baixo) |
| IP público + egress | — | ~US$ 3–5 |

Total estimado: **~US$ 50–75/mês**. Valores variam por região e uso; confirme na
calculadora oficial da Azure.

---

## 12. Troubleshooting

- **API não sobe / reinicia em loop**: quase sempre `.env` inválido. Veja
  `docker compose -f docker-compose.prod.yml logs api` — a validação Zod lista a
  variável faltante (CORS_ORIGINS, JWT secrets, DATABASE_URL).
- **Erro de conexão ao banco**: faltou `?sslmode=require`, ou o IP da VM não está
  liberado no firewall do PostgreSQL.
- **Upload de anexo falha (CORS)**: revise o `az storage cors add` (origem exata
  com `https://`, métodos PUT/GET, header `x-ms-blob-type`).
- **Anexo > 50 MB rejeitado**: é o `MAX_UPLOAD_MB`. Aumente no `.env` e no
  `client_max_body_size` do Nginx se realmente precisar.
- **TLS inválido**: confira que `fullchain.pem`/`privkey.pem` existem em
  `infra/nginx/certs/` e são legíveis pelo usuário `nginx` (uid 101).
- **Memória apertada na B2**: a API está limitada a 2.5 GB com heap V8 de 1536 MB.
  Se houver OOM em picos, reduza `NODE_OPTIONS` ou suba para B2ms (8 GB).
