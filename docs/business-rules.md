# Regras de Negócio

> **Etapa 5.** Implementação em `src/services/`, testes em `src/tests/services/`.
> Referência: `java-project-analysis.md`, seção 4 (regras R1–R16, problemas P1–P10, dúvidas D1–D16).
> Diferenças em relação ao Java estão marcadas com **[DIFERENÇA]** e resumidas no fim. Comportamentos mantidos de propósito, à espera de decisão, estão marcados com **[MANTIDO]**.

## Convenções

- Todos os serviços são funções puras: recebem os dados (listas de jogadores, partidas, rascunhos) e devolvem dados novos. Nunca alteram o que receberam e nunca acessam o `localStorage`.
- Relógio e aleatoriedade são recebidos por parâmetro (`now`, `random`, `createId`), com padrões em `src/utils/`. O ESLint proíbe `Math.random` e `Date.now` dentro de `services/`.
- Erros: `ValidationError` (dado inválido, com `fieldErrors`), `BusinessRuleError` (regra violada, ex.: nome repetido) e `NotFoundError` (id inexistente). Equivalem aos códigos 400, 422 e 404 da API Java.
- As constantes vêm de `DEFAULT_SETTINGS` (`src/domain/settings.js`), com os mesmos valores do Java.
- Mensagens para o usuário em português, iguais às do Java quando existiam.

## Mapa de serviços

| Serviço | Funções | Regras | Java de origem |
|---|---|---|---|
| `ratingCalculator.js` | `calculateScore`, `calculateHitterScore`, `calculateSetterScore`, `calculatePreferredRoleScore` | R5 | `ScoreService` |
| `ratingDelta.js` | `countSets`, `calculateDeltaFromSets`, `calculateDelta`, `adjustRatings` | R8 | `SorteioService.calcularDeltaNota` e `EstatisticasService.buildStats` |
| `teamBalancer.js` | `generateTeams`, `scorePlayersForDraw`, `enumerateCandidates`, `filterByWomenBalance`, `selectEligibleCandidates`, `combinations` | R6 (validação), R7 | `SorteioService.calcular`, `montarCandidato`, `combinacoes` |
| `teamSwap.js` | `swapPlayers`, `calculateTeamAverage`, `withAverages` | R12 | `Resultado.trocarJogadores`, `calcMediaTime` |
| `selectionService.js` | `toggleSelection`, `toggleSetter`, `clearSelection`, `selectLastLineup`, `selectMonthly`, `autoComplete`, `filterAndSortPlayers`, `getSelectionError`, `sortPlayersByName`, `toDrawRequest` | R6 | `NovoSorteio.jsx` |
| `draftService.js` | `addDraft`, `findDraft`, `getActiveDraft`, `updateDraftLineup`, `redrawDraft`, `restoreOriginalLineup`, `removeDraft` | R11 | `NovoSorteio.sortear`, `Resultado.jsx`, `Rascunhos.jsx` |
| `matchService.js` | `confirmDraft`, `setScore`, `changeDate`, `removeMatch`, `findMatch`, `sortByDateDesc` | R9, R10 | `SorteioService.confirmar`, `registrarPlacar`, `atualizarData`, `excluir`, `listarHistorico` |
| `playerStatistics.js` | `collectGamesByPlayer`, `buildPlayerStats`, `buildAllStats`, `selectPlayerOfMonth`, `preferredAdjustedScore` | R13 | `EstatisticasService` |
| `playerService.js` | `addPlayer`, `updatePlayer`, `removePlayer`, `findPlayer`, `isNameTaken`, `assertUniqueName` | R1–R4 | `JogadorService` |
| `import/playerImport.js` | `parseRows`, `previewImport`, `applyImport`, `normalizeHeader`, `normalizeImportMode`, `TEMPLATE_ROWS` | R14 | `ImportarJogadores.jsx`, `JogadorService.importar` |
| `import/javaDataImport.js` | `convertJavaExport` | D13 | (novo) respostas de `GET /jogadores` e `GET /sorteios` |
| `utils/random.js` | `defaultRandom`, `seededRandom`, `randomIndex` | R7 | `ThreadLocalRandom.nextInt` |

