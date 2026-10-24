# Plano de Migração

> Resumo operacional. Os detalhes estão em `java-project-analysis.md` (o que existe) e `web-architecture.md` (como será).

| Etapa | Entrega | Critério de pronto |
|---|---|---|
| 1 — Análise do Java | `java-project-analysis.md` | Dúvidas registradas e validadas |
| 2 — Arquitetura | `web-architecture.md` | Validada pelo responsável |
| 3 — Inicialização | Projeto Vite + React + Router + ESLint + Vitest, README, estrutura de pastas | `npm install`, `npm run dev`, `npm run test`, `npm run lint` e `npm run build` funcionando |
| 4 — Modelos | `src/domain/*` + testes + `data-models.md` | Criação, validação, normalização e (de)serialização testadas |
| 5 — Regras | `src/services/*` + testes + `business-rules.md` | Funções puras cobrindo R1–R14 |
| 6 — Equivalência | testes + `equivalence-tests.md` | Cenários conferidos contra o Java |
| 7 — Persistência | `src/storage/*`, backup, importação do Java | Leitura/escrita seguras testadas, sem perda de dados |
| 8 — Interface | `src/pages/*`, `src/components/*`, `src/hooks/*` | Telas conectadas e comportamento validado |

Regras gerais:

- Uma etapa só começa depois da validação da anterior.
- O projeto Java nunca é alterado.
- Nenhuma diferença de comportamento entra sem aprovação; as aprovadas são registradas em `business-rules.md`.
- `migration-progress.md` é atualizado ao final de cada etapa.
- Commits pequenos, um assunto por commit.
- Durante a transição, o sistema Java continua sendo o oficial.
