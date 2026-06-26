# Deploy no Oracle Cloud (OCI Always Free) — SIG-COMPDEC MG

Runbook para hospedar **toda** a aplicação no Oracle Cloud usando o tier
**Always Free**, numa única VM ARM (Ampere A1).

## Por que esta arquitetura no OCI

O OCI Always Free **não** oferece PostgreSQL gerenciado gratuito (o "Autonomous
Database" grátis é Oracle DB, não Postgres). Em compensação, a VM **Ampere A1
(ARM)** free é generosa (até 4 OCPU / 24 GB). Então, diferente do Azure:

- **PostgreSQL roda na própria VM** (container, com volume persistente).
- **Anexos em disco local** (block volume persistente) — `STORAGE_DRIVER=local`.
- API + Web + Postgres na mesma VM, via `docker-compose.oracle.yml`.
- As imagens são **buildadas na própria VM** (ARM64 nativo) — sem registry.

```
                 Internet (HTTPS)
                       │
        ┌──────────────▼───────────────┐
        │  OCI VM  Ampere A1 (ARM64)    │
        │  ┌──────────────────────────┐ │
        │  │ web (Nginx)  :80/:443    │ │
        │  │ api (NestJS) :4000       │ │
        │  │ postgres     :5432       │ │  ← na própria VM
        │  └──────────────────────────┘ │
        │  volumes: pg_data, uploads     │  ← block volume persistente
        └────────────────────────────────┘
```

---

## ⚙️ Configurações da VM (o que provisionar)

| Item | Recomendado (free) | Mínimo (free) |
|---|---|---|
| Shape | **VM.Standard.A1.Flex** (Ampere ARM) | VM.Standard.A1.Flex |
| OCPU | **2** | 1 |
| Memória | **12 GB** | 6 GB |
| Boot volume | 50 GB | 50 GB |
| Arquitetura | **ARM64 (aarch64)** | ARM64 |
| SO | Ubuntu 22.04 (aarch64) ou Oracle Linux 9 | idem |

O Always Free dá **até 4 OCPU + 24 GB** de Ampere A1 no total (pode ser uma VM
só). 2 OCPU/12 GB é o ponto ideal (builds tranquilos + folga). 1 OCPU/6 GB
funciona, mas o build na VM fica lento — suba temporariamente para 4 OCPU durante
o primeiro build se precisar.

> ❌ Não use o shape **E2.1.Micro** (1/8 OCPU, 1 GB, AMD) — é pequeno demais para
> Postgres + Node + Nginx + build.

> ⚠️ **Capacidade Ampere A1**: em regiões populares costuma dar *"Out of host
> capacity"*. Tente outro Availability Domain/região, ou repita a criação (há
> scripts de retry). É o obstáculo nº 1 no OCI free.

---

## 0. Pré-requisitos

- Conta Oracle Cloud (Always Free).
- Par de chaves SSH (`ssh-keygen -t ed25519`).
- Um domínio apontável para o TLS.

---

## 1. Rede (VCN) + regras de entrada

1. **Networking → Virtual Cloud Networks → Start VCN Wizard → "VCN with Internet
   Connectivity"**. Isso cria VCN, subnet pública, Internet Gateway e route table.
2. Na **Security List** (ou crie uma **Network Security Group**) da subnet pública,
   adicione regras de **Ingress** (Stateless: No):
   - `0.0.0.0/0` TCP **22** (SSH)
   - `0.0.0.0/0` TCP **80** (HTTP)
   - `0.0.0.0/0` TCP **443** (HTTPS)

---

## 2. Criar a instância (Ampere A1)

1. **Compute → Instances → Create Instance**.
2. **Image**: Canonical Ubuntu 22.04 (**aarch64**).
3. **Shape**: Ampere → **VM.Standard.A1.Flex** → 2 OCPU / 12 GB (ou 1/6).
4. **Networking**: a VCN/subnet pública do passo 1; "Assign public IPv4".
5. **SSH keys**: cole sua chave pública.
6. **Boot volume**: 50 GB.
7. Create. Anote o **IP público**.

