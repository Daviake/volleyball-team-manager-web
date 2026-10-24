import { DEFAULT_SETTINGS } from "../domain/settings.js";
import { nameKey } from "../utils/text.js";
import { sortByDateDesc } from "./matchService.js";

/**
 * Seleção dos participantes de um sorteio (R6; Java: NovoSorteio.jsx).
 * A seleção é `{ playerIds, setterIds }` (listas na ordem em que foram marcados).
 * As funções devolvem `{ selection, warning }`, com `warning` = texto a mostrar ou `null`.
 */

export const ROLE_FILTERS = Object.freeze({ ALL: "all", SETTERS: "setters", HITTERS: "hitters" });
export const MEMBERSHIP_FILTERS = Object.freeze({ ALL: "all", MONTHLY: "monthly", CASUAL: "casual" });

export function clearSelection() {
  return { selection: { playerIds: [], setterIds: [] }, warning: null };
}

/** Jogadores em ordem alfabética (Java: `localeCompare` do navegador; aqui fixado em pt-BR). */
export function sortPlayersByName(players) {
  return [...players].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Marca ou desmarca um jogador. Ao marcar alguém que costuma levantar, ele já entra como
 * "levantador hoje" se ainda houver vaga. Ao desmarcar, sai também dos levantadores.
 */
export function toggleSelection(selection, player, settings = DEFAULT_SETTINGS) {
  const { playersPerDraw, settersPerDraw } = settings.draw;
  if (selection.playerIds.includes(player.id)) {
    return {
      selection: {
        playerIds: selection.playerIds.filter((id) => id !== player.id),
        setterIds: selection.setterIds.filter((id) => id !== player.id)
      },
      warning: null
    };
  }
  if (selection.playerIds.length >= playersPerDraw) {
    return {
      selection: copy(selection),
      warning: `Você já selecionou ${playersPerDraw} jogadores. Desmarque algum para trocar.`
    };
  }
  const addAsSetter = player.prefersSetter && selection.setterIds.length < settersPerDraw;
  return {
    selection: {
      playerIds: [...selection.playerIds, player.id],
      setterIds: addAsSetter ? [...selection.setterIds, player.id] : [...selection.setterIds]
    },
    warning: null
  };
}

/**
 * Marca ou desmarca um jogador selecionado como "levantador hoje" (máximo 2).
 * Na tela do Java a opção só aparece para quem está selecionado; aqui um jogador não selecionado
 * é simplesmente ignorado.
 */
export function toggleSetter(selection, playerId, settings = DEFAULT_SETTINGS) {
  if (selection.setterIds.includes(playerId)) {
    return { selection: { ...copy(selection), setterIds: selection.setterIds.filter((id) => id !== playerId) }, warning: null };
  }
  if (!selection.playerIds.includes(playerId) || selection.setterIds.length >= settings.draw.settersPerDraw) {
    return { selection: copy(selection), warning: null };
  }
  return { selection: { ...copy(selection), setterIds: [...selection.setterIds, playerId] }, warning: null };
}

/**
 * "Últimos 14 usados": jogadores do sorteio confirmado mais recente que ainda estão cadastrados;
 * os levantadores são os que eram levantadores naquele sorteio.
 */
export function selectLastLineup(matches, players, settings = DEFAULT_SETTINGS) {
  const { playersPerDraw } = settings.draw;
  if (matches.length === 0) {
    return { selection: { playerIds: [], setterIds: [] }, warning: "Ainda não há nenhum sorteio salvo no histórico." };
  }
  const [latest] = sortByDateDesc(matches);
  const registered = new Set(players.map((player) => player.id));
  const slots = [...latest.teamA, ...latest.teamB].filter((slot) => registered.has(slot.playerId));
  const selection = {
    playerIds: slots.map((slot) => slot.playerId),
    setterIds: slots.filter((slot) => slot.isSetter).map((slot) => slot.playerId)
  };
  const warning =
    selection.playerIds.length < playersPerDraw
      ? `Apenas ${selection.playerIds.length}/${playersPerDraw} jogadores do último sorteio ainda estão cadastrados. Complete manualmente.`
      : null;
  return { selection, warning };
}

/**
 * "Selecionar mensalistas": SUBSTITUI a seleção atual. Levantadores = os 2 primeiros mensalistas
 * que costumam levantar (ordem alfabética); completa com mensalistas de linha e, se faltar,
 * com os demais mensalistas levantadores (sem marcá-los como levantador hoje).
 */
export function selectMonthly(players, settings = DEFAULT_SETTINGS) {
  const { playersPerDraw, settersPerDraw } = settings.draw;
  const monthly = sortPlayersByName(players).filter((player) => player.isMonthly);
  const monthlySetters = monthly.filter((player) => player.prefersSetter);
  const monthlyHitters = monthly.filter((player) => !player.prefersSetter);

  const setterIds = monthlySetters.slice(0, settersPerDraw).map((player) => player.id);
  const playerIds = [...setterIds];
  for (const player of [...monthlyHitters, ...monthlySetters.slice(settersPerDraw)]) {
    if (playerIds.length >= playersPerDraw) break;
    playerIds.push(player.id);
  }
  const missing = playersPerDraw - playerIds.length;
  const warning =
    missing > 0
      ? `Só há ${playerIds.length} jogador(es) mensalista(s) cadastrado(s). Selecione mais ${missing} manualmente.`
      : null;
  return { selection: { playerIds, setterIds }, warning };
}

/**
 * "Completar automaticamente": MANTÉM a seleção atual. Se faltar levantador, adiciona quem
 * costuma levantar até ter 2; depois completa até 14 dando prioridade a quem não levanta
 * (ordem alfabética dentro de cada grupo).
 *
 * Diferenças em relação ao Java:
 * - P4 corrigido: quem costuma levantar e entra na segunda fase só vira "levantador hoje" se
 *   ainda houver vaga; no Java podiam ficar mais de 2 levantadores.
 * - P10 corrigido (decisão D16): a seleção nunca passa de 14. Na primeira fase, quem já está
 *   selecionado e costuma levantar é marcado primeiro (não ocupa vaga); só depois entram jogadores
 *   novos, e apenas se houver vaga. Se ainda faltar levantador, a tela recebe um aviso.
 */
export function autoComplete(selection, players, settings = DEFAULT_SETTINGS) {
  const { playersPerDraw, settersPerDraw } = settings.draw;
  const sorted = sortPlayersByName(players);
  const playerIds = [...selection.playerIds];
  const setterIds = [...selection.setterIds];
  const candidates = sorted.filter((player) => player.prefersSetter && !setterIds.includes(player.id));
  const alreadySelected = candidates.filter((player) => playerIds.includes(player.id));
  const notSelected = candidates.filter((player) => !playerIds.includes(player.id));

  for (const player of alreadySelected) {
    if (setterIds.length >= settersPerDraw) break;
    setterIds.push(player.id);
  }
  for (const player of notSelected) {
    if (setterIds.length >= settersPerDraw || playerIds.length >= playersPerDraw) break;
    playerIds.push(player.id);
    setterIds.push(player.id);
  }

  const remaining = sorted
    .filter((player) => !playerIds.includes(player.id))
    .sort((a, b) => Number(a.prefersSetter) - Number(b.prefersSetter));
  for (const player of remaining) {
    if (playerIds.length >= playersPerDraw) break;
    playerIds.push(player.id);
    if (player.prefersSetter && setterIds.length < settersPerDraw) setterIds.push(player.id);
  }
  const warning =
    setterIds.length < settersPerDraw
      ? `Faltam ${settersPerDraw - setterIds.length} levantador(es). Marque manualmente quem vai levantar hoje.`
      : null;
  return { selection: { playerIds, setterIds }, warning };
}

/**
 * Lista exibida na tela: filtros por busca (contém, sem diferenciar maiúsculas, com acentos),
 * preferência e mensalista; selecionados primeiro, depois ordem alfabética.
 */
export function filterAndSortPlayers(players, { search = "", role = ROLE_FILTERS.ALL, membership = MEMBERSHIP_FILTERS.ALL } = {}, selectedIds = []) {
  const query = nameKey(search);
  const selected = new Set(selectedIds);
  return players
    .filter((player) => {
      if (role === ROLE_FILTERS.SETTERS && !player.prefersSetter) return false;
      if (role === ROLE_FILTERS.HITTERS && player.prefersSetter) return false;
      if (membership === MEMBERSHIP_FILTERS.MONTHLY && !player.isMonthly) return false;
      if (membership === MEMBERSHIP_FILTERS.CASUAL && player.isMonthly) return false;
      if (query && !player.name.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => {
      const order = Number(!selected.has(a.id)) - Number(!selected.has(b.id));
      return order !== 0 ? order : a.name.localeCompare(b.name, "pt-BR");
    });
}

/** Mensagem que impede o sorteio, ou `null` se a seleção estiver pronta (Java: mensagemValidacao). */
export function getSelectionError(selection, settings = DEFAULT_SETTINGS) {
  const { playersPerDraw, settersPerDraw } = settings.draw;
  const players = selection.playerIds.length;
  const setters = selection.setterIds.length;
  if (players < playersPerDraw) return `Selecione mais ${playersPerDraw - players} jogador(es).`;
  if (players > playersPerDraw) return `Você selecionou jogadores demais (${players}/${playersPerDraw}).`;
  if (setters < settersPerDraw) return `É necessário selecionar exatamente ${settersPerDraw} levantadores.`;
  if (setters > settersPerDraw) return "Você selecionou levantadores demais.";
  return null;
}

/** Converte a seleção no pedido de sorteio do domínio. */
export function toDrawRequest(selection) {
  return { playerIds: [...selection.playerIds], setterIds: [...selection.setterIds] };
}

function copy(selection) {
  return { playerIds: [...selection.playerIds], setterIds: [...selection.setterIds] };
}
