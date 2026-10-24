/**
 * DADOS FICTÍCIOS, apenas para testes. Não representam jogadores reais.
 * 14 jogadores com notas variadas; os dois primeiros costumam levantar.
 */
import { PLAYER_IDS } from "./lineups.js";

export const NOW = "2026-10-24T12:00:00.000Z";

const BASE_RATINGS = [
  [6, 6, 5, 8, 5, 7],
  [5, 6, 5, 7, 4, 6],
  [8, 7, 7, 3, 6, 8],
  [7, 7, 6, 2, 7, 7],
  [7, 6, 8, 3, 5, 6],
  [6, 8, 5, 4, 4, 7],
  [6, 5, 6, 3, 6, 5],
  [5, 6, 6, 2, 5, 6],
  [5, 5, 4, 3, 5, 5],
  [4, 6, 5, 2, 3, 6],
  [4, 4, 5, 3, 4, 5],
  [3, 5, 4, 2, 4, 4],
  [3, 4, 3, 2, 3, 4],
  [2, 3, 3, 1, 2, 3]
];

export function buildPlayer(index, overrides = {}) {
  const [attack, defense, serve, setting, blocking, consistency] = BASE_RATINGS[index % BASE_RATINGS.length];
  return {
    id: PLAYER_IDS[index] ?? `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
    name: `Jogador Teste ${String(index + 1).padStart(2, "0")}`,
    prefersSetter: index < 2,
    isMonthly: true,
    isWoman: false,
    ratings: { attack, defense, serve, setting, blocking, consistency },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

export function buildPlayers(count = 14, overrides = () => ({})) {
  return Array.from({ length: count }, (_, index) => buildPlayer(index, overrides(index)));
}

export function uniformRatings(value) {
  return { attack: value, defense: value, serve: value, setting: value, blocking: value, consistency: value };
}
