import { describe, expect, it } from "vitest";
import {
  applyImport,
  IMPORT_ACTIONS,
  IMPORT_MODES,
  normalizeHeader,
  normalizeImportMode,
  parseRows,
  previewImport,
  TEMPLATE_ROWS
} from "../../services/import/playerImport.js";
import { convertJavaExport } from "../../services/import/javaDataImport.js";
import { BusinessRuleError } from "../../utils/errors.js";
import { buildLineup, PLAYER_IDS } from "../fixtures/lineups.js";
import { buildPlayer, NOW } from "../fixtures/players.js";

let counter = 0;
const createId = () => `importado-${(counter += 1)}`;

describe("parseRows (R14, leitura da planilha)", () => {
  it("normaliza cabeçalhos: minúsculas, sem acento, espaços viram _", () => {
    expect(normalizeHeader("  Constância ")).toBe("constancia");
    expect(normalizeHeader("Nome Completo")).toBe("nome_completo");
  });

  it("lê notas com vírgula, booleanos em vários formatos e deixa vazios como não informados", () => {
    const { items, errors } = parseRows([
      { " Nome ": " Ana ", Ataque: "7,5", Defesa: 6, Constância: "", Levantador: "Sim", Mensalista: "não", Mulher: "x" }
    ]);
    expect(errors).toEqual([]);
    expect(items).toEqual([{ line: 2, name: "Ana", ratings: { attack: 7.5, defense: 6 }, prefersSetter: true, isMonthly: false, isWoman: true }]);
  });

  it("linha sem nome é ignorada com aviso; nota ou booleano inválido descarta a linha", () => {
    const { items, errors } = parseRows([
      { nome: "" },
      { nome: "Bia", ataque: "11" },
      { nome: "Caio", saque: "abc" },
      { nome: "Duda", mulher: "talvez" },
      { nome: "Edu", bloqueio: "7abc" },
      { nome: "Fábio", ataque: "0", defesa: "10" }
    ]);
    expect(items.map((item) => item.name)).toEqual(["Fábio"]);
    expect(errors).toEqual([
      'Linha 2: coluna "nome" vazia, ignorada.',
      "Linha 3 (Bia): ataque — 11 fora do intervalo 0-10.",
      'Linha 4 (Caio): saque — "abc" não é número.',
      'Linha 5 (Duda): mulher — "talvez" não é sim/não.',
      'Linha 6 (Edu): bloqueio — "7abc" não é número.'
    ]);
  });

  it("nome repetido na própria planilha é descartado com aviso (correção do P3)", () => {
    const { items, errors } = parseRows([{ nome: "Gabi" }, { nome: " gabi " }]);
    expect(items).toHaveLength(1);
    expect(errors).toEqual(["Linha 3 (gabi): nome repetido na planilha (já aparece na linha 2), linha ignorada."]);
  });

  it("o modelo de planilha usa um exemplo identificado como fictício e é lido sem erros", () => {
    expect(TEMPLATE_ROWS[0].nome).toMatch(/fictício/);
    expect(parseRows(TEMPLATE_ROWS).errors).toEqual([]);
  });
});

describe("previewImport e applyImport (R14, modos)", () => {
  const existing = [buildPlayer(0, { name: "Ana" }), buildPlayer(1, { name: "Bia" })];
  const { items } = parseRows([
    { nome: "ana", ataque: 9, mulher: "sim" },
    { nome: "Nova", defesa: 8 }
  ]);

  it("modo ausente ou desconhecido vira MESCLAR", () => {
    expect(normalizeImportMode(undefined)).toBe(IMPORT_MODES.MERGE);
    expect(normalizeImportMode(" add ")).toBe(IMPORT_MODES.ADD);
    expect(normalizeImportMode("qualquer")).toBe(IMPORT_MODES.MERGE);
  });

  it("prévia mostra a ação de cada linha por modo", () => {
    const actions = (mode) => previewImport(items, existing, mode).rows.map((row) => row.action);
    expect(actions(IMPORT_MODES.MERGE)).toEqual([IMPORT_ACTIONS.UPDATE, IMPORT_ACTIONS.CREATE]);
    expect(actions(IMPORT_MODES.ADD)).toEqual([IMPORT_ACTIONS.IGNORE, IMPORT_ACTIONS.CREATE]);
    expect(actions(IMPORT_MODES.REPLACE)).toEqual([IMPORT_ACTIONS.CREATE, IMPORT_ACTIONS.CREATE]);
    expect(previewImport(items, existing, IMPORT_MODES.REPLACE).summary).toEqual({ toCreate: 2, toUpdate: 0, toIgnore: 0, removed: 2 });
  });

  it("MESCLAR atualiza só os campos informados (sem mudar o nome) e cria os novos com padrões", () => {
    const { players, summary } = applyImport(items, existing, IMPORT_MODES.MERGE, { now: NOW, createId });
    expect(summary).toEqual({ updated: 1, added: 1, ignored: [], errors: [], removed: 0 });
    const ana = players.find((player) => player.id === existing[0].id);
    expect(ana).toMatchObject({ name: "Ana", isWoman: true, ratings: { ...existing[0].ratings, attack: 9 } });
    const nova = players.find((player) => player.name === "Nova");
    expect(nova).toMatchObject({ prefersSetter: false, isMonthly: true, isWoman: false, ratings: { attack: 5, defense: 8, consistency: 5 } });
    expect(existing[0].ratings.attack).not.toBe(9);
  });

  it("ADICIONAR ignora os existentes e lista os nomes ignorados", () => {
    const { players, summary } = applyImport(items, existing, IMPORT_MODES.ADD, { now: NOW, createId });
    expect(summary).toMatchObject({ updated: 0, added: 1, ignored: ["ana"] });
    expect(players).toHaveLength(3);
  });

  it("SUBSTITUIR exige confirmação explícita e recria todos com ids novos (P9)", () => {
    expect(() => applyImport(items, existing, IMPORT_MODES.REPLACE)).toThrow(BusinessRuleError);
    const { players, summary } = applyImport(items, existing, IMPORT_MODES.REPLACE, { now: NOW, createId, confirmReplace: true });
    expect(summary).toMatchObject({ added: 2, removed: 2 });
    expect(players.map((player) => player.name)).toEqual(["ana", "Nova"]);
    expect(players.some((player) => player.id === existing[0].id)).toBe(false);
  });

  it("lista vazia não é importada; item inválido vai para os erros sem interromper", () => {
    expect(() => applyImport([], existing, IMPORT_MODES.MERGE)).toThrow(BusinessRuleError);
    const invalid = [{ name: "Zeca", ratings: { attack: 12 } }, { name: "Yuri", ratings: {} }];
    const { players, summary } = applyImport(invalid, existing, IMPORT_MODES.MERGE, { now: NOW, createId });
    expect(summary.added).toBe(1);
    expect(summary.errors).toEqual(["Zeca: Ataque: a nota deve estar entre 0 e 10."]);
    expect(players).toHaveLength(3);
  });
});

