import { RATING_KEYS } from "../domain/player.js";
import { DEFAULT_SETTINGS } from "../domain/settings.js";

/**
 * Score ponderado (R5; Java: ScoreService.calcular). Escala 0–10, sem arredondamento.
 *
 *   linha:      (3·ataque + 3,5·defesa + 2·saque + 0,5·bloqueio + 1·constância) / 10
 *   levantador: (1·ataque + 2·defesa + 5·levantamento + 1·bloqueio + 1·constância) / 10
 *
 * `isSetter` é o papel EFETIVO (o do sorteio), que pode ser diferente da preferência do cadastro.
 * As parcelas são somadas na ordem de RATING_KEYS; as de peso zero somam 0 e não alteram o
 * resultado, que fica idêntico ao do Java em ponto flutuante.
 */
export function calculateScore(ratings, isSetter, weights = DEFAULT_SETTINGS.weights) {
  const roleWeights = isSetter ? weights.setter : weights.hitter;
  let sum = 0;
  for (const key of RATING_KEYS) {
    sum += ratings[key] * roleWeights[key];
  }
  return sum / weights.divisor;
}

export function calculateHitterScore(ratings, weights = DEFAULT_SETTINGS.weights) {
  return calculateScore(ratings, false, weights);
}

export function calculateSetterScore(ratings, weights = DEFAULT_SETTINGS.weights) {
  return calculateScore(ratings, true, weights);
}

/** Score com as notas base, no papel preferido do cadastro (usado pelo fator elástico, R8). */
export function calculatePreferredRoleScore(player, weights = DEFAULT_SETTINGS.weights) {
  return calculateScore(player.ratings, player.prefersSetter, weights);
}
