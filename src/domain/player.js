import { toIsoDate, nowIso } from "../utils/dates.js";
import { generateId, isValidId } from "../utils/ids.js";
import { isFiniteNumber, parseDecimal } from "../utils/numbers.js";
import { normalizeName } from "../utils/text.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { assertValid, fail, hasErrors, isPlainObject, ok, readBoolean } from "./validation.js";

/** Habilidades avaliadas, na ordem do cadastro do Java (Jogador.java). */
export const RATING_KEYS = Object.freeze(["attack", "defense", "serve", "setting", "blocking", "consistency"]);

export const RATING_LABELS = Object.freeze({
  attack: "Ataque",
  defense: "Defesa",
  serve: "Saque",
  setting: "Levantamento",
  blocking: "Bloqueio",
  consistency: "Constância"
});

const { min: RATING_MIN, max: RATING_MAX, default: RATING_DEFAULT } = DEFAULT_SETTINGS.ratings;

/**
 * Converte os dados recebidos (formulário, importação ou armazenamento) para o formato do modelo,
 * sem validar. Valores numéricos em texto ("7,5") viram números; o nome perde os espaços nas pontas.
 * Notas ausentes ficam `undefined` aqui; quem decide o padrão é `createPlayer`.
 */
export function normalizePlayer(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const ratingsSource = isPlainObject(source.ratings) ? source.ratings : {};
  const ratings = {};
  for (const key of RATING_KEYS) {
    const parsed = parseDecimal(ratingsSource[key]);
    ratings[key] = parsed === null ? undefined : parsed;
  }
  return {
    id: source.id,
    name: normalizeName(source.name),
    // Java: "levantador" é só a preferência de costume, não uma restrição.
    prefersSetter: readBoolean(source.prefersSetter, false),
    // Java: mensalista nulo é tratado como true.
    isMonthly: readBoolean(source.isMonthly, true),
    // Java: mulher nula é tratada como false.
    isWoman: readBoolean(source.isWoman, false),
    ratings,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null
  };
}

/** Valida um jogador já normalizado. */
export function validatePlayer(player) {
  const errors = {};
  if (!isValidId(player.id)) errors.id = "O identificador é obrigatório.";
  if (!player.name) errors.name = "Informe o nome do jogador.";
  for (const field of ["prefersSetter", "isMonthly", "isWoman"]) {
    if (typeof player[field] !== "boolean") errors[field] = "Deve ser verdadeiro ou falso.";
  }
  for (const key of RATING_KEYS) {
    const value = player.ratings?.[key];
    const label = RATING_LABELS[key];
    if (value === undefined) {
      errors[`ratings.${key}`] = `${label}: informe a nota.`;
    } else if (!isFiniteNumber(value)) {
      errors[`ratings.${key}`] = `${label}: a nota deve ser um número.`;
    } else if (value < RATING_MIN || value > RATING_MAX) {
      errors[`ratings.${key}`] = `${label}: a nota deve estar entre ${RATING_MIN} e ${RATING_MAX}.`;
    }
  }
  for (const field of ["createdAt", "updatedAt"]) {
    if (player[field] !== null && toIsoDate(player[field]) === null) errors[field] = "Data inválida.";
  }
  return errors;
}

/**
 * Cria um jogador novo. Notas não informadas recebem 5, como no formulário e na importação
 * do sistema Java. Lança ValidationError se os dados forem inválidos.
 */
export function createPlayer(input, { now = nowIso(), createId = generateId } = {}) {
  const normalized = normalizePlayer(input);
  const ratings = Object.fromEntries(
    RATING_KEYS.map((key) => [key, normalized.ratings[key] === undefined ? RATING_DEFAULT : normalized.ratings[key]])
  );
  const player = {
    ...normalized,
    id: isValidId(normalized.id) ? normalized.id : createId(),
    ratings,
    createdAt: normalized.createdAt ?? now,
    updatedAt: normalized.updatedAt ?? now
  };
  assertValid(validatePlayer(player), "Dados do jogador inválidos.");
  return toCanonicalPlayer(player);
}

/** Aplica alterações a um jogador existente, preservando id e data de criação. */
export function updatePlayerData(player, changes, { now = nowIso() } = {}) {
  const merged = normalizePlayer({
    ...player,
    ...changes,
    ratings: { ...player.ratings, ...(isPlainObject(changes?.ratings) ? changes.ratings : {}) },
    id: player.id,
    createdAt: player.createdAt,
    updatedAt: now
  });
  assertValid(validatePlayer(merged), "Dados do jogador inválidos.");
  return toCanonicalPlayer(merged);
}

export function serializePlayer(player) {
  return toCanonicalPlayer(player);
}

/**
 * Lê um jogador salvo. Diferente de `createPlayer`, não inventa notas: um jogador salvo sem
 * alguma nota é considerado corrompido e devolvido como erro, para não alterar dados em silêncio.
 */
export function deserializePlayer(raw) {
  if (!isPlainObject(raw)) return fail({ player: "O jogador salvo não é um objeto." });
  const player = normalizePlayer(raw);
  const errors = validatePlayer(player);
  return hasErrors(errors) ? fail(errors) : ok(toCanonicalPlayer(player));
}

function toCanonicalPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    prefersSetter: player.prefersSetter,
    isMonthly: player.isMonthly,
    isWoman: player.isWoman,
    ratings: Object.fromEntries(RATING_KEYS.map((key) => [key, player.ratings[key]])),
    createdAt: player.createdAt === null ? null : toIsoDate(player.createdAt),
    updatedAt: player.updatedAt === null ? null : toIsoDate(player.updatedAt)
  };
}
