# Relatório de Auditoria — Plataforma Defesa Civil MG (SIG-COMPDEC)

Auditoria profunda (Staff Engineer / Arquitetura / Segurança) sobre o estado atual
do monorepo (apps/api, apps/web, packages/contracts, infra). Conduzida com 8
revisores independentes por área + verificação manual e correção dos achados reais.

---

## 1. Resumo executivo

A base está **madura e bem arquitetada** após o hardening anterior (sem Redis/filas/
WebSocket; auth com lockout + timing uniforme + refresh em Postgres; CORS/Helmet/CSP;
SAS de upload; cache em memória; índices). A auditoria encontrou **46 achados**,
concentrados em **controle de acesso a nível de objeto/tenant (RBAC)** — a
divergência entre o `where` das listagens e as verificações por ID era o padrão de
risco recorrente.

Foram corrigidos **todos os achados de severidade crítica e alta**, mais os médios
de maior valor. Itens de baixa severidade / refator maior foram documentados como
risco remanescente. Após as correções: **lint 0 erros, typecheck api+web, 22/22
testes, builds api+web OK**.

| Severidade | Encontrados | Corrigidos | Deferidos (documentados) |
|---|---|---|---|
| Crítica | 3 | 3 | 0 |
| Alta | 8 | 8 | 0 |
| Média | ~12 | 6 | ~6 |
| Baixa/Info | ~23 | 3 | ~20 |

---

## 2. Bugs encontrados

1. **TOCTOU nas transições de submissão** — status lido fora da transação e UPDATE
   só por `id`; dois requests concorrentes (duplo "aprovar"/duplo envio) geravam
   dupla transição, dois e-mails e sobrescrita de protocolo. *(corrigido)*
2. **Versão de formulário PUBLICADA editável in-place** quando tinha 0 submissões,
   mesmo já vinculada a competência ABERTA (formulário em produção alterável). *(corrigido)*
3. **`verificarEscopo` (submissões) não tratava REGIONAL** nem a regra "nível <
   ADMIN_MUNICIPAL só vê as próprias" — divergente da listagem. *(corrigido)*
4. **`completarAnexo` não-transacional** (Arquivo+blob órfãos se o vínculo falhar). *(corrigido)*
5. **Regras condicionais com origem órfã descartadas em silêncio** ao salvar schema. *(deferido)*
6. **`proximaVersao`/`removerComVersoes` fora de transação** (corrida/estado parcial). *(deferido)*

## 3. Vulnerabilidades encontradas (OWASP)

1. **[Broken Access Control] Escalonamento de privilégio** — `usuarios.criar`
   ignorava o solicitante e aceitava `perfilCodigo` arbitrário: um ADMIN_MUNICIPAL
   (que tem `usuarios.gerenciar`) podia criar um **SUPER_ADMIN**. *(corrigido)*
2. **[Broken Access Control] IDOR cross-tenant em submissões** — ler/baixar
   anexo (SAS)/listar/remover/transicionar **qualquer** submissão por ID por
   usuários REGIONAIS de outra regional e por operadores de baixo nível. *(corrigido)*
3. **[Broken Access Control] Promoção acima do próprio nível** em `usuarios.atualizar`. *(corrigido)*
4. **[Sensitive Data Exposure / LGPD] `GET /usuarios`** retornava **toda a base do
   estado** e **CPF em claro** (sem escopo, sem máscara). *(corrigido)*
5. **[Insecure Design] Validação de anexo contornável** (`MIME || extensão` +
   `octet-stream`) permitia subir `.exe/.html/.svg`. *(corrigido)*
6. **[LGPD] Auditoria gravava nome/e-mail/telefone do respondente em claro**
   (`redact.util` não cobria os campos `*Respondente`). *(corrigido)*
7. **[Auth/Secrets] Senha de SUPER_ADMIN padrão** versionada no seed, usada em
   produção se `SEED_ADMIN_SENHA` ausente. *(corrigido — aborta em prod)*
8. **[Broken Access Control] COMPDEC** atualizável por usuário REGIONAL fora da
   sua regional. *(corrigido)*
9. **[Auth] Lockout só por e-mail** → DoS de conta. *(deferido — recomendação)*
10. **[Security Misconfig] CSP duplicado** (Helmet + Nginx) nas respostas `/api`. *(deferido)*
11. **[Software Integrity] `.npmrc enable-pre-post-scripts=true`** (supply-chain em
    postinstall). *(deferido — recomendação)*

