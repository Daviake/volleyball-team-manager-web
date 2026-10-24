import { createPlayer, RATING_KEYS, updatePlayerData } from "../../domain/player.js";
import { isPlainObject } from "../../domain/validation.js";
import { nowIso } from "../../utils/dates.js";
import { BusinessRuleError, ValidationError } from "../../utils/errors.js";
import { generateId } from "../../utils/ids.js";
import { parseDecimal } from "../../utils/numbers.js";
import { nameKey } from "../../utils/text.js";

/**
 * Importação de jogadores por planilha (R14; Java: ImportarJogadores.jsx + JogadorService.importar).
 * Este módulo trabalha com linhas já lidas (objetos { cabeçalho: valor }); a leitura do arquivo
 * XLSX/CSV fica num adaptador separado, que depende da decisão D11.
 */

/** Java: MESCLAR (padrão), ADICIONAR e SUBSTITUIR. */
export const IMPORT_MODES = Object.freeze({ MERGE: "MERGE", ADD: "ADD", REPLACE: "REPLACE" });

export const IMPORT_ACTIONS = Object.freeze({ CREATE: "CREATE", UPDATE: "UPDATE", IGNORE: "IGNORE" });

/** Colunas da planilha (em português, como no Java) → campos do modelo. */
const RATING_COLUMNS = Object.freeze({
  ataque: "attack",
  defesa: "defense",
  saque: "serve",
  levantamento: "setting",
  bloqueio: "blocking",
  constancia: "consistency"
});
const BOOLEAN_COLUMNS = Object.freeze({ levantador: "prefersSetter", mensalista: "isMonthly", mulher: "isWoman" });
const TRUE_VALUES = new Set(["sim", "s", "1", "true", "x", "yes"]);
const FALSE_VALUES = new Set(["nao", "não", "n", "0", "false", "no"]);

/** Linha de exemplo do modelo de planilha. DADO FICTÍCIO (no Java: "João Silva"). */
export const TEMPLATE_ROWS = Object.freeze([
  Object.freeze({
    nome: "Jogador Exemplo (fictício)",
    ataque: 7,
    defesa: 6,
    saque: 5,
    levantamento: 3,
    bloqueio: 5,
    constancia: 8,
    levantador: "Não",
    mensalista: "Sim",
    mulher: "Não"
  })
]);

/** Cabeçalho normalizado: minúsculas, sem espaços nas pontas, sem acentos, espaços → "_". */
export function normalizeHeader(header) {
  return String(header)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_");
}

/** Modo recebido → modo conhecido. Como no Java, valor ausente ou desconhecido vira MESCLAR. */
export function normalizeImportMode(mode) {
  const value = typeof mode === "string" ? mode.trim().toUpperCase() : "";
  return Object.values(IMPORT_MODES).includes(value) ? value : IMPORT_MODES.MERGE;
}

/**
 * Converte as linhas da planilha em itens de importação. Linha 1 é o cabeçalho, então a primeira
 * linha de dados é a 2. Regras do Java: linha sem nome é ignorada com aviso; nota inválida ou fora
 * de 0–10 ou booleano inválido descarta a linha inteira; célula vazia = "não informado".
 *
 * Diferenças em relação ao Java:
 * - P3 corrigido: um nome repetido na própria planilha (mesma comparação do nome único) descarta
 *   as repetições com aviso; no Java as duas linhas criavam jogadores duplicados.
 * - Nota com texto depois do número ("7abc") é rejeitada; o `parseFloat` do Java aceitava como 7.
 */
export function parseRows(rows) {
  const items = [];
  const errors = [];
  const seen = new Map();
  rows.forEach((row, index) => {
    const line = index + 2;
    const cells = normalizeRow(row);
    const name = String(cells.nome ?? "").trim();
    if (!name) {
      errors.push(`Linha ${line}: coluna "nome" vazia, ignorada.`);
      return;
    }
    const key = nameKey(name);
    if (seen.has(key)) {
      errors.push(`Linha ${line} (${name}): nome repetido na planilha (já aparece na linha ${seen.get(key)}), linha ignorada.`);
      return;
    }

    const item = { line, name, ratings: {} };
    let valid = true;
    for (const [column, field] of Object.entries(RATING_COLUMNS)) {
      if (!(column in cells)) continue;
      const result = parseRating(cells[column]);
      if (!result.ok) {
        errors.push(`Linha ${line} (${name}): ${column} — ${result.error}.`);
        valid = false;
      } else if (result.value !== null) {
        item.ratings[field] = result.value;
      }
    }
    for (const [column, field] of Object.entries(BOOLEAN_COLUMNS)) {
      if (!(column in cells)) continue;
      const result = parseBoolean(cells[column]);
      if (!result.ok) {
        errors.push(`Linha ${line} (${name}): ${column} — ${result.error}.`);
        valid = false;
      } else if (result.value !== null) {
        item[field] = result.value;
      }
    }
    if (valid) {
      seen.set(key, line);
      items.push(item);
    }
  });
  return { items, errors };
}

