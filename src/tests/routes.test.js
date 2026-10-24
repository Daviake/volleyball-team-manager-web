import { describe, expect, it } from "vitest";
import { DEFAULT_PATH, NAV_ROUTES, ROUTES } from "../routes.js";

describe("rotas", () => {
  it("têm ids e caminhos únicos", () => {
    const ids = ROUTES.map((route) => route.id);
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("a rota padrão é Meus Jogadores, como no sistema Java", () => {
    expect(ROUTES.find((route) => route.path === DEFAULT_PATH)?.id).toBe("players");
  });

  it("a navegação não inclui rotas que dependem de parâmetro", () => {
    expect(NAV_ROUTES.every((route) => !route.path.includes(":"))).toBe(true);
  });
});