describe("convertJavaExport (D13)", () => {
  // DADOS FICTÍCIOS no formato das respostas da API Java.
  const lineup = buildLineup();
  const javaTeam = (team) => team.map((slot) => ({ jogadorId: slot.playerId, nome: `${slot.playerName} `, levantador: slot.isSetter, titular: slot.isStarter, score: slot.score }));
  const javaPlayer = (index, overrides = {}) => ({
    id: PLAYER_IDS[index],
    nome: `Jogador Teste ${index + 1}`,
    levantador: index === 0,
    mensalista: null,
    mulher: null,
    ataque: 6,
    defesa: 6,
    saque: 5,
    levantamento: 4,
    bloqueio: 5,
    constancia: 6,
    scoreLinha: 5.85,
    evolucao: 0,
    ...overrides
  });
  const javaMatch = (overrides = {}) => ({
    id: "s1",
    data: "2026-09-10T23:00:00Z",
    jogadoresIds: PLAYER_IDS,
    timeA: javaTeam(lineup.teamA),
    timeB: javaTeam(lineup.teamB),
    mediaTimeA: lineup.averageA,
    mediaTimeB: lineup.averageB,
    diferenca: lineup.difference,
    setsTimeA: 2,
    setsTimeB: 1,
    resultado: "TIME_A",
    ...overrides
  });

  it("converte jogadores e sorteios preservando ids e aplicando os padrões do Java", () => {
    const { players, matches, warnings } = convertJavaExport({
      jogadores: [javaPlayer(0), javaPlayer(1, { nome: "  Com Espaço  " })],
      sorteios: [javaMatch(), javaMatch({ id: "s2", setsTimeA: null, setsTimeB: null })]
    });
    expect(warnings).toEqual([]);
    expect(players[0]).toMatchObject({ id: PLAYER_IDS[0], prefersSetter: true, isMonthly: true, isWoman: false, createdAt: null });
    expect(players[1].name).toBe("Com Espaço");
    expect(matches[0]).toMatchObject({ id: "s1", playedAt: "2026-09-10T23:00:00.000Z", score: { setsA: 2, setsB: 1 } });
    expect(matches[0].teamA[0]).toMatchObject({ playerId: PLAYER_IDS[0], playerName: "Jogador Teste 1", isSetter: true });
    expect(matches[1].score).toBeNull();
  });

  it("registros inválidos ficam de fora com aviso, sem interromper a conversão", () => {
    const { players, matches, warnings } = convertJavaExport({
      jogadores: [javaPlayer(0), javaPlayer(1, { ataque: null }), "texto"],
      sorteios: [javaMatch({ timeA: [] }), javaMatch({ id: "s3" })]
    });
    expect(players).toHaveLength(1);
    expect(matches.map((match) => match.id)).toEqual(["s3"]);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/^Jogador 2 \(Jogador Teste 2\) ignorado: Ataque/);
    expect(warnings[2]).toMatch(/^Sorteio 1 \(2026-09-10T23:00:00Z\) ignorado/);
  });

  it("avisa sobre nomes repetidos vindos do Java, sem apagar nenhum", () => {
    const { players, warnings } = convertJavaExport({ jogadores: [javaPlayer(0, { nome: "Ana" }), javaPlayer(1, { nome: "ana " })] });
    expect(players).toHaveLength(2);
    expect(warnings).toEqual(['Nome repetido no arquivo: "Ana" aparece 2 vezes. Revise antes de usar.']);
  });

  it("entrada que não é lista gera aviso", () => {
    expect(convertJavaExport({ jogadores: "x" }).warnings[0]).toMatch(/não é uma lista/);
  });
});