---

## R1–R4. Cadastro, edição, exclusão e nome único — `playerService.js`

- **Criar** (`addPlayer`): usa `createPlayer` do domínio. Notas não informadas = 5; `prefersSetter` = não; `isMonthly` = sim; `isWoman` = não. **[DIFERENÇA]** Nome gravado sem espaços nas pontas (P1).
- **Nome único** (`assertUniqueName`): compara com `trim().toLowerCase()`; acentos contam ("José" ≠ "Jose"). Erro: `Já existe um jogador com o nome "X".` Na edição, o próprio jogador é ignorado.
- **Editar** (`updatePlayer`): alterações parciais; `id` e `createdAt` preservados; `updatedAt` atualizado. Não mexe no histórico (os times salvos guardam o score do momento), mas muda o delta, porque o fator elástico usa as notas atuais.
- **Excluir** (`removePlayer`): remove só o jogador. Partidas antigas continuam com o nome e o id dele; as estatísticas dele deixam de ser calculadas. A confirmação é responsabilidade da tela.

## R5. Score ponderado — `ratingCalculator.js`

```
linha      = (3·ataque + 3,5·defesa + 2·saque + 0,5·bloqueio + 1·constância) / 10
levantador = (1·ataque + 2·defesa + 5·levantamento + 1·bloqueio + 1·constância) / 10
```

- `isSetter` é o papel **do sorteio**; `calculatePreferredRoleScore` usa a preferência do cadastro.
- Sem arredondamento. As parcelas são somadas na mesma ordem do Java; as de peso zero somam exatamente 0, então o resultado é **idêntico bit a bit** (há teste comparando com a fórmula literal do Java).
- Exemplo testado: A=7, D=6, S=5, L=3, B=5, C=8 → linha **6,25**, levantador **4,70**.

## R8. Delta elástico — `ratingDelta.js`

```
setsGanhos/Perdidos = soma dos sets do time do jogador em todas as partidas com placar (titulares e reserva)
scoreBase           = score com as notas base, no papel PREFERIDO          [MANTIDO, D6]
fator               = (scoreBase − 5) / 5
ganhoPorSet         = 0,05 × (1 − 0,3 × fator)
perdaPorSet         = 0,05 × (1 + 0,3 × fator)
delta               = setsGanhos × ganhoPorSet − setsPerdidos × perdaPorSet
notaAjustada        = clamp(notaBase + delta, 0, 10)   (o mesmo delta nas 6 notas)
```

- **[DIFERENÇA]** Uma única implementação, usada pelo sorteio e pelas estatísticas (no Java a fórmula está duplicada).
- **[DIFERENÇA]** P6 corrigido: não há leitura de JSON que falhe em silêncio. As partidas chegam validadas pelo domínio; uma partida inválida é rejeitada (com mensagem) ao ser lida, não ignorada.
- As notas base nunca mudam; o delta é sempre recalculado do histórico. Placar 0×0 não altera nada. Exemplo testado: score 7, 3 sets ganhos e 1 perdido → **+0,076**.

## R6. Seleção dos participantes — `selectionService.js`

A seleção é `{ playerIds, setterIds }`, na ordem em que os jogadores foram marcados. As funções devolvem `{ selection, warning }`.

