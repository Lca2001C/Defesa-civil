# Deploy na Azure — 3 serviços gerenciados (custo otimizado)

Runbook para subir a **Plataforma Defesa Civil MG** em produção usando **3 serviços
gerenciados** da Azure, sem nenhuma VM para manter. Esta é a abordagem **recomendada**
e de **menor custo/manutenção**.

> Procura o plano antigo de **VM única** (Docker Compose numa B2s)? Continua
> disponível em [DEPLOY-AZURE-VM.md](DEPLOY-AZURE-VM.md).

---

## Visão geral: os 3 serviços

Conforme a orientação de criar serviços separados para otimizar custo, o deploy se
divide em **3 recursos Azure independentes**, cada um cobrado e dimensionado à parte:

| # | "Coisa" a criar | Serviço Azure | Para quê |
|---|---|---|---|
| 1 | **Banco de dados** | Azure Database for PostgreSQL (Flexible Server) | Dados da aplicação (gerenciado, com backup automático) |
| 2 | **Containers** | Azure Container Registry (ACR) | Guardar as imagens Docker (`api` e `web`) |
| 3 | **Apps** | Azure Container Apps (ACA) | Rodar a aplicação (serverless, com TLS e escala automática) |

Mais um recurso de **apoio** (barato, não muda esse desenho de 3 serviços):

- **Azure Blob Storage** — anexos enviados/baixados **direto pelo navegador** via URL
  SAS. Já existia no projeto e permanece.

```
                          Internet (HTTPS)
                                │
                  ┌─────────────▼──────────────┐
                  │   3. Azure Container Apps   │   serverless, escala 0→1
                  │  ┌───────────────────────┐  │   TLS gerenciado (grátis)
                  │  │  app "dcmg-app"        │  │
                  │  │  ┌─────────┐ ┌───────┐ │  │   ingress :8080 → web
                  │  │  │ web     │ │ api   │ │  │   web faz proxy /api →
                  │  │  │ (Nginx) │→│(Nest) │ │  │   127.0.0.1:4000 (api)
                  │  │  │ :8080   │ │ :4000 │ │  │
                  │  │  └─────────┘ └───┬───┘ │  │
                  │  └──────────────────┼─────┘  │
                  └──────────┬──────────┼────────┘
              puxa imagens   │          │ DSN + connection string
              ┌──────────────▼──┐   ┌───▼─────────────────┐   ┌──────────────────┐
              │ 2. Container     │   │ 1. PostgreSQL        │   │ Blob Storage      │
              │    Registry(ACR) │   │    Flexible Server   │   │ (anexos via SAS)  │
              └──────────────────┘   └──────────────────────┘   └──────────────────┘
```

### Por que isso otimiza custo

- **Escala a zero (`minReplicas: 0`)**: quando ninguém está usando (noite, fim de
  semana), o app **não consome CPU/RAM** e não é cobrado. Sobe sozinho na primeira
  requisição. Uma VM cobra 24/7 mesmo parada.
- **Free grant mensal do Container Apps**: as primeiras ~180.000 vCPU-s + 360.000
  GiB-s + 2 milhões de requisições por mês são **gratuitas** — costuma cobrir boa
  parte (ou tudo) de um uso interno.
- **TLS gerenciado grátis**: o Container Apps emite e renova o certificado HTTPS
  sozinho. **Acaba o Certbot/cron** do plano de VM.
- **Sem servidor para manter**: zero patch de SO, zero Docker na VM, restart
  automático, logs centralizados.
- **ACR Basic** (registry) e **PostgreSQL Burstable B1ms** são os menores SKUs
  viáveis para esta escala.

> ⚠️ **Réplica única é obrigatória (não é só custo).** O lockout de login, o
> rate-limit e o cache são **em memória, sem store compartilhado**
> ([cache.service.ts](../apps/api/src/infra/cache/cache.service.ts)). Por isso o app
> roda com **`maxReplicas: 1`** — mais de uma réplica fragmentaria o lockout
> (enfraquecendo a proteção contra força bruta) e deixaria o cache inconsistente.

---

## 0. Pré-requisitos

