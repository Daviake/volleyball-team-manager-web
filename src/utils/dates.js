/** Data atual em ISO-8601 UTC, equivalente ao `Instant.now()` do Java. */
export function nowIso() {
  return new Date().toISOString();
}

/** Indica se o valor é um texto de data/hora que o JavaScript consegue interpretar. */
export function isValidIsoDate(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

/** Converte uma data válida para ISO-8601 UTC; devolve `null` se não for válida. */
export function toIsoDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (!isValidIsoDate(value)) return null;
  return new Date(value).toISOString();
}
