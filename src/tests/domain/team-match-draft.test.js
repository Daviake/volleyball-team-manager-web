import { describe, expect, it } from "vitest";
import { createTeamSlot, deserializeLineup, validateLineup, validateTeam } from "../../domain/team.js";
import { createMatch, deserializeMatch, getMatchResult, MATCH_RESULT, serializeMatch, validateScore } from "../../domain/match.js";
import { createDraft, deserializeDraft, validateDrawRequest } from "../../domain/draft.js";
import { ValidationError } from "../../utils/errors.js";
import { buildDrawRequest, buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";

const NOW = "2026-10-24T12:00:00.000Z";
const fixedId = () => "fixed-id";

describe("time e escalação", () => {
  it("aceita uma escalação válida", () => {
    expect(validateLineup(buildLineup())).toEqual({});
  });

  it("createTeamSlot normaliza nome e marcadores", () => {
    expect(createTeamSlot({ playerId: "p", playerName: " Ana ", isSetter: 1, isStarter: 0, score: 5 })).toEqual({
      playerId: "p",
      playerName: "Ana",
      isSetter: true,
      isStarter: false,
      score: 5
    });
  });

  it("exige 7 jogadores, 6 titulares e 1 levantador titular", () => {
    const { teamA } = buildLineup();
    expect(validateTeam(teamA.slice(0, 6)).team).toMatch(/7 jogadores/);
    expect(validateTeam(teamA.map((slot) => ({ ...slot, isStarter: true }))).team).toMatch(/6 titulares/);
    expect(validateTeam(teamA.map((slot) => ({ ...slot, isSetter: false }))).team).toMatch(/1 levantador/);
    const setterAsReserve = teamA.map((slot, index) => ({ ...slot, isSetter: index === 6 }));
    expect(validateTeam(setterAsReserve).team).toMatch(/levantador titular/);
  });

  it("rejeita jogador repetido entre os times e diferença incoerente", () => {
    const lineup = buildLineup();
    const shared = { ...lineup, teamB: lineup.teamB.map((slot, index) => (index === 1 ? { ...slot, playerId: PLAYER_IDS[1] } : slot)) };
    expect(validateLineup(shared).lineup).toBeDefined();
    expect(validateLineup({ ...lineup, difference: lineup.difference + 0.1 }).difference).toBeDefined();
  });

  it("deserializeLineup apara nomes e valida", () => {
    const lineup = buildLineup();
    lineup.teamA[0].playerName = "  Jogador Teste 1  ";
    const result = deserializeLineup(JSON.parse(JSON.stringify(lineup)));
    expect(result.ok).toBe(true);
    expect(result.value.teamA[0].playerName).toBe("Jogador Teste 1");
    expect(deserializeLineup({ teamA: [] }).ok).toBe(false);
  });
});

describe("partida", () => {
  const baseMatch = () => createMatch({ playerIds: PLAYER_IDS, lineup: buildLineup() }, { now: NOW, createId: fixedId });

  it("cria uma partida sem placar, com data atual", () => {
    const match = baseMatch();
    expect(match).toMatchObject({ id: "fixed-id", playedAt: NOW, score: null, createdAt: NOW });
    expect(getMatchResult(match)).toBeNull();
  });

  it("deriva vitória, derrota e empate do placar de sets (inclusive 0×0)", () => {
    const match = baseMatch();
    expect(getMatchResult({ ...match, score: { setsA: 2, setsB: 1 } })).toBe(MATCH_RESULT.TEAM_A);
    expect(getMatchResult({ ...match, score: { setsA: 0, setsB: 2 } })).toBe(MATCH_RESULT.TEAM_B);
    expect(getMatchResult({ ...match, score: { setsA: 1, setsB: 1 } })).toBe(MATCH_RESULT.DRAW);
    expect(getMatchResult({ ...match, score: { setsA: 0, setsB: 0 } })).toBe(MATCH_RESULT.DRAW);
  });

  it("valida o placar: inteiros maiores ou iguais a zero", () => {
    expect(validateScore(null)).toEqual({});
    expect(validateScore({ setsA: 3, setsB: 0 })).toEqual({});
    expect(Object.keys(validateScore({ setsA: -1, setsB: 1.5 }))).toEqual(["score.setsA", "score.setsB"]);
  });

  it("valida o conteúdo ao criar (correção do P7)", () => {
    const lineup = buildLineup();
    expect(() => createMatch({ playerIds: PLAYER_IDS.slice(0, 13), lineup }, { now: NOW })).toThrow(ValidationError);
    expect(() => createMatch({ playerIds: PLAYER_IDS, lineup: { ...lineup, teamB: lineup.teamB.slice(0, 6) } }, { now: NOW })).toThrow(
      ValidationError
    );
    const otherIds = [...PLAYER_IDS.slice(0, 13), "outro-id"];
    expect(() => createMatch({ playerIds: otherIds, lineup }, { now: NOW })).toThrow(ValidationError);
  });

  it("rejeita data inválida", () => {
    expect(() => createMatch({ playerIds: PLAYER_IDS, lineup: buildLineup(), playedAt: "ontem" }, { now: NOW })).toThrow(ValidationError);
  });

  it("ida e volta pelo JSON preserva a partida com placar", () => {
    const match = { ...baseMatch(), score: { setsA: 2, setsB: 0 } };
    const restored = deserializeMatch(JSON.parse(JSON.stringify(serializeMatch(match))));
    expect(restored).toEqual({ ok: true, value: match });
  });

  it("rejeita partida salva com placar inválido", () => {
    const result = deserializeMatch({ ...baseMatch(), score: { setsA: "2", setsB: 0 } });
    expect(result.ok).toBe(false);
    expect(result.errors["score.setsA"]).toBeDefined();
  });
});

describe("pedido de sorteio e rascunho", () => {
  it("exige 14 jogadores distintos e 2 levantadores distintos entre eles", () => {
    const request = buildDrawRequest();
    expect(validateDrawRequest(request)).toEqual({});
    expect(validateDrawRequest({ ...request, playerIds: request.playerIds.slice(0, 13) }).playerIds).toMatch(/exatamente 14/);
    expect(validateDrawRequest({ ...request, playerIds: [...request.playerIds.slice(0, 13), request.playerIds[0]] }).playerIds).toMatch(
      /repetidos/
    );
    expect(validateDrawRequest({ ...request, setterIds: [request.setterIds[0], request.setterIds[0]] }).setterIds).toMatch(/repetidos/);
    expect(validateDrawRequest({ ...request, setterIds: [request.setterIds[0]] }).setterIds).toMatch(/exatamente 2/);
    expect(validateDrawRequest({ ...request, setterIds: [request.setterIds[0], "fora"] }).setterIds).toMatch(/entre os jogadores/);
  });

  it("cria um rascunho guardando a escalação original", () => {
    const draft = createDraft({ request: buildDrawRequest(), lineup: buildLineup() }, { now: NOW, createId: fixedId });
    expect(draft).toMatchObject({ id: "fixed-id", createdAt: NOW, edited: false });
    expect(draft.originalLineup).toEqual(draft.lineup);
    expect(draft.originalLineup).not.toBe(draft.lineup);
  });

  it("rejeita escalação com jogador fora do pedido", () => {
    const request = { ...buildDrawRequest(), playerIds: [...PLAYER_IDS.slice(0, 13), "outro-id"] };
    expect(() => createDraft({ request: { ...request, setterIds: [PLAYER_IDS[0], PLAYER_IDS[7]] }, lineup: buildLineup() })).toThrow(
      ValidationError
    );
  });

  it("ida e volta pelo JSON e rascunho salvo sem original", () => {
    const draft = createDraft({ request: buildDrawRequest(), lineup: buildLineup() }, { now: NOW, createId: fixedId });
    expect(deserializeDraft(JSON.parse(JSON.stringify(draft)))).toEqual({ ok: true, value: draft });
    const { originalLineup: _ignored, edited: _edited, ...withoutOriginal } = draft;
    const restored = deserializeDraft(withoutOriginal);
    expect(restored.ok).toBe(true);
    expect(restored.value.originalLineup).toEqual(draft.lineup);
    expect(restored.value.edited).toBe(false);
  });
});
