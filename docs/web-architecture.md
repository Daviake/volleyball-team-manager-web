# Arquitetura da Aplicação Web — volleyball-team-manager-web

> **Etapa 2 da migração.** Baseada em `java-project-analysis.md` (24/10/2026), que define as regras R1–R16, os problemas P1–P9 e as dúvidas D1–D15 citados aqui.
> **Data:** 24/10/2026. **Substitui** a versão anterior (salva como `web-architecture.anterior-2026-08.md`).
> Decisão já tomada pelo responsável: **D14 — o projeto web será recriado do zero** (a pasta da tentativa anterior não será reaproveitada).
> As demais dúvidas seguem a "interpretação mais provável" da análise até serem validadas; os pontos que dependem delas estão marcados.

---

## 1. Objetivos e princípios

1. **Preservar as regras** do sistema atual (`backend/` + `frontend/` do "Projeto Volei"), sem tradução literal das classes Java.
2. **Regra de negócio fora do React.** Toda regra fica em `domain/` e `services/` como funções puras, testáveis no Node sem navegador. Componentes só exibem dados e disparam ações.
3. **Persistência isolada.** Só a camada `storage/` conhece o `localStorage`. Serviços nunca leem nem gravam dados; recebem o estado e devolvem o novo estado.
4. **Preparada para crescer.** A camada de storage tem uma interface assíncrona desde o início, para que um backend Node/REST possa substituí-la sem mexer em serviços, hooks ou páginas.
5. **Sem dependências desnecessárias.** Cada dependência abaixo tem um motivo explícito.
6. **Nada silencioso.** Diferenças de comportamento em relação ao Java só entram com aprovação e ficam registradas em `docs/migration-progress.md` e `docs/business-rules.md`.

### Por que não replicar a organização Java

| No Java | Problema para uma SPA | Na web |
|---|---|---|
| `SorteioService` calcula, persiste, serializa JSON e recalcula o delta | Mistura regra, I/O e formato | `teamBalancer` (puro) + `ratingDelta` (puro) + `matchStorage` (I/O) |
| Fórmula do delta duplicada em 2 serviços | Risco de divergir | Um único `ratingDelta.js` |
| Times guardados como JSON dentro de string | Exige parse em toda leitura | Arrays de objetos no próprio documento JSON |
| DTOs de request/response | Não há rede | Modelos de domínio simples + objetos derivados calculados na hora |
| Regras no frontend (seleção rápida, troca, rascunhos) | Não testadas, misturadas com JSX | `selectionService`, `teamSwap`, `draftService` |
| Exceções HTTP (404/422/400) | Não há HTTP | Erros tipados de domínio |

---

## 2. Tecnologias e dependências

| Pacote | Tipo | Problema que resolve |
|---|---|---|
| `react`, `react-dom` | produção | Interface |
| `react-router` (v7) | produção | Há 7 telas com URL própria (incluindo `/resultado/:id`), igual ao sistema atual |
| `vite`, `@vitejs/plugin-react` | dev | Servidor de desenvolvimento e build |
| `vitest` | dev | Testes unitários (pedido) |
| `eslint`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | dev | Padronização (pedido); os plugins de hooks pegam erros reais de React, e o de refresh é o padrão do template do Vite |
| `xlsx` (SheetJS) | produção, **carregada só na tela de importação** (`import()` dinâmico) | Ler planilhas `.xlsx` e gerar o template, como hoje. **Depende de D11** |

**Atenção sobre o SheetJS (D11):** o pacote `xlsx` publicado no registro npm parou na versão 0.18.5, que tem vulnerabilidades conhecidas (por exemplo CVE-2023-30533). As versões corrigidas são distribuídas pelo próprio site da SheetJS (`https://cdn.sheetjs.com/`), instaladas por URL de tarball no `package.json`. Alternativas: (a) instalar a versão corrigida pela URL da SheetJS — recomendado; (b) aceitar apenas CSV na primeira versão, sem nenhuma dependência. A escolha muda só o adaptador `src/services/import/spreadsheetReader.js`; o restante da importação é igual.

