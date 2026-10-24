import { describe, expect, it } from "vitest";
import { validateLineup } from "../../domain/team.js";
import {
  combinations,
  enumerateCandidates,
  filterByWomenBalance,
  generateTeams,
  scorePlayersForDraw,
  selectEligibleCandidates
} from "../../services/teamBalancer.js";
import { calculateScore } from "../../services/ratingCalculator.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { seededRandom } from "../../utils/random.js";
import { buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { buildPlayers, uniformRatings } from "../fixtures/players.js";

const players = buildPlayers();
const request = { playerIds: [...PLAYER_IDS], setterIds: [PLAYER_IDS[0], PLAYER_IDS[1]] };

describe("teamBalancer (R7)", () => {
  it("gera 2 × C(12,6) = 1.848 candidatos, todos válidos", () => {
    const scored = scorePlayersForDraw({ players, request });
    const candidates = enumerateCandidates(scored);
    expect(candidates).toHaveLength(1848);
    expect(candidates.every((candidate) => Object.keys(validateLineup(candidate)).length === 0)).toBe(true);
  });

  it("combinations segue a ordem lexicográfica do Java", () => {
    expect(combinations(["a", "b", "c", "d"], 2)).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
      ["b", "c"],
      ["b", "d"],
      ["c", "d"]
    ]);
  });

  it("monta cada time com levantador, titulares em ordem crescente e reserva de menor score fora da média", () => {
    const lineup = generateTeams({ players, request, random: seededRandom(1) });
    for (const team of [lineup.teamA, lineup.teamB]) {
      const [setter, ...rest] = team;
      const reserve = rest.at(-1);
      const starters = rest.slice(0, -1);
      expect(setter.isSetter && setter.isStarter).toBe(true);
      expect(reserve.isStarter).toBe(false);
      expect(starters.every((slot, index) => index === 0 || slot.score >= starters[index - 1].score)).toBe(true);
      expect(reserve.score).toBeLessThanOrEqual(starters[0].score);
    }
    const expectedA = (lineup.teamA.slice(1, 6).reduce((sum, slot) => sum + slot.score, 0) + lineup.teamA[0].score) / 6;
    expect(lineup.averageA).toBe(expectedA);
    expect(lineup.difference).toBe(Math.abs(lineup.averageA - lineup.averageB));
  });

  it("usa o score no papel do sorteio, não na preferência", () => {
    const today = { ...request, setterIds: [PLAYER_IDS[2], PLAYER_IDS[3]] };
    const scored = scorePlayersForDraw({ players, request: today });
    expect(scored[2].score).toBe(calculateScore(players[2].ratings, true));
    expect(scored[0].score).toBe(calculateScore(players[0].ratings, false));
  });

  it("usa as notas ajustadas pelo delta do histórico", () => {
    const history = [{ id: "m1", playedAt: "2026-10-01T20:00:00.000Z", playerIds: PLAYER_IDS, ...buildLineup(), score: { setsA: 3, setsB: 0 } }];
    const before = scorePlayersForDraw({ players, request })[2].score;
    const after = scorePlayersForDraw({ players, request, matches: history })[2].score;
    expect(after).toBeGreaterThan(before);
  });

  it("o resultado escolhido está dentro da folga de 0,05 da menor diferença", () => {
    const scored = scorePlayersForDraw({ players, request });
    const smallest = Math.min(...enumerateCandidates(scored).map((candidate) => candidate.difference));
    for (let seed = 1; seed <= 20; seed += 1) {
      const lineup = generateTeams({ players, request, random: seededRandom(seed) });
      expect(lineup.difference).toBeLessThanOrEqual(smallest + 0.05 + 1e-9);
    }
  });

  it("com a mesma semente o sorteio é sempre igual", () => {
    expect(generateTeams({ players, request, random: seededRandom(99) })).toEqual(generateTeams({ players, request, random: seededRandom(99) }));
  });

  it("o gerador escolhe a posição entre os elegíveis, na ordem de enumeração", () => {
    const scored = scorePlayersForDraw({ players, request });
    const eligible = selectEligibleCandidates(filterByWomenBalance(enumerateCandidates(scored), scored));
    expect(generateTeams({ players, request, random: () => 0 }).teamA).toEqual(eligible[0].teamA);
    expect(generateTeams({ players, request, random: () => 0.999999 }).teamA).toEqual(eligible.at(-1).teamA);
  });

  it("equilibra mulheres no time A entre floor(n/2) e ceil(n/2), contando o reserva", () => {
    const withWomen = buildPlayers(14, (index) => ({ isWoman: [3, 7, 11].includes(index) }));
    for (let seed = 1; seed <= 15; seed += 1) {
      const lineup = generateTeams({ players: withWomen, request, random: seededRandom(seed) });
      const women = lineup.teamA.filter((slot) => withWomen.find((player) => player.id === slot.playerId).isWoman).length;
      expect([1, 2]).toContain(women);
    }
  });

  it("filtro de mulheres usa todos os candidatos quando nenhum passa (fallback)", () => {
    const scored = [{ player: { isWoman: true } }, { player: { isWoman: true } }];
    const candidates = [{ womenInTeamA: 0 }, { womenInTeamA: 2 }];
    expect(filterByWomenBalance(candidates, scored)).toBe(candidates);
    expect(filterByWomenBalance([...candidates, { womenInTeamA: 1 }], scored)).toEqual([{ womenInTeamA: 1 }]);
  });

  it("com scores iguais fica como reserva quem vem primeiro no pedido (ordenação estável)", () => {
    const equal = buildPlayers(14, () => ({ ratings: uniformRatings(5) }));
    const lineup = generateTeams({ players: equal, request, random: () => 0 });
    expect(lineup.difference).toBe(0);
    const reserveA = lineup.teamA.at(-1).playerId;
    const hittersA = PLAYER_IDS.filter((id) => lineup.teamA.some((slot) => slot.playerId === id && !slot.isSetter));
    expect(reserveA).toBe(hittersA[0]);
  });

  it("valida o pedido e os jogadores, como o Java", () => {
    expect(() => generateTeams({ players, request: { ...request, playerIds: PLAYER_IDS.slice(0, 13) } })).toThrow(ValidationError);
    expect(() => generateTeams({ players, request: { ...request, setterIds: [PLAYER_IDS[0]] } })).toThrow(ValidationError);
    expect(() => generateTeams({ players: players.slice(0, 13), request })).toThrow(NotFoundError);
  });

  it("não altera os dados recebidos", () => {
    const snapshot = JSON.stringify({ players, request });
    generateTeams({ players, request, random: seededRandom(3) });
    expect(JSON.stringify({ players, request })).toBe(snapshot);
  });
});
