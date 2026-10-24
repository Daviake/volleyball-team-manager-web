# volleyball-team-manager-web

Aplicação web para cadastrar jogadores de vôlei, sortear dois times equilibrados, registrar os placares em sets e acompanhar o desempenho de cada jogador. Roda inteira no navegador, sem backend.

> **Situação:** em migração. A Etapa 3 (inicialização) está concluída; as telas ainda são provisórias. O andamento está em [`docs/migration-progress.md`](docs/migration-progress.md).

## Relação com o projeto Java

Esta é a nova versão do **Projeto Volei** (backend Java/Spring Boot + H2 e frontend React que consome a API). O projeto Java **não é alterado** e serve como:

- referência funcional e documentação das regras existentes;
- fonte dos modelos de dados;
- base de comparação para validar os resultados.

A migração não é uma tradução linha a linha: as regras foram documentadas em [`docs/java-project-analysis.md`](docs/java-project-analysis.md) e reorganizadas numa arquitetura própria para React, descrita em [`docs/web-architecture.md`](docs/web-architecture.md).

## Tecnologias

- React 19 + Vite 8, em JavaScript (sem TypeScript)
- React Router 7
- Vitest 5 (testes unitários)
- ESLint 10 (padronização e regras de dependência entre camadas)
- `localStorage` para persistência inicial
- HTML5 e CSS3, sem biblioteca de UI

Dependências futuras só serão adicionadas com justificativa (ver `docs/web-architecture.md`, seção 2).

## Requisitos

- Node.js **22.12 ou superior**
- npm 10 ou superior

## Instalação

```bash
npm install
```

> Observação: o `package-lock.json` está versionado. Sem ele, algumas versões do npm 10 falham ao montar a árvore de dependências do Vitest (`Cannot read properties of null (reading 'edgesOut')`). Se isso acontecer ao atualizar dependências, use `npx npm@11 install`.

## Execução

```bash
npm run dev       # servidor de desenvolvimento em http://localhost:5173
```

## Testes e qualidade

```bash
npm run test         # executa os testes uma vez
npm run test:watch   # modo observação
npm run lint         # ESLint
```

## Build

```bash
npm run build     # gera a versão de produção em dist/
npm run preview   # serve o conteúdo de dist/ localmente
```

## Estrutura de pastas

```
src/
├── assets/      imagens
├── styles/      CSS global e tokens de tema
├── domain/      modelos: criação, validação, normalização e (de)serialização
├── services/    regras de negócio puras (score, delta, sorteio, estatísticas, importação)
├── storage/     única camada que acessa o localStorage
├── hooks/       ligação entre React, serviços e storage
├── components/  componentes visuais reutilizáveis
├── pages/       telas
├── utils/       erros, aleatoriedade com semente, datas, números, texto
├── tests/       testes Vitest
├── routes.js    rotas da aplicação
├── App.jsx
└── main.jsx
docs/            documentação da migração
public/          ícones
```

O ESLint impede, por exemplo, que `domain/` e `services/` importem React ou `storage/`, e que qualquer arquivo fora de `storage/` use `localStorage` diretamente.

## Persistência

Os dados ficam no `localStorage` do navegador, num único documento versionado (`{ version, players, matches, drafts, settings, preferences }`). Isso significa que os dados ficam **somente neste navegador e neste dispositivo**. *(A camada de armazenamento é implementada na Etapa 7.)*

## Importação e exportação

Previstas para a Etapa 7: exportar e importar backup em JSON, importar jogadores por planilha (modos Mesclar, Adicionar e Substituir) e importar os dados atuais do sistema Java.

## Funcionalidades

As funcionalidades da primeira versão são as mesmas do sistema Java (lista completa em `docs/java-project-analysis.md`, seção 8): cadastro de jogadores com notas por habilidade, seleção de 14 jogadores e 2 levantadores, sorteio exaustivo equilibrado, rascunhos, troca manual, histórico com placar em sets e estatísticas com delta elástico.

## Limitações atuais

- As telas ainda são provisórias; nenhuma regra de negócio foi implementada.
- Sem backend, login ou sincronização entre dispositivos.
- Não é instalável como PWA nesta fase.

## Próximos passos

1. Etapa 4 — modelos de dados (`src/domain/`).
2. Etapa 5 — regras de negócio (`src/services/`).
3. Etapa 6 — testes de equivalência com o Java.
4. Etapa 7 — armazenamento, backup e importações.
5. Etapa 8 — interface.