**Não serão usados:** TypeScript, Redux/Zustand (o estado é pequeno; Context + `useReducer` basta), bibliotecas de UI/CSS, Testing Library e jsdom (nesta fase os testes cobrem `domain/`, `services/` e `storage/`, que rodam no Node; testes de componentes podem ser propostos depois, com justificativa), `uuid` (o navegador já tem `crypto.randomUUID()`), `vite-plugin-pwa` (PWA fica para depois, D12).

Node.js 18 ou superior. Módulos ES (`"type": "module"`).

---

## 3. Estrutura de pastas

```
volleyball-team-manager-web/
├── public/                     ícones (reaproveitados do projeto atual)
├── src/
│   ├── assets/                 imagens
│   ├── styles/                 CSS global e tokens (ajuste ao modelo pedido, ver nota)
│   ├── domain/                 modelos: criação, validação, normalização, (de)serialização
│   │   ├── player.js
│   │   ├── team.js             item de time (TeamSlot) e helpers de time
│   │   ├── match.js            sorteio confirmado + placar + resultado
│   │   ├── draft.js            rascunho de sorteio
│   │   └── settings.js         pesos, constantes e preferências (valores padrão = Java)
│   ├── services/               regras de negócio puras
│   │   ├── ratingCalculator.js
│   │   ├── ratingDelta.js
│   │   ├── teamBalancer.js
│   │   ├── teamSwap.js
│   │   ├── selectionService.js
│   │   ├── matchService.js
│   │   ├── draftService.js
│   │   ├── playerService.js
│   │   ├── playerStatistics.js
│   │   └── import/
│   │       ├── playerImport.js       modos MESCLAR / ADICIONAR / SUBSTITUIR
│   │       ├── spreadsheetReader.js  adaptador XLSX/CSV → linhas brutas
│   │       └── javaDataImport.js     converte o JSON exportado da API Java (D13)
│   ├── storage/                única camada que toca o localStorage
│   │   ├── storageAdapter.js   leitura/escrita seguras sobre um "Storage" injetável
│   │   ├── appDataStorage.js   documento versionado, migrações, backup, import/export
│   │   ├── migrations.js       migrações entre versões do esquema
│   │   ├── playerStorage.js
│   │   ├── matchStorage.js
│   │   ├── draftStorage.js
│   │   └── settingsStorage.js
│   ├── hooks/                  ligação entre React, serviços e storage
│   │   ├── AppDataProvider.jsx Context + useReducer com o estado carregado
│   │   ├── usePlayers.js
│   │   ├── useMatches.js
│   │   ├── useDrafts.js
│   │   └── useConfirm.js       confirmação de ações destrutivas
│   ├── components/             visuais e reutilizáveis
│   ├── pages/                  uma pasta/arquivo por tela
│   ├── utils/
│   │   ├── errors.js
│   │   ├── random.js           seededRandom + random padrão
│   │   ├── dates.js            ISO ⇄ datetime-local
│   │   ├── numbers.js          clamp, EPSILON, formatação
│   │   └── text.js             normalização de nomes
│   ├── tests/                  testes Vitest, espelhando domain/, services/, storage/
│   │   └── fixtures/           dados de teste (identificados como fictícios)
│   ├── App.jsx
│   └── main.jsx
├── docs/
│   ├── java-project-analysis.md
│   ├── web-architecture.md
│   ├── business-rules.md
│   ├── data-models.md
│   ├── migration-plan.md
│   ├── equivalence-tests.md
│   └── migration-progress.md
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

**Nota sobre `src/styles/`:** o modelo pedido não tem pasta de estilos. O CSS atual (1.712 linhas) é global, com variáveis de tema; separá-lo de `assets/` (imagens) deixa claro o que é código de estilo. Os componentes podem ter CSS próprio ao lado do `.jsx` quando forem específicos.

---

## 4. Camadas e regras de dependência

```
pages/  ──►  components/
   │
   ▼
hooks/  ──►  services/  ──►  domain/  ──►  utils/
   │
   ▼
