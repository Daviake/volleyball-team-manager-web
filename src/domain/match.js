import { nowIso, toIsoDate } from "../utils/dates.js";
import { generateId, hasUniqueIds, isValidId } from "../utils/ids.js";
import { isNonNegativeInteger } from "../utils/numbers.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { lineupPlayerIds, serializeLineup, validateLineup } from "./team.js";
import { assertValid, fail, hasErrors, isPlainObject, ok } from "./validation.js";

/** Java: enum ResultadoSorteio (TIME_A, TIME_B, EMPATE). */
export const MATCH_RESULT = Object.freeze({
  TEAM_A: "TEAM_A",
  TEAM_B: "TEAM_B",
  DRAW: "DRAW"
});

/**
 * Resultado derivado do placar de sets, como em SorteioService.registrarPlacar:
 * A > B vence A, B > A vence B, iguais é empate (inclusive 0×0). Sem placar, `null`.
 */
export function getMatchResult(match) {
  if (!match.score) return null;
  const { setsA, setsB } = match.score;
  if (setsA === setsB) return MATCH_RESULT.DRAW;
  return setsA > setsB ? MATCH_RESULT.TEAM_A : MATCH_RESULT.TEAM_B;
}

/** Placar opcional: `null` (ainda não registrado) ou dois inteiros ≥ 0 (Java: PlacarRequest). */
export function validateScore(score) {
  if (score === null) return {};
  if (!isPlainObject(score)) return { score: "O placar deve ter os sets dos dois times." };
  const errors = {};
  if (!isNonNegativeInteger(score.setsA)) errors["score.setsA"] = "Os sets do Time A devem ser um número inteiro maior ou igual a zero.";
  if (!isNonNegativeInteger(score.setsB)) errors["score.setsB"] = "Os sets do Time B devem ser um número inteiro maior ou igual a zero.";
  return errors;
}

/** Partida registrada no histórico (Java: Sorteio confirmado). */
export function validateMatch(match, { draw = DEFAULT_SETTINGS.draw } = {}) {
  if (!isPlainObject(match)) return { match: "A partida não é um objeto." };
  const errors = {};
  if (!isValidId(match.id)) errors.id = "O identificador é obrigatório.";
  if (toIsoDate(match.playedAt) === null) errors.playedAt = "Informe uma data válida.";
  Object.assign(errors, validateLineup(match, { draw }), validateScore(match.score));

  if (!Array.isArray(match.playerIds) || !match.playerIds.every(isValidId)) {
    errors.playerIds = "A lista de jogadores é inválida.";
  } else if (match.playerIds.length !== draw.playersPerDraw || !hasUniqueIds(match.playerIds)) {
    errors.playerIds = `A partida deve ter ${draw.playersPerDraw} jogadores distintos.`;
  } else if (!errors.lineup && Array.isArray(match.teamA) && Array.isArray(match.teamB)) {
    const inTeams = new Set(lineupPlayerIds(match));
    if (!match.playerIds.every((id) => inTeams.has(id)) || inTeams.size !== match.playerIds.length) {
      errors.playerIds = "Os jogadores da partida não correspondem aos dos times.";
    }
  }
  for (const field of ["createdAt", "updatedAt"]) {
    if (match[field] !== null && match[field] !== undefined && toIsoDate(match[field]) === null) errors[field] = "Data inválida.";
  }
  return errors;
}

/**
 * Cria uma partida a partir de uma escalação confirmada. Diferente do Java (P7), o conteúdo
 * é validado: times completos, levantadores, médias coerentes e jogadores sem repetição.
 */
export function createMatch({ id, playedAt, playerIds, lineup, score = null }, { now = nowIso(), createId = generateId } = {}) {
  const match = toCanonicalMatch({
    id: isValidId(id) ? id : createId(),
    playedAt: playedAt ?? now,
    playerIds: Array.isArray(playerIds) ? [...playerIds] : playerIds,
    ...(isPlainObject(lineup) ? lineup : {}),
    score,
    createdAt: now,
    updatedAt: now
  });
  assertValid(validateMatch(match), "Dados da partida inválidos.");
  return serializeMatch(match);
}

export function serializeMatch(match) {
  return {
    id: match.id,
    playedAt: toIsoDate(match.playedAt),
    playerIds: [...match.playerIds],
    ...serializeLineup(match),
    score: match.score ? { setsA: match.score.setsA, setsB: match.score.setsB } : null,
    createdAt: match.createdAt ? toIsoDate(match.createdAt) : null,
    updatedAt: match.updatedAt ? toIsoDate(match.updatedAt) : null
  };
}

export function deserializeMatch(raw) {
  if (!isPlainObject(raw)) return fail({ match: "A partida salva não é um objeto." });
  const match = toCanonicalMatch(raw);
  const errors = validateMatch(match);
  return hasErrors(errors) ? fail(errors) : ok(serializeMatch(match));
}

function toCanonicalMatch(source) {
  return {
    id: source.id,
    playedAt: source.playedAt,
    playerIds: source.playerIds,
    teamA: source.teamA,
    teamB: source.teamB,
    averageA: source.averageA,
    averageB: source.averageB,
    difference: source.difference,
    score: source.score ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null
  };
}
