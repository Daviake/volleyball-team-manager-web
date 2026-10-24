/** Nome como deve ser gravado: sem espaços nas pontas (corrige P1 da análise do Java). */
export function normalizeName(name) {
  return typeof name === "string" ? name.trim() : "";
}

/**
 * Chave de comparação de nomes, igual à do Java (`trim().toLowerCase()`):
 * ignora maiúsculas e espaços nas pontas, mas considera acentos ("José" ≠ "Jose").
 */
export function nameKey(name) {
  return normalizeName(name).toLowerCase();
}
