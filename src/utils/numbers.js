/** Tolerância de comparação de ponto flutuante usada pelo Java (SorteioService.EPSILON). */
export const EPSILON = 1e-9;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function nearlyEqual(a, b, tolerance = EPSILON) {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Converte uma entrada numérica de formulário ou planilha em número.
 * Aceita números e textos com ponto ou vírgula decimal ("7,5"). Texto vazio vira `null`
 * (valor não informado); qualquer outra coisa que não seja número vira `NaN`.
 */
export function parseDecimal(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const text = value.trim();
  if (text === "") return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) return Number.NaN;
  return Number(text.replace(",", "."));
}

export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}
