import { ValidationError } from "../utils/errors.js";

/**
 * Convenções dos modelos:
 * - `validate*` devolve um objeto { caminhoDoCampo: mensagem }; vazio significa válido.
 * - `deserialize*` devolve { ok: true, value } ou { ok: false, errors } e nunca lança erro.
 * - `create*` lança ValidationError quando os dados são inválidos.
 */

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function ok(value) {
  return { ok: true, value };
}

export function fail(errors) {
  return { ok: false, errors };
}

export function assertValid(errors, message) {
  if (hasErrors(errors)) {
    throw new ValidationError(message, errors);
  }
}

/** Prefixa os caminhos de erro de um sub-objeto (ex.: "teamA[2].score"). */
export function prefixErrors(errors, prefix) {
  return Object.fromEntries(Object.entries(errors).map(([path, message]) => [`${prefix}.${path}`, message]));
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Lê um booleano opcional: ausente vira o padrão; qualquer coisa que não seja booleano é inválida. */
export function readBoolean(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  return value;
}
