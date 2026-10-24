import { describe, expect, it } from "vitest";
import { addPlayer, assertUniqueName, removePlayer, updatePlayer } from "../../services/playerService.js";
import { buildAllStats, buildPlayerStats, collectGamesByPlayer, GAME_RESULT, selectPlayerOfMonth } from "../../services/playerStatistics.js";
import { calculateDelta } from "../../services/ratingDelta.js";
import { BusinessRuleError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { buildPlayer, buildPlayers, NOW } from "../fixtures/players.js";

describe("playerService (R1–R4)", () => {
  const fixedId = () => "novo-id";

  it("cria jogador com nome aparado e notas padrão 5", () => {
    const { player, players } = addPlayer([], { name: "  Ana  " }, { now: NOW, createId: fixedId });
    expect(player).toMatchObject({ id: "novo-id", name: "Ana", isMonthly: true, isWoman: false, prefersSetter: false });
    expect(Object.values(player.ratings).every((value) => value === 5)).toBe(true);
    expect(players).toEqual([player]);
  });

  it("nome único: ignora maiúsculas e espaços, mas não acentos", () => {
    const existing = [buildPlayer(0, { name: "José Silva" })];
    expect(() => addPlayer(existing, { name: " josé silva " })).toThrow('Já existe um jogador com o nome "josé silva".');
    expect(() => addPlayer(existing, { name: "Jose Silva" }, { now: NOW })).not.toThrow();
    expect(() => assertUniqueName(existing, "JOSÉ SILVA")).toThrow(BusinessRuleError);
  });

  it("edição ignora o próprio jogador na regra de nome único e preserva id e criação", () => {
    const players = buildPlayers(2);
    const later = "2026-10-25T10:00:00.000Z";
    const { player } = updatePlayer(players, players[0].id, { name: players[0].name.toUpperCase(), ratings: { attack: 9 } }, { now: later });
    expect(player).toMatchObject({ id: players[0].id, createdAt: NOW, updatedAt: later });
    expect(player.ratings.attack).toBe(9);
    expect(() => updatePlayer(players, players[0].id, { name: players[1].name })).toThrow(BusinessRuleError);
    expect(() => updatePlayer(players, players[0].id, { ratings: { attack: 11 } })).toThrow(ValidationError);
    expect(() => updatePlayer(players, "inexistente", {})).toThrow(NotFoundError);
  });

  it("exclusão remove só o jogador", () => {
    const players = buildPlayers(3);
    expect(removePlayer(players, players[1].id).map((player) => player.id)).toEqual([players[0].id, players[2].id]);
    expect(() => removePlayer(players, "inexistente")).toThrow(NotFoundError);
  });
});

describe("playerStatistics (R13)", () => {
  const players = buildPlayers();
  const match = (id, playedAt, score) => ({ id, playedAt, playerIds: PLAYER_IDS, ...buildLineup(), score });
  const matches = [
    match("m1", "2026-10-01T20:00:00.000Z", { setsA: 2, setsB: 1 }),
    match("m2", "2026-10-08T20:00:00.000Z", { setsA: 0, setsB: 3 }),
    match("m3", "2026-10-15T20:00:00.000Z", null),
    match("m4", "2026-10-22T20:00:00.000Z", { setsA: 1, setsB: 1 })
  ];

  it("soma sets, saldo e aproveitamento por sets", () => {
    const stats = buildAllStats(players, matches);
    const a = stats[0];
    expect(a).toMatchObject({ setsWon: 3, setsLost: 5, setBalance: -2, winRate: 37.5 });
    expect(stats[7]).toMatchObject({ setsWon: 5, setsLost: 3, setBalance: 2, winRate: 62.5 });
  });

  it("o delta das estatísticas é o mesmo do sorteio (implementação única)", () => {
    const stats = buildAllStats(players, matches);
    expect(stats[3].delta).toBe(calculateDelta(players[3], matches).delta);
  });

  it("últimos jogos: mais recentes primeiro, só com placar, com vitória/derrota/empate", () => {
    const [first] = buildAllStats(players, matches);
    expect(first.recentGames.map((game) => game.result)).toEqual([GAME_RESULT.DRAW, GAME_RESULT.LOSS, GAME_RESULT.WIN]);
    expect(first.recentGames[0]).toMatchObject({ playedAt: "2026-10-22T20:00:00.000Z", setsWon: 1, setsLost: 1 });
  });

  it("mostra no máximo 5 últimos jogos", () => {
    const many = Array.from({ length: 7 }, (_, index) => match(`x${index}`, `2026-09-0${index + 1}T20:00:00.000Z`, { setsA: 1, setsB: 0 }));
    const games = collectGamesByPlayer(many).get(PLAYER_IDS[0]);
    expect(buildPlayerStats(players[0], games).recentGames).toHaveLength(5);
  });

  it("sem sets disputados: winRate 0 e fora do jogador do mês", () => {
    const stats = buildAllStats(players, []);
    expect(stats.every((item) => item.winRate === 0 && !item.isPlayerOfMonth && item.highlightScore === null)).toBe(true);
  });

  it("jogador do mês: maior pontuação composta entre quem jogou", () => {
    const stats = buildAllStats(players, matches);
    const winner = stats.filter((item) => item.isPlayerOfMonth);
    expect(winner).toHaveLength(1);
    const best = Math.max(...stats.map((item) => item.highlightScore ?? -1));
    expect(winner[0].highlightScore).toBe(best);
    expect(stats.find((item) => item.isPlayerOfMonth).setBalance).toBe(2);
  });

  it("normalização dá 0,5 quando todos empatam e o empate exato fica com o primeiro da lista", () => {
    const base = { prefersSetter: false, adjustedHitterScore: 6, adjustedSetterScore: 5 };
    const stats = [
      { ...base, playerId: "a", setsWon: 2, setsLost: 1, winRate: 50, setBalance: 1, delta: 0.1 },
      { ...base, playerId: "b", setsWon: 2, setsLost: 1, winRate: 50, setBalance: 1, delta: 0.1 },
      { ...base, playerId: "c", setsWon: 0, setsLost: 0, winRate: 0, setBalance: 0, delta: 0 }
    ];
    const result = selectPlayerOfMonth(stats);
    expect(result.map((item) => item.highlightScore)).toEqual([0.5, 0.5, null]);
    expect(result.map((item) => item.isPlayerOfMonth)).toEqual([true, false, false]);
    expect(stats[0].isPlayerOfMonth).toBeUndefined();
  });

  it("usa o score ajustado no papel preferido", () => {
    const stats = buildAllStats(players, matches);
    const setter = stats[0];
    expect(setter.prefersSetter).toBe(true);
    expect(setter.adjustedSetterScore).not.toBe(setter.adjustedHitterScore);
  });
});
