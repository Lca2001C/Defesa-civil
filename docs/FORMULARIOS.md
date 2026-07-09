# Motor de formulários dinâmicos

Guia do construtor de formulários da Plataforma Defesa Civil MG: tipos de
campo, lógica condicional, grupos repetíveis, importação via Excel, validação e
o roteiro para aplicar ajustes num formulário já em produção.

## Conceitos

Um formulário é versionado (`FormularioVersao`) e tem a hierarquia
**Páginas → Seções → Perguntas**. No banco a estrutura é normalizada em tabelas;
no transporte/edição ela é a projeção JSON `SchemaFormulario`
(`packages/contracts/src/formulario.ts`). As respostas de uma submissão são
gravadas como uma linha por pergunta (`Resposta.valor`, JSON).

## Tipos de pergunta

| Tipo | Uso | Valor gravado |
|---|---|---|
| `TEXTO_CURTO` / `TEXTO_LONGO` | Texto livre | string |
| `NUMERO` / `MOEDA` / `PORCENTAGEM` | Numéricos | número |
| `ANO` | Ano com 4 dígitos (1900–2100) | string "AAAA" |
| `MES_ANO` | Competência mensal | string "MM/AAAA" |
| `DATA` | Data completa | string ISO "AAAA-MM-DD" |
| `EMAIL` / `URL` / `CPF` / `CNPJ` / `CEP` / `TELEFONE` | Texto com máscara/validação | string |
| `SIM_NAO` | Booleano | boolean |
| `LISTA_SUSPENSA` | Seleção única — ou **múltipla** (flag `multipla`) | string ou string[] |
| `RADIO` | Escolha única | string |
| `CHECKBOX` | Múltipla escolha | string[] |
| `MUNICIPIO` | Autocomplete da base oficial (IBGE) | `{ id, nome }` |
| `UPLOAD` | Anexo (inclui KML/KMZ/GeoJSON/SHP em ZIP) | id do arquivo |
| `AUTOMATICO` | Preenchido pelo servidor (IBGE, município, competência…) | conforme a fonte |
| `GRUPO` | Bloco repetível de subperguntas | array de objetos |

## Lógica condicional

Cada pergunta pode ter regras `{ origemCodigo, operador (IGUAL/DIFERENTE), valor, acao (MOSTRAR/OCULTAR) }`.
A primeira regra satisfeita decide a exibição. Para Sim/Não, compare com
`true`/`false`. Campos ocultos **não** são exigidos, mesmo que marcados como
obrigatórios (implementa o padrão "Se Sim, abrir campo obrigatório").

## Opção "Outro(s)"

Convenção sem alterar o modelo: a pergunta ganha a opção `outro` e uma pergunta
**companheira** `TEXTO_CURTO` obrigatória (código `<codigo>_outro`) que só
aparece quando "Outro(s)" é selecionado. Na **importação por Excel**
(`PermiteOutro = S`) a companheira é gerada automaticamente. No builder, marque
"Incluir opção Outro(s)" e, se quiser exigir a especificação, adicione um campo
de texto condicional.

## Grupos repetíveis (`GRUPO`)

Um grupo abre N cópias de um conjunto de subperguntas (ex.: cadastro de cursos,
do efetivo, de municípios consorciados). A quantidade de registros pode ser:

- **controlada por quantidade**: informe `quantidadeOrigemCodigo` = código de uma
  pergunta `NUMERO` (ex.: "Quantos cursos?" abre exatamente N blocos); ou
- **manual**: botões Adicionar/Remover, limitados por `minInstancias`/`maxInstancias`.

Limitações da v1: um grupo **não** pode conter outro grupo, nem campos `UPLOAD`
ou `AUTOMATICO`. A resposta é um array de objetos, um por registro:

```json
"cursos": [
  { "curso_nome": "Capacitação básica", "curso_ano": "2024" },
  { "curso_nome": "Simulado", "curso_ano": "2025" }
]
```

## Validação

A lógica de validação é **isomórfica** (`packages/contracts/src/validacao.ts`,
`validarRespostas`): roda no navegador (feedback de preenchimento) e na **API**
(barreira de segurança no envio — o backend nunca confia só no cliente). Cobre
obrigatoriedade de campos visíveis, tipos, opções válidas e grupos. Um envio com
respostas inválidas retorna `400` com a lista de erros por campo/registro.

## Importação via Excel

Na tela **Formulários** (perfil Gestor Estadual ou Super Admin), use
**Importar Excel**:

1. **Baixar planilha-modelo** — gera um `.xlsx` com as abas `Instrucoes`
   (nome do formulário na célula **B1** + legenda) e `Perguntas`, com exemplos.
2. Preencher a aba `Perguntas` — **uma linha por pergunta**. Colunas:

   | Coluna | Descrição |
   |---|---|
   | `Pagina` / `Secao` | Agrupam as perguntas (repita o mesmo texto para juntar) |
   | `Codigo` | Identificador único (chave da resposta) |
   | `Pergunta` | Rótulo exibido |
   | `Tipo` | Um dos tipos acima (ex.: `TEXTO_CURTO`, `GRUPO`, `MUNICIPIO`) |
   | `Obrigatoria` | `S` / `N` |
   | `Ajuda` | Texto de apoio (opcional) |
   | `Opcoes` | Rótulos separados por `;` (tipos de escolha) |
   | `PermiteOutro` | `S` gera a opção "Outro(s)" + campo de especificação obrigatório |
   | `Multipla` | `S` no `LISTA_SUSPENSA` = seleção múltipla |
   | `CondicionalDe` + `CondicionalValor` | Mostra a pergunta só quando a origem == valor |
   | `Grupo` | Código de uma pergunta `GRUPO` — a linha vira subpergunta dele |
   | `QuantidadeDe` | No `GRUPO`: código da pergunta `NUMERO` que controla o nº de registros |
   | `Min` / `Max` | Texto/número: limites; no `GRUPO` sem `QuantidadeDe`: mín./máx. de registros |

3. **Importar** — a API valida com **erros por linha** (tipo inválido, código
   duplicado, referência quebrada) e cria um formulário **RASCUNHO**, que abre no
   builder para revisão. Publique numa competência **ABERTA** para disponibilizar.

## Aplicar ajustes num formulário já em produção

Versões publicadas são **imutáveis**. Para ajustar um formulário existente:

1. Abra o formulário no builder e edite (ou importe uma planilha atualizada como
   novo rascunho).
2. Salvar sobre uma versão **publicada** cria automaticamente uma **nova versão
   (rascunho)** — a versão publicada e suas submissões permanecem intactas.
3. **Publique** a nova versão numa competência ABERTA. As novas submissões usam
   a versão nova; as antigas continuam ligadas à versão em que foram feitas.

## Arquivos-chave

- Contrato + validação/formatação isomórficas: `packages/contracts/src/{formulario,validacao,formato}.ts`
- Compor/decompor schema (banco ↔ JSON): `apps/api/src/modules/formularios/repositories/formularios.repository.ts`
- Importação Excel: `apps/api/src/modules/formularios/services/formulario-import.service.ts`
- Validação no envio: `apps/api/src/modules/submissoes/services/submissoes.service.ts`
- Renderizador: `apps/web/src/components/dynamic-form/`
- Construtor visual: `apps/web/src/features/formularios/builder/`