/**
 * Prévia: a ação de cada item no modo escolhido e os totais, sem alterar nada.
 * Em SUBSTITUIR, `summary.removed` diz quantos jogadores cadastrados serão apagados (P9).
 */
export function previewImport(items, players, mode) {
  const normalizedMode = normalizeImportMode(mode);
  const existing = new Map(players.map((player) => [nameKey(player.name), player]));
  const rows = items.map((item) => {
    const match = normalizedMode === IMPORT_MODES.REPLACE ? undefined : existing.get(nameKey(item.name));
    let action = IMPORT_ACTIONS.CREATE;
    if (match) action = normalizedMode === IMPORT_MODES.MERGE ? IMPORT_ACTIONS.UPDATE : IMPORT_ACTIONS.IGNORE;
    return { item, action, playerId: match?.id ?? null };
  });
  const count = (action) => rows.filter((row) => row.action === action).length;
  return {
    mode: normalizedMode,
    rows,
    summary: {
      toCreate: count(IMPORT_ACTIONS.CREATE),
      toUpdate: count(IMPORT_ACTIONS.UPDATE),
      toIgnore: count(IMPORT_ACTIONS.IGNORE),
      removed: normalizedMode === IMPORT_MODES.REPLACE ? players.length : 0
    }
  };
}

/**
 * Aplica a importação e devolve a nova lista de jogadores e o resumo
 * `{ updated, added, ignored: [nomes], errors: [mensagens], removed }`.
 *
 * - MESCLAR: nome existente → atualiza só os campos informados (o nome não muda); novo → cria.
 * - ADICIONAR: nome existente → ignorado; novo → cria.
 * - SUBSTITUIR: apaga todos e cria todos da planilha, com ids novos. As partidas antigas deixam
 *   de corresponder aos jogadores e as estatísticas se perdem (P9, igual ao Java). Por isso exige
 *   `confirmReplace: true`, além da confirmação da tela.
 * Jogadores novos: notas ausentes = 5, levantador = não, mensalista = sim, mulher = não.
 * A operação é tudo ou nada: a lista nova só substitui a atual se for gravada pelo chamador.
 */
export function applyImport(items, players, mode, { now = nowIso(), createId = generateId, confirmReplace = false } = {}) {
  if (items.length === 0) {
    throw new BusinessRuleError("A planilha não tem nenhum jogador para importar.");
  }
  const plan = previewImport(items, players, mode);
  if (plan.mode === IMPORT_MODES.REPLACE && confirmReplace !== true) {
    throw new BusinessRuleError("Confirme a substituição: todos os jogadores cadastrados serão apagados.");
  }

  let result = plan.mode === IMPORT_MODES.REPLACE ? [] : [...players];
  const summary = { updated: 0, added: 0, ignored: [], errors: [], removed: plan.summary.removed };
  for (const { item, action, playerId } of plan.rows) {
    if (action === IMPORT_ACTIONS.IGNORE) {
      summary.ignored.push(item.name);
      continue;
    }
    try {
      if (action === IMPORT_ACTIONS.UPDATE) {
        const current = result.find((player) => player.id === playerId);
        const updated = updatePlayerData(current, changesFrom(item), { now });
        result = result.map((player) => (player.id === playerId ? updated : player));
        summary.updated += 1;
      } else {
        result.push(createPlayer({ name: item.name, ...changesFrom(item) }, { now, createId }));
        summary.added += 1;
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      summary.errors.push(`${item.name}: ${Object.values(error.fieldErrors).join(", ")}`);
    }
  }
  return { players: result, summary };
}

function changesFrom(item) {
  const changes = { ratings: {} };
  for (const key of RATING_KEYS) {
    if (item.ratings?.[key] !== undefined) changes.ratings[key] = item.ratings[key];
  }
  for (const field of Object.values(BOOLEAN_COLUMNS)) {
    if (item[field] !== undefined) changes[field] = item[field];
  }
  return changes;
}

function normalizeRow(row) {
  const cells = {};
  if (!isPlainObject(row)) return cells;
  for (const [header, value] of Object.entries(row)) cells[normalizeHeader(header)] = value;
  return cells;
}

function parseRating(raw) {
  const value = parseDecimal(raw);
  if (value === null) return { ok: true, value: null };
  if (!Number.isFinite(value)) return { ok: false, error: `"${raw}" não é número` };
  if (value < 0 || value > 10) return { ok: false, error: `${value} fora do intervalo 0-10` };
  return { ok: true, value };
}

function parseBoolean(raw) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const text = String(raw).toLowerCase().trim();
  if (TRUE_VALUES.has(text)) return { ok: true, value: true };
  if (FALSE_VALUES.has(text) || text === "") return { ok: true, value: false };
  return { ok: false, error: `"${raw}" não é sim/não` };
}
