import { validateDrawRequest } from "../domain/draft.js";
import { DEFAULT_SETTINGS } from "../domain/settings.js";
import { createTeamSlot } from "../domain/team.js";
import { assertValid } from "../domain/validation.js";
import { NotFoundError } from "../utils/errors.js";
import { defaultRandom, randomIndex } from "../utils/random.js";
import { calculateScore } from "./ratingCalculator.js";
import { adjustRatings, calculateDelta } from "./ratingDelta.js";

/**
 * Sorteio equilibrado (R7; Java: SorteioService.calcular).
 *
 * 1. Score ajustado de cada jogador (notas + delta elástico), no papel do sorteio.
 * 2. Para cada uma das 2 posições dos levantadores e cada uma das C(12,6) = 924 escolhas de
 *    jogadores de linha para o time A: 1.848 candidatos.
 * 3. Em cada time, o jogador de linha de menor score é o reserva; a média é a dos 6 titulares.
 * 4. Filtro de mulheres: o time A fica com floor(n/2) a ceil(n/2) mulheres, contando o reserva
 *    (dúvida D4); se nenhum candidato passar, usa todos.
 * 5. Elegíveis: diferença ≤ menor diferença + 0,05 (+1e-9) (dúvida D3).
 * 6. Um elegível é escolhido com o gerador `random` recebido.
 */
export function generateTeams({ players, request, matches = [], settings = DEFAULT_SETTINGS, random = defaultRandom }) {
  const scored = scorePlayersForDraw({ players, request, matches, settings });
  const candidates = enumerateCandidates(scored, settings);
  const eligible = selectEligibleCandidates(filterByWomenBalance(candidates, scored), settings);
  return toLineup(eligible[randomIndex(eligible.length, random)]);
}

/**
 * Valida o pedido e calcula o score ajustado de cada um dos 14 jogadores, na ordem do pedido.
 * Lança ValidationError (pedido inválido) ou NotFoundError (jogador não cadastrado).
 */
export function scorePlayersForDraw({ players, request, matches = [], settings = DEFAULT_SETTINGS }) {
  assertValid(validateDrawRequest(request, { draw: settings.draw }), "Pedido de sorteio inválido.");
  const byId = new Map(players.map((player) => [player.id, player]));
  const missing = request.playerIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new NotFoundError(`Jogador(es) não encontrado(s): ${missing.join(", ")}.`);
  }
  const setterIds = new Set(request.setterIds);
  return request.playerIds.map((id) => {
    const player = byId.get(id);
    const isSetter = setterIds.has(id);
    const { delta } = calculateDelta(player, matches, settings);
    const score = calculateScore(adjustRatings(player.ratings, delta, settings), isSetter, settings.weights);
    return { player, isSetter, score };
  });
}

/** Gera todos os candidatos na mesma ordem do Java. Exportado para os testes. */
export function enumerateCandidates(scored, settings = DEFAULT_SETTINGS) {
  const setters = scored.filter((entry) => entry.isSetter);
  const hitters = scored.filter((entry) => !entry.isSetter);
  const groupSize = hitters.length / 2;
  const candidates = [];
  for (const [setterA, setterB] of [
    [setters[0], setters[1]],
    [setters[1], setters[0]]
  ]) {
    for (const groupA of combinations(hitters, groupSize)) {
      const inA = new Set(groupA);
      const groupB = hitters.filter((entry) => !inA.has(entry));
      candidates.push(buildCandidate(setterA, setterB, groupA, groupB, settings));
    }
  }
  return candidates;
}

/** Mantém os candidatos com mulheres equilibradas; se nenhum servir, devolve todos (fallback do Java). */
export function filterByWomenBalance(candidates, scored) {
  const women = scored.filter((entry) => entry.player.isWoman).length;
  const min = Math.floor(women / 2);
  const max = Math.ceil(women / 2);
  const filtered = candidates.filter((candidate) => candidate.womenInTeamA >= min && candidate.womenInTeamA <= max);
  return filtered.length > 0 ? filtered : candidates;
}

/** Candidatos com diferença até `menor + tieTolerance` (com a margem `epsilon` do Java). */
export function selectEligibleCandidates(candidates, settings = DEFAULT_SETTINGS) {
  const { tieTolerance, epsilon } = settings.draw;
  const smallest = Math.min(...candidates.map((candidate) => candidate.difference));
  const threshold = smallest + tieTolerance;
  return candidates.filter((candidate) => candidate.difference <= threshold + epsilon);
}

/**
 * Monta um time: levantador, titulares de linha em ordem crescente de score e reserva(s) por
 * último. A ordenação é estável, como no Java: com scores iguais, fica como reserva quem
 * aparece primeiro no pedido.
 */
function buildTeam(setter, group, settings) {
  const reserves = settings.draw.playersPerTeam - settings.draw.starters;
  const sorted = [...group].sort((a, b) => a.score - b.score);
  const bench = sorted.slice(0, reserves);
  const starters = sorted.slice(reserves);
  // Mesma ordem de soma do Java: titulares de linha (crescente) e depois o levantador.
  let sum = 0;
  for (const entry of starters) sum += entry.score;
  sum += setter.score;
  return {
    slots: [toSlot(setter, true), ...starters.map((entry) => toSlot(entry, true)), ...bench.map((entry) => toSlot(entry, false))],
    average: sum / settings.draw.starters,
    women: [setter, ...group].filter((entry) => entry.player.isWoman).length
  };
}

function buildCandidate(setterA, setterB, groupA, groupB, settings) {
  const teamA = buildTeam(setterA, groupA, settings);
  const teamB = buildTeam(setterB, groupB, settings);
  return {
    teamA: teamA.slots,
    teamB: teamB.slots,
    averageA: teamA.average,
    averageB: teamB.average,
    difference: Math.abs(teamA.average - teamB.average),
    womenInTeamA: teamA.women
  };
}

function toSlot(entry, isStarter) {
  return createTeamSlot({
    playerId: entry.player.id,
    playerName: entry.player.name,
    isSetter: entry.isSetter,
    isStarter,
    score: entry.score
  });
}

function toLineup(candidate) {
  const { teamA, teamB, averageA, averageB, difference } = candidate;
  return { teamA, teamB, averageA, averageB, difference };
}

/** Combinações de `size` itens em ordem lexicográfica de posição (igual a `combinacoesRecursivo`). */
export function combinations(items, size) {
  const result = [];
  const current = [];
  const visit = (start) => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
    }
  };
  visit(0);
  return result;
}
