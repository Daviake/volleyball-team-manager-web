import { describe, expect, it } from "vitest";
import { createPlayer, deserializePlayer, normalizePlayer, RATING_KEYS, serializePlayer, updatePlayerData, validatePlayer } from "../../domain/player.js";
import { ValidationError } from "../../utils/errors.js";

const NOW = "2026-10-24T12:00:00.000Z";
const fixedId = () => "player-1";

const validInput = {
  name: "Jogador Teste",
  prefersSetter: false,
  isMonthly: true,
  isWoman: false,
  ratings: { attack: 7, defense: 6, serve: 5, setting: 3, blocking: 5, consistency: 8 }
};

describe("createPlayer", () => {
  it("cria um jogador com notas válidas, id e datas", () => {
    const player = createPlayer(validInput, { now: NOW, createId: fixedId });
    expect(player).toEqual({ ...validInput, id: "player-1", createdAt: NOW, updatedAt: NOW });
  });

  it("aplica os padrões do Java: notas 5, mensalista sim, mulher não, levantador não", () => {
    const player = createPlayer({ name: "Novo" }, { now: NOW, createId: fixedId });
    expect(player.ratings).toEqual(Object.fromEntries(RATING_KEYS.map((key) => [key, 5])));
    expect(player.isMonthly).toBe(true);
    expect(player.isWoman).toBe(false);
    expect(player.prefersSetter).toBe(false);
  });

  it("tira os espaços das pontas do nome (correção do P1)", () => {
    expect(createPlayer({ ...validInput, name: "  Ana  " }, { now: NOW }).name).toBe("Ana");
  });

  it("aceita notas em texto com vírgula decimal", () => {
    const player = createPlayer({ ...validInput, ratings: { ...validInput.ratings, attack: "7,5" } }, { now: NOW });
    expect(player.ratings.attack).toBe(7.5);
  });

  it("aceita os limites 0 e 10", () => {
    const ratings = { attack: 0, defense: 10, serve: 0, setting: 10, blocking: 0, consistency: 10 };
    expect(createPlayer({ ...validInput, ratings }, { now: NOW }).ratings).toEqual(ratings);
  });

  it("rejeita notas fora de 0–10, sem ajustar o valor", () => {
    let error;
    try {
      createPlayer({ ...validInput, ratings: { ...validInput.ratings, attack: 10.1, defense: -0.1 } }, { now: NOW });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["ratings.attack", "ratings.defense"]);
  });

  it("rejeita nome vazio ou só com espaços", () => {
    expect(() => createPlayer({ ...validInput, name: "   " }, { now: NOW })).toThrow(ValidationError);
  });

  it("rejeita nota que não é número e marcadores que não são booleanos", () => {
    const errors = validatePlayer(
      normalizePlayer({ ...validInput, id: "x", isWoman: "sim", ratings: { ...validInput.ratings, serve: "abc" } })
    );
    expect(errors["ratings.serve"]).toMatch(/número/);
    expect(errors.isWoman).toBeDefined();
  });
});

describe("updatePlayerData", () => {
  it("altera os dados preservando id e criação", () => {
    const player = createPlayer(validInput, { now: NOW, createId: fixedId });
    const later = "2026-10-25T12:00:00.000Z";
    const updated = updatePlayerData(player, { name: " Novo Nome ", ratings: { attack: 9 } }, { now: later });
    expect(updated.id).toBe(player.id);
    expect(updated.createdAt).toBe(NOW);
    expect(updated.updatedAt).toBe(later);
    expect(updated.name).toBe("Novo Nome");
    expect(updated.ratings).toEqual({ ...validInput.ratings, attack: 9 });
    expect(player.ratings.attack).toBe(7);
  });
});

describe("serialização", () => {
  it("ida e volta pelo JSON preserva o jogador", () => {
    const player = createPlayer(validInput, { now: NOW, createId: fixedId });
    const restored = deserializePlayer(JSON.parse(JSON.stringify(serializePlayer(player))));
    expect(restored).toEqual({ ok: true, value: player });
  });

  it("aceita jogador salvo sem datas (ex.: vindo do Java) e aplica os padrões dos marcadores", () => {
    const result = deserializePlayer({ id: "p", name: "Antigo", ratings: validInput.ratings });
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ createdAt: null, isMonthly: true, isWoman: false, prefersSetter: false });
  });

  it("não inventa notas para um jogador salvo incompleto", () => {
    const result = deserializePlayer({ id: "p", name: "Sem notas", ratings: { attack: 5 } });
    expect(result.ok).toBe(false);
    expect(result.errors["ratings.defense"]).toBeDefined();
  });

  it("rejeita valores que não são objetos sem lançar erro", () => {
    expect(deserializePlayer(null).ok).toBe(false);
    expect(deserializePlayer("texto").ok).toBe(false);
  });
});
