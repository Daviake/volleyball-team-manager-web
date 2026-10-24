import { isFiniteNumber } from "../utils/numbers.js";
import { fail, isPlainObject, ok } from "./validation.js";

/**
 * Constantes de negócio. Os valores padrão são os do projeto Java e não são editáveis
 * na primeira versão (o Java não tem configuração; ver docs/web-architecture.md, seção 5.5).
 */
export const DEFAULT_SETTINGS = deepFreeze({
  weights: {
    // ScoreService.calcular(..., false)
    hitter: { attack: 3, defense: 3.5, serve: 2, setting: 0, blocking: 0.5, consistency: 1 },
    // ScoreService.calcular(..., true)
    setter: { attack: 1, defense: 2, serve: 0, setting: 5, blocking: 1, consistency: 1 },
    divisor: 10
  },
  ratings: { min: 0, max: 10, step: 0.1, default: 5 },
  draw: {
    playersPerDraw: 14,
    settersPerDraw: 2,
    playersPerTeam: 7,
    starters: 6,
    // SorteioService.DELTA_ALEATORIO (dúvida D3: o README fala em empate exato)
    tieTolerance: 0.05,
    epsilon: 1e-9
  },
  // EstatisticasService / SorteioService: DELTA_BASE e ELASTICIDADE
  ratingDelta: { base: 0.05, elasticity: 0.3 },
  // EstatisticasService: PESO_WIN_RATE, PESO_SALDO_SETS, PESO_DELTA_NOTA, PESO_SCORE_ADJ
  playerOfMonth: { winRate: 0.25, setBalance: 0.25, delta: 0.25, adjustedScore: 0.25 },
  drafts: { max: 5 },
  recentMatches: 5
});

/**
 * Lê as configurações salvas. Como nada é editável na primeira versão, valores ausentes
 * ou inválidos voltam ao padrão e são listados em `warnings`; nunca impedem o carregamento.
 */
export function deserializeSettings(raw) {
  if (raw === undefined || raw === null) return ok({ settings: DEFAULT_SETTINGS, warnings: [] });
  if (!isPlainObject(raw)) return fail({ settings: "As configurações salvas não são um objeto." });
  const warnings = [];
  const settings = mergeWithDefaults(DEFAULT_SETTINGS, raw, "", warnings);
  return ok({ settings: deepFreeze(settings), warnings });
}

export function serializeSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function mergeWithDefaults(defaults, raw, path, warnings) {
  const result = {};
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const fieldPath = path ? `${path}.${key}` : key;
    const value = isPlainObject(raw) ? raw[key] : undefined;
    if (isPlainObject(defaultValue)) {
      if (value !== undefined && !isPlainObject(value)) warnings.push(`${fieldPath}: valor inválido, usando o padrão.`);
      result[key] = mergeWithDefaults(defaultValue, value, fieldPath, warnings);
    } else if (value === undefined) {
      result[key] = defaultValue;
    } else if (isFiniteNumber(value) && (key === "divisor" ? value > 0 : value >= 0)) {
      result[key] = value;
    } else {
      warnings.push(`${fieldPath}: valor inválido, usando o padrão.`);
      result[key] = defaultValue;
    }
  }
  return result;
}

function deepFreeze(value) {
  if (isPlainObject(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