- Conta Azure com permissão para criar recursos e um método de pagamento.
- **Azure CLI** instalado e logado: `az login`.
- Extensão de Container Apps: `az extension add --name containerapp --upgrade`.
- Provedores registrados (uma vez por assinatura):
  ```bash
  az provider register --namespace Microsoft.App
  az provider register --namespace Microsoft.OperationalInsights
  ```
- Um **domínio/subdomínio** apontável (ex.: `defesacivil.mg.gov.br` ou
  `app.defesacivil.mg.gov.br`) para o HTTPS com domínio próprio.
- **Não** é preciso Docker instalado na sua máquina: as imagens são construídas
  **na nuvem** com `az acr build`.

### Variáveis reutilizadas (ajuste os valores)

```bash
# ---- Identificação --------------------------------------------------------
export RG="rg-dcmg-prod"
export LOC="brazilsouth"                       # região (São Paulo)
export PREFIX="dcmg"                            # prefixo de nomes

# ---- 1. Banco -------------------------------------------------------------
export PG_SERVER="${PREFIX}-pg"
export PG_ADMIN="dcmgadmin"
export PG_PASS="$(openssl rand -base64 24)"     # GUARDE este valor!
export PG_DB="defesacivil"

# ---- Blob (apoio): 3-24 chars, só minúsculas/números, único global --------
export ST_ACCOUNT="${PREFIX}stor$RANDOM"
export ST_CONTAINER="anexos"

# ---- 2. Containers (ACR): 5-50 alfanuméricos, minúsculas, único global ----
export ACR="${PREFIX}acr$RANDOM"

# ---- 3. Apps (Container Apps) ---------------------------------------------
export ACA_ENV="${PREFIX}-env"                  # ambiente do Container Apps
export ACA_APP="${PREFIX}-app"                  # o app (web + api)
export ACA_IDENTITY="${PREFIX}-aca-id"          # identidade p/ puxar do ACR

# ---- Domínio público da aplicação -----------------------------------------
export APP_DOMAIN="app.defesacivil.exemplo.gov.br"

# Grupo de recursos (guarda-chuva de tudo)
az group create --name "$RG" --location "$LOC"
```

> Dica: cole esse bloco num arquivo `deploy.env` e rode `source deploy.env` a cada
> sessão de terminal — assim as variáveis (inclusive `PG_PASS`) não se perdem.

---

# SERVIÇO 1 — Banco de dados (PostgreSQL gerenciado)

### 1.1 Criar o servidor e o banco

```bash
# Burstable B1ms (1 vCPU / 2 GB) — menor SKU adequado a esta escala.
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

# Banco da aplicação.
az postgres flexible-server db create \
  --resource-group "$RG" \
  --server-name "$PG_SERVER" \
  --database-name "$PG_DB"
```

> `--public-access 0.0.0.0` cria a regra **"Permitir serviços do Azure"**. Como o
> Container Apps (plano Consumo, sem VNet) sai por **IPs dinâmicos da Azure**, essa
> é a regra prática — você **mantém** esta regra (diferente do plano de VM, que
> fixava o IP da VM). Para o nível mais seguro, use um ambiente ACA com **VNet +
> Private Endpoint** (mais complexo e com custo extra) — ver §"Endurecimento".

### 1.2 Montar a `DATABASE_URL`

```bash
export DATABASE_URL="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_SERVER}.postgres.database.azure.com:5432/${PG_DB}?sslmode=require"
echo "$DATABASE_URL"
```

> O `?sslmode=require` é **obrigatório** no Azure PostgreSQL. Guarde essa string —
> ela vira um **secret** do app no Serviço 3.

---

# (Apoio) Armazenamento de anexos — Azure Blob

Recurso barato e separado dos 3 serviços principais. O navegador envia/baixa anexos
**direto** no Blob via URL SAS.

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

# Connection string (GUARDE — vira secret AZURE_STORAGE_CONNECTION_STRING no app).
export ST_CONN="$(az storage account show-connection-string \
  --resource-group "$RG" --name "$ST_ACCOUNT" --query connectionString -o tsv)"

# Container privado dos anexos.
az storage container create \
  --name "$ST_CONTAINER" \
  --connection-string "$ST_CONN" \
  --public-access off