| Ação | Regra |
|---|---|
| Marcar (`toggleSelection`) | Bloqueia o 15º com `Você já selecionou 14 jogadores. Desmarque algum para trocar.` Quem costuma levantar já entra como levantador hoje se houver vaga (máx. 2). |
| Desmarcar | Sai também dos levantadores. |
| Levantador hoje (`toggleSetter`) | Máximo 2. Só para quem está selecionado (no Java a opção só aparece para selecionados). |
| Últimos 14 (`selectLastLineup`) | Partida mais recente por data; só jogadores ainda cadastrados; levantadores = os daquela partida. Avisos do Java para histórico vazio e para menos de 14. |
| Mensalistas (`selectMonthly`) | **Substitui** a seleção. 2 primeiros mensalistas levantadores (ordem alfabética) como levantadores; depois mensalistas de linha; depois os demais mensalistas levantadores, sem marcá-los. Aviso se ficar abaixo de 14. |
| Completar (`autoComplete`) | **Mantém** a seleção. Garante 2 levantadores com quem costuma levantar; completa até 14 priorizando a linha (ordem alfabética em cada grupo). **[DIFERENÇA]** P4 corrigido: na segunda fase, quem costuma levantar só vira levantador hoje se houver vaga. **[DIFERENÇA]** P10 corrigido (D16, decidido por Davi em 24/10/2026): a seleção nunca passa de 14. Primeiro são marcados como levantador hoje os já selecionados que costumam levantar (não ocupam vaga); depois entram jogadores novos que costumam levantar, só se houver vaga. Se ainda faltar levantador: `Faltam N levantador(es). Marque manualmente quem vai levantar hoje.` |
| Lista (`filterAndSortPlayers`) | Busca "contém", sem diferenciar maiúsculas e com acentos; filtros por preferência e mensalista; selecionados primeiro, depois ordem alfabética. |
| Validação (`getSelectionError`) | Mensagens do Java: `Selecione mais N jogador(es).`, `Você selecionou jogadores demais (N/14).`, `É necessário selecionar exatamente 2 levantadores.`, `Você selecionou levantadores demais.` |

Ordem alfabética: `localeCompare` com `pt-BR` fixo (no Java, o idioma do navegador).

## R7. Sorteio equilibrado — `teamBalancer.js`

`generateTeams({ players, request, matches, settings, random })` devolve uma escalação `{ teamA, teamB, averageA, averageB, difference }`.

1. Valida o pedido (`validateDrawRequest`: 14 distintos, 2 levantadores distintos entre eles) → `ValidationError`. Jogador inexistente → `NotFoundError`.
2. Score ajustado de cada jogador: notas + delta (R8), no papel do sorteio.
3. Levantadores e jogadores de linha na **ordem do pedido**. Para as 2 posições dos levantadores × as 924 combinações de 6 jogadores de linha para o time A (ordem lexicográfica, igual a `combinacoes`): **1.848 candidatos**.
4. Em cada time: ordenação estável crescente por score; o primeiro é o reserva; média = (5 titulares de linha + levantador) / 6, somados na ordem do Java. Time = levantador, titulares em ordem crescente, reserva.
5. Filtro de mulheres: time A com `floor(n/2)` a `ceil(n/2)` mulheres, **contando o reserva** **[MANTIDO, D4]**; se nenhum candidato passar, usa todos.
6. Elegíveis: `diferença ≤ menor + 0,05 + 1e-9` **[MANTIDO, D3]**.
7. Escolha: `eligible[Math.floor(random() * eligible.length)]`, equivalente ao `nextInt` do Java. Com `seededRandom(semente)` o resultado é reproduzível.

**Nota de equivalência:** o Java usa a ordem em que o banco devolve os jogadores (`findAllById`, sem ordem garantida); aqui a ordem é a do pedido, o que torna o resultado determinístico para uma mesma semente. Só afeta qual jogador vira reserva em caso de score exatamente igual e a ordem de enumeração; o conjunto de candidatos é o mesmo.

## R12. Troca manual — `teamSwap.js`

- Um jogador do A e um do B trocam de lugar. `isStarter` e `isSetter` ficam na posição; `playerId`, `playerName` e `score` acompanham o jogador.
- Médias recalculadas como média dos titulares (0 se não houver), e `difference = |A − B|`.
- **[MANTIDO, D9 / P8]** O score não é recalculado pelo novo papel: um jogador de linha que ocupa a posição de levantador leva o score de linha. A regra "reserva = menor score" deixa de valer após trocas, como no Java.

## R11. Rascunhos — `draftService.js`