```bash
ssh ubuntu@<IP_PUBLICO>     # Ubuntu; em Oracle Linux o usuário é "opc"
```

---

## 3. Abrir as portas no firewall do SO (pegadinha clássica do OCI!)

As imagens do OCI vêm com firewall do SO bloqueando tudo além do SSH. Abra 80/443
**também** no SO (a regra da VCN sozinha não basta):

**Ubuntu** (usa iptables + netfilter-persistent):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**Oracle Linux** (firewalld):
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 4. Instalar Docker

**Ubuntu:**
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker version
```

**Oracle Linux:**
```bash
sudo dnf install -y dnf-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker
```

---

## 5. Código + `.env`

```bash
git clone https://github.com/Lca2001C/Defesa-civil.git dcmg
cd dcmg
cp .env.example .env
nano .env
```

Preencha (banco é **local** na VM):

```dotenv
NODE_ENV=production
APP_ENV=production
CORS_ORIGINS=https://defesacivil.exemplo.gov.br
PUBLIC_BASE_URL=https://defesacivil.exemplo.gov.br

# Banco local (o docker-compose.oracle.yml sobe o Postgres e injeta a DATABASE_URL
# interna automaticamente — só defina usuário/senha/db):
POSTGRES_USER=dcmg
POSTGRES_PASSWORD=<senha-forte>
POSTGRES_DB=defesacivil
# DATABASE_URL pode ficar com o padrão do .env.example (será sobrescrita p/ a rede interna).

JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<outro openssl rand -hex 32>
JWT_ACCESS_TTL=900s
JWT_REFRESH_TTL=7d

# Anexos em disco local (volume persistente):
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=/data/uploads
MAX_UPLOAD_MB=50

RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=120
LOG_LEVEL=info

# SMTP opcional
SMTP_HOST=
SMTP_PORT=587
SMTP_FROM="Defesa Civil MG" <noreply@defesacivil.mg.gov.br>
```

---

## 6. TLS (Let's Encrypt) — antes de subir o Nginx

```bash
sudo docker run --rm -p 80:80 \
  -v "$PWD/infra/nginx/certs:/etc/letsencrypt/live-out" \
  certbot/certbot certonly --standalone \
  -d defesacivil.exemplo.gov.br --agree-tos -m admin@defesacivil.mg.gov.br --non-interactive

