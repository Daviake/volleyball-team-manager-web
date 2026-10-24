# Modelos de Dados

> **Etapa 4.** Implementação em `src/domain/`, testes em `src/tests/domain/`.
> Referência: `java-project-analysis.md`, seção 5. As diferenças em relação ao Java estão marcadas com **[DIFERENÇA]** e resumidas no fim.

## Convenções

- Objetos JavaScript simples, sem classes, compatíveis com `JSON.stringify`/`JSON.parse`.
- Nomes de campos em inglês; textos para o usuário em português.
- Cada modelo oferece:
  - `normalize*` — converte a entrada (formulário, planilha, armazenamento) para o formato do modelo, sem validar;
  - `validate*` — devolve `{ "caminho.do.campo": "mensagem" }`; objeto vazio = válido;
  - `create*` — aplica padrões, gera id e datas e lança `ValidationError` se algo estiver inválido;
  - `serialize*` — devolve uma cópia em formato canônico, pronta para JSON;
  - `deserialize*` — lê dados salvos e devolve `{ ok: true, value }` ou `{ ok: false, errors }`, **sem lançar erro e sem inventar valores**.
- Ids são UUID v4 gerados por `crypto.randomUUID()` (`src/utils/ids.js`), como o `UUID.randomUUID()` do Java. Ids recebidos são preservados (necessário para importar os dados do Java sem perder os vínculos).
- Datas são textos ISO-8601 em UTC (`2026-10-24T12:00:00.000Z`), equivalentes ao `Instant` do Java.
- Funções que dependem do relógio ou de ids recebem `{ now, createId }` opcionais, para os testes serem determinísticos.

## Player — `src/domain/player.js` (Java: `Jogador`)

| Campo | Tipo | Padrão em `createPlayer` | Obrigatório | Validação | Java |
|---|---|---|---|---|---|
| `id` | string | gerado | sim | texto não vazio | `id` (UUID) |
| `name` | string | — | sim | não vazio após `trim` | `nome` |
| `prefersSetter` | boolean | `false` | sim | booleano | `levantador` (só preferência) |
| `isMonthly` | boolean | `true` | sim | booleano | `mensalista` (`null` = `true`) |
| `isWoman` | boolean | `false` | sim | booleano | `mulher` (`null` = `false`) |
| `ratings.attack` | number | 5 | sim | finito, 0 ≤ x ≤ 10, decimais livres | `ataque` |
| `ratings.defense` | number | 5 | sim | idem | `defesa` |
| `ratings.serve` | number | 5 | sim | idem | `saque` |
| `ratings.setting` | number | 5 | sim | idem | `levantamento` |
| `ratings.blocking` | number | 5 | sim | idem | `bloqueio` |
| `ratings.consistency` | number | 5 | sim | idem | `constancia` |
| `createdAt` | string ISO \| null | agora | não | data válida | — **[DIFERENÇA]** novo |
| `updatedAt` | string ISO \| null | agora | não | data válida | — **[DIFERENÇA]** novo |

- Notas aceitam texto com ponto ou vírgula (`"7,5"`), como a importação de planilha do Java. Valores fora de 0–10 são **rejeitados**, não ajustados (o ajuste ao limite do campo `NotaInput` é comportamento da tela e fica para a Etapa 8).
- `updatePlayerData(player, changes)` aplica alterações parciais, preservando `id` e `createdAt` e atualizando `updatedAt`.
- `deserializePlayer` aplica os padrões dos três marcadores (como os getters do Java), aceita datas ausentes (dados vindos do Java não têm datas), mas **rejeita** jogador salvo sem alguma nota.
- A regra de nome único (R4) envolve a lista de jogadores e fica em `services/playerService` (Etapa 5); a chave de comparação é `nameKey` em `src/utils/text.js` (`trim().toLowerCase()`, igual ao Java).
- Não migrado: `evolucao` (sempre 0 no Java atual; dúvida D5).

## TeamSlot e Lineup — `src/domain/team.js` (Java: `JogadorResultado` e os campos de time do `Sorteio`)

**TeamSlot** — uma posição num time.

| Campo | Tipo | Validação | Java |
|---|---|---|---|
| `playerId` | string | não vazio | `jogadorId` |
| `playerName` | string | não vazio | `nome` (cópia congelada) |
| `isSetter` | boolean | booleano | `levantador` (papel **neste** sorteio) |
| `isStarter` | boolean | booleano | `titular` (`false` = reserva) |
| `score` | number | 0 ≤ x ≤ 10 | `score` (congelado no momento do sorteio) |

**Time** (`validateTeam`): exatamente 7 posições, jogadores distintos, 6 titulares, exatamente 1 levantador e ele titular (logo, o reserva nunca é levantador). São as mesmas verificações do `SorteioServiceTest`.

**Lineup** (`validateLineup`): `{ teamA, teamB, averageA, averageB, difference }`. Os dois times válidos e sem jogadores em comum; médias e diferença números ≥ 0; `difference` igual a `|averageA − averageB|` (tolerância 1e-6). Se as médias correspondem aos titulares é regra de cálculo e será conferido pelos serviços (Etapa 5).

