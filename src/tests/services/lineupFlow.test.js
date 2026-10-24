import { describe, expect, it } from "vitest";
import { validateLineup } from "../../domain/team.js";
import { calculateTeamAverage, swapPlayers } from "../../services/teamSwap.js";
import { addDraft, getActiveDraft, redrawDraft, removeDraft, restoreOriginalLineup, updateDraftLineup } from "../../services/draftService.js";
import { changeDate, confirmDraft, removeMatch, setScore, sortByDateDesc } from "../../services/matchService.js";
import { getMatchResult } from "../../domain/match.js";
import { BusinessRuleError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { buildDrawRequest, buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { NOW } from "../fixtures/players.js";

const ids = (() => {
  let next = 0;
  return () => `fixed-${(next += 1)}`;
})();

describe("teamSwap (R12)", () => {
  it("troca os jogadores mantendo titular e levantador na posição e recalcula as médias", () => {
    const lineup = buildLineup();
    const swapped = swapPlayers(lineup, PLAYER_IDS[1], PLAYER_IDS[8]);
    expect(swapped.teamA[1]).toMatchObject({ playerId: PLAYER_IDS[8], isStarter: true, isSetter: false, score: lineup.teamB[1].score });
    expect(swapped.teamB[1]).toMatchObject({ playerId: PLAYER_IDS[1], score: lineup.teamA[1].score });
    expect(swapped.averageA).toBe(calculateTeamAverage(swapped.teamA));
    expect(swapped.difference).toBe(Math.abs(swapped.averageA - swapped.averageB));
    expect(validateLineup(swapped)).toEqual({});
  });

  it("levantador trocado por jogador de linha mantém o score antigo (P8, mantido até D9)", () => {
    const lineup = buildLineup();
    const swapped = swapPlayers(lineup, PLAYER_IDS[0], PLAYER_IDS[9]);
    expect(swapped.teamA[0]).toMatchObject({ playerId: PLAYER_IDS[9], isSetter: true, score: lineup.teamB[2].score });
    expect(swapped.teamB[2]).toMatchObject({ playerId: PLAYER_IDS[0], isSetter: false, score: lineup.teamA[0].score });
  });

  it("trocar com o reserva muda quem entra na média", () => {
    const lineup = buildLineup();
    const swapped = swapPlayers(lineup, PLAYER_IDS[6], PLAYER_IDS[12]);
    expect(swapped.teamA[6].isStarter).toBe(false);
    expect(swapped.averageB).not.toBe(lineup.averageB);
  });

  it("exige um jogador de cada time e não altera a escalação recebida", () => {
    const lineup = buildLineup();
    const snapshot = JSON.stringify(lineup);
    expect(() => swapPlayers(lineup, PLAYER_IDS[8], PLAYER_IDS[9])).toThrow(BusinessRuleError);
    expect(() => swapPlayers(lineup, PLAYER_IDS[1], PLAYER_IDS[2])).toThrow(BusinessRuleError);
    swapPlayers(lineup, PLAYER_IDS[1], PLAYER_IDS[8]);
    expect(JSON.stringify(lineup)).toBe(snapshot);
  });

  it("média de time sem titulares é 0, como no Java", () => {
    expect(calculateTeamAverage([])).toBe(0);
  });
});

describe("draftService (R11)", () => {
  const add = (drafts, now = NOW) => addDraft(drafts, { request: buildDrawRequest(), lineup: buildLineup() }, { now, createId: ids });

  it("cada sorteio entra no início e a lista guarda no máximo 5", () => {
    let drafts = [];
    const created = [];
    for (let index = 0; index < 6; index += 1) {
      const result = add(drafts);
      created.push(result.draft.id);
      drafts = result.drafts;
      if (index < 5) expect(result.discarded).toEqual([]);
      else expect(result.discarded.map((draft) => draft.id)).toEqual([created[0]]);
    }
    expect(drafts.map((draft) => draft.id)).toEqual(created.slice(1).reverse());
  });

  it("troca manual grava no rascunho e marca como alterado; o original fica guardado", () => {
    const { draft, drafts } = add([]);
    const swapped = swapPlayers(draft.lineup, PLAYER_IDS[1], PLAYER_IDS[8]);
    const updated = updateDraftLineup(drafts, draft.id, swapped);
    expect(updated[0].lineup).toEqual(swapped);
    expect(updated[0].edited).toBe(true);
    expect(updated[0].originalLineup).toEqual(draft.lineup);
    expect(restoreOriginalLineup(updated, draft.id)[0]).toMatchObject({ lineup: draft.lineup, edited: false });
  });

  it("sortear de novo substitui o rascunho ativo e atualiza a data", () => {
    const { draft, drafts } = add([]);
    const later = "2026-10-24T13:00:00.000Z";
    const lineup = swapPlayers(buildLineup(), PLAYER_IDS[2], PLAYER_IDS[9]);
    const redrawn = redrawDraft(drafts, draft.id, lineup, { now: later });
    expect(redrawn).toHaveLength(1);
    expect(redrawn[0]).toMatchObject({ id: draft.id, createdAt: later, edited: false, lineup, originalLineup: lineup });
  });

  it("remover indica o próximo rascunho; abrir sem id pega o mais recente", () => {
    const first = add([]);
    const second = add(first.drafts);
    expect(getActiveDraft(second.drafts)).toBe(second.drafts[0]);
    expect(getActiveDraft(second.drafts, first.draft.id).id).toBe(first.draft.id);
    expect(getActiveDraft([])).toBeNull();
    const { drafts, next } = removeDraft(second.drafts, second.draft.id);
    expect(drafts).toHaveLength(1);
    expect(next.id).toBe(first.draft.id);
    expect(() => removeDraft(drafts, "inexistente")).toThrow(NotFoundError);
  });

  it("rejeita escalação inválida no rascunho", () => {
    const { draft, drafts } = add([]);
    expect(() => updateDraftLineup(drafts, draft.id, { ...draft.lineup, teamA: draft.lineup.teamA.slice(0, 6) })).toThrow(ValidationError);
  });
});

describe("matchService (R9, R10)", () => {
  const confirmed = () => {
    const { draft, drafts } = addDraft([], { request: buildDrawRequest(), lineup: buildLineup() }, { now: NOW, createId: ids });
    return { draft, ...confirmDraft(drafts, draft.id, { now: NOW, createId: () => "match-1" }) };
  };

  it("confirmar grava a escalação atual com a data de agora e remove o rascunho", () => {
    const { draft, match, drafts } = confirmed();
    expect(match).toMatchObject({ id: "match-1", playedAt: NOW, score: null, teamA: draft.lineup.teamA });
    expect(match.playerIds).toEqual(draft.request.playerIds);
    expect(drafts).toEqual([]);
  });

  it("registra e corrige o placar; empate e 0×0 são aceitos", () => {
    const { match } = confirmed();
    let matches = setScore([match], match.id, { setsA: 2, setsB: 1 }, { now: NOW });
    expect(getMatchResult(matches[0])).toBe("TEAM_A");
    matches = setScore(matches, match.id, { setsA: 1, setsB: 3 }, { now: NOW });
    expect(matches[0].score).toEqual({ setsA: 1, setsB: 3 });
    expect(getMatchResult(setScore(matches, match.id, { setsA: 0, setsB: 0 })[0])).toBe("DRAW");
  });

  it("placar exige dois inteiros ≥ 0 e não pode ser removido", () => {
    const { match } = confirmed();
    expect(() => setScore([match], match.id, { setsA: -1, setsB: 0 })).toThrow(ValidationError);
    expect(() => setScore([match], match.id, { setsA: 1.5, setsB: 0 })).toThrow(ValidationError);
    expect(() => setScore([match], match.id, { setsA: "2", setsB: 0 })).toThrow(ValidationError);
    expect(() => setScore([match], match.id, { setsA: 2 })).toThrow(ValidationError);
    expect(() => setScore([match], match.id, null)).toThrow(ValidationError);
    expect(() => setScore([match], "outro", { setsA: 1, setsB: 0 })).toThrow(NotFoundError);
  });

  it("altera a data (obrigatória) e exclui a partida", () => {
    const { match } = confirmed();
    const changed = changeDate([match], match.id, "2026-10-20T22:30:00-03:00", { now: NOW });
    expect(changed[0].playedAt).toBe("2026-10-21T01:30:00.000Z");
    expect(() => changeDate([match], match.id, "")).toThrow(ValidationError);
    expect(removeMatch(changed, match.id)).toEqual([]);
    expect(() => removeMatch([], match.id)).toThrow(NotFoundError);
  });

  it("histórico do mais recente para o mais antigo", () => {
    const list = ["2026-10-01T10:00:00Z", "2026-10-03T10:00:00Z", "2026-10-02T10:00:00Z"].map((playedAt) => ({ id: playedAt, playedAt }));
    expect(sortByDateDesc(list).map((match) => match.id)).toEqual(["2026-10-03T10:00:00Z", "2026-10-02T10:00:00Z", "2026-10-01T10:00:00Z"]);
  });
});
