import { hasUniqueIds, isValidId } from "../utils/ids.js";
import { isFiniteNumber, nearlyEqual } from "../utils/numbers.js";
import { normalizeName } from "../utils/text.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { fail, hasErrors, isPlainObject, ok, prefixErrors } from "./validation.js";

/** Tolerância para conferir se `difference` corresponde às médias gravadas. */
const DIFFERENCE_TOLERANCE = 1e-6;

/**
 * Posição de um jogador num time (Java: JogadorResultado).
 * `playerName` e `score` são cópias congeladas do momento do sorteio: o histórico não muda
 * se o jogador for renomeado, tiver as notas editadas ou for excluído.
 * `isSetter` e `isStarter` pertencem à posição (na troca manual o jogador muda, a posição fica).
 */
export function createTeamSlot({ playerId, playerName, isSetter, isStarter, score }) {
  return {
    playerId,
    playerName: normalizeName(playerName),
    isSetter: Boolean(isSetter),
    isStarter: Boolean(isStarter),
    score
  };
}

export function validateTeamSlot(slot) {
  const errors = {};
  if (!isPlainObject(slot)) return { slot: "A posição do time não é um objeto." };
  if (!isValidId(slot.playerId)) errors.playerId = "O id do jogador é obrigatório.";
  if (typeof slot.playerName !== "string" || slot.playerName.trim() === "") errors.playerName = "O nome do jogador é obrigatório.";
  if (typeof slot.isSetter !== "boolean") errors.isSetter = "Deve ser verdadeiro ou falso.";
  if (typeof slot.isStarter !== "boolean") errors.isStarter = "Deve ser verdadeiro ou falso.";
  if (!isFiniteNumber(slot.score) || slot.score < 0 || slot.score > 10) errors.score = "O score deve ser um número entre 0 e 10.";
  return errors;
}

/**
 * Valida a composição de um time: 7 jogadores distintos, 6 titulares, 1 reserva,
 * exatamente 1 levantador e ele titular, reserva nunca levantador (regras do SorteioServiceTest).
 */
export function validateTeam(slots, { draw = DEFAULT_SETTINGS.draw } = {}) {
  if (!Array.isArray(slots)) return { team: "O time deve ser uma lista." };
  const errors = {};
  slots.forEach((slot, index) => Object.assign(errors, prefixErrors(validateTeamSlot(slot), `[${index}]`)));
  if (hasErrors(errors)) return errors;

  const starters = slots.filter((slot) => slot.isStarter);
  const setters = slots.filter((slot) => slot.isSetter);
  if (slots.length !== draw.playersPerTeam) errors.team = `O time deve ter ${draw.playersPerTeam} jogadores.`;
  else if (!hasUniqueIds(slots.map((slot) => slot.playerId))) errors.team = "O time tem jogadores repetidos.";
  else if (starters.length !== draw.starters) errors.team = `O time deve ter ${draw.starters} titulares.`;
  else if (setters.length !== 1 || !setters[0].isStarter) errors.team = "O time deve ter exatamente 1 levantador titular.";
  return errors;
}

/** Escalação completa: os dois times e as médias dos titulares. */
export function validateLineup(lineup, { draw = DEFAULT_SETTINGS.draw } = {}) {
  if (!isPlainObject(lineup)) return { lineup: "A escalação não é um objeto." };
  const errors = {
    ...prefixErrors(validateTeam(lineup.teamA, { draw }), "teamA"),
    ...prefixErrors(validateTeam(lineup.teamB, { draw }), "teamB")
  };
  for (const field of ["averageA", "averageB", "difference"]) {
    if (!isFiniteNumber(lineup[field]) || lineup[field] < 0) errors[field] = "Deve ser um número maior ou igual a zero.";
  }
  if (hasErrors(errors)) return errors;

  const idsA = lineup.teamA.map((slot) => slot.playerId);
  const idsB = new Set(lineup.teamB.map((slot) => slot.playerId));
  if (idsA.some((id) => idsB.has(id))) errors.lineup = "Os times não podem ter jogadores em comum.";
  if (!nearlyEqual(lineup.difference, Math.abs(lineup.averageA - lineup.averageB), DIFFERENCE_TOLERANCE)) {
    errors.difference = "A diferença não corresponde às médias dos times.";
  }
  return errors;
}

export function lineupPlayerIds(lineup) {
  return [...lineup.teamA, ...lineup.teamB].map((slot) => slot.playerId);
}

export function serializeLineup(lineup) {
  return {
    teamA: lineup.teamA.map(serializeTeamSlot),
    teamB: lineup.teamB.map(serializeTeamSlot),
    averageA: lineup.averageA,
    averageB: lineup.averageB,
    difference: lineup.difference
  };
}

export function deserializeLineup(raw, options) {
  if (!isPlainObject(raw)) return fail({ lineup: "A escalação salva não é um objeto." });
  const lineup = {
    teamA: Array.isArray(raw.teamA) ? raw.teamA.map(normalizeSlot) : raw.teamA,
    teamB: Array.isArray(raw.teamB) ? raw.teamB.map(normalizeSlot) : raw.teamB,
    averageA: raw.averageA,
    averageB: raw.averageB,
    difference: raw.difference
  };
  const errors = validateLineup(lineup, options);
  return hasErrors(errors) ? fail(errors) : ok(serializeLineup(lineup));
}

function serializeTeamSlot(slot) {
  return {
    playerId: slot.playerId,
    playerName: slot.playerName,
    isSetter: slot.isSetter,
    isStarter: slot.isStarter,
    score: slot.score
  };
}

function normalizeSlot(slot) {
  if (!isPlainObject(slot)) return slot;
  return { ...slot, playerName: typeof slot.playerName === "string" ? slot.playerName.trim() : slot.playerName };
}
