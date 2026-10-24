# Progresso da Migração

> Atualizado ao final de cada etapa. Uma funcionalidade só é "Validada" quando a regra está documentada, o JavaScript implementado, os testes passando, a interface conectada e o comportamento conferido.

## Etapas

| Etapa | Situação | Data |
|---|---|---|
| 1 — Análise do projeto Java | Concluída; D14 decidida (recriar do zero), demais dúvidas seguem a interpretação proposta | 24/10/2026 |
| 2 — Arquitetura web | Concluída e validada | 24/10/2026 |
| 3 — Inicialização do projeto | Concluída: Vite + React + Router + ESLint + Vitest; install, lint, test e build passando. Validada | 24/10/2026 |
| 4 — Modelos de dados | Concluída: `src/domain/` + testes + `data-models.md` (PR #1). Validada; PR aguardando merge | 24/10/2026 |
| 5 — Regras de negócio | Concluída: `src/services/` + 78 testes + `business-rules.md`. Aguardando validação | 24/10/2026 |
| 6 — Testes de equivalência | Não iniciada | |
| 7 — Persistência | Não iniciada | |
| 8 — Interface | Não iniciada | |

## Funcionalidades

Legenda: ✅ concluído · 🟡 parcial · ⬜ não iniciado.

Referências: regras R1–R16 e dúvidas D1–D16 em `java-project-analysis.md`.

| Funcionalidade | Java analisado | Regra documentada | JavaScript criado | Testes criados | Interface criada | Validado |
|----------------|-----------------|-------------------|------------------|----------------|------------------|----------|
| Cadastro de jogador (R1) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Edição de jogador (R2) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Exclusão de jogador (R3) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Nome único / duplicados (R4) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Score de linha e de levantador (R5) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Seleção e ações rápidas (R6) | ✅ | ✅ (D16 decidida: corrigido) | ✅ | ✅ | ⬜ | ⬜ |
| Sorteio e balanceamento (R7) | ✅ | ✅ (D3, D4 pendentes) | ✅ | ✅ | ⬜ | ⬜ |
| Delta elástico (R8) | ✅ | ✅ (D5, D6 pendentes) | ✅ | ✅ | ⬜ | ⬜ |
| Placar, vitória, derrota, empate (R9) | ✅ | ✅ (D7 pendente) | ✅ | ✅ | ⬜ | ⬜ |
| Confirmar, editar data, excluir sorteio (R10) | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Rascunhos / histórico temporário (R11) | ✅ | ✅ (D8 pendente) | ✅ | ✅ | ⬜ | ⬜ |
| Troca manual e recálculo (R12) | ✅ | ✅ (D9 pendente) | ✅ | ✅ | ⬜ | ⬜ |
| Estatísticas e jogador do mês (R13) | ✅ | ✅ (D10 pendente) | ✅ | ✅ | ⬜ | ⬜ |
| Importação de planilha (R14) | ✅ | ✅ (D11 pendente) | 🟡 sem leitor de arquivo (D11) | 🟡 | ⬜ | ⬜ |
| Validações de formulário (R15) | ✅ | ✅ | 🟡 modelos | 🟡 modelos | ⬜ | ⬜ |
| Backup: exportar/importar (novo) | n/a | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Importação dos dados do H2 (novo, D13) | n/a | ✅ | 🟡 conversão pronta, sem tela | 🟡 | ⬜ | ⬜ |
