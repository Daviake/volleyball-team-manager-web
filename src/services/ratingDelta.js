import { RATING_KEYS } from "../domain/player.js";
import { DEFAULT_SETTINGS } from "../domain/settings.js";
import { clamp } from "../utils/numbers.js";
import { calculatePreferredRoleScore } from "./ratingCalculator.js";

/**
 * Delta elástico (R8). No Java a fórmula está duplicada em SorteioService e EstatisticasService;
 * aqui existe uma única implementação, usada pelo sorteio e pelas estatísticas.
 * As notas base nunca são alteradas: o delta é sempre recalculado a partir do histórico.
 */

/**
 * Soma os sets ganhos e perdidos pelo jogador nas partidas com placar registrado.
 * Titulares e reserva contam igualmente. Partidas sem placar são ignoradas.
 * As partidas já chegam validadas pelo domínio, então não há leitura de JSON que possa falhar
 * em silêncio (corrige o P6).
 */
export function countSets(playerId, matches) {
  let setsWon = 0;
  let setsLost = 0;
  for (const match of matches) {
    if (!match.score) continue;
    if (match.teamA.some((slot) => slot.playerId === playerId)) {
      setsWon += match.score.setsA;
      setsLost += match.score.setsB;
    } else if (match.teamB.some((slot) => slot.playerId === playerId)) {
      setsWon += match.score.setsB;
      setsLost += match.score.setsA;
    }
  }
  return { setsWon, setsLost };
}

/**
 * Delta a partir de uma contagem de sets já feita.
 *
 *   fator     = (scoreBase no papel preferido − 5) / 5
 *   ganho/set = 0,05 × (1 − 0,3 × fator)
 *   perda/set = 0,05 × (1 + 0,3 × fator)
 *   delta     = setsGanhos × ganho − setsPerdidos × perda
 */
export function calculateDeltaFromSets(player, { setsWon, setsLost }, settings = DEFAULT_SETTINGS) {
  const { base, elasticity } = settings.ratingDelta;
  const baseScore = calculatePreferredRoleScore(player, settings.weights);
  const factor = (baseScore - 5.0) / 5.0;
  const gainPerSet = base * (1.0 - elasticity * factor);
  const lossPerSet = base * (1.0 + elasticity * factor);
  const delta = setsWon * gainPerSet - setsLost * lossPerSet;
  return { setsWon, setsLost, gainPerSet, lossPerSet, delta };
}

/** Delta de um jogador considerando todo o histórico de partidas. */
export function calculateDelta(player, matches, settings = DEFAULT_SETTINGS) {
  return calculateDeltaFromSets(player, countSets(player.id, matches), settings);
}

/** Soma o mesmo delta às 6 notas, limitando cada uma ao intervalo 0–10. */
export function adjustRatings(ratings, delta, settings = DEFAULT_SETTINGS) {
  const { min, max } = settings.ratings;
  return Object.fromEntries(RATING_KEYS.map((key) => [key, clamp(ratings[key] + delta, min, max)]));
}
