import { describe, expect, it } from "vitest";
import { clamp, nearlyEqual, parseDecimal, isNonNegativeInteger } from "../../utils/numbers.js";
import { nameKey, normalizeName } from "../../utils/text.js";
import { isValidIsoDate, toIsoDate } from "../../utils/dates.js";
import { generateId, hasUniqueIds } from "../../utils/ids.js";
import { ValidationError, StorageError, STORAGE_ERROR_CODES } from "../../utils/errors.js";

describe("numbers", () => {
  it("parseDecimal aceita ponto e vírgula decimal", () => {
    expect(parseDecimal("7,5")).toBe(7.5);
    expect(parseDecimal(" 8.25 ")).toBe(8.25);
    expect(parseDecimal(3)).toBe(3);
  });

  it("parseDecimal trata vazio como não informado e texto inválido como NaN", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
    expect(parseDecimal("1,2,3")).toBeNaN();
    expect(parseDecimal(true)).toBeNaN();
  });

  it("clamp, nearlyEqual e inteiros não negativos", () => {
    expect(clamp(10.4, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(1.5)).toBe(false);
    expect(isNonNegativeInteger(-1)).toBe(false);
  });
});

describe("text", () => {
  it("compara nomes como o Java: ignora maiúsculas e espaços nas pontas, mas não acentos", () => {
    expect(nameKey("  Ana Souza ")).toBe(nameKey("ana souza"));
    expect(nameKey("José")).not.toBe(nameKey("Jose"));
    expect(normalizeName("  Ana ")).toBe("Ana");
    expect(normalizeName(null)).toBe("");
  });
});

describe("dates e ids", () => {
  it("valida e converte datas ISO", () => {
    expect(isValidIsoDate("2026-10-24T12:00:00Z")).toBe(true);
    expect(isValidIsoDate("ontem")).toBe(false);
    expect(toIsoDate("2026-10-24T09:00:00-03:00")).toBe("2026-10-24T12:00:00.000Z");
    expect(toIsoDate("ontem")).toBeNull();
  });

  it("gera ids únicos", () => {
    const ids = Array.from({ length: 50 }, generateId);
    expect(hasUniqueIds(ids)).toBe(true);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("errors", () => {
  it("guarda os erros por campo e o código de armazenamento", () => {
    const error = new ValidationError("inválido", { name: "obrigatório" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ValidationError");
    expect(error.fieldErrors).toEqual({ name: "obrigatório" });
    expect(new StorageError("x", STORAGE_ERROR_CODES.QUOTA).code).toBe("QUOTA");
  });
});