```

O **CORS do Blob** depende do domínio público (definido no Serviço 3); por isso ele
é configurado lá na etapa de **unificação** (§U.3).

---

# SERVIÇO 2 — Containers (Azure Container Registry)

Aqui criamos o **registro de imagens** e construímos as imagens `api` e `web`
**na nuvem** (não precisa de Docker local).

### 2.1 Criar o registry

```bash
# Basic é o menor SKU (inclui o ACR Tasks usado pelo `az acr build`).
az acr create \
  --resource-group "$RG" \
  --name "$ACR" \
  --sku Basic \
  --admin-enabled false
```

### 2.2 Construir e publicar as imagens (build na nuvem)

Rode na **raiz do repositório** (onde estão os Dockerfiles em `infra/docker/`):

```bash
# API (NestJS) — usa infra/docker/api.Dockerfile, contexto = raiz do monorepo.
az acr build \
  --registry "$ACR" \
  --image dcmg-api:latest \
  --file infra/docker/api.Dockerfile .

# Web (SPA + Nginx) — usa infra/docker/web.Dockerfile.
az acr build \
  --registry "$ACR" \
  --image dcmg-web:latest \
  --file infra/docker/web.Dockerfile .
```

> `az acr build` envia o contexto para o ACR Tasks, que **compila no Azure** e já
> deixa a imagem publicada no registry. Isso elimina a necessidade de uma máquina
> de build. Cada deploy futuro repete esses dois comandos (ver §"Operação").

Confirme as imagens:

```bash
az acr repository list --name "$ACR" -o table
```

---

# SERVIÇO 3 — Apps (Azure Container Apps)

Aqui criamos o **ambiente** do Container Apps e o **app** que roda `web` + `api`
juntos (padrão *sidecar*: dois containers na mesma réplica, comunicando por
`localhost`). O Nginx (`web`) é o ingress público e faz proxy de `/api` para o
container `api` em `127.0.0.1:4000`.

> **Ajuste de código já aplicado neste repositório:** para o proxy funcionar tanto
> no docker-compose (`api:4000`) quanto no sidecar do ACA (`127.0.0.1:4000`), o
> Nginx passou a ler o destino de `${API_UPSTREAM}` (renderizado pelo entrypoint).
> Default = `api:4000`, então **dev e o plano de VM continuam iguais**. No ACA
> passamos `API_UPSTREAM=127.0.0.1:4000` (já está no YAML abaixo). Por isso é
> importante ter **rebuildado a imagem `web`** no passo 2.2.

### 3.1 Criar o ambiente do Container Apps

```bash
# Ambiente "Consumo" (sem custo fixo; cobra só pelo uso dos apps).
# Cria automaticamente um workspace do Log Analytics para os logs.
az containerapp env create \
  --name "$ACA_ENV" \
  --resource-group "$RG" \
  --location "$LOC"
```

### 3.2 Identidade gerenciada para puxar imagens do ACR

Em vez de senha de registry, usamos uma **identidade gerenciada** com permissão
somente de leitura (`AcrPull`) no ACR:

```bash
az identity create --resource-group "$RG" --name "$ACA_IDENTITY"

export ACA_ID_RESID="$(az identity show -g "$RG" -n "$ACA_IDENTITY" --query id -o tsv)"
export ACA_ID_PRINCIPAL="$(az identity show -g "$RG" -n "$ACA_IDENTITY" --query principalId -o tsv)"
export ACR_RESID="$(az acr show -g "$RG" -n "$ACR" --query id -o tsv)"
export ACR_SERVER="$(az acr show -g "$RG" -n "$ACR" --query loginServer -o tsv)"

# Concede AcrPull à identidade no escopo do registry.
az role assignment create \
  --assignee-object-id "$ACA_ID_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal \
  --role AcrPull \
  --scope "$ACR_RESID"
