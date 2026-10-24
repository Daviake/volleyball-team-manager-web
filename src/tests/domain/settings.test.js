import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, deserializeSettings, serializeSettings } from "../../domain/settings.js";

describe("configurações", () => {
  it("os pesos padrão são os do ScoreService e somam 10 em cada papel", () => {
    const sum = (weights) => Object.values(weights).reduce((total, value) => total + value, 0);
    expect(sum(DEFAULT_SETTINGS.weights.hitter)).toBe(10);
    expect(sum(DEFAULT_SETTINGS.weights.setter)).toBe(10);
    expect(DEFAULT_SETTINGS.weights.hitter.setting).toBe(0);
    expect(DEFAULT_SETTINGS.weights.setter.serve).toBe(0);
  });

  it("as constantes do sorteio e do delta são as do Java", () => {
    expect(DEFAULT_SETTINGS.draw).toMatchObject({ playersPerDraw: 14, settersPerDraw: 2, playersPerTeam: 7, starters: 6, tieTolerance: 0.05 });
    expect(DEFAULT_SETTINGS.ratingDelta).toEqual({ base: 0.05, elasticity: 0.3 });
    expect(DEFAULT_SETTINGS.drafts.max).toBe(5);
  });

  it("os padrões não podem ser modificados", () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS.weights.hitter)).toBe(true);
  });

  it("configurações ausentes usam o padrão", () => {
    expect(deserializeSettings(undefined)).toEqual({ ok: true, value: { settings: DEFAULT_SETTINGS, warnings: [] } });
    expect(deserializeSettings({}).value.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("valores inválidos voltam ao padrão com aviso, sem bloquear", () => {
    const result = deserializeSettings({ draw: { tieTolerance: -1 }, weights: { divisor: 0 }, drafts: "x" });
    expect(result.ok).toBe(true);
    expect(result.value.settings.draw.tieTolerance).toBe(0.05);
    expect(result.value.settings.weights.divisor).toBe(10);
    expect(result.value.warnings).toHaveLength(3);
  });

  it("serializa como JSON simples", () => {
    expect(serializeSettings(DEFAULT_SETTINGS)).toEqual(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    expect(deserializeSettings("texto").ok).toBe(false);
  });
});
