/**
 * Geradores de números aleatórios no formato de `Math.random`: funções sem argumentos que
 * devolvem um número em [0, 1). Os serviços recebem o gerador por parâmetro, para que os
 * testes possam usar `seededRandom` e obter sempre o mesmo resultado.
 */

/** Gerador padrão da aplicação (equivale ao `ThreadLocalRandom` do Java). */
export const defaultRandom = () => Math.random();

/**
 * Gerador determinístico (algoritmo mulberry32): a mesma semente produz sempre a mesma sequência.
 * Uso exclusivo em testes e reproduções; não é adequado para criptografia.
 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escolhe um índice uniforme em [0, length), como `Random.nextInt(length)` do Java. */
export function randomIndex(length, random = defaultRandom) {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError("É preciso ao menos um item para sortear.");
  const value = random();
  if (!(value >= 0 && value < 1)) throw new RangeError("O gerador aleatório deve devolver um número em [0, 1).");
  return Math.floor(value * length);
}