```

### 3.3 Gerar os segredos JWT

```bash
export JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"   # DISTINTO do de access
```

### 3.4 Definir o app a partir de um YAML (dois containers)

O app multi-container é descrito num YAML. O bloco abaixo **gera o arquivo** já
preenchido com suas variáveis (banco, storage, JWT) — confira que `DATABASE_URL`,
`ST_CONN`, `JWT_*` e `APP_DOMAIN` estão exportados (Serviços 1, 2 e §0).

```bash
cat > aca-app.yaml <<EOF
identity:
  type: UserAssigned
  userAssignedIdentities:
    ${ACA_ID_RESID}: {}
properties:
  managedEnvironmentId: $(az containerapp env show -g "$RG" -n "$ACA_ENV" --query id -o tsv)
  configuration:
    activeRevisionsMode: Single
    ingress:
      external: true
      targetPort: 8080
      transport: auto
      allowInsecure: false          # força HTTPS no ingress
      traffic:
        - latestRevision: true
          weight: 100
    registries:
      - server: ${ACR_SERVER}
        identity: ${ACA_ID_RESID}
    secrets:
      - name: database-url
        value: "${DATABASE_URL}"
      - name: jwt-access-secret
        value: "${JWT_ACCESS_SECRET}"
      - name: jwt-refresh-secret
        value: "${JWT_REFRESH_SECRET}"
      - name: storage-connection-string
        value: "${ST_CONN}"
  template:
    scale:
      minReplicas: 0               # escala a zero (custo mínimo). Ver nota abaixo.
      maxReplicas: 1               # OBRIGATÓRIO: estado em memória, sem store compartilhado.
    containers:
      # ---- Nginx (ingress público; serve a SPA e faz proxy /api) ----------
      - name: web
        image: ${ACR_SERVER}/dcmg-web:latest
        resources:
          cpu: 0.25
          memory: 0.5Gi
        env:
          - name: APP_ENV
            value: production
          - name: API_BASE_URL
            value: /api
          - name: API_UPSTREAM
            value: 127.0.0.1:4000   # api na MESMA réplica (sidecar)
      # ---- API (NestJS; interna, alcançada pelo Nginx via localhost) ------
      - name: api
        image: ${ACR_SERVER}/dcmg-api:latest
        resources:
          cpu: 1.0
          memory: 2.0Gi
        env:
          - name: NODE_ENV
            value: production
          - name: APP_ENV
            value: production
          - name: API_PREFIX
            value: api
          - name: PORT
            value: "4000"
          - name: CORS_ORIGINS
            value: "https://${APP_DOMAIN}"
          - name: PUBLIC_BASE_URL
            value: "https://${APP_DOMAIN}"
          - name: DATABASE_URL
            secretRef: database-url
          - name: JWT_ACCESS_SECRET
            secretRef: jwt-access-secret
          - name: JWT_REFRESH_SECRET
            secretRef: jwt-refresh-secret
          - name: JWT_ACCESS_TTL
            value: 900s
          - name: JWT_REFRESH_TTL
            value: 7d
          - name: STORAGE_DRIVER
            value: azure
          - name: AZURE_STORAGE_CONNECTION_STRING
            secretRef: storage-connection-string
          - name: AZURE_STORAGE_CONTAINER
            value: anexos
          - name: MAX_UPLOAD_MB
            value: "50"
          - name: RATE_LIMIT_TTL
            value: "60"
          - name: RATE_LIMIT_LIMIT
            value: "120"
          - name: LOG_LEVEL
            value: info
        probes:
          - type: Liveness
            httpGet:
              path: /api/health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 15
          - type: Readiness
            httpGet:
              path: /api/health
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 10
EOF

# Cria o app a partir do YAML.
az containerapp create \
  --resource-group "$RG" \
  --name "$ACA_APP" \
  --yaml aca-app.yaml
```

> ⚠️ O `aca-app.yaml` contém **segredos** (DATABASE_URL, JWT, storage). Apague-o
> depois (`rm aca-app.yaml`) ou guarde-o fora do repositório — **nunca** o comite.

#### `minReplicas`: 0 (custo) × 1 (sem cold start)

- **`minReplicas: 0`** (acima) = **menor custo**. O app dorme quando ocioso e sobe
  na primeira requisição (cold start de ~5–15 s, uma vez, após período sem uso).
  Seguro aqui: o único job de fundo é uma varredura de cache não-crítica, e os
  refresh tokens ficam no PostgreSQL (sobrevivem ao "sleep").
- **`minReplicas: 1`** = sempre quente (sem cold start), porém **cobra 24/7** —
  fica **mais caro que a VM**. Use só se o cold start incomodar.

Pegue a URL provisória do app (antes do domínio próprio):

```bash
export APP_FQDN="$(az containerapp show -g "$RG" -n "$ACA_APP" \
  --query properties.configuration.ingress.fqdn -o tsv)"