- `addDraft`: novo rascunho no início; lista cortada em 5. **[DIFERENÇA, só informativa]** Os descartados são devolvidos em `discarded`, para a tela poder avisar; a regra de corte é a mesma.
- `updateDraftLineup`: grava cada troca manual no rascunho e marca `edited`. Com a interpretação atual da **D8**, "desfazer alterações" volta a este último estado salvo (no Java isso, na prática, não desfaz nada, porque cada troca já foi gravada).
- `restoreOriginalLineup`: volta à escalação do sorteio. Fica disponível caso a resposta da D8 seja "voltar ao sorteio original"; nenhuma tela a usa por enquanto.
- `redrawDraft` ("Sortear de novo"): substitui o rascunho ativo (não cria outro) e atualiza a data, como no Java.
- `getActiveDraft`: o rascunho pedido ou, sem id, o mais recente. `removeDraft`: remove e indica o próximo a abrir.

## R9, R10. Partidas — `matchService.js`

- `confirmDraft`: grava exatamente a escalação atual do rascunho (inclusive trocas), data = agora, e remove o rascunho. **[DIFERENÇA]** P7 corrigido: o conteúdo é validado por `createMatch` (7 por time, 6 titulares, 1 levantador titular, jogadores distintos, médias coerentes).
- `setScore`: registra ou corrige (sobrescreve). Dois inteiros ≥ 0 obrigatórios; empate aceito, inclusive 0×0 **[MANTIDO, D7]**. Não é possível voltar para "sem placar". O resultado é sempre derivado do placar.
- `changeDate`: data obrigatória e válida; gravada em ISO/UTC.
- `removeMatch`: exclui; a influência no delta some junto. A confirmação é da tela.
- `sortByDateDesc`: histórico do mais recente para o mais antigo.

## R13. Estatísticas e jogador do mês — `playerStatistics.js`

- Por jogador: `setsWon`, `setsLost`, `setBalance`, `winRate` (aproveitamento por **sets**, em %; 0 sem sets), `delta`, `gainPerSet`, `lossPerSet`, notas ajustadas, scores ajustados de linha e de levantador e `recentGames` (até 5, mais recentes primeiro, com `WIN`/`LOSS`/`DRAW`). Só partidas com placar contam.
- **Jogador do mês:** elegíveis = quem disputou ao menos 1 set. Pontuação = 0,25·norm(winRate) + 0,25·norm(saldo) + 0,25·norm(delta) + 0,25·norm(score ajustado no papel preferido), min-max (0,5 quando todos iguais). Maior vence; em empate exato, o primeiro da lista. **[MANTIDO, D10]** Usa todo o histórico, sem filtro de mês.
- Nada é gravado: as estatísticas são sempre derivadas.

## R14. Importação de planilha — `import/playerImport.js`

**Leitura das linhas (`parseRows`)** — recebe as linhas já lidas do arquivo (`{ cabeçalho: valor }`):

- Cabeçalhos normalizados (minúsculas, sem acento, espaços → `_`). Colunas: `nome`, `ataque`, `defesa`, `saque`, `levantamento`, `bloqueio`, `constancia`, `levantador`, `mensalista`, `mulher`.
- Linha sem nome é ignorada com aviso. Nota com vírgula ou ponto; nota inválida ou fora de 0–10 descarta a linha. Booleanos: `sim, s, 1, true, x, yes` / `nao, não, n, 0, false, no`; outro valor descarta a linha. Célula vazia = não informado.
- **[DIFERENÇA]** P3 corrigido: nome repetido dentro da própria planilha descarta as repetições, com aviso indicando a linha original.
- **[DIFERENÇA]** Nota com texto após o número (`"7abc"`) é rejeitada; o `parseFloat` do Java a aceitava como 7.
- `TEMPLATE_ROWS`: linha de exemplo do modelo, identificada como **fictícia** (no Java era "João Silva").

**Modos (`previewImport` / `applyImport`)** — a prévia e a aplicação usam o mesmo plano, então nunca divergem:

| Modo | Nome já cadastrado | Nome novo |
|---|---|---|
| MESCLAR (padrão; também para modo desconhecido) | atualiza só os campos informados; o nome não muda | cria |
| ADICIONAR | ignora (listado em `ignored`) | cria |
| SUBSTITUIR | apaga todos e cria todos da planilha, com ids novos | cria |

- Novos jogadores: notas ausentes = 5, levantador = não, mensalista = sim, mulher = não.
- Resumo: `{ updated, added, ignored, errors, removed }`. Item inválido vai para `errors` sem interromper.
- **[DIFERENÇA]** P9: SUBSTITUIR continua apagando (as partidas antigas deixam de corresponder aos jogadores e as estatísticas se perdem, como no Java), mas exige `confirmReplace: true` e a prévia informa quantos jogadores serão apagados (`summary.removed`).
- **[DIFERENÇA]** Tudo ou nada: o serviço devolve a lista nova e só ela é gravada; não há estado parcial como na importação não transacional do Java.
- A leitura do arquivo (XLSX ou CSV) fica no adaptador `import/spreadsheetReader.js`, que **ainda não foi criado** porque depende da decisão **D11**.

## D13. Dados do sistema Java — `import/javaDataImport.js`

`convertJavaExport({ jogadores, sorteios })` converte as respostas de `GET /jogadores` e `GET /sorteios` da API Java em `{ players, matches, warnings }`:

- Ids preservados (vínculos, estatísticas e delta continuam iguais). Padrões do Java para `mensalista`/`mulher` nulos. Nomes aparados.
- Placar só quando os dois sets existem; `resultado`, `evolucao` e `scoreLinha` são ignorados (derivados ou sem uso).
- Registros inválidos ficam de fora, cada um com aviso. Nomes repetidos (possíveis no Java por P1/P3) são mantidos e avisados.
- A tela de importação desses dados e a gravação ficam para as Etapas 7 e 8.

---

## Dúvidas que afetam esta etapa

| # | Situação nesta etapa |
|---|---|
| D3 | Folga de 0,05 do código (não a diferença mínima exata do README) |
| D4 | Equilíbrio de mulheres conta o reserva |
| D6 | Fator elástico usa o papel preferido |
| D7 | 0×0 aceito |
| D8 | "Desfazer" volta ao último estado salvo; `restoreOriginalLineup` pronta caso a resposta mude |
| D9 | Troca manual mantém o score antigo (P8) |
| D10 | Jogador do mês usa todo o histórico |
| D11 | Adaptador de leitura XLSX/CSV não criado até a decisão |
| D16 | **Decidida (24/10/2026): corrigir.** "Completar automaticamente" nunca passa de 14 (P10 corrigido) |

## Resumo das diferenças em relação ao Java

| # | Diferença | Motivo |
|---|---|---|
| 1 | Nome aparado ao gravar | P1 (D15) |
| 2 | Delta com implementação única | Evita divergência entre sorteio e estatísticas; mesmo resultado |
| 3 | Partida inválida rejeitada com mensagem, não ignorada | P6 (D15) |
| 4 | "Completar" não passa de 2 levantadores | P4 (D15) |
| 5 | Confirmação valida o conteúdo | P7 (D15) |
| 6 | Nome repetido na planilha descartado com aviso | P3 (D15) |
| 7 | Nota com texto após o número rejeitada na planilha | Evita aceitar dado digitado errado |
| 8 | SUBSTITUIR exige confirmação explícita e informa quantos serão apagados | P9 (D15) |
| 9 | Importação tudo ou nada | Java não era transacional |
| 10 | Ordem dos jogadores no sorteio = ordem do pedido | Java dependia da ordem do banco; torna o resultado reproduzível |
| 11 | Rascunhos descartados pelo limite são informados ao chamador | Permite avisar; a regra de corte é a mesma |
| 12 | "Completar" nunca passa de 14 e marca primeiro os já selecionados | P10 (D16) |