storage/ ──►  domain/ (serializar/desserializar)
```

| Camada | Pode importar | Não pode importar |
|---|---|---|
| `domain/` | `utils/` | React, `storage/`, `services/`, `window`, `localStorage` |
| `services/` | `domain/`, `utils/` | React, `storage/`, `window`, `localStorage`, `Date.now()`/`Math.random()` diretos (recebem `now` e `random` por parâmetro) |
| `storage/` | `domain/`, `utils/` | React, `services/` |
| `hooks/` | `services/`, `storage/`, `domain/`, `utils/` | — |
| `components/` | `utils/` (formatação) e props | `storage/`, `services/` |
| `pages/` | `hooks/`, `components/`, `utils/` | `storage/` direto |

Essas regras serão verificadas por ESLint (`no-restricted-imports` por pasta e `no-restricted-globals` para `localStorage` fora de `storage/`).

**Convenção de nomes:** código, arquivos e campos em inglês (como no modelo pedido); textos da interface em português. A correspondência com os nomes do Java fica em `docs/data-models.md` e no importador `javaDataImport.js`.

---

## 5. Modelos de dados (`src/domain/`)

Objetos JavaScript simples (sem classes), compatíveis com `JSON.stringify`. Cada módulo exporta `create*`, `validate*` (retorna lista de erros por campo), `normalize*`, `serialize*` e `deserialize*` (tolerante: aplica padrões e rejeita o que não dá para recuperar, com erro explícito). Detalhes de cada campo em `docs/data-models.md` (Etapa 4).

### 5.1 Player (Java: `Jogador`)

| Campo | Tipo | Padrão | Java |
|---|---|---|---|
| `id` | string (UUID) | `crypto.randomUUID()` | `id` |
| `name` | string, aparado | — (obrigatório) | `nome` |
| `prefersSetter` | boolean | `false` | `levantador` (só preferência) |
| `isMonthly` | boolean | `true` | `mensalista` |
| `isWoman` | boolean | `false` | `mulher` |
| `ratings` | `{ attack, defense, serve, setting, blocking, consistency }`, números 0–10 | 5 em cada (formulário e importação) | `ataque`, `defesa`, `saque`, `levantamento`, `bloqueio`, `constancia` |
| `createdAt`, `updatedAt` | string ISO | agora | (não existe no Java) |

`evolucao` não é migrado (P5/D5). As **notas base nunca são alteradas** por resultados; notas ajustadas são sempre derivadas (R8).

### 5.2 TeamSlot (Java: `JogadorResultado`)

`{ playerId, playerName, isSetter, isStarter, score }`. `playerName` e `score` são **cópias congeladas** do momento do sorteio (R7, risco R7 da análise).

### 5.3 Match (Java: `Sorteio` confirmado)

| Campo | Tipo | Java |
|---|---|---|
| `id` | UUID | `id` |
| `playedAt` | string ISO (UTC) | `data` |
| `playerIds` | UUID[14] | `jogadoresIdsJson` |
| `teamA`, `teamB` | TeamSlot[7] (levantador, 5 titulares de linha, reserva) | `timeAJson`, `timeBJson` |
| `averageA`, `averageB`, `difference` | number | `mediaTimeA`, `mediaTimeB`, `diferenca` |
| `score` | `{ setsA, setsB } \| null` | `setsTimeA`, `setsTimeB` |
| `createdAt`, `updatedAt` | ISO | — |

`result` (`'TEAM_A' | 'TEAM_B' | 'DRAW' | null`) **não é armazenado**; é derivado de `score` por `matchService.getResult` (no Java ele é gravado, mas sempre igual ao derivado).

### 5.4 Draft (rascunho)

`{ id, createdAt, request: { playerIds, setterIds }, lineup: { teamA, teamB, averageA, averageB, difference }, originalLineup, edited: boolean }`. `originalLineup` existe para permitir a decisão D8 sem mudar o formato depois; com a interpretação atual (manter igual ao Java), "desfazer" usa o último estado salvo.

### 5.5 Settings

Valores iguais às constantes do Java, **somente leitura na primeira versão** (o Java não permite configurar nada; editar pesos seria funcionalidade nova):

```js
{
  weights: {
    hitter: { attack: 3, defense: 3.5, serve: 2, setting: 0, blocking: 0.5, consistency: 1 },
    setter: { attack: 1, defense: 2, serve: 0, setting: 5, blocking: 1, consistency: 1 },
    divisor: 10
  },
  draw: { playersPerDraw: 14, settersPerDraw: 2, playersPerTeam: 7, starters: 6, tieTolerance: 0.05, epsilon: 1e-9 },
  ratingDelta: { base: 0.05, elasticity: 0.3, min: 0, max: 10 },
  playerOfMonth: { winRate: 0.25, setBalance: 0.25, delta: 0.25, adjustedScore: 0.25 },
  drafts: { max: 5 },
  recentMatches: 5
}
```

As preferências de interface (filtros, ordenação escolhida) ficam no mesmo documento, em `preferences`, e não afetam regras.

---

## 6. Serviços (`src/services/`)

Todos puros: recebem dados (e `random`/`now` quando precisam) e devolvem dados novos, sem modificar a entrada. Erros de regra lançam `BusinessRuleError`; erros de dados, `ValidationError`.

| Módulo | Funções principais | Regras |
|---|---|---|
| `ratingCalculator` | `calculateScore(ratings, role, weights)`, `calculateHitterScore`, `calculateSetterScore` | R5 |
| `ratingDelta` | `countSets(playerId, matches)`, `calculateDelta(player, matches, settings)` → `{ setsWon, setsLost, gainPerSet, lossPerSet, delta }`, `adjustRatings(ratings, delta)` | R8 (implementação única) |
| `teamBalancer` | `generateTeams({ players, setterIds, matches, settings, random })` → lineup; `enumerateCandidates(...)` exportado para testes | R6 (validação), R7 |
| `teamSwap` | `swapPlayers(lineup, playerIdA, playerIdB)` → lineup com médias recalculadas | R12 (comportamento atual; D9) |
| `selectionService` | `toggleSelection`, `toggleSetter`, `selectLastLineup`, `selectMonthly`, `autoComplete`, `clearSelection`, `filterAndSortPlayers`, `getSelectionError` | R6 (P4 depende de D15) |
| `draftService` | `addDraft(drafts, draft, max)`, `replaceDraftLineup`, `removeDraft` | R11 |
| `matchService` | `confirmDraft(draft, players, now)` (valida o conteúdo, P7), `setScore`, `getResult`, `changeDate`, `removeMatch`, `sortByDateDesc` | R9, R10 |
| `playerService` | `addPlayer`, `updatePlayer`, `removePlayer`, `assertUniqueName`, `normalizeName` | R1–R4 (P1 depende de D15) |
| `playerStatistics` | `buildPlayerStats(player, matches, settings)`, `buildAllStats`, `selectPlayerOfMonth` | R13 |
| `import/playerImport` | `parseRows(rows)` → `{ items, errors }`, `previewImport(items, players, mode)`, `applyImport(items, players, mode, now)` → `{ players, summary }` | R14 (P3 depende de D15) |
| `import/spreadsheetReader` | `readSpreadsheet(file)` → linhas brutas; `buildTemplate()` | adaptador (D11) |
| `import/javaDataImport` | `convertJavaExport({ jogadores, sorteios })` → `{ players, matches, warnings }` | D13 |

### 6.1 Sorteio com aleatoriedade injetável

```js
generateTeams({ players, setterIds, matches, settings, random = Math.random })
```

`utils/random.js` exporta `seededRandom(seed)` (gerador determinístico, por exemplo mulberry32). Nos testes: `generateTeams({ ..., random: seededRandom(123) })` sempre produz o mesmo resultado. A escolha final é `eligible[Math.floor(random() * eligible.length)]`, equivalente ao `nextInt` do Java. A ordem de enumeração dos 1.848 candidatos segue a do Java (levantadores na ordem recebida, combinações em ordem lexicográfica), e o reserva é escolhido com ordenação estável por score.

### 6.2 Fluxo de dados de uma ação

```
Página ──(clique)──► hook (useMatches.setScore)
                         │
                         ├─► matchService.setScore(matches, id, score)   ← puro
                         ├─► matchStorage.saveAll(novasPartidas)         ← I/O, pode falhar
                         └─► dispatch({ type: 'matches/replaced', ... }) ← só depois de salvar