echo "App em: https://$APP_FQDN"

# Health check (sem domínio próprio ainda; CORS não afeta o health):
curl -i "https://$APP_FQDN/api/health"     # espera 200
```

---

# UNIFICAÇÃO — ligando os 3 serviços

Os recursos já existem; agora conectamos tudo para virar **uma aplicação pública e
funcional**.

### U.1 ACR → Apps (imagens)

Já está ligado: no YAML, `registries[].identity` aponta para a identidade com
`AcrPull` (§3.2), e cada container usa `image: ${ACR_SERVER}/dcmg-*:latest`. O app
puxa as imagens do **Serviço 2** automaticamente a cada revisão.

### U.2 Apps → Banco (Serviço 1)

Já está ligado: a `DATABASE_URL` (com `?sslmode=require`) entra como **secret** e é
lida pelo container `api`. A regra **"Permitir serviços do Azure"** (§1.1) deixa o
Container Apps alcançar o PostgreSQL. **Falta criar o schema** — ver §U.5.

### U.3 Apps → Blob (anexos) + CORS

O `api` usa a connection string (secret) para gerar URLs SAS; o **navegador** fala
direto com o Blob, então a conta precisa liberar a origem pública:

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

> A CSP do Nginx já libera `connect-src ... https://*.blob.core.windows.net`, então
> o upload/download direto do navegador funciona sem ajustes adicionais.

### U.4 Domínio próprio + HTTPS gerenciado (substitui o Certbot)

1. **Pegue os dados de validação:**

   ```bash
   export DOMAIN_VERIFICATION_ID="$(az containerapp show -g "$RG" -n "$ACA_APP" \
     --query properties.customDomainVerificationId -o tsv)"
   echo "CNAME  ->  $APP_FQDN"
   echo "TXT asuid.<host>  ->  $DOMAIN_VERIFICATION_ID"
   ```

2. **No seu DNS**, crie (exemplo para `app.defesacivil.exemplo.gov.br`):

   ```
   app                 CNAME   <APP_FQDN>
   asuid.app           TXT     <DOMAIN_VERIFICATION_ID>
   ```

   Aguarde a propagação (`nslookup $APP_DOMAIN` deve resolver para o `APP_FQDN`).

3. **Adicione o hostname e emita o certificado gerenciado (grátis):**

   ```bash
   az containerapp hostname add \
     --resource-group "$RG" --name "$ACA_APP" --hostname "$APP_DOMAIN"

   az containerapp hostname bind \
     --resource-group "$RG" --name "$ACA_APP" --hostname "$APP_DOMAIN" \
     --environment "$ACA_ENV" --validation-method CNAME
   ```

   O Container Apps emite e **renova sozinho** o certificado TLS. Sem Certbot, sem
   cron. As variáveis `CORS_ORIGINS`/`PUBLIC_BASE_URL` já apontam para `$APP_DOMAIN`
   (definidas no YAML), então nada mais a mudar.

### U.5 Criar o schema e o admin (migrações + seed)

As migrações criam as tabelas; o seed cria perfis/permissões e o **SUPER_ADMIN**. O
seed usa `tsx` (devDependency), que **não existe** na imagem de runtime — então rode
a partir de uma máquina com o **repo + dependências completas**, apontando para o
banco do Azure:

```bash
# Numa máquina com Node 20 + o repositório:
corepack enable
corepack pnpm install                      # instala devDeps (tsx + prisma CLI)

export DATABASE_URL="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_SERVER}.postgres.database.azure.com:5432/${PG_DB}?sslmode=require"

# Admin inicial (defina ANTES do seed!)
export SEED_ADMIN_EMAIL="admin@defesacivil.mg.gov.br"
export SEED_ADMIN_SENHA="<senha-forte-unica>"
export SEED_ADMIN_CPF="<cpf-sem-pontuacao>"
export SEED_ADMIN_NOME="Administrador"

corepack pnpm --filter @dcmg/api exec prisma migrate deploy
corepack pnpm --filter @dcmg/api exec prisma db seed
```

> ⚠️ **Segurança:** o seed tem uma senha padrão de DEV. SEMPRE defina
> `SEED_ADMIN_SENHA` em produção e troque no primeiro login.
>
> Alternativa só para **migrações** (sem seed), via container já no ar — exige uma
> réplica ativa (com `minReplicas: 0`, faça uma requisição antes para acordar o app,
> ou suba `minReplicas` para 1 temporariamente):
> ```bash
> az containerapp exec -g "$RG" -n "$ACA_APP" --container api \
>   --command "/app/node_modules/.bin/prisma migrate deploy"
> ```

### U.6 Validar a aplicação unificada

```bash
curl -i "https://$APP_DOMAIN/api/health"     # 200 via domínio próprio + TLS
```

Abra `https://$APP_DOMAIN` no navegador: a SPA deve carregar com cadeado válido.

---

## Pós-deploy (checklist)

- [ ] `https://<dominio>` abre a SPA com TLS válido (certificado gerenciado pelo ACA).
- [ ] Login com o admin do seed; **trocar a senha** imediatamente.
- [ ] `curl https://<dominio>/api/health` → `200`.
- [ ] Criar uma submissão de teste e **anexar um arquivo** (valida Blob/SAS + CORS).
- [ ] Exportar Excel no painel/submissões (valida o export síncrono).
- [ ] Logs sem erros: `az containerapp logs show -g "$RG" -n "$ACA_APP" --container api --tail 100`.
- [ ] Confirmar `maxReplicas: 1` (réplica única) e backups automáticos do PostgreSQL no portal.
- [ ] Apagar/guardar com segurança o `aca-app.yaml` (contém segredos).

---

## Operação do dia a dia

| Ação | Comando |
|---|---|
| **Atualizar (deploy)** | `az acr build -r "$ACR" -t dcmg-api:latest -f infra/docker/api.Dockerfile .` e idem `dcmg-web`, depois `az containerapp update -g "$RG" -n "$ACA_APP" --container-name api --image "$ACR_SERVER/dcmg-api:latest"` (e idem `web`) |
| Ver logs (api) | `az containerapp logs show -g "$RG" -n "$ACA_APP" --container api --follow` |
| Logs do ambiente | Portal → Container App → Monitoring → Log stream / Logs |
| Reiniciar | Criar nova revisão: `az containerapp update ...` (gera revisão nova) |
| Alterar uma env/secret | `az containerapp update`/`az containerapp secret set` (gera nova revisão) |
| Escalar (warm) | `az containerapp update -g "$RG" -n "$ACA_APP" --min-replicas 1 --max-replicas 1` |
| Nova migração | `prisma migrate deploy` apontando `DATABASE_URL` ao Azure (§U.5) |
| Status/revisões | `az containerapp revision list -g "$RG" -n "$ACA_APP" -o table` |

> Como o tag é `latest`, após `az acr build` rode o `az containerapp update --image`
> para forçar uma **nova revisão** que puxe a imagem recém-publicada. (Para deploys
> mais rastreáveis, use uma tag por versão/commit em vez de `latest`.)

> **Refresh tokens** ficam no PostgreSQL (sessões sobrevivem a deploys e ao
> sleep). **Cache, rate-limit e lockout** são em memória → zeram a cada nova
> revisão ou cold start (aceitável nesta escala e com réplica única).

### CI/CD (GitHub Actions) — opcional

O fluxo manual acima pode virar automático trocando o "SSH na VM" por
"`az acr build` + `az containerapp update`". Esboço:

```yaml
# .github/workflows/deploy-aca.yml (esboço)
- uses: azure/login@v2
  with: { creds: ${{ secrets.AZURE_CREDENTIALS }} }   # service principal
- run: az acr build -r $ACR -t dcmg-api:latest -f infra/docker/api.Dockerfile .
- run: az acr build -r $ACR -t dcmg-web:latest -f infra/docker/web.Dockerfile .
- run: az containerapp update -g $RG -n $ACA_APP --container-name api --image $ACR_SERVER/dcmg-api:latest
- run: az containerapp update -g $RG -n $ACA_APP --container-name web --image $ACR_SERVER/dcmg-web:latest
```

O workflow atual ([deploy.yml](../.github/workflows/deploy.yml)) é específico da VM
e pode ser mantido para o cenário alternativo, ou substituído por este.

---

## Custo mensal aproximado (referência)

| Serviço | SKU / config | Ordem de grandeza |
|---|---|---|
| 1. PostgreSQL | Flexible B1ms + 32 GB | ~US$ 15–25 |
| 2. Container Registry | ACR Basic | ~US$ 5 |
| 3. Container Apps | 1,25 vCPU / 2,5 GiB, `minReplicas: 0` | ~US$ 0–25 (cai muito com o free grant + sleep) |
| Blob Storage | Standard LRS | ~US$ 1–5 |
| Log Analytics | logs do ACA, volume baixo | ~US$ 0–5 |

Total estimado: **~US$ 25–60/mês**, tendendo ao piso com uso intermitente (escala a
zero). Com `minReplicas: 1` some ~US$ 60–90 do compute sempre ligado — por isso o
**`minReplicas: 0` é a chave da economia**. Confirme na calculadora oficial da Azure.

> **Comparação com a VM:** a VM B2s custa ~US$ 30–40 **fixos 24/7** + IP + disco e
> exige manutenção (SO, Docker, Certbot). O Container Apps tende a custar **igual ou
> menos** com uso real intermitente, **sem servidor para manter** e com **TLS grátis**.

---

## Endurecimento (opcional, mais seguro)

- **Banco sem exposição pública:** ambiente ACA com **VNet** + **Private Endpoint**
  do PostgreSQL (remove a regra "serviços do Azure"). Custa mais e exige um ambiente
  ACA dedicado à VNet.
- **HSTS:** o ingress do ACA serve HTTPS, mas o cabeçalho `Strict-Transport-Security`
  não é adicionado pela config base do Nginx (só pela `nginx.prod.conf` da VM). Para
  paridade, dá para incluí-lo em [nginx.conf](../infra/nginx/nginx.conf).
- **Registry sem identidade gerenciada:** se preferir simplicidade a RBAC, dá para
  usar `az acr update -n "$ACR" --admin-enabled true` e referenciar usuário/senha
  como secret no YAML — menos seguro que a identidade gerenciada (§3.2).

---

## Troubleshooting

- **App não sobe / reinicia em loop**: quase sempre env inválido. Veja
  `az containerapp logs show -g "$RG" -n "$ACA_APP" --container api --tail 200` — a
  validação Zod aponta a variável faltante (CORS_ORIGINS, JWT, DATABASE_URL).
- **`/api` dá 502/erro de upstream**: confirme que a imagem `web` foi **rebuildada**
  (passo 2.2) e que `API_UPSTREAM=127.0.0.1:4000` está no container `web`. No
  sidecar, os containers se falam por `localhost`, não por nome.
- **Erro de conexão ao banco**: faltou `?sslmode=require`, ou a regra "serviços do
  Azure" do PostgreSQL foi removida.
- **Falha ao puxar imagem (pull)**: a identidade gerenciada não tem `AcrPull`, ou o
  `registries[].identity`/`server` no YAML está incorreto (§3.2).
- **Upload de anexo falha (CORS)**: revise o `az storage cors add` (origem exata com
  `https://`, métodos PUT/GET, header `x-ms-blob-type`).
- **Domínio não valida**: cheque os registros `CNAME` e `TXT asuid.<host>` e a
  propagação de DNS antes do `hostname bind`.
- **Cold start lento incomoda**: suba `--min-replicas 1` (custa mais; ver §3.4).
- **Lockout/rate-limit "não funcionam" ou inconsistentes**: confirme
  `maxReplicas: 1` — múltiplas réplicas fragmentam o estado em memória.
