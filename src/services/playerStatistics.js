import { DEFAULT_SETTINGS } from "../domain/settings.js";
import { calculateScore } from "./ratingCalculator.js";
import { adjustRatings, calculateDeltaFromSets } from "./ratingDelta.js";
import { sortByDateDesc } from "./matchService.js";

/**
 * Estatísticas individuais e jogador do mês (R13; Java: EstatisticasService).
 * Tudo é derivado do cadastro e do histórico; nada aqui é gravado.
 */

export const GAME_RESULT = Object.freeze({ WIN: "WIN", LOSS: "LOSS", DRAW: "DRAW" });

/**
 * Jogos de cada jogador, do ponto de vista dele, do mais recente para o mais antigo.
 * Só partidas com placar contam. Devolve um Map playerId → [{ playedAt, setsWon, setsLost }].
 */
export function collectGamesByPlayer(matches) {
  const games = new Map();
  const add = (playerId, game) => {
    if (!games.has(playerId)) games.set(playerId, []);
    games.get(playerId).push(game);
  };
  for (const match of sortByDateDesc(matches)) {
    if (!match.score) continue;
    const { setsA, setsB } = match.score;
    for (const slot of match.teamA) add(slot.playerId, { playedAt: match.playedAt, setsWon: setsA, setsLost: setsB });
    for (const slot of match.teamB) add(slot.playerId, { playedAt: match.playedAt, setsWon: setsB, setsLost: setsA });
  }
  return games;
}

/**
 * Estatísticas de um jogador a partir dos seus jogos (Java: buildStats).
 * winRate é o aproveitamento por SETS, em %, e 0 sem sets disputados.
 */
export function buildPlayerStats(player, games, settings = DEFAULT_SETTINGS) {
  const setsWon = games.reduce((sum, game) => sum + game.setsWon, 0);
  const setsLost = games.reduce((sum, game) => sum + game.setsLost, 0);
  const { gainPerSet, lossPerSet, delta } = calculateDeltaFromSets(player, { setsWon, setsLost }, settings);
  const adjustedRatings = adjustRatings(player.ratings, delta, settings);
  const total = setsWon + setsLost;
  return {
    playerId: player.id,
    name: player.name,
    prefersSetter: player.prefersSetter,
    isMonthly: player.isMonthly,
    isWoman: player.isWoman,
    ratings: { ...player.ratings },
    setsWon,
    setsLost,
    setBalance: setsWon - setsLost,
    winRate: total === 0 ? 0.0 : (setsWon / total) * 100.0,
    delta,
    gainPerSet,
    lossPerSet,
    adjustedRatings,
    adjustedHitterScore: calculateScore(adjustedRatings, false, settings.weights),
    adjustedSetterScore: calculateScore(adjustedRatings, true, settings.weights),
    recentGames: [...games]
      .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
      .slice(0, settings.recentMatches)
      .map((game) => ({ ...game, result: gameResult(game) })),
    isPlayerOfMonth: false,
    highlightScore: null
  };
}

/** Estatísticas de todos os jogadores cadastrados, com o jogador do mês marcado. */
export function buildAllStats(players, matches, settings = DEFAULT_SETTINGS) {
  const games = collectGamesByPlayer(matches);
  const stats = players.map((player) => buildPlayerStats(player, games.get(player.id) ?? [], settings));
  return selectPlayerOfMonth(stats, settings);
}

/** Score ajustado no papel preferido do cadastro. */
export function preferredAdjustedScore(stats) {
  return stats.prefersSetter ? stats.adjustedSetterScore : stats.adjustedHitterScore;
}

/**
 * Jogador do mês (Java: selecionarJogadorDoMes). Elegíveis: quem disputou ao menos 1 set.
 * Pontuação = 0,25·norm(winRate) + 0,25·norm(saldo) + 0,25·norm(delta) + 0,25·norm(score ajustado),
 * com normalização min-max (0,5 quando todos são iguais). Maior pontuação vence; em empate exato,
 * fica o primeiro da lista. Usa todo o histórico, sem filtro de mês (dúvida D10).
 * Devolve uma lista nova com `highlightScore` dos elegíveis e `isPlayerOfMonth` do vencedor.
 */
export function selectPlayerOfMonth(stats, settings = DEFAULT_SETTINGS) {
  const weights = settings.playerOfMonth;
  const eligible = stats.filter((item) => item.setsWon + item.setsLost > 0);
  if (eligible.length === 0) return stats.map((item) => ({ ...item }));

  const metrics = [
    { weight: weights.winRate, read: (item) => item.winRate },
    { weight: weights.setBalance, read: (item) => item.setBalance },
    { weight: weights.delta, read: (item) => item.delta },
    { weight: weights.adjustedScore, read: preferredAdjustedScore }
  ].map((metric) => {
    const values = eligible.map(metric.read);
    return { ...metric, min: Math.min(...values), max: Math.max(...values) };
  });

  const scores = new Map();
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const item of eligible) {
    let score = 0;
    for (const metric of metrics) score += metric.weight * normalizeMinMax(metric.read(item), metric.min, metric.max);
    scores.set(item, score);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return stats.map((item) => ({
    ...item,
    highlightScore: scores.has(item) ? scores.get(item) : null,
    isPlayerOfMonth: item === best
  }));
}

function normalizeMinMax(value, min, max) {
  return max - min < 1e-9 ? 0.5 : (value - min) / (max - min);
}

function gameResult({ setsWon, setsLost }) {
  if (setsWon > setsLost) return GAME_RESULT.WIN;
  if (setsWon < setsLost) return GAME_RESULT.LOSS;
  return GAME_RESULT.DRAW;
}
