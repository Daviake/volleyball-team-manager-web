import { createDraft, validateDraft } from "../domain/draft.js";
import { DEFAULT_SETTINGS } from "../domain/settings.js";
import { serializeLineup } from "../domain/team.js";
import { assertValid } from "../domain/validation.js";
import { nowIso } from "../utils/dates.js";
import { generateId } from "../utils/ids.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Rascunhos de sorteio (R11; Java: NovoSorteio.sortear, Resultado.jsx, Rascunhos.jsx).
 * A lista fica do mais recente para o mais antigo. Todas as funções devolvem listas novas.
 */

/**
 * Cada "Sortear" cria um rascunho no início da lista, que é cortada no máximo (5).
 * O Java descarta o mais antigo sem aviso; aqui os descartados são devolvidos em `discarded`
 * para que a tela possa avisar, se for decidido mostrar (a regra de corte é a mesma).
 */
export function addDraft(drafts, { request, lineup }, { now = nowIso(), createId = generateId, settings = DEFAULT_SETTINGS } = {}) {
  const draft = createDraft({ request, lineup }, { now, createId });
  const all = [draft, ...drafts];
  return { draft, drafts: all.slice(0, settings.drafts.max), discarded: all.slice(settings.drafts.max) };
}

export function findDraft(drafts, draftId) {
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) throw new NotFoundError("Rascunho não encontrado.");
  return draft;
}

/** Rascunho a abrir na tela de resultado: o pedido, ou o mais recente (Java: ao recarregar /resultado). */
export function getActiveDraft(drafts, draftId = null) {
  return drafts.find((item) => item.id === draftId) ?? drafts[0] ?? null;
}

/**
 * Grava uma troca manual no rascunho (o Java grava a cada troca). Marca o rascunho como alterado.
 * Com a interpretação atual da dúvida D8, "desfazer alterações" volta a este último estado salvo.
 */
export function updateDraftLineup(drafts, draftId, lineup) {
  return replaceDraft(drafts, draftId, (draft) => ({ ...draft, lineup: serializeLineup(lineup), edited: true }));
}

/**
 * "Sortear de novo": substitui a escalação do rascunho ativo (não cria outro) e atualiza a data
 * de criação, como o Java. O novo sorteio passa a ser também a escalação original.
 */
export function redrawDraft(drafts, draftId, lineup, { now = nowIso() } = {}) {
  return replaceDraft(drafts, draftId, (draft) => ({
    ...draft,
    createdAt: now,
    lineup: serializeLineup(lineup),
    originalLineup: serializeLineup(lineup),
    edited: false
  }));
}

/**
 * Volta à escalação gerada pelo sorteio, antes das trocas. Disponível para a decisão D8;
 * a tela só deve usá-la se for essa a resposta (a interpretação atual mantém o comportamento do Java).
 */
export function restoreOriginalLineup(drafts, draftId) {
  return replaceDraft(drafts, draftId, (draft) => ({ ...draft, lineup: serializeLineup(draft.originalLineup), edited: false }));
}

/** Remove um rascunho (ao confirmar ou descartar) e indica o próximo a abrir. */
export function removeDraft(drafts, draftId) {
  findDraft(drafts, draftId);
  const remaining = drafts.filter((item) => item.id !== draftId);
  return { drafts: remaining, next: remaining[0] ?? null };
}

function replaceDraft(drafts, draftId, change) {
  const current = findDraft(drafts, draftId);
  const updated = change(current);
  assertValid(validateDraft(updated), "Dados do rascunho inválidos.");
  return drafts.map((item) => (item.id === draftId ? updated : item));
}
