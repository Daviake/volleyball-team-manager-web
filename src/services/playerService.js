import { createPlayer, updatePlayerData } from "../domain/player.js";
import { nowIso } from "../utils/dates.js";
import { BusinessRuleError, NotFoundError } from "../utils/errors.js";
import { generateId } from "../utils/ids.js";
import { nameKey, normalizeName } from "../utils/text.js";

/**
 * Cadastro de jogadores (R1–R4; Java: JogadorService.criar, atualizar, excluir, validarNomeUnico).
 * Todas as funções recebem a lista atual e devolvem uma lista nova.
 */

/**
 * Nome único: dois jogadores não podem ter o mesmo nome comparando sem espaços nas pontas e sem
 * diferenciar maiúsculas; acentos contam ("José" ≠ "Jose"). `excludeId` ignora o próprio jogador.
 */
export function isNameTaken(players, name, excludeId = null) {
  const key = nameKey(name);
  return players.some((player) => player.id !== excludeId && nameKey(player.name) === key);
}

export function assertUniqueName(players, name, excludeId = null) {
  if (isNameTaken(players, name, excludeId)) {
    throw new BusinessRuleError(`Já existe um jogador com o nome "${normalizeName(name)}".`);
  }
}

export function findPlayer(players, playerId) {
  const player = players.find((item) => item.id === playerId);
  if (!player) throw new NotFoundError("Jogador não encontrado.");
  return player;
}

/** Cria um jogador (notas não informadas = 5; nome gravado sem espaços nas pontas, P1). */
export function addPlayer(players, input, { now = nowIso(), createId = generateId } = {}) {
  const player = createPlayer(input, { now, createId });
  assertUniqueName(players, player.name);
  return { player, players: [...players, player] };
}

/** Altera um jogador. Não mexe no histórico: os times salvos guardam o score do momento do sorteio. */
export function updatePlayer(players, playerId, changes, { now = nowIso() } = {}) {
  const current = findPlayer(players, playerId);
  const player = updatePlayerData(current, changes, { now });
  assertUniqueName(players, player.name, playerId);
  return { player, players: players.map((item) => (item.id === playerId ? player : item)) };
}

/**
 * Exclui um jogador. As partidas continuam com o nome e o id dele nos times; as estatísticas
 * deixam de ser calculadas (R3). A confirmação da exclusão é feita pela tela.
 */
export function removePlayer(players, playerId) {
  findPlayer(players, playerId);
  return players.filter((item) => item.id !== playerId);
}
