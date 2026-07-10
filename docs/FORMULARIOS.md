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
| `HORA` | Hora (24h) | string "HH:MM" |
| `EMAIL` / `URL` / `CPF` / `CNPJ` / `CEP` / `TELEFONE` | Texto com máscara/validação | string |
| `SIM_NAO` | Booleano | boolean |
| `LISTA_SUSPENSA` | Seleção única — ou **múltipla** (flag `multipla`) | string ou string[] |
| `RADIO` | Escolha única | string |
| `CHECKBOX` | Múltipla escolha | string[] |
| `MUNICIPIO` | Autocomplete da base oficial (IBGE) | `{ id, nome }` |
| `UPLOAD` | Anexo (inclui KML/KMZ/GeoJSON/SHP em ZIP) | id do arquivo |
| `AUTOMATICO` | Preenchido pelo servidor (IBGE, município, competência…) | conforme a fonte |
| `GRUPO` | Bloco repetível de subperguntas | array de objetos |
| `INFORMATIVO` | Componente visual (título/descrição/alerta) — **não** é resposta | — |

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

## Importação via Excel (formato Defesa Civil MG)

Na tela **Formulários** (perfil Gestor Estadual ou Super Admin), use
**Importar Excel**. A planilha é apenas o **molde**: a importação cria um
formulário **nativo** (rascunho) no banco; nada da planilha permanece depois, e
tudo fica editável no construtor visual.

Fluxo: **selecionar `.xlsx` → prévia (seções/perguntas/listas/regras + erros) →
Criar formulário → abre no construtor**. (Apenas `.xlsx`; para `.xls` antigo,
abra no Excel e "Salvar como" `.xlsx`.)

### Estrutura da planilha
- **Cada aba (worksheet) vira uma SEÇÃO**, na ordem em que aparecem. Um número
  no início do nome (ex.: `1- Identificação`) é removido do título.
- Abas reservadas (não viram seção): **`Listas_Suspensas`** e **`Instrucoes`**
  (opcional; nome do formulário na célula **B1**).
- Em cada aba, deve haver as colunas **`Pergunta`** e **`Tipo`** (a coluna
  `Resposta`, se existir, é **ignorada** — é só exemplo).

### Mapeamento da coluna "Tipo"
`Texto`→texto curto · `Texto longo`→parágrafo · `Número` · `Data` · `Hora` ·
`Ano` · `Mês/Ano` · `E-mail`/`Telefone`/`CPF`/`CNPJ`/`CEP`/`URL` ·
`Sim / Não`→escolha Sim/Não · `Sim / Não / N.A.`→3 opções ·
`Lista suspensa`→select (opções da aba `Listas_Suspensas`) ·
`Município`→lista de municípios de MG · `Automático`→campo do sistema
(IBGE/município/usuário/data, inferido pelo rótulo) ·
`Título`/`Instrução`/`Alerta` (ou célula vazia)→componente **informativo**.

### Recursos automáticos
- **`Listas_Suspensas`**: cada **coluna** é uma lista — a 1ª linha é o nome da
  lista, as células abaixo são as opções. A pergunta é casada com a lista de
  **mesmo nome** (ex.: pergunta "Cargo/Função" ↔ coluna "Cargo/Função").
- **Perguntas-filhas**: rótulo começando com **`↳`** vira condicional da
  pergunta anterior (aparece quando esta = "Sim"). Ajustável no construtor.
- **Checklists**: rótulos começando com **`☐`** viram um **grupo repetível** de
  itens (Item + Possui? + Quantidade + Observação); os nomes detectados ficam na
  ajuda do grupo.
- **Efetivo**: uma aba com "Efetivo" no nome vira **um grupo repetível** (um
  registro por servidor), com as perguntas da aba como subcampos.
- **Município**: gera um campo de seleção de **todos os municípios de MG** (base
  oficial), com busca.

A prévia mostra as contagens e **erros amigáveis** (tipo não reconhecido, lista
suspensa sem correspondência, aba sem cabeçalho) antes de confirmar. A criação é
registrada no **log de auditoria** (usuário, arquivo, contagens, tempo).

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
