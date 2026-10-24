/** Gera um identificador único (UUID v4), como o `UUID.randomUUID()` do Java. */
export function generateId() {
  return crypto.randomUUID();
}

export function isValidId(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** Indica se a lista não tem ids repetidos. */
export function hasUniqueIds(ids) {
  return new Set(ids).size === ids.length;
}