sudo cp /etc/letsencrypt/live/defesacivil.exemplo.gov.br/fullchain.pem infra/nginx/certs/
sudo cp /etc/letsencrypt/live/defesacivil.exemplo.gov.br/privkey.pem   infra/nginx/certs/
sudo chown $USER:$USER infra/nginx/certs/*.pem
```

> O DNS (registro A) deve apontar para o IP da VM antes deste passo.

---

## 7. Subir a stack (build na própria VM, ARM64)

```bash
docker compose -f docker-compose.oracle.yml up -d --build
docker compose -f docker-compose.oracle.yml ps
docker compose -f docker-compose.oracle.yml logs -f api
```

> O build é ARM64 nativo. Os módulos nativos (argon2) compilam com o toolchain já
> incluído no `api.Dockerfile`. Em 1 OCPU o build é lento (minutos) — paciência,
> ou suba temporariamente o shape para 4 OCPU só para o primeiro build.

---

## 8. Migrations + usuário admin

**Migrations** (Prisma é dependência de produção, roda no container da API):
```bash
docker compose -f docker-compose.oracle.yml exec -T -w /app/apps/api \
  api /app/node_modules/.bin/prisma migrate deploy
```

**Seed** (perfis/permissões + SUPER_ADMIN). O seed usa `tsx` (devDependency, fora
do runtime), então rode um container temporário com as deps completas, na rede do
compose (descubra o nome da rede com `docker network ls | grep dcmg`):

```bash
NET=$(docker network ls --format '{{.Name}}' | grep dcmg | head -1)
docker run --rm --network "$NET" -v "$PWD":/app -w /app node:20-alpine sh -c '
  apk add --no-cache python3 make g++ >/dev/null
  corepack enable && pnpm install --frozen-lockfile
  export DATABASE_URL="postgresql://'"$POSTGRES_USER"':'"$POSTGRES_PASSWORD"'@postgres:5432/'"$POSTGRES_DB"'?schema=public"
  export SEED_ADMIN_EMAIL="admin@defesacivil.mg.gov.br"
  export SEED_ADMIN_SENHA="<senha-forte-unica>"
  export SEED_ADMIN_CPF="<cpf-sem-pontuacao>"
  pnpm --filter @dcmg/api exec prisma db seed
'
```

> ⚠️ Defina sempre `SEED_ADMIN_SENHA` (o padrão é de DEV) e troque no 1º login.

---

## 9. Pós-deploy (checklist)

- [ ] `https://<dominio>` abre a SPA com TLS válido.
- [ ] Login com o admin do seed; **trocar a senha**.
- [ ] `curl https://<dominio>/api/health` → 200.
- [ ] Criar submissão + anexar arquivo (valida o disco local de uploads).
- [ ] Exportar Excel (valida o export síncrono).
- [ ] `docker compose -f docker-compose.oracle.yml logs --tail=100` sem erros.
- [ ] Configurar **backup do Postgres** (ver §11).

---

## 10. Operação

| Ação | Comando |
|---|---|
| Logs | `docker compose -f docker-compose.oracle.yml logs -f api` |
| Atualizar | `git pull && docker compose -f docker-compose.oracle.yml up -d --build` |
| Migração nova | `... exec -T -w /app/apps/api api /app/node_modules/.bin/prisma migrate deploy` |
| Parar | `docker compose -f docker-compose.oracle.yml down` |
| Recursos | `docker stats` |

---

## 11. Backup do PostgreSQL (importante — banco está na VM)

Como o banco roda na VM, faça dump periódico (cron):
```bash
# /etc/cron.daily/dcmg-backup (chmod +x)
cd /home/ubuntu/dcmg
docker compose -f docker-compose.oracle.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "/home/ubuntu/backups/dcmg-$(date +%F).sql.gz"
find /home/ubuntu/backups -name 'dcmg-*.sql.gz' -mtime +14 -delete
```
Opcional: enviar o dump para o **OCI Object Storage** (10 GB free) com a OCI CLI.

---

## 12. Custo

Tudo dentro do **Always Free** (VM Ampere A1 + block volume + 10 GB Object
Storage). Custo recorrente: **US$ 0** enquanto respeitar os limites do free tier.

---

## 13. CI/CD no OCI (opcional)

O `deploy.yml` atual publica imagens **amd64** no GHCR (voltado ao Azure). Para
CD automático no OCI (ARM64), há dois caminhos:

1. **Build na VM** (mais simples): um workflow que faz SSH e roda
   `git pull && docker compose -f docker-compose.oracle.yml up -d --build`.
2. **Imagens multi-arch**: alterar o `build-push` para
   `platforms: linux/amd64,linux/arm64` (docker/build-push-action) e a VM faz
   `pull`. Requer QEMU no runner (`docker/setup-qemu-action`).

Para começar, o deploy manual (§7) já entrega tudo funcionando.

---

## Troubleshooting

- **Site não abre, mas containers OK**: faltou abrir 80/443 no **firewall do SO**
  (§3) — além da regra da VCN.
- **"Out of host capacity" ao criar a VM**: capacidade Ampere esgotada na região;
  tente outro AD/região ou repita.
- **Build falha por memória (1 OCPU/6 GB)**: suba o shape para 4 OCPU temporariamente
  ou adicione swap (`fallocate -l 2G /swapfile && mkswap && swapon`).
- **`permission denied` no Docker**: `sudo usermod -aG docker $USER && newgrp docker`.
- **Anexo > 50 MB recusado**: ajuste `MAX_UPLOAD_MB` no `.env` e `client_max_body_size`
  no Nginx.
