/**
 * DADOS FICTÍCIOS, apenas para testes. Não representam jogadores reais.
 * Uma escalação válida: 14 jogadores, 7 por time (levantador, 5 titulares de linha, reserva).
 */

export const PLAYER_IDS = Array.from({ length: 14 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

export const SETTER_IDS = [PLAYER_IDS[0], PLAYER_IDS[7]];

function team(ids, scores) {
  return ids.map((playerId, index) => ({
    playerId,
    playerName: `Jogador Teste ${PLAYER_IDS.indexOf(playerId) + 1}`,
    isSetter: index === 0,
    isStarter: index < 6,
    score: scores[index]
  }));
}

const average = (slots) => slots.filter((slot) => slot.isStarter).reduce((sum, slot) => sum + slot.score, 0) / 6;

export function buildLineup() {
  const teamA = team(PLAYER_IDS.slice(0, 7), [6.2, 5.5, 6.1, 6.8, 7.0, 7.4, 4.1]);
  const teamB = team(PLAYER_IDS.slice(7, 14), [6.0, 5.6, 6.3, 6.6, 7.1, 7.2, 4.0]);
  const averageA = average(teamA);
  const averageB = average(teamB);
  return { teamA, teamB, averageA, averageB, difference: Math.abs(averageA - averageB) };
}

export function buildDrawRequest() {
  return { playerIds: [...PLAYER_IDS], setterIds: [...SETTER_IDS] };
}
