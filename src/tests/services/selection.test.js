import { describe, expect, it } from "vitest";
import {
  autoComplete,
  clearSelection,
  filterAndSortPlayers,
  getSelectionError,
  MEMBERSHIP_FILTERS,
  ROLE_FILTERS,
  selectLastLineup,
  selectMonthly,
  sortPlayersByName,
  toDrawRequest,
  toggleSelection,
  toggleSetter
} from "../../services/selectionService.js";
import { buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { buildPlayer, buildPlayers } from "../fixtures/players.js";

const empty = () => clearSelection().selection;
const select = (players) => players.reduce((selection, player) => toggleSelection(selection, player).selection, empty());

describe("selectionService (R6)", () => {
  it("quem costuma levantar entra como levantador hoje se houver vaga (máximo 2)", () => {
    const setters = buildPlayers(3, () => ({ prefersSetter: true }));
    const selection = select(setters);
    expect(selection.playerIds).toHaveLength(3);
    expect(selection.setterIds).toEqual([setters[0].id, setters[1].id]);
  });

  it("desmarcar tira também dos levantadores", () => {
    const [setter] = buildPlayers(1);
    const selection = toggleSelection(select([setter]), setter).selection;
    expect(selection).toEqual({ playerIds: [], setterIds: [] });
  });

  it("bloqueia o 15º jogador com aviso", () => {
    const players = buildPlayers(15);
    const full = select(players.slice(0, 14));
    const result = toggleSelection(full, players[14]);
    expect(result.selection.playerIds).toHaveLength(14);
    expect(result.warning).toBe("Você já selecionou 14 jogadores. Desmarque algum para trocar.");
  });

  it("levantador hoje: no máximo 2 e só entre os selecionados", () => {
    const players = buildPlayers(4, () => ({ prefersSetter: false }));
    let selection = select(players);
    selection = toggleSetter(selection, players[0].id).selection;
    selection = toggleSetter(selection, players[1].id).selection;
    selection = toggleSetter(selection, players[2].id).selection;
    expect(selection.setterIds).toEqual([players[0].id, players[1].id]);
    expect(toggleSetter(selection, players[0].id).selection.setterIds).toEqual([players[1].id]);
    expect(toggleSetter(empty(), players[0].id).selection.setterIds).toEqual([]);
  });

  it("últimos 14: usa o sorteio mais recente e ignora quem não está mais cadastrado", () => {
    const players = buildPlayers(13);
    const older = { id: "a", playedAt: "2026-10-01T10:00:00Z", ...buildLineup() };
    const latest = { id: "b", playedAt: "2026-10-08T10:00:00Z", ...buildLineup() };
    const result = selectLastLineup([older, latest], players);
    expect(result.selection.playerIds).toHaveLength(13);
    expect(result.selection.setterIds).toEqual([PLAYER_IDS[0], PLAYER_IDS[7]]);
    expect(result.warning).toBe("Apenas 13/14 jogadores do último sorteio ainda estão cadastrados. Complete manualmente.");
    expect(selectLastLineup([], players).warning).toBe("Ainda não há nenhum sorteio salvo no histórico.");
    expect(selectLastLineup([latest], buildPlayers(14)).warning).toBeNull();
  });

  it("selecionar mensalistas substitui a seleção: 2 levantadores, linha e depois os demais levantadores", () => {
    const players = buildPlayers(16, (index) => ({ prefersSetter: index < 4, isMonthly: index !== 15 }));
    const { selection, warning } = selectMonthly(players);
    expect(selection.setterIds).toEqual([players[0].id, players[1].id]);
    expect(selection.playerIds).toHaveLength(14);
    expect(selection.playerIds).not.toContain(players[15].id);
    // 2 levantadores + 11 de linha mensalistas + 1 levantador extra (sem marcar como levantador hoje)
    expect(selection.playerIds.at(-1)).toBe(players[2].id);
    expect(warning).toBeNull();
    expect(selectMonthly(players.slice(0, 5)).warning).toBe("Só há 5 jogador(es) mensalista(s) cadastrado(s). Selecione mais 9 manualmente.");
  });

  it("completar automaticamente mantém a seleção, garante 2 levantadores e prioriza a linha", () => {
    const players = buildPlayers(18, (index) => ({ prefersSetter: index < 5 }));
    const start = toggleSelection(empty(), players[10]).selection;
    const { selection } = autoComplete(start, players);
    expect(selection.playerIds[0]).toBe(players[10].id);
    expect(selection.playerIds).toHaveLength(14);
    expect(selection.setterIds).toEqual([players[0].id, players[1].id]);
    // Os outros 3 que costumam levantar ficam de fora: 12 dos 13 de linha completam os 14.
    const chosenSetters = players.filter((player) => player.prefersSetter && selection.playerIds.includes(player.id));
    expect(chosenSetters).toHaveLength(2);
  });

  it("completar não passa de 2 levantadores (correção do P4)", () => {
    const players = buildPlayers(14, (index) => ({ prefersSetter: index < 6 }));
    const { selection } = autoComplete(empty(), players);
    expect(selection.playerIds).toHaveLength(14);
    expect(selection.setterIds).toHaveLength(2);
    expect(getSelectionError(selection)).toBeNull();
  });

  it("completar nunca passa de 14 (correção do P10, decisão D16)", () => {
    const players = buildPlayers(16, (index) => ({ prefersSetter: index >= 14 }));
    const full = select(players.slice(0, 14));
    const { selection, warning } = autoComplete(full, players);
    expect(selection.playerIds).toHaveLength(14);
    expect(selection.setterIds).toEqual([]);
    expect(warning).toBe("Faltam 2 levantador(es). Marque manualmente quem vai levantar hoje.");
  });

  it("completar marca primeiro quem já está selecionado e costuma levantar, sem ocupar vaga", () => {
    const players = buildPlayers(16, (index) => ({ prefersSetter: [0, 13, 14].includes(index) }));
    // Só o primeiro está marcado como levantador hoje; o 14º costuma levantar, mas não foi marcado.
    const full = { ...select(players.slice(0, 14)), setterIds: [players[0].id] };
    const { selection, warning } = autoComplete(full, players);
    expect(selection.playerIds).toHaveLength(14);
    expect(selection.setterIds).toEqual([players[0].id, players[13].id]);
    expect(warning).toBeNull();
  });

  it("lista com busca e filtros, selecionados no topo e depois em ordem alfabética", () => {
    const players = [
      buildPlayer(0, { name: "Bruno", prefersSetter: true }),
      buildPlayer(1, { name: "ana", prefersSetter: false }),
      buildPlayer(2, { name: "Álvaro", prefersSetter: false, isMonthly: false }),
      buildPlayer(3, { name: "Carla", prefersSetter: false })
    ];
    expect(filterAndSortPlayers(players, {}, [players[3].id]).map((player) => player.name)).toEqual(["Carla", "Álvaro", "ana", "Bruno"]);
    expect(filterAndSortPlayers(players, { search: "  AN " }).map((player) => player.name)).toEqual(["ana"]);
    expect(filterAndSortPlayers(players, { search: "alvaro" })).toEqual([]);
    expect(filterAndSortPlayers(players, { role: ROLE_FILTERS.SETTERS }).map((player) => player.name)).toEqual(["Bruno"]);
    expect(filterAndSortPlayers(players, { membership: MEMBERSHIP_FILTERS.CASUAL }).map((player) => player.name)).toEqual(["Álvaro"]);
    expect(sortPlayersByName(players).map((player) => player.name)).toEqual(["Álvaro", "ana", "Bruno", "Carla"]);
  });

  it("mensagens de validação da seleção iguais às do Java", () => {
    const players = buildPlayers(14, () => ({ prefersSetter: false }));
    let selection = select(players.slice(0, 10));
    expect(getSelectionError(selection)).toBe("Selecione mais 4 jogador(es).");
    selection = select(players);
    expect(getSelectionError(selection)).toBe("É necessário selecionar exatamente 2 levantadores.");
    selection = toggleSetter(toggleSetter(selection, players[0].id).selection, players[1].id).selection;
    expect(getSelectionError(selection)).toBeNull();
    expect(getSelectionError({ ...selection, setterIds: [...selection.setterIds, players[2].id] })).toBe("Você selecionou levantadores demais.");
    expect(toDrawRequest(selection)).toEqual({ playerIds: selection.playerIds, setterIds: selection.setterIds });
  });
});