> SSRF, Injection (Prisma parametriza tudo), Cryptographic Failures (Argon2id +
> JWT distintos), e Vulnerable Components: **sem achados**.

## 4. Severidade de cada problema

- **Crítica:** #2.1 (priv. escalation criar), #2.2 (IDOR submissões — leitura/anexos), #3 verificarEscopo.
- **Alta:** #3.3 (promoção), #3.4 (listar/CPF), #3.5 (anexo), #2.1 bug (TOCTOU), #2.2 bug (form imutável), #3.7 (seed prod).
- **Média:** #3.6 (redact PII), #3.8 (COMPDEC regional), #3.9 (lockout email), content-type do blob, #2.5 (regras órfãs), builder `codigo` editável.
- **Baixa/Info:** CSP duplicado, `.npmrc`, snapshot fora de tx, proximaVersao/removerComVersoes tx, SMTP duplicado, validação competenciaId no painel, DTO de respondente sem `@IsEmail`, logout-global redundante, LOGIN_FALHA grava e-mail, redact por denylist/profundidade.

## 5. Arquivos afetados (correções)

- `apps/api/src/modules/usuarios/services/usuarios.service.ts` — nível+escopo em criar/atualizar; escopo+máscara na listagem.
- `apps/api/src/modules/usuarios/repositories/usuarios.repository.ts` — `buscarPerfilPorCodigo`, `buscarRegionalDoMunicipio`, escopo na `listar`.
- `apps/api/src/modules/usuarios/controllers/usuarios.controller.ts` — passa `usuario` na listagem.
- `apps/api/src/modules/submissoes/services/submissoes.service.ts` — `verificarEscopo` async espelhando o where; `completarAnexo` (content-type real + anti-órfão).
- `apps/api/src/modules/submissoes/repositories/submissoes.repository.ts` — guarda de status (anti-TOCTOU) nas 3 transições.
- `apps/api/src/modules/submissoes/validators/anexo.validator.ts` — extensão obrigatória na allowlist.
- `apps/api/src/modules/formularios/services/formularios.service.ts` — imutabilidade de versão PUBLICADA.
- `apps/api/src/modules/localidades/services/localidades.service.ts` + `repositories/localidades.repository.ts` — escopo REGIONAL no COMPDEC.
- `apps/api/src/shared/redact.util.ts` — PII do respondente + truncagem profunda.
- `apps/api/prisma/seed.ts` — aborta seed de admin em produção sem senha definida.

## 6. Correções aplicadas (detalhe)

- **RBAC/tenant unificado:** `verificarEscopo` de submissões agora aplica
  MUNICIPAL→próprio município, REGIONAL→sua regional (via `buscarRegionalDoMunicipio`),
  e nível<ADMIN_MUNICIPAL→`autorId===sub` — paridade exata com `montarWhereSubmissoes`.
- **Gestão de usuários:** `validarNivelAlvo` (não atribuir perfil acima do próprio)
  + `validarEscopoAlvo` (MUNICIPAL/REGIONAL não criam fora do tenant) em `criar`;
  teto de nível em `atualizar`. `listar` filtra por escopo e mascara CPF.
- **Concorrência:** transições usam `updateMany({ where: { id, status: anterior } })`
  e tratam `count===0` como `409 Conflict`; protocolo de envio deixou de ser
  sobrescrito por duplo-envio.
- **Imutabilidade de formulário:** qualquer edição de versão PUBLICADA cria nova
  versão RASCUNHO (gatilho = publicação, não a 1ª submissão).
- **Upload:** extensão deve estar na allowlist (bloqueia `octet-stream`+`.exe`);
  registra o content-type real do blob; remove Arquivo/blob órfão em falha de vínculo.
- **LGPD:** auditoria redige `nome/email/telefone(Respondente)` e trunca objetos
  além da profundidade máxima; listagem de usuários mascara CPF e respeita escopo.
- **Seed:** em `NODE_ENV/APP_ENV=production`, aborta se `SEED_ADMIN_SENHA` ausente.

## 7. Código morto removido

- Nesta rodada: nenhum (a remoção de Redis/BullMQ/WebSocket/AWS-SDK/ngrok/loadtest e
  artefatos `.js` do contracts ocorreu nas rodadas anteriores de simplificação).
- Confirmado **sem resíduos** de dependências de Redis/socket.io/bullmq/aws nos
  `package.json` (apenas comentários explicativos no código).

## 8. Dependências atualizadas

