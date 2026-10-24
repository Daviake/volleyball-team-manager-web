import { deserializeMatch } from "../../domain/match.js";
import { deserializePlayer } from "../../domain/player.js";
import { isPlainObject } from "../../domain/validation.js";
import { nameKey } from "../../utils/text.js";

/**
 * Converte os dados exportados da API Java (respostas de GET /jogadores e GET /sorteios) para os
 * modelos da versão web (dúvida D13). Ids são preservados para manter os vínculos entre partidas
 * e jogadores, e portanto as estatísticas e o delta.
 *
 * Nada é corrigido em silêncio: registros inválidos ficam de fora e cada um gera um aviso em
 * `warnings`. Campos sem uso na versão web (`evolucao`, `scoreLinha`, `resultado`…) são ignorados;
 * o resultado é sempre derivado do placar.
 */
export function convertJavaExport({ jogadores = [], sorteios = [] } = {}) {
  const warnings = [];
  const players = [];
  const matches = [];

  if (!Array.isArray(jogadores)) warnings.push("A lista de jogadores do arquivo não é uma lista; nenhum jogador foi lido.");
  if (!Array.isArray(sorteios)) warnings.push("A lista de sorteios do arquivo não é uma lista; nenhum sorteio foi lido.");

  (Array.isArray(jogadores) ? jogadores : []).forEach((raw, index) => {
    const result = deserializePlayer(fromJavaPlayer(raw));
    if (result.ok) players.push(result.value);
    else warnings.push(`Jogador ${index + 1} (${describe(raw?.nome)}) ignorado: ${Object.values(result.errors).join(" ")}`);
  });

  (Array.isArray(sorteios) ? sorteios : []).forEach((raw, index) => {
    const result = deserializeMatch(fromJavaMatch(raw));
    if (result.ok) matches.push(result.value);
    else warnings.push(`Sorteio ${index + 1} (${describe(raw?.data)}) ignorado: ${Object.values(result.errors).join(" ")}`);
  });

  warnings.push(...duplicateWarnings(players));
  return { players, matches, warnings };
}

function fromJavaPlayer(raw) {
  if (!isPlainObject(raw)) return raw;
  return {
    id: raw.id,
    name: raw.nome,
    prefersSetter: raw.levantador,
    isMonthly: raw.mensalista,
    isWoman: raw.mulher,
    ratings: {
      attack: raw.ataque,
      defense: raw.defesa,
      serve: raw.saque,
      setting: raw.levantamento,
      blocking: raw.bloqueio,
      consistency: raw.constancia
    }
  };
}

function fromJavaMatch(raw) {
  if (!isPlainObject(raw)) return raw;
  const hasScore = raw.setsTimeA !== null && raw.setsTimeA !== undefined && raw.setsTimeB !== null && raw.setsTimeB !== undefined;
  return {
    id: raw.id,
    playedAt: raw.data,
    playerIds: raw.jogadoresIds,
    teamA: fromJavaTeam(raw.timeA),
    teamB: fromJavaTeam(raw.timeB),
    averageA: raw.mediaTimeA,
    averageB: raw.mediaTimeB,
    difference: raw.diferenca,
    score: hasScore ? { setsA: raw.setsTimeA, setsB: raw.setsTimeB } : null
  };
}

function fromJavaTeam(team) {
  if (!Array.isArray(team)) return team;
  return team.map((slot) =>
    isPlainObject(slot)
      ? {
          playerId: slot.jogadorId,
          playerName: typeof slot.nome === "string" ? slot.nome.trim() : slot.nome,
          isSetter: slot.levantador,
          isStarter: slot.titular,
          score: slot.score
        }
      : slot
  );
}

/** Nomes repetidos (possíveis no Java por P1/P3) são mantidos, mas avisados para revisão. */
function duplicateWarnings(players) {
  const byKey = new Map();
  for (const player of players) {
    const key = nameKey(player.name);
    byKey.set(key, [...(byKey.get(key) ?? []), player.name]);
  }
  return [...byKey.values()]
    .filter((names) => names.length > 1)
    .map((names) => `Nome repetido no arquivo: "${names[0]}" aparece ${names.length} vezes. Revise antes de usar.`);
}

function describe(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "sem identificação";
}