```

O estado do React só muda depois que a gravação deu certo; se falhar, a página recebe o erro e mostra a mensagem (sem `catch` vazio).

---

## 7. Armazenamento (`src/storage/`)

### 7.1 Documento versionado

Um único documento em uma chave do `localStorage`:

```js
// chave: "vtm:data"
{
  version: 1,
  savedAt: "2026-10-24T12:00:00.000Z",
  players: [],
  matches: [],
  drafts: [],
  settings: {},
  preferences: {}
}
```

**Por que uma chave só:** o `localStorage` não tem transação. Com um documento único, operações como "SUBSTITUIR todos os jogadores" ou "importar backup" montam o novo estado em memória e gravam uma vez; ou tudo é salvo, ou nada muda. `playerStorage`, `matchStorage`, `draftStorage` e `settingsStorage` são fachadas sobre esse documento, para que páginas e hooks não conheçam o formato.

### 7.2 Leitura e escrita seguras

- `storageAdapter` recebe o objeto `Storage` por injeção (nos testes, um armazenamento em memória).
- Leitura: chave ausente → documento padrão; JSON inválido → **não sobrescreve**; copia o conteúdo bruto para `vtm:data:corrupted:<data>` e mostra erro com opção de restaurar backup.
- Versão maior que a suportada → erro "dados de uma versão mais nova do aplicativo", sem gravar.
- Versão menor → `migrations.js` aplica as migrações em sequência; antes de migrar, guarda uma cópia em `vtm:data:backup:v<versão>`.
- Cada item é desserializado pelo `domain/`; itens inválidos são separados e listados num aviso, nunca apagados em silêncio.
- Escrita: serializa, grava, trata `QuotaExceededError` com mensagem clara.

### 7.3 Backup, exportação e importação

- **Exportar:** baixa um arquivo `.json` com o documento inteiro (`application/json`), gerado com `Blob` + link de download.
- **Importar backup:** lê o arquivo como texto, `JSON.parse` (nunca `eval`), valida versão e estrutura pelo `domain/`, mostra resumo (quantos jogadores, partidas, rascunhos) e pede confirmação antes de substituir. Antes de substituir, guarda o estado atual em `vtm:data:backup:before-import`.
- **Importar dados do sistema Java (D13):** aceita o JSON salvo de `GET /jogadores` e `GET /sorteios` e converte com `javaDataImport` (UUIDs preservados, para manter os vínculos entre jogadores e partidas e, portanto, o delta).
- Os dados nunca são apagados automaticamente; toda ação destrutiva pede confirmação.

### 7.4 Interface pronta para backend

As fachadas expõem funções assíncronas (`async loadAll()`, `async savePlayers(players)` etc.), mesmo que hoje sejam síncronas por dentro. Trocar `localStorage` por uma API REST no futuro significa reescrever só `storage/`.

---

## 8. Gerenciamento de estado

- `AppDataProvider` (Context + `useReducer`) carrega o documento na inicialização e mantém `{ status: 'loading' | 'ready' | 'error', players, matches, drafts, settings, preferences, warnings }`.
- Hooks por assunto (`usePlayers`, `useMatches`, `useDrafts`) expõem dados e ações; dados derivados (scores, estatísticas, jogador do mês) são calculados com `useMemo` a partir de `services/`, nunca armazenados.
- Estado de tela (busca, filtros, seleção em andamento, modo de troca) fica no `useState` da página. A seleção de "Novo Sorteio" fica no Provider para não se perder ao navegar.
- O estado nunca é modificado diretamente; reducers e serviços devolvem objetos novos. Listas usam `id` como `key`, nunca o índice.
- Sincronização entre abas: o Provider escuta o evento `storage` e recarrega o documento (evita uma aba sobrescrever a outra).

---

## 9. Páginas e navegação

As telas seguem as do sistema atual. Não haverá "Dashboard", "Partida atual" nem "Configurações de pesos", porque não existem no Java; a única tela nova é **Dados e backup**, exigida pelas instruções de segurança dos dados.

| Rota | Página | Equivale a | Principais componentes |
|---|---|---|---|
| `/` | redireciona para `/jogadores` | `App.jsx` | — |
| `/jogadores` | `PlayersStatsPage` ("Meus Jogadores") | `Jogadores.jsx` | `PlayerOfMonthBanner`, `PlayerFilters`, `PlayerStatsCard`, `RatingsTable`, `RecentMatches` |
| `/jogadores/editar` | `ManagePlayersPage` ("Editar Jogadores") | `EditarJogadores.jsx` | `PlayerFilters`, `PlayerCard`, `PlayerForm`, `RatingInput`, `WeightsPanel`, `PlayerImport` |
| `/sorteio/novo` | `NewDrawPage` ("Novo Sorteio") | `NovoSorteio.jsx` | `QuickActions`, `PlayerFilters`, `SelectablePlayerCard`, `SelectionCounter` |
| `/sorteio/resultado` e `/sorteio/resultado/:draftId` | `DrawResultPage` | `Resultado.jsx` (rascunho) | `TeamColumn`, `SwapPanel`, `DraftSidebar`, `DifferenceBadge` |
| `/rascunhos` | `DraftsPage` | `Rascunhos.jsx` | `DraftCard` |
| `/historico` | `HistoryPage` | `Historico.jsx` | `MatchListItem`, `ScoreForm`, `DateEditor` |
| `/historico/:matchId` | `MatchDetailsPage` | `Resultado.jsx` (somente leitura) | `TeamColumn` |
| `/dados` | `DataPage` ("Dados e backup") | — (novo) | `ExportBackup`, `ImportBackup`, `ImportJavaData`, `StorageStatus` |
| `*` | `NotFoundPage` | — | — |

Navegação: barra superior em telas largas e barra inferior fixa no celular (Jogadores, Editar, Sortear, Histórico, Mais → Rascunhos e Dados), com o contador de rascunhos atualizado pelo estado (corrige o contador que hoje só atualiza ao recarregar). As URLs passam a usar a ordem "assunto/ação"; os nomes em português continuam visíveis na interface.

Componentes comuns: `ConfirmDialog` (substitui `window.confirm`, acessível por teclado), `Toast`/`FeedbackMessage` (sucesso e erro), `EmptyState`, `FieldError`, `PageHeader`. Formulários com `<label>` associado, mensagens ligadas por `aria-describedby`, foco visível, alvos de toque de pelo menos 44 px. Visual: identidade azul-escuro/laranja do app atual, cartões, contraste alto para uso em quadra.

---

## 10. Erros (`src/utils/errors.js`)

| Classe | Uso | Equivalente Java |
|---|---|---|
| `ValidationError` (com `fieldErrors`) | dados inválidos de formulário/importação | 400 `VALIDACAO` |
| `BusinessRuleError` | regra violada (nome duplicado, 14/2, levantador fora da seleção) | 422 `REGRA_NEGOCIO` |
| `NotFoundError` | id inexistente | 404 |
| `StorageError` (`code`: `CORRUPTED`, `QUOTA`, `VERSION_TOO_NEW`, `UNAVAILABLE`) | problemas de armazenamento | — |

As mensagens ao usuário reaproveitam os textos do sistema atual, com acentuação corrigida.

---

## 11. Estratégia de testes

- **Vitest em ambiente Node** para `domain/`, `services/` e `storage/` (com `Storage` em memória). Meta: todas as regras R1–R14 cobertas antes de qualquer tela.
- **Equivalência com o Java** (Etapa 6, registrada em `docs/equivalence-tests.md`):
  - valores numéricos exatos para score, delta e jogador do mês, calculados à mão a partir das fórmulas e conferidos contra o Java quando o backend estiver rodando;
  - porte das propriedades do `SorteioServiceTest` (30 cenários com semente fixa): 7+7 sem repetição, 1 levantador titular por time, 6 titulares + 1 reserva, reserva = menor score de linha, `difference = |A − B|`;
  - propriedades adicionais: a diferença escolhida fica a no máximo 0,05 da menor possível (verificado por força bruta), equilíbrio de mulheres e fallback;
  - casos de borda pedidos: notas ausentes, nomes duplicados, menos/mais que 14, sem levantador, vitória, derrota, empate, 0×0, exclusão de partida, edição de data, limites 0 e 10, histórico vazio, dados inválidos no armazenamento.
- **ESLint** sem avisos é parte do critério de pronto de cada etapa.
- Scripts: `npm run dev`, `npm run test` (`vitest run`), `npm run test:watch`, `npm run lint`, `npm run build`, `npm run preview`.

---

## 12. Estratégia de migração

1. **Etapa 3:** criar o projeto novo do zero (D14). A pasta antiga `volleyball-team-manager-web` no seu computador será renomeada para `volleyball-team-manager-web-anterior` (para isso vou pedir acesso à pasta `Projetos`), e o Git é iniciado só na pasta nova. O repositório no GitHub precisa ser criado por você; depois eu conecto e faço o push.
2. **Etapa 4:** `domain/` + testes + `docs/data-models.md`.
3. **Etapa 5:** serviços na ordem `ratingCalculator` → `ratingDelta` → `teamBalancer` → `teamSwap` → `selectionService` → `draftService` → `matchService` → `playerStatistics` → `playerService` → `import/*`, com `docs/business-rules.md`.
4. **Etapa 6:** testes de equivalência + `docs/equivalence-tests.md`.
5. **Etapa 7:** `storage/`, backup e importação dos dados do Java.
6. **Etapa 8:** telas na ordem do fluxo (Editar Jogadores → Novo Sorteio → Resultado/Rascunhos → Histórico → Meus Jogadores → Dados).
7. Durante a transição o sistema Java continua sendo o oficial; a versão web só substitui depois que os dados forem importados e os resultados conferidos lado a lado.

Commits pequenos, um assunto por commit (`docs:`, `chore:`, `feat:`, `test:`, `fix:`).

---

## 13. Hospedagem e evolução futura

| Evolução | Onde muda |
|---|---|
| Backend Node.js + API REST | só `storage/` (fachadas assíncronas viram chamadas `fetch`); serviços podem ser reutilizados no servidor, pois não dependem do navegador |
| Banco de dados | no backend; o formato de `domain/` vira o contrato da API |
| Autenticação | novo `AuthProvider` em `hooks/` + rotas protegidas; nenhuma mudança em `services/` |
| Sincronização entre dispositivos | `storage/` passa a usar `updatedAt` dos registros para resolver conflitos |
| PWA (D12) | adicionar `vite-plugin-pwa` e o manifesto atual; os dados já são locais, então funciona offline |
| Hospedagem online | build estático (`dist/`). Com `BrowserRouter`, o servidor precisa redirecionar rotas para `index.html` (Netlify e Vercel fazem com uma regra; no GitHub Pages seria preciso `HashRouter` ou uma página 404 de redirecionamento). `crypto.randomUUID()` exige HTTPS ou localhost |
| Configurar pesos pela interface | `settings` já está no documento salvo; faltaria só a tela (funcionalidade nova, precisa de aprovação) |

---

## 14. Pontos que dependem das dúvidas da análise

| Dúvida | Impacto na arquitetura |
|---|---|
| D3 (folga 0,05) | apenas o valor `settings.draw.tieTolerance` |
| D4 (mulheres com reserva) | uma linha em `teamBalancer` |
| D5 (descartar `evolucao`) | campo não existe em `Player`; o importador do Java o ignora |
| D8 (desfazer) | `Draft.originalLineup` já previsto |
| D9 (troca manual) | só `teamSwap` |
| D10 (jogador do mês) | parâmetro opcional de período em `selectPlayerOfMonth` |
| D11 (XLSX ou CSV) | só `spreadsheetReader` e a dependência `xlsx` |
| D12 (PWA) | plugin no `vite.config.js` |
| D13 (dados do H2) | `javaDataImport` + tela Dados |
| D15 (defeitos P1–P9) | funções específicas em `playerService`, `playerImport`, `selectionService`, `matchService` |
