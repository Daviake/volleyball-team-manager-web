import { nowIso, toIsoDate } from "../utils/dates.js";
import { generateId, hasUniqueIds, isValidId } from "../utils/ids.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { lineupPlayerIds, serializeLineup, validateLineup } from "./team.js";
import { assertValid, fail, hasErrors, isPlainObject, ok, prefixErrors } from "./validation.js";

/**
 * Pedido de sorteio (Java: SorteioRequest): exatamente 14 jogadores distintos e
 * exatamente 2 levantadores distintos, escolhidos entre os 14.
 */
export function validateDrawRequest(request, { draw = DEFAULT_SETTINGS.draw } = {}) {
  if (!isPlainObject(request)) return { request: "O pedido de sorteio não é um objeto." };
  const errors = {};
  const { playerIds, setterIds } = request;
  if (!Array.isArray(playerIds) || !playerIds.every(isValidId)) {
    errors.playerIds = "A lista de jogadores é inválida.";
  } else if (!hasUniqueIds(playerIds)) {
    errors.playerIds = "A lista de jogadores contém jogadores repetidos.";
  } else if (playerIds.length !== draw.playersPerDraw) {
    errors.playerIds = `É necessário selecionar exatamente ${draw.playersPerDraw} jogadores.`;
  }
  if (!Array.isArray(setterIds) || !setterIds.every(isValidId)) {
    errors.setterIds = "A lista de levantadores é inválida.";
  } else if (!hasUniqueIds(setterIds)) {
    errors.setterIds = "A lista de levantadores contém jogadores repetidos.";
  } else if (setterIds.length !== draw.settersPerDraw) {
    errors.setterIds = `É necessário indicar exatamente ${draw.settersPerDraw} levantadores.`;
  } else if (Array.isArray(playerIds) && !setterIds.every((id) => playerIds.includes(id))) {
    errors.setterIds = "Os levantadores precisam estar entre os jogadores selecionados.";
  }
  return errors;
}

/**
 * Rascunho de sorteio, ainda não confirmado (Java: item da chave "rascunhos" do localStorage).
 * `originalLineup` guarda a escalação gerada pelo sorteio, antes de trocas manuais (ver dúvida D8).
 */
export function validateDraft(draft, { draw = DEFAULT_SETTINGS.draw } = {}) {
  if (!isPlainObject(draft)) return { draft: "O rascunho não é um objeto." };
  const errors = {};
  if (!isValidId(draft.id)) errors.id = "O identificador é obrigatório.";
  if (toIsoDate(draft.createdAt) === null) errors.createdAt = "Data inválida.";
  if (typeof draft.edited !== "boolean") errors.edited = "Deve ser verdadeiro ou falso.";
  Object.assign(
    errors,
    prefixErrors(validateDrawRequest(draft.request, { draw }), "request"),
    prefixErrors(validateLineup(draft.lineup, { draw }), "lineup"),
    prefixErrors(validateLineup(draft.originalLineup, { draw }), "originalLineup")
  );
  if (!hasErrors(errors)) {
    const requested = new Set(draft.request.playerIds);
    for (const field of ["lineup", "originalLineup"]) {
      if (!lineupPlayerIds(draft[field]).every((id) => requested.has(id))) {
        errors[field] = "A escalação tem jogadores que não estão no pedido de sorteio.";
      }
    }
  }
  return errors;
}

export function createDraft({ request, lineup }, { now = nowIso(), createId = generateId } = {}) {
  const draft = {
    id: createId(),
    createdAt: now,
    request: isPlainObject(request) ? { playerIds: request.playerIds, setterIds: request.setterIds } : request,
    lineup,
    originalLineup: lineup,
    edited: false
  };
  assertValid(validateDraft(draft), "Dados do rascunho inválidos.");
  return serializeDraft(draft);
}

export function serializeDraft(draft) {
  return {
    id: draft.id,
    createdAt: toIsoDate(draft.createdAt),
    request: { playerIds: [...draft.request.playerIds], setterIds: [...draft.request.setterIds] },
    lineup: serializeLineup(draft.lineup),
    originalLineup: serializeLineup(draft.originalLineup),
    edited: draft.edited
  };
}

export function deserializeDraft(raw) {
  if (!isPlainObject(raw)) return fail({ draft: "O rascunho salvo não é um objeto." });
  const draft = {
    id: raw.id,
    createdAt: raw.createdAt,
    request: raw.request,
    lineup: raw.lineup,
    // Rascunhos sem original (ex.: vindos de outra fonte) usam a escalação atual.
    originalLineup: raw.originalLineup ?? raw.lineup,
    edited: raw.edited ?? false
  };
  const errors = validateDraft(draft);
  return hasErrors(errors) ? fail(errors) : ok(serializeDraft(draft));
}
