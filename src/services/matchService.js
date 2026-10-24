import { createMatch, validateScore } from "../domain/match.js";
import { assertValid, isPlainObject } from "../domain/validation.js";
import { nowIso, toIsoDate } from "../utils/dates.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { generateId } from "../utils/ids.js";
import { findDraft, removeDraft } from "./draftService.js";

/**
 * Partidas do histórico (R9, R10; Java: SorteioService.confirmar, registrarPlacar,
 * atualizarData, excluir e listarHistorico).
 */

/**
 * Confirma um rascunho: grava exatamente a escalação atual (inclusive trocas manuais) com a data
 * de agora e remove o rascunho. Diferente do Java (P7), o conteúdo é validado pelo domínio.
 */
export function confirmDraft(drafts, draftId, { now = nowIso(), createId = generateId } = {}) {
  const draft = findDraft(drafts, draftId);
  const match = createMatch({ playerIds: draft.request.playerIds, lineup: draft.lineup, playedAt: now }, { now, createId });
  return { match, drafts: removeDraft(drafts, draftId).drafts };
}

/**
 * Registra ou corrige o placar de sets (sobrescreve; o delta é recalculado do histórico).
 * Os dois valores são obrigatórios, inteiros e ≥ 0; empate é aceito, inclusive 0×0 (D7).
 * Como no Java, não é possível voltar para "sem placar".
 */
export function setScore(matches, matchId, score, { now = nowIso() } = {}) {
  if (!isPlainObject(score)) {
    throw new ValidationError("Informe os sets dos dois times (empate também é permitido).", {
      score: "Informe os sets dos dois times (empate também é permitido)."
    });
  }
  const normalized = { setsA: score.setsA, setsB: score.setsB };
  assertValid(validateScore(normalized), "Placar inválido.");
  return replaceMatch(matches, matchId, (match) => ({ ...match, score: normalized, updatedAt: now }));
}

/** Altera a data da partida. A data é obrigatória. */
export function changeDate(matches, matchId, playedAt, { now = nowIso() } = {}) {
  const iso = toIsoDate(playedAt);
  if (iso === null) {
    throw new ValidationError("A data é obrigatória.", { playedAt: "Informe uma data válida." });
  }
  return replaceMatch(matches, matchId, (match) => ({ ...match, playedAt: iso, updatedAt: now }));
}

/** Exclui a partida; sua influência no delta some junto. A confirmação é feita pela tela. */
export function removeMatch(matches, matchId) {
  findMatch(matches, matchId);
  return matches.filter((match) => match.id !== matchId);
}

export function findMatch(matches, matchId) {
  const match = matches.find((item) => item.id === matchId);
  if (!match) throw new NotFoundError("Sorteio não encontrado.");
  return match;
}

/** Histórico do mais recente para o mais antigo (ordenação estável para datas iguais). */
export function sortByDateDesc(matches) {
  return [...matches].sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
}

function replaceMatch(matches, matchId, change) {
  findMatch(matches, matchId);
  return matches.map((match) => (match.id === matchId ? change(match) : match));
}