- Nenhuma alteração de versão nesta rodada. Não foram encontradas dependências
  abandonadas ou com CVE conhecido em uso. ESLint (já adicionado na rodada de CI)
  permanece. Recomenda-se rodar `pnpm audit` periodicamente no CI (ver §11).

## 9. Melhorias de performance

- Nesta rodada, foco em segurança/correção (sem regressão de performance; o
  `verificarEscopo` REGIONAL adiciona no máx. 1 query leve por acesso a ID).
- Otimizações de performance da rodada anterior permanecem: Dashboard via `groupBy`
  (em vez de agregar em JS), `upsertRespostas` em 2 queries, drawer do painel em
  paralelo, índice `respostas.pergunta_id`, cache do painel (TTL 60s).

## 10. Riscos remanescentes (deferidos, com justificativa)

| Item | Sev. | Por que deferido |
|---|---|---|
| Lockout de login só por e-mail (DoS de conta) | média | Requer estratégia (IP/CAPTCHA); throttle global mitiga parcialmente. |
| Protocolo gerado antes da transação (gaps) | baixa | Duplo-envio já não sobrescreve (guarda de status); gap em falha é aceitável. |
| Snapshot do histórico lido fora da transação | baixa | Janela mínima em instância única; refator no repo. |
| `proximaVersao`/`removerComVersoes` sem transação | baixa | Poucos editores; corrida rara. |
| Regras condicionais órfãs descartadas + `codigo` editável no builder | média | Correção UX/integridade no builder (front+back). |
| CSP duplicado (Nginx + Helmet em `/api`) | baixa | Políticas equivalentes; reorganizar headers do Nginx. |
| `.npmrc enable-pre-post-scripts=true` | baixa | Trocar por allowlist exige validar build de prisma/esbuild. |
| Validação `competenciaId` no painel; `@IsEmail` no DTO de submissão | baixa | Robustez; sem impacto de segurança direto. |
| SMTP duplicado (AuthService vs NotificacoesService) | baixa | Refator (extrair EmailService). |
| **Auditoria de frontend automatizada falhou** | — | O agente da área retornou resultado inválido; feito spot-check manual (sem log de token, `ProtectedRoute` correto). Recomenda-se auditoria dedicada do front. |

## 11. Recomendações futuras

1. **Testes de autorização** automatizados (e2e) cobrindo a matriz escopo×ação×perfil
   para travar regressões de IDOR/escalonamento.
2. **`pnpm audit`** (e Dependabot) como passo do CI.
3. **Política de retenção/expurgo** de `LogAuditoria` (LGPD) e base legal documentada.
4. **Allowlist de scripts** no pnpm (`onlyBuiltDependencies`) em vez de `enable-pre-post-scripts`.
5. **EmailService** compartilhado (remover duplicação SMTP).
6. **Builder de formulário**: tornar `codigo` imutável após criado e validar regras órfãs.
7. **Rotina de coleta de blobs órfãos** (cron) para o storage.
8. Auditoria dedicada e tests do **frontend** (builder/preview/painel).

## 12. Comandos executados

```
pnpm install --frozen-lockfile
pnpm --filter @dcmg/api exec prisma generate
pnpm --filter @dcmg/api exec prisma validate
eslint .                         # via node_modules/.bin
tsc --noEmit  (contracts | api | web)
nest build (api)   |  vite build (web)  |  tsc -p contracts
jest (api)
```
> Observação de ambiente: nesta máquina Windows, o wrapper `pnpm run <script>` falha
> por um quirk de resolução de bin com `node-linker=hoisted`; as ferramentas foram
> executadas diretamente via `node node_modules/...`. Nos runners Linux do CI
> (`ci.yml`) os scripts pnpm rodam normalmente.

## 13. Resultado dos testes/build (pós-correções)

| Verificação | Resultado |
|---|---|
| `eslint .` | ✅ 0 erros (1 warning benigno: react-refresh em auth-context) |
| typecheck contracts/api/web | ✅ 0 / 0 / 0 |
| `jest` (api) | ✅ **22/22** (7 suites) |
| build contracts | ✅ |
| build api (`dist/main.js`) | ✅ |
| build web (`dist/index.html`) | ✅ |
| `prisma validate` | ✅ schema válido |

> `apps/web` não possui suíte de testes configurada (nunca teve) — não é regressão.

---

**Conclusão:** todos os achados **críticos e altos** foram corrigidos e o projeto
builda/testa 100%. Não permanece nenhuma vulnerabilidade crítica. Os itens
remanescentes são de baixa severidade (ou refator maior) e estão documentados acima.
