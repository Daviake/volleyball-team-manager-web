/**
 * Erros da aplicação (ver docs/web-architecture.md, seção 10).
 * Equivalem às respostas de erro da API Java: 400 VALIDACAO, 422 REGRA_NEGOCIO e 404 NOT_FOUND.
 */

export class AppError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Dados inválidos. `fieldErrors` mapeia o caminho do campo (ex.: "ratings.attack") para a mensagem. */
export class ValidationError extends AppError {
  constructor(message, fieldErrors = {}, options) {
    super(message, options);
    this.fieldErrors = { ...fieldErrors };
  }
}

/** Regra de negócio violada (ex.: nome duplicado, quantidade errada de jogadores). */
export class BusinessRuleError extends AppError {}

/** Registro não encontrado pelo id. */
export class NotFoundError extends AppError {}

export const STORAGE_ERROR_CODES = Object.freeze({
  CORRUPTED: "CORRUPTED",
  QUOTA: "QUOTA",
  VERSION_TOO_NEW: "VERSION_TOO_NEW",
  UNAVAILABLE: "UNAVAILABLE"
});

/** Falha ao ler ou gravar os dados salvos no navegador. */
export class StorageError extends AppError {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
  }
}