## Match — `src/domain/match.js` (Java: `Sorteio` confirmado)

| Campo | Tipo | Padrão em `createMatch` | Validação | Java |
|---|---|---|---|---|
| `id` | string | gerado | não vazio | `id` |
| `playedAt` | string ISO | agora | data válida | `data` |
| `playerIds` | string[] | — | 14 ids distintos, os mesmos dos dois times | `jogadoresIdsJson` |
| `teamA`, `teamB` | TeamSlot[] | — | ver Lineup | `timeAJson`, `timeBJson` (texto JSON) |
| `averageA`, `averageB`, `difference` | number | — | ver Lineup | `mediaTimeA`, `mediaTimeB`, `diferenca` |
| `score` | `{ setsA, setsB }` \| null | `null` | inteiros ≥ 0 | `setsTimeA`, `setsTimeB` |
| `createdAt`, `updatedAt` | string ISO \| null | agora | data válida | — **[DIFERENÇA]** novo |

- `getMatchResult(match)` → `"TEAM_A" | "TEAM_B" | "DRAW" | null`, derivado do placar (empate inclusive em 0×0). **[DIFERENÇA]** O Java grava `resultado`; aqui ele é sempre calculado, porque no Java ele é sempre igual ao derivado.
- `createMatch` **valida o conteúdo** da escalação. **[DIFERENÇA]** Corrige o P7: o `POST /sorteios/confirmar` do Java aceitava qualquer conteúdo.
- Não migrado: `evolucaoAplicadaJson` (nunca escrito no Java atual; D5).

## Draft e pedido de sorteio — `src/domain/draft.js` (Java: item de `localStorage["rascunhos"]` e `SorteioRequest`)

**Pedido** (`validateDrawRequest`): `{ playerIds, setterIds }` — 14 ids distintos e 2 ids distintos contidos nos 14. Mensagens iguais às do Java ("É necessário selecionar exatamente 14 jogadores." etc.).

**Draft**

| Campo | Tipo | Validação | Java (`rascunhos`) |
|---|---|---|---|
| `id` | string | não vazio | `id` |
| `createdAt` | string ISO | data válida | `criadoEm` |
| `request` | pedido | ver acima | `pedidoOriginal` (`jogadoresIds`, `levantadorIds`) |
| `lineup` | Lineup | válida e só com jogadores do pedido | `sorteio` (sem `id`/`data`) |
| `originalLineup` | Lineup | idem | — **[DIFERENÇA]** novo, para a dúvida D8 |
| `edited` | boolean | booleano | equivale ao estado "Alterado manualmente" da tela |

`createDraft` guarda `originalLineup` igual a `lineup`. `deserializeDraft` aceita rascunhos sem `originalLineup` (usa `lineup`) e sem `edited` (`false`). O limite de 5 rascunhos é regra de lista e fica em `services/draftService` (Etapa 5).

## Settings — `src/domain/settings.js`

`DEFAULT_SETTINGS` (congelado) reúne as constantes do Java: pesos do score (linha e levantador, divisor 10), limites das notas (0–10, passo 0,1, padrão 5), parâmetros do sorteio (14, 2, 7, 6 titulares, folga 0,05, epsilon 1e-9), delta elástico (0,05 e 0,3), pesos do jogador do mês (0,25 cada), máximo de rascunhos (5) e quantidade de últimos jogos (5).

Nada é editável na primeira versão (o Java não tem configuração). `deserializeSettings` completa o que faltar com o padrão e troca valores inválidos pelo padrão com um aviso, sem bloquear o carregamento.

## Relacionamentos

```
Player 1 ── * TeamSlot (por playerId; nome e score copiados)
Match  1 ── 2 times de 7 TeamSlot
Draft  1 ── 1 pedido + 2 Lineups (atual e original)
```

Não há chave estrangeira: excluir um jogador não altera partidas nem rascunhos (comportamento do Java, R3).

## Resumo das diferenças em relação ao Java

| # | Diferença | Motivo |
|---|---|---|
| 1 | Nome gravado sem espaços nas pontas | Corrige P1 (D15) |
| 2 | Partida validada ao ser criada | Corrige P7 (D15) |
| 3 | `createdAt`/`updatedAt` em jogadores e partidas | Preparação para sincronização futura; não muda regras |
| 4 | `result` derivado, não gravado | Evita dado redundante; mesmo valor do Java |
| 5 | `evolucao` e `evolucaoAplicadaJson` não existem | Campos sem uso no Java atual (D5) |
| 6 | Rascunho com `originalLineup` e `edited` | Permite decidir D8 sem mudar o formato |
| 7 | Nota ausente em `createPlayer` vira 5 | Igual ao formulário e à importação do Java; só a API Java gravava 0 quando o campo faltava (P2), caminho que nenhuma tela usa |
