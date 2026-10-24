import { BusinessRuleError } from "../utils/errors.js";

/**
 * Troca manual (R12; Java: Resultado.trocarJogadores). Um jogador do time A e um do time B trocam
 * de lugar. O "lugar" fica: `isStarter` e `isSetter` pertencem à posição; `playerId`,
 * `playerName` e `score` acompanham o jogador.
 *
 * Comportamento mantido do Java (dúvida D9, problema P8): o score NÃO é recalculado pelo novo
 * papel. Um jogador de linha que vai para a posição de levantador leva o score de linha.
 */
export function swapPlayers(lineup, playerIdA, playerIdB) {
  const slotA = lineup.teamA.find((slot) => slot.playerId === playerIdA);
  const slotB = lineup.teamB.find((slot) => slot.playerId === playerIdB);
  if (!slotA) throw new BusinessRuleError("Selecione um jogador do Time A.");
  if (!slotB) throw new BusinessRuleError("Selecione um jogador do Time B.");

  const teamA = lineup.teamA.map((slot) => (slot === slotA ? movePlayer(slotB, slotA) : { ...slot }));
  const teamB = lineup.teamB.map((slot) => (slot === slotB ? movePlayer(slotA, slotB) : { ...slot }));
  return withAverages(teamA, teamB);
}

/** Média dos titulares do time, na ordem da lista (Java: calcMediaTime). Sem titulares, 0. */
export function calculateTeamAverage(team) {
  const starters = team.filter((slot) => slot.isStarter);
  if (starters.length === 0) return 0;
  return starters.reduce((sum, slot) => sum + slot.score, 0) / starters.length;
}

/** Recalcula médias e diferença de uma escalação. */
export function withAverages(teamA, teamB) {
  const averageA = calculateTeamAverage(teamA);
  const averageB = calculateTeamAverage(teamB);
  return { teamA, teamB, averageA, averageB, difference: Math.abs(averageA - averageB) };
}

function movePlayer(from, position) {
  return {
    playerId: from.playerId,
    playerName: from.playerName,
    isSetter: position.isSetter,
    isStarter: position.isStarter,
    score: from.score
  };
}
