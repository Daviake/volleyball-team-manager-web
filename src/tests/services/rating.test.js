import { describe, expect, it } from "vitest";
import { calculateHitterScore, calculatePreferredRoleScore, calculateScore, calculateSetterScore } from "../../services/ratingCalculator.js";
import { adjustRatings, calculateDelta, calculateDeltaFromSets, countSets } from "../../services/ratingDelta.js";
import { defaultRandom, randomIndex, seededRandom } from "../../utils/random.js";
import { buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { buildPlayer, uniformRatings } from "../fixtures/players.js";

const EXAMPLE = { attack: 7, defense: 6, serve: 5, setting: 3, blocking: 5, consistency: 8 };

describe("ratingCalculator (R5)", () => {
  it("reproduz o exemplo da análise: linha 6,25 e levantador 4,70", () => {
    expect(calculateHitterScore(EXAMPLE)).toBe(6.25);
    expect(calculateSetterScore(EXAMPLE)).toBeCloseTo(4.7, 12);
  });

  it("dá o mesmo valor que a fórmula do Java, na mesma ordem de soma", () => {
    const ratings = { attack: 7.3, defense: 6.1, serve: 5.9, setting: 3.7, blocking: 4.4, consistency: 8.2 };
    const javaHitter = (ratings.attack * 3 + ratings.defense * 3.5 + ratings.serve * 2 + ratings.blocking * 0.5 + ratings.consistency * 1) / 10.0;
    const javaSetter = (ratings.attack * 1 + ratings.defense * 2 + ratings.setting * 5 + ratings.blocking * 1 + ratings.consistency * 1) / 10.0;
    expect(calculateScore(ratings, false)).toBe(javaHitter);
    expect(calculateScore(ratings, true)).toBe(javaSetter);
  });

  it("levantamento não conta para linha e saque não conta para levantador", () => {
    expect(calculateHitterScore({ ...EXAMPLE, setting: 10 })).toBe(calculateHitterScore(EXAMPLE));
    expect(calculateSetterScore({ ...EXAMPLE, serve: 0 })).toBe(calculateSetterScore(EXAMPLE));
  });

  it("limites: todas as notas 0 dão 0 e todas 10 dão 10", () => {
    expect(calculateScore(uniformRatings(0), false)).toBe(0);
    expect(calculateScore(uniformRatings(10), true)).toBe(10);
  });

  it("o score do papel preferido usa a preferência do cadastro", () => {
    const player = buildPlayer(0, { ratings: EXAMPLE, prefersSetter: true });
    expect(calculatePreferredRoleScore(player)).toBe(calculateSetterScore(EXAMPLE));
    expect(calculatePreferredRoleScore({ ...player, prefersSetter: false })).toBe(6.25);
  });
});

describe("ratingDelta (R8)", () => {
  const lineup = buildLineup();
  const match = (score, playedAt = "2026-10-01T20:00:00.000Z") => ({ id: playedAt, playedAt, playerIds: PLAYER_IDS, ...lineup, score });

  it("conta sets do time do jogador, titular ou reserva, só em partidas com placar", () => {
    const matches = [match({ setsA: 2, setsB: 1 }), match(null), match({ setsA: 0, setsB: 3 })];
    expect(countSets(PLAYER_IDS[0], matches)).toEqual({ setsWon: 2, setsLost: 4 });
    expect(countSets(PLAYER_IDS[6], matches)).toEqual({ setsWon: 2, setsLost: 4 }); // reserva do time A
    expect(countSets(PLAYER_IDS[8], matches)).toEqual({ setsWon: 4, setsLost: 2 });
    expect(countSets("fora-do-jogo", matches)).toEqual({ setsWon: 0, setsLost: 0 });
  });

  it("reproduz o exemplo da análise: score 7, 3 sets ganhos e 1 perdido → +0,076", () => {
    const player = buildPlayer(0, { ratings: uniformRatings(7), prefersSetter: false });
    const result = calculateDeltaFromSets(player, { setsWon: 3, setsLost: 1 });
    expect(result.gainPerSet).toBeCloseTo(0.044, 12);
    expect(result.lossPerSet).toBeCloseTo(0.056, 12);
    expect(result.delta).toBeCloseTo(0.076, 12);
  });

  it("jogador mediano (score 5) ganha e perde 0,05 por set", () => {
    const result = calculateDeltaFromSets(buildPlayer(0, { ratings: uniformRatings(5) }), { setsWon: 1, setsLost: 3 });
    expect(result.gainPerSet).toBe(0.05);
    expect(result.lossPerSet).toBe(0.05);
    expect(result.delta).toBeCloseTo(-0.1, 12);
  });

  it("sem histórico ou só com 0×0 o delta é zero", () => {
    const player = buildPlayer(0);
    expect(calculateDelta(player, []).delta).toBe(0);
    expect(calculateDelta(player, [match({ setsA: 0, setsB: 0 })]).delta).toBe(0);
  });

  it("ajusta as 6 notas com o mesmo delta, limitado a 0–10, sem mudar as notas base", () => {
    const ratings = { attack: 9.95, defense: 0.02, serve: 5, setting: 5, blocking: 5, consistency: 5 };
    expect(adjustRatings(ratings, 0.1)).toEqual({ attack: 10, defense: 0.12000000000000001, serve: 5.1, setting: 5.1, blocking: 5.1, consistency: 5.1 });
    expect(adjustRatings(ratings, -0.1).defense).toBe(0);
    expect(ratings.attack).toBe(9.95);
  });
});

describe("random", () => {
  it("seededRandom repete a sequência para a mesma semente e fica em [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seededRandom(7)()).not.toBe(seededRandom(8)());
  });

  it("randomIndex escolhe como nextInt e recusa entradas inválidas", () => {
    expect(randomIndex(4, () => 0)).toBe(0);
    expect(randomIndex(4, () => 0.9999)).toBe(3);
    expect(randomIndex(3, defaultRandom)).toBeLessThan(3);
    expect(() => randomIndex(0)).toThrow(RangeError);
    expect(() => randomIndex(2, () => 1)).toThrow(RangeError);
  });
});
