/**
 * Rotas da aplicação (ver docs/web-architecture.md, seção 9).
 * Mantidas fora do App.jsx para que a navegação e os testes usem a mesma fonte.
 */
export const ROUTES = [
  { id: "players", path: "/jogadores", title: "Meus Jogadores", inNav: true },
  { id: "managePlayers", path: "/jogadores/editar", title: "Editar Jogadores", inNav: true },
  { id: "newDraw", path: "/sorteio/novo", title: "Novo Sorteio", inNav: true },
  { id: "drawResult", path: "/sorteio/resultado/:draftId?", title: "Resultado do Sorteio", inNav: false },
  { id: "drafts", path: "/rascunhos", title: "Rascunhos", inNav: true },
  { id: "history", path: "/historico", title: "Histórico", inNav: true },
  { id: "matchDetails", path: "/historico/:matchId", title: "Detalhes do Sorteio", inNav: false },
  { id: "data", path: "/dados", title: "Dados e backup", inNav: true }
];

export const DEFAULT_PATH = "/jogadores";

export const NAV_ROUTES = ROUTES.filter((route) => route.inNav);
