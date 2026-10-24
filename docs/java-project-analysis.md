# Análise do Projeto Java — Sorteio de Times de Vôlei

> **Etapa 1 da migração** para `volleyball-team-manager-web` (React + Vite + JavaScript, sem backend).
> **Data da análise:** 24/10/2026.
> **Fonte analisada:** `C:\Users\daviw\OneDrive\Documentos\Projetos\Projeto Volei\` (somente leitura; nenhum arquivo foi alterado).
> **Substitui** a versão anterior deste documento (salva como `java-project-analysis.anterior-2026-08.md`). As correções em relação a ela estão no Apêndice B.

Convenções usadas neste documento:

- **[FATO]** comportamento confirmado lendo o código.
- **[DÚVIDA]** regra ambígua ou contraditória; precisa de validação do responsável. Cada dúvida tem um número (D1, D2…) e aparece consolidada na seção 9.
- **[PROBLEMA]** defeito ou fragilidade encontrada no código atual. Não deve ser "corrigido silenciosamente" na migração; cada um precisa de decisão.

---

## 0. O que existe na pasta "Projeto Volei"

A pasta contém **dois sistemas diferentes** que compartilham o domínio:

| Subpasta | O que é | Situação |
|---|---|---|
| `backend/` | API REST Java 17 + Spring Boot 3.2.5 + JPA + H2 (arquivo) / PostgreSQL | **Sistema principal**, em uso (o banco `backend/data/voleidb.mv.db` foi modificado em 24/10/2026) |
| `frontend/` | SPA React 18 + Vite 5 + React Router 6 + PWA, que consome a API | **Sistema principal** (interface) |
| `volei-pocket/` (+ `volei-pocket.zip`) | Aplicação Java de console, sem frameworks, persistência em `.txt` | Versão acadêmica/anterior (o `roteiro.docx` é um roteiro de apresentação para um professor de POO) |
| `roteiro.docx` | Roteiro de apresentação do `volei-pocket` | Documentação |
| `.github/modernize/…`, `backend/.github/…` | Logs/hooks de uma tentativa de upgrade de Java via GitHub Copilot App Modernization | Não faz parte do app |
| `.vscode/settings.json` | Configuração do editor | Não faz parte do app |

Não há repositório Git na pasta.

**Premissa desta análise:** a referência funcional da migração é o par **`backend/` + `frontend/`**. O `volei-pocket` é documentado no Apêndice A porque tem regras diferentes (algoritmo de sorteio, média com 7 jogadores, CSV). **[DÚVIDA D1]** Confirmar que o `volei-pocket` não precisa ser preservado.

> Observação importante: o "projeto Java" atual **já tem um frontend React**. Boa parte das regras de interface (seleção, troca manual, rascunhos, importação de planilha) está em JavaScript no `frontend/`, e não em Java. Por isso a análise cobre os dois lados.

---

## 1. Visão geral

### 1.1 Finalidade

Organizar peladas recorrentes de vôlei: cadastrar jogadores com notas por habilidade, escolher os 14 jogadores do dia (com 2 levantadores), sortear **2 times de 7 (6 titulares + 1 reserva)** equilibrados pelo score ponderado, registrar o placar em sets e acompanhar o desempenho de cada jogador.

### 1.2 Fluxo principal de uso

```
Editar Jogadores: cadastrar / importar planilha
        ↓
Novo Sorteio: selecionar exatamente 14 jogadores e marcar 2 "levantadores hoje"
        ↓
POST /sorteios/preview  →  resultado salvo como RASCUNHO no localStorage (máx. 5)
        ↓
Resultado: comparar rascunhos, sortear de novo, trocar jogadores manualmente
        ↓
Confirmar jogo  →  POST /sorteios/confirmar  →  vai para o Histórico (banco)
        ↓
Histórico: registrar placar de sets (pode corrigir), editar data, excluir
        ↓
Meus Jogadores: notas ajustadas pelo delta, sets, win rate, últimos jogos, "jogador do mês"
```

O delta calculado a partir dos sets **também entra no próximo sorteio** (o score usado para equilibrar os times é o score ajustado).

### 1.3 Telas existentes (frontend React)

| Rota | Arquivo | Função |
|---|---|---|
| `/` | `App.jsx` | Redireciona para `/jogadores` |
| `/jogadores` | `pages/Jogadores.jsx` | "Meus Jogadores": estatísticas, notas base × ajustadas, delta, win rate, últimos 5 jogos, banner "Jogador do Mês", filtros e ordenação |
| `/editar-jogadores` | `pages/EditarJogadores.jsx` | CRUD de jogadores, filtros, ordenação, abre a importação por planilha |
| `/novo-sorteio` | `pages/NovoSorteio.jsx` | Seleção de 14 jogadores + 2 levantadores, busca, filtros, ações rápidas |
| `/resultado` | `pages/Resultado.jsx` | Rascunho atual: troca manual, sortear de novo, desfazer, descartar, confirmar; painel "Histórico Temp." com os rascunhos |
| `/resultado/:id` | `pages/Resultado.jsx` | Visualização somente leitura de um sorteio do histórico |
| `/rascunhos` | `pages/Rascunhos.jsx` | Lista, abre e exclui rascunhos (um ou todos) |
| `/historico` | `pages/Historico.jsx` | Lista de sorteios confirmados: placar, correção, edição de data, exclusão |

Componentes: `JogadorForm.jsx` (formulário + painel "Como as notas são ponderadas?"), `NotaInput.jsx` (slider + número 0–10, passo 0,1), `ImportarJogadores.jsx` (upload → prévia → resultado), `TimesResultado.jsx` (exibição de times; **não é usado por nenhuma página** atualmente).

### 1.4 Funcionalidades existentes

**Jogadores:** cadastrar, editar, excluir (com confirmação), listar, buscar por nome, filtrar (levantador/linha, mensalista/avulso, mulher/homem), ordenar (nome, score linha, score levantador; em "Meus Jogadores" também por delta, win rate e saldo), impedir nome duplicado, importar XLSX (3 modos) com prévia, baixar template XLSX.

**Seleção:** marcar até 14, marcar até 2 "levantador hoje" entre os selecionados, pré-marcação automática do levantador pela preferência do cadastro, selecionados no topo da lista, busca e filtros, "Últimos 14 usados", "Selecionar mensalistas", "Completar automaticamente", "Limpar seleção".

**Sorteio:** busca exaustiva das combinações, equilíbrio de mulheres, reserva automática, escolha aleatória entre combinações quase ótimas, troca manual A↔B com recálculo das médias, sortear de novo, até 5 rascunhos comparáveis, desfazer alterações, descartar, confirmar.

**Partidas e histórico:** registrar placar em sets (empate permitido, inclusive 0×0), corrigir placar, editar data/hora, excluir sorteio (com confirmação), ver times de um sorteio passado.

**Estatísticas:** sets ganhos/perdidos, saldo, win rate (por sets), delta elástico, notas e scores ajustados, últimos 5 jogos, jogador do mês.

**PWA:** manifesto e service worker via `vite-plugin-pwa` (instalável).

Não existem: login/autenticação, múltiplos grupos, exportação de dados pela interface web, estatísticas por partida (pontos), configurações editáveis pelo usuário (todos os pesos e constantes estão fixos no código).

### 1.5 Público-alvo

Organizador(a) de uma pelada recorrente de vôlei recreativo (provavelmente usado em celular durante o jogo, dado o PWA e o layout responsivo). Um único usuário/grupo; não há perfis.

### 1.6 Persistência atual

| Dado | Onde | Detalhe |
|---|---|---|
| Jogadores | Banco relacional, tabela `jogadores` | H2 em arquivo `./data/voleidb` (padrão) ou PostgreSQL (perfil `postgres`); `ddl-auto=update` |
| Sorteios confirmados | Tabela `sorteios` | Times guardados como **JSON em colunas TEXT** |
| Rascunhos | `localStorage` do navegador, chave `"rascunhos"` | Array com no máximo 5 itens |
| Testes | H2 em memória (`create-drop`) | `src/test/resources/application.properties` |

**Dados reais existem hoje no H2** (`backend/data/voleidb.mv.db`, 94 KB). A migração precisa de um caminho para levá-los ao `localStorage` (ver Risco R1).

---

## 2. Arquitetura atual

### 2.1 Backend — pacotes e classes (`com.voleisorteio`)

| Pacote | Arquivo | Tipo | Papel |
|---|---|---|---|
| (raiz) | `VoleiSorteioApplication` | classe | Ponto de entrada Spring Boot (porta 8080) |
| `config` | `CorsConfig` | classe `WebMvcConfigurer` | CORS a partir de `app.cors.allowed-origins` |
| `controller` | `JogadorController` | `@RestController` `/jogadores` | Listar, stats, buscar, criar, atualizar, excluir, importar |
| `controller` | `SorteioController` | `@RestController` `/sorteios` | Sortear, preview, confirmar, histórico, buscar, placar, data, excluir |
| `service` | `ScoreService` | `@Service` | Fórmulas de score |
| `service` | `SorteioService` | `@Service` | Algoritmo de sorteio, delta no sorteio, placar, data, exclusão, (de)serialização JSON |
| `service` | `EstatisticasService` | `@Service` | Estatísticas por jogador, delta elástico, jogador do mês |
| `service` | `JogadorService` | `@Service` | CRUD, unicidade de nome, importação |
| `service` | `JogadorComScore` | classe interna (package-private) | Jogador + papel no sorteio + score |
| `model` | `Jogador` | `@Entity` `jogadores` | Jogador |
| `model` | `Sorteio` | `@Entity` `sorteios` | Sorteio/partida |
| `model` | `ResultadoSorteio` | **enum** | `TIME_A`, `TIME_B`, `EMPATE` |
| `repository` | `JogadorRepository` | **interface** `JpaRepository<Jogador, UUID>` | Sem métodos próprios |
| `repository` | `SorteioRepository` | **interface** `JpaRepository<Sorteio, UUID>` | `findAllByOrderByDataDesc()` |
| `dto` | `JogadorRequest`, `JogadorResponse`, `JogadorStatsResponse` (+ classe interna `UltimoJogo`), `JogadorResultado`, `SorteioRequest`, `SorteioResponse`, `ConfirmarSorteioRequest`, `PlacarRequest`, `AtualizarDataRequest`, `ImportarJogadoresRequest` (+ classe interna `Item`), `ImportarJogadoresResult` | classes | Contratos da API |
| `exception` | `ApiError` | classe | Corpo de erro: `timestamp, status, erro, mensagem, detalhes[]` |
| `exception` | `GlobalExceptionHandler` | `@RestControllerAdvice` | 404 / 422 / 400 / 500 |
| `exception` | `RegraNegocioException` | `RuntimeException` | → HTTP 422 `REGRA_NEGOCIO` |
| `exception` | `ResourceNotFoundException` | `RuntimeException` | → HTTP 404 `NOT_FOUND` |
| (test) | `SorteioServiceTest` | JUnit 5 `@SpringBootTest` | 9 testes (ver 2.6) |

Records internos: `SorteioService.SorteioCalculo`, `EstatisticasService.JogoInfo`. Classe interna: `SorteioService.Candidato`.

### 2.2 Endpoints REST

| Método | Caminho | Serviço | Observação |
|---|---|---|---|
| GET | `/jogadores` | `JogadorService.listarTodos` | Inclui `scoreLinha`, `scoreLevantador`, `evolucao` |
| GET | `/jogadores/stats` | `EstatisticasService.listarTodos` | Estatísticas completas |
| GET | `/jogadores/{id}` | `JogadorService.buscarPorId` | |
| POST | `/jogadores` | `JogadorService.criar` | 201 |
| PUT | `/jogadores/{id}` | `JogadorService.atualizar` | |
| DELETE | `/jogadores/{id}` | `JogadorService.excluir` | 204 |
| POST | `/jogadores/importar` | `JogadorService.importar` | |
| POST | `/sorteios` | `SorteioService.sortear` | Sorteia **e persiste**; não é usado pelo frontend |
| POST | `/sorteios/preview` | `SorteioService.previsualizar` | Sorteia sem persistir |
| POST | `/sorteios/confirmar` | `SorteioService.confirmar` | Persiste os times recebidos |
| GET | `/sorteios` | `SorteioService.listarHistorico` | Mais recente primeiro |
| GET | `/sorteios/{id}` | `SorteioService.buscarPorId` | |
| PUT | `/sorteios/{id}/placar` | `SorteioService.registrarPlacar` | |
| PUT | `/sorteios/{id}/data` | `SorteioService.atualizarData` | |
| DELETE | `/sorteios/{id}` | `SorteioService.excluir` | 204 |

### 2.3 Frontend — estrutura

```
frontend/
├── index.html            # carrega SheetJS (xlsx 0.18.5) via <script> do cdnjs
├── vite.config.js        # React + VitePWA (manifest, ícones, workbox)
├── .env / .env.example   # VITE_API_URL (padrão http://localhost:8080)
├── public/icons/         # icon-192.png, icon-512.png
└── src/
    ├── main.jsx          # BrowserRouter + StrictMode
    ├── App.jsx           # cabeçalho, navegação, rotas, contador de rascunhos
    ├── api/client.js     # fetch para a API + tratamento do ApiError
    ├── components/       # JogadorForm, NotaInput, ImportarJogadores, TimesResultado
    ├── pages/            # Jogadores, EditarJogadores, NovoSorteio, Resultado, Rascunhos, Historico
    └── styles/app.css    # 1712 linhas, tema azul/laranja
```

### 2.4 Arquivos de configuração

| Arquivo | Conteúdo relevante |
|---|---|
| `backend/pom.xml` | Spring Boot parent 3.2.5, Java 17, starters web/data-jpa/validation/test, H2 e PostgreSQL (runtime) |
| `backend/src/main/resources/application.properties` | H2 `jdbc:h2:file:./data/voleidb;AUTO_SERVER=TRUE`, `ddl-auto=update`, console H2 em `/h2-console`, porta 8080, CORS `localhost:5173` |
| `backend/src/main/resources/application-postgres.properties` | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, dialeto PostgreSQL |
| `backend/src/test/resources/application.properties` | H2 em memória |
| `backend/.gitignore` | `target/`, `data/`, logs, IDE |
| `frontend/package.json` | Scripts `dev`, `build`, `preview` (sem lint nem testes) |
| `frontend/vite.config.js` | PWA: nome "Sorteio de Times de Vôlei", tema `#0f2a54`, `navigateFallbackDenylist` para `/jogadores` e `/sorteios` |
| `frontend/.env.example` | `VITE_API_URL=http://localhost:8080` |
| `frontend/.gitignore` | `node_modules`, `dist`, `dev-dist`, `.env`, logs |

### 2.5 Bibliotecas utilizadas

| Lado | Biblioteca | Versão | Uso |
|---|---|---|---|
| Backend | Spring Boot (web, data-jpa, validation) | 3.2.5 | API, DI, JPA, Bean Validation |
| Backend | Hibernate / Jackson | (Boot) | ORM / JSON (inclui `ObjectMapper` para os times) |
| Backend | H2 | (Boot) | Banco em arquivo |
| Backend | PostgreSQL JDBC | (Boot) | Banco opcional |
| Backend | spring-boot-starter-test (JUnit 5) | (Boot) | Testes |
| Frontend | react, react-dom | ^18.3.1 | UI |
| Frontend | react-router-dom | ^6.26.0 | Rotas |
| Frontend | vite, @vitejs/plugin-react | ^5.4.0 / ^4.3.1 | Build |
| Frontend | vite-plugin-pwa | ^0.20.1 | PWA |
| Frontend | **SheetJS (xlsx) 0.18.5** | via CDN em `index.html` | Leitura de XLSX e geração do template. **Não está no `package.json`**; usado como `window.XLSX` global |

### 2.6 Pontos de entrada, dependências externas e testes

- Backend: `VoleiSorteioApplication.main` (`mvn spring-boot:run`).
- Frontend: `index.html` → `src/main.jsx` → `App.jsx` (`npm run dev`, porta 5173).
- Dependências externas em tempo de execução: o backend na URL `VITE_API_URL`; o CDN `cdnjs.cloudflare.com` para o SheetJS (sem ele, importar planilha e baixar template quebram).
- Testes existentes (`SorteioServiceTest`): 30 sorteios aleatórios com semente 123 verificando 7+7 sem sobreposição, 1 levantador titular por time, 6 titulares e 1 reserva, reserva nunca levantador, reserva = menor score de linha do time, `diferenca = |mediaA − mediaB|`; erro com levantador repetido; placar 2×0, correção 0×2, empate 1×1, vitória A/B; exclusão com e sem placar; edição de data; data nula. Não há testes de `EstatisticasService`, `JogadorService` nem do frontend. Os testes não foram executados nesta etapa (só leitura).

---

## 3. Separação de responsabilidades

| Categoria | Componentes |
|---|---|
| **Interface** | Todas as páginas e componentes React; `App.jsx`; `app.css`; `index.html`; PWA |
| **Regras de negócio** | `ScoreService`, `SorteioService` (algoritmo, delta no sorteio, resultado do placar), `EstatisticasService` (delta, stats, jogador do mês), `JogadorService` (unicidade, importação). **Também no frontend:** ações rápidas de seleção (`NovoSorteio.jsx`), troca manual e recálculo de média (`Resultado.jsx`), parsing e validação da planilha (`ImportarJogadores.jsx`), regras de rascunho (máx. 5) |
| **Modelos de dados** | `Jogador`, `Sorteio`, `ResultadoSorteio`; DTOs; objeto `rascunho` (frontend) |
| **Persistência** | `JogadorRepository`, `SorteioRepository`, JPA/H2/PostgreSQL; (de)serialização JSON dos times em `SorteioService`/`EstatisticasService`; `localStorage` acessado diretamente em `NovoSorteio.jsx`, `Resultado.jsx`, `Rascunhos.jsx` e `App.jsx` |
| **Validações** | Bean Validation nos DTOs; `SorteioService.calcular`/`validarSemIdsDuplicados`; `JogadorService.validarNomeUnico`/`validarNotas`; frontend: `JogadorForm` (nome vazio), `NotaInput` (limita 0–10), `NovoSorteio.mensagemValidacao`, `Historico.salvarPlacar` (campos vazios), `ImportarJogadores.parseNota/parseBool` |
| **Utilitários** | `ScoreService.calcular` (sobrecargas), `clamp` (duplicado em 2 serviços), `combinacoes` (recursivo), `normMinMax`, `normalizar`; frontend: `paraInputDatetime`/`paraIso`, `fmt`, `fmtDelta`, `normalizarChave` |
| **Configurações** | `CorsConfig`, `application*.properties`, `vite.config.js`, `.env`; **constantes de negócio fixas no código** (pesos, `DELTA_BASE`, `ELASTICIDADE`, `DELTA_ALEATORIO`, pesos do jogador do mês, 14/2/5/7) |

---

## 4. Regras de negócio

### R1. Cadastro de jogadores

- **Onde:** `JogadorService.criar` → `validarNomeUnico` + `aplicar`; DTO `JogadorRequest`; UI `JogadorForm.jsx`, `EditarJogadores.salvar`.
- **Entrada:** `nome` (obrigatório, não vazio), `levantador` (obrigatório true/false), `mensalista` (padrão `true`), `mulher` (padrão `false`), 6 notas `double` entre 0 e 10.
- **Saída:** `JogadorResponse` com `scoreLinha` e `scoreLevantador` calculados; `id` UUID gerado em `@PrePersist`.
- **Dependências:** `ScoreService`, `JogadorRepository`.
- **Situações especiais:**
  - `mensalista`: `null` ou ausente → `true` (`!Boolean.FALSE.equals(...)`). `mulher`: só `true` se `TRUE`.
  - O formulário inicia todas as notas em **5** (`VAZIO` em `JogadorForm.jsx`).
  - `NotaInput`: slider e campo numérico com passo 0,1; valores digitados fora de 0–10 são **ajustados** para o limite (não geram erro).
  - "Levantador" é só **preferência** ("Costuma jogar de levantador"); não restringe nada.
- **Problemas:**
  - **[PROBLEMA P1]** O nome **não é aparado** ao salvar (`jogador.setNome(request.getNome())`), embora a comparação de duplicidade use `trim()`. "Ana " é gravado com espaço.
  - **[PROBLEMA P2]** As notas são `double` primitivos no DTO: se o campo faltar no JSON, vira `0` sem erro.
  - Não há limite de tamanho para o nome.

### R2. Edição de jogadores

- **Onde:** `JogadorService.atualizar`; UI `EditarJogadores.jsx`.
- **Entrada:** `id` + `JogadorRequest` completo (substitui todos os campos).
- **Saída:** `JogadorResponse`. 404 se o id não existir.
- **Situações especiais:** a unicidade ignora o próprio jogador (`idExcluir`). Editar notas **não altera o histórico** (os times salvos guardam o score do momento do sorteio), mas **altera o delta**, porque o fator elástico usa o score base atual (ver R8).
- **Problemas:** P1 também se aplica.

### R3. Exclusão de jogadores

- **Onde:** `JogadorService.excluir`; UI `EditarJogadores.excluir` (`window.confirm`).
- **Entrada:** `id`. **Saída:** 204; 404 se não existir.
- **Situações especiais:** os sorteios antigos **continuam** com o nome e o id do jogador dentro do JSON dos times (exibição do histórico preservada). As estatísticas desse jogador somem (só são calculadas para jogadores existentes). "Últimos 14 usados" ignora ids que não existem mais.
- **Problemas:** nenhum bloqueio; exclusão é definitiva.

### R4. Unicidade de nome / dados duplicados

- **Onde:** `JogadorService.validarNomeUnico` (criar/atualizar) e `normalizar` (importação).
- **Regra [FATO]:** dois jogadores não podem ter o mesmo nome comparando `trim().toLowerCase()`. Acentos **contam** ("José" ≠ "Jose"). Erro 422: `Já existe um jogador com o nome "X".`
- **Problemas:**
  - **[PROBLEMA P3]** Na importação, a lista de existentes é carregada **uma vez antes do laço**. Se a planilha tiver o mesmo nome novo em duas linhas, nos modos MESCLAR e ADICIONAR **os dois são criados** (duplicata). No modo SUBSTITUIR não há nenhuma verificação de duplicidade.
  - Não existe restrição única no banco; a regra é só na aplicação.
  - Em `sortear`/`preview`, ids duplicados em `jogadoresIds` ou `levantadorIds` geram 422 (`validarSemIdsDuplicados`).

### R5. Cálculo do score (nota consolidada) e pesos

- **Onde:** `ScoreService.calcular(...)` (duas sobrecargas). Pesos repetidos no frontend em `JogadorForm.jsx` (`PESOS_LINHA`, `PESOS_LEVANTADOR`) apenas para exibição.
- **Fórmulas [FATO]:**

  | Habilidade | Peso linha | Peso levantador |
  |---|---|---|
  | Ataque | 3 | 1 |
  | Defesa | 3,5 | 2 |
  | Saque | 2 | — (não entra) |
  | Levantamento | — (não entra) | 5 |
  | Bloqueio | 0,5 | 1 |
  | Constância | 1 | 1 |
  | **Soma / divisor** | **10 / 10** | **10 / 10** |

  `scoreLinha = (3·A + 3,5·D + 2·S + 0,5·B + 1·C) / 10`
  `scoreLevantador = (1·A + 2·D + 5·L + 1·B + 1·C) / 10`
- **Entrada:** 6 notas + papel efetivo (booleano). **Saída:** `double` na escala 0–10, sem arredondamento.
- **Exemplo:** A=7, D=6, S=5, L=3, B=5, C=8 → linha = (21 + 21 + 10 + 2,5 + 8)/10 = **6,25**; levantador = (7 + 12 + 15 + 5 + 8)/10 = **4,70**.
- **Situações especiais:** o papel usado é o **do sorteio** (`levantadorIds`), não a preferência do cadastro. Em "Meus Jogadores"/"Editar Jogadores" o score de levantador só é exibido se `levantamento > 0` (regra só visual).
- **Média geral do jogador:** não existe média simples das 6 notas no sistema. O "score" é sempre ponderado e depende do papel. **[DÚVIDA D2]** Confirmar que não se deseja uma "média simples".

### R6. Seleção dos participantes

- **Onde:** `NovoSorteio.jsx` (UI) + `SorteioRequest` (`@Size 14/14`, `@Size 2/2`) + `SorteioService.calcular`.
- **Regras [FATO]:**
  - Exatamente **14 jogadores distintos** e exatamente **2 levantadores distintos**, que devem estar entre os 14. Fora disso: 400 (validação) ou 422 (regra).
  - Se houver menos de 14 cadastrados, a tela não permite sortear e mostra quantos existem.
  - Ao marcar um jogador cuja preferência é levantador, ele é **pré-marcado como "levantador hoje"** se ainda houver vaga (máx. 2). Ao desmarcar o jogador, ele sai também dos levantadores.
  - A UI bloqueia o 15º jogador com aviso e o 3º levantador (checkbox desabilitado).
  - Lista ordenada por nome; **selecionados sobem para o topo**.
  - Busca por nome (contém, sem diferenciar maiúsculas; **com** diferenciação de acentos); filtros por preferência (levantador/linha) e mensalista/avulso.
- **Ações rápidas [FATO]:**
  - **Últimos 14 usados:** pega o sorteio confirmado mais recente (`GET /sorteios`, primeiro da lista) e seleciona seus jogadores ainda cadastrados; os levantadores são os que eram levantadores naquele sorteio. Avisa se faltar alguém.
  - **Selecionar mensalistas:** **substitui** a seleção atual. Levantadores = os 2 primeiros mensalistas com preferência de levantador (ordem alfabética); depois completa com mensalistas de linha até 14; se faltar, usa os demais mensalistas levantadores (sem marcá-los como levantador hoje). Avisa se houver menos de 14.
  - **Completar automaticamente:** **mantém** a seleção atual. Se faltar levantador, adiciona jogadores com preferência de levantador até ter 2; depois completa até 14 dando prioridade a quem **não** é levantador (ordem alfabética dentro de cada grupo).
  - **Limpar seleção:** zera seleção e levantadores.
- **Problemas:**
  - **[PROBLEMA P4]** Em "Completar automaticamente", ao completar até 14, quem tem preferência de levantador é adicionado ao conjunto de levantadores **sem limite**, podendo passar de 2 (a validação então bloqueia o sorteio com "Você selecionou levantadores demais").
  - "Selecionar mensalistas" e "Completar" não consideram mulheres.
  - **[PROBLEMA P10]** (encontrado na Etapa 5) Em "Completar automaticamente", a primeira fase (garantir 2 levantadores) não confere o total: com 14 já selecionados e menos de 2 levantadores, a seleção passa de 14 e o sorteio fica bloqueado com "Você selecionou jogadores demais". **[DÚVIDA D16]**

### R7. Formação dos times, sorteio e balanceamento

- **Onde:** `SorteioService.calcular`, `montarCandidato`, `combinacoes`; constantes `DELTA_ALEATORIO = 0.05`, `EPSILON = 1e-9`.
- **Entrada:** 14 ids + 2 ids de levantadores; jogadores do banco; **todo o histórico** de sorteios (para o delta).
- **Saída:** `timeA` e `timeB` (7 `JogadorResultado` cada: 1º o levantador, depois 5 titulares de linha em ordem crescente de score, por último o reserva), `mediaTimeA`, `mediaTimeB`, `diferenca`.
- **Algoritmo [FATO]:**
  1. Calcula para cada jogador o **score ajustado**: cada uma das 6 notas recebe `+deltaNota` (R8), limitada a [0, 10], e o score é calculado no papel do dia.
  2. Separa os 2 levantadores e os 12 de linha.
  3. Para cada uma das 2 formas de colocar os levantadores (L1 em A e L2 em B, ou o inverso) e para cada uma das **C(12,6) = 924** escolhas de 6 jogadores de linha para o time A, monta um candidato: **1.848 candidatos**.
  4. Em cada time, o jogador de linha com **menor score** vira **reserva**; os outros 5 + o levantador são os 6 titulares.
  5. `media = (soma dos 5 titulares de linha + levantador) / 6` — **o reserva não entra na média**. `diferenca = |mediaA − mediaB|`.
  6. **Filtro de mulheres:** com `n` mulheres entre os 14, mantém só candidatos em que o time A tem entre `floor(n/2)` e `ceil(n/2)` mulheres (contando titulares e reserva). Se nenhum candidato passar, usa todos (fallback).
  7. `menor = min(diferenca)`; elegíveis = candidatos com `diferenca ≤ menor + 0,05 (+1e-9)`.
  8. Escolhe **um elegível ao acaso** (`ThreadLocalRandom`, uniforme).
- **Situações especiais:**
  - Cada divisão aparece **duas vezes** (como A/B e espelhada B/A), então a chance de cada divisão é a mesma; o lado A/B é aleatório.
  - Não há limite de diferença máxima entre as médias: o algoritmo sempre devolve o melhor possível (com a folga de 0,05).
  - Não há restrição por posição além do levantador (não existem posições como líbero, ponteiro, central).
  - O reserva nunca é levantador (garantido pela construção).
  - Empate de score no reserva: fica o primeiro na ordenação estável (ordem em que o banco devolveu os jogadores).
  - Número ímpar de jogadores ou menos/mais que 14: impossível (rejeitado na validação).
- **Problemas / dúvidas:**
  - **[DÚVIDA D3]** O `README.md` diz que o desempate é "sorteio aleatório só entre as que têm a diferença mínima exata (tolerância 1e-9)". O código usa **folga de 0,05**. Confirmar qual é a regra desejada (proposta: seguir o código).
  - **[DÚVIDA D4]** O filtro de mulheres usa a contagem **com o reserva**. Ex.: 2 mulheres podem ficar 1×1, mas uma delas ser reserva. Confirmar se a regra deve considerar só titulares (proposta: manter como está).
  - `jogadorRepository.findAllById` não garante ordem; com scores iguais a escolha do reserva pode variar entre execuções.

### R8. Delta elástico (alteração dinâmica das notas)

- **Onde:** `EstatisticasService.buildStats` (estatísticas) e `SorteioService.calcularDeltaNota` (sorteio). **A fórmula está duplicada** nas duas classes com as mesmas constantes.
- **Constantes:** `DELTA_BASE = 0.05`, `ELASTICIDADE = 0.3`.
- **Entrada:** jogador (notas base e preferência `levantador`) + todos os sorteios **com placar registrado**.
- **Fórmula [FATO]:**
  ```
  setsGanhos / setsPerdidos = soma, em todos os sorteios com placar, dos sets do time do jogador
                              (titulares E reserva contam)
  scoreBase        = score com as notas base, no PAPEL PREFERIDO do cadastro
  fator            = (scoreBase − 5) / 5                  ∈ [−1, 1]
  deltaGanhoPorSet = 0,05 × (1 − 0,3 × fator)
  deltaPerdaPorSet = 0,05 × (1 + 0,3 × fator)
  deltaNota        = setsGanhos × deltaGanhoPorSet − setsPerdidos × deltaPerdaPorSet
  notaAjustada     = clamp(notaBase + deltaNota, 0, 10)      (o mesmo delta em cada uma das 6 notas)
  ```
- **Exemplo:** scoreBase 7,0 → fator 0,4 → ganho 0,044/set, perda 0,056/set. Com 3 sets ganhos e 1 perdido: delta = 0,132 − 0,056 = **+0,076**.
- **Saída:** `deltaNota`, `deltaGanhoPorSet`, `deltaPerdaPorSet`, notas e scores ajustados.
- **Regra crítica [FATO]:** as **notas base nunca são alteradas** por resultados. O delta é sempre recalculado do histórico; corrigir um placar ou excluir um sorteio muda o delta automaticamente. Não existe "nota inicial" separada de "nota atual" armazenada: a nota atual é derivada.
- **Situações especiais:** o delta não tem teto; só a nota ajustada é limitada a [0, 10]. Placar 0×0 não altera nada. Editar as notas base muda o fator e, portanto, recalcula retroativamente todo o delta.
- **Problemas:**
  - **[PROBLEMA P5]** O campo `Jogador.evolucao` e o modelo "Elo" descritos no `README.md` (`EVOLUCAO_K`, `EVOLUCAO_DIVISOR`, `evolucaoAplicadaJson`) **não existem mais no código**: `evolucao` é sempre 0 e só aparece no `JogadorResponse`. Os textos do Histórico ("vencer de forma surpreendente pesa mais…" e "vai desfazer o ajuste de evolução") também estão desatualizados. **[DÚVIDA D5]** Confirmar que a regra vigente é o delta elástico (proposta: sim; descartar `evolucao`).
  - **[PROBLEMA P6]** Erros ao ler o JSON de um sorteio são **ignorados silenciosamente** (`catch (Exception ignored)`), nos dois serviços.
  - **[DÚVIDA D6]** O fator usa o papel **preferido**, mesmo quando o jogador jogou no outro papel. Confirmar.

### R9. Registro de partidas, sets, vitória, derrota e empate

- **Onde:** `SorteioService.registrarPlacar`; `PlacarRequest`; UI `Historico.ItemHistorico.salvarPlacar`.
- **Entrada:** `setsTimeA`, `setsTimeB` inteiros obrigatórios, `≥ 0`.
- **Saída:** sorteio com `setsTimeA`, `setsTimeB` e `resultado` derivado: `TIME_A` se A > B, `TIME_B` se B > A, `EMPATE` se iguais (**inclusive 0×0**).
- **Situações especiais:** pode ser registrado e **corrigido** quantas vezes quiser (sobrescreve; não acumula, porque o delta é recalculado). Não há limite superior de sets nem regra de "melhor de N". Não é possível **remover** um placar (voltar a "sem placar"), só alterar. A partida é o próprio sorteio confirmado (não há entidade "Partida" separada nem placar de pontos por set).
- **Problemas:** **[DÚVIDA D7]** Um placar 0×0 conta como "jogo" em "últimos jogos" (aparece como empate), mas não conta para win rate nem para a elegibilidade do jogador do mês. Confirmar se 0×0 deve ser aceito.

### R10. Confirmação, edição de data e exclusão de sorteios / histórico

- **Onde:** `SorteioService.confirmar`, `atualizarData`, `excluir`, `listarHistorico`; UI `Resultado.confirmar`, `Historico`.
- **Regras [FATO]:**
  - Confirmar grava **exatamente** os times enviados pelo cliente (inclusive após trocas manuais). `data` = agora (`@PrePersist`).
  - Data editável (`datetime-local` no fuso do navegador → ISO/UTC). Data obrigatória (400/422).
  - Exclusão com `window.confirm`; remove o sorteio e, por consequência, sua influência no delta.
  - Histórico ordenado por data decrescente; histórico vazio mostra "Nenhum sorteio realizado ainda."
- **Problemas:** **[PROBLEMA P7]** `confirmar` **não valida nada** do conteúdo (quantidade de jogadores, levantadores, médias, ids existentes); confia no cliente. Na versão web isso precisa de validação no domínio.

### R11. Rascunhos e histórico temporário de sorteios

- **Onde:** `NovoSorteio.sortear`, `Resultado.jsx` (`MAX_RASCUNHOS = 5`, chave `"rascunhos"`), `Rascunhos.jsx`, `App.RascunhosCount`.
- **Estrutura:** `{ id: uuid, criadoEm: ISO, sorteio: SorteioResponse (sem id), pedidoOriginal: { jogadoresIds, levantadorIds } }`.
- **Regras [FATO]:**
  - Cada "Sortear" em Novo Sorteio cria um rascunho **no início** da lista; a lista é cortada em 5 (o mais antigo é descartado **sem aviso**).
  - "Sortear de novo" na tela Resultado **substitui o rascunho ativo** (não cria outro) usando o `pedidoOriginal`.
  - Trocas manuais são gravadas no rascunho ativo; "Desfazer todas as alterações" volta ao estado guardado do rascunho. **[DÚVIDA D8]** Como cada troca já é gravada no rascunho, não ficou claro se "desfazer" deveria voltar ao sorteio original.
  - Confirmar remove o rascunho. "Descartar" remove e abre o próximo rascunho ou volta a Novo Sorteio.
  - Ao recarregar `/resultado`, abre o rascunho mais recente.
- **Problemas:** o contador do menu só atualiza quando o `App` é renderizado de novo; `catch {}` vazio em `gravarRascunhos`.

### R12. Troca manual de jogadores e recálculo das médias

- **Onde:** `Resultado.trocarJogadores`, `calcMediaTime`.
- **Regra [FATO]:** seleciona 1 jogador do A e 1 do B; eles trocam de time **mas o "lugar" fica**: as propriedades `titular` e `levantador` pertencem à posição, e o `score` acompanha o jogador. As médias são recalculadas como média dos 6 titulares, e a `diferenca` também.
- **Problemas:**
  - **[PROBLEMA P8]** Ao trocar um levantador por um jogador de linha, o jogador de linha passa a ser "levantador" do time **mantendo o score de linha**, e vice-versa. A própria tela avisa que "a média pode variar ligeiramente". A regra "reserva = menor score" também deixa de valer após trocas. **[DÚVIDA D9]** Confirmar se o score deve ser recalculado pelo novo papel (proposta: manter o comportamento atual na primeira versão e documentar; mudança só com aprovação).
  - Como o papel fica na posição, cada time continua com exatamente 1 levantador; o aviso "⚠ Lev" do painel lateral nunca deveria aparecer.

### R13. Estatísticas individuais e jogador do mês

- **Onde:** `EstatisticasService.listarTodos`, `buildStats`, `selecionarJogadorDoMes`; UI `Jogadores.jsx`.
- **Regras [FATO]:**
  - `setsGanhos`, `setsPerdidos`, `saldoSets = ganhos − perdidos` (também exposto como `deltaSets`).
  - `winRate = setsGanhos / (setsGanhos + setsPerdidos) × 100` — **aproveitamento por sets**, não por partidas. 0 se não houver sets. Cores na UI: ≥ 60 verde, ≥ 40 laranja, abaixo vermelho.
  - Vitórias/derrotas/empates por partida **não são contados** como números; só aparecem em "últimos jogos" (até 5, mais recentes) como "vitória"/"derrota"/"empate".
  - **Jogador do mês:** entre jogadores com pelo menos 1 set disputado, pontuação = 0,25·norm(winRate) + 0,25·norm(saldo) + 0,25·norm(deltaNota) + 0,25·norm(score ajustado no papel preferido), com normalização min-max (0,5 se todos iguais). Maior pontuação vence; em empate exato, o primeiro da lista.
- **Problemas:**
  - **[DÚVIDA D10]** Apesar do nome, o "jogador do mês" usa **todo o histórico**, sem filtro de mês. Confirmar (proposta: manter igual ao Java).
  - O desempate do jogador do mês depende da ordem do `findAll()` (não determinística).

### R14. Importação de jogadores (planilha XLSX)

- **Onde:** `ImportarJogadores.jsx` (parsing) + `JogadorService.importar` e helpers.
- **Parsing no navegador [FATO]:** primeira aba; cabeçalhos normalizados (minúsculas, sem acento, espaços → `_`); `nome` obrigatório (linha sem nome é ignorada com aviso); notas aceitam vírgula decimal; nota inválida ou fora de 0–10 **descarta a linha inteira**; booleanos aceitam `sim, s, 1, true, x, yes` / `nao, não, n, 0, false, no`; células vazias = "não informado".
- **Modos no backend [FATO]:**
  - **MESCLAR (padrão; também para qualquer valor desconhecido):** nome existente → atualiza só os campos informados; novo → cria.
  - **ADICIONAR:** ignora nomes existentes (listados em `ignorados`); cria os novos.
  - **SUBSTITUIR:** apaga **todos** os jogadores e cria todos da planilha.
  - Novos jogadores: notas ausentes = **5,0**; `levantador` ausente = `false`; `mensalista` ausente = `true`; `mulher` ausente = `false`; nome aparado.
  - Resultado: `atualizados`, `adicionados`, `ignorados[]`, `erros[]` (notas fora do intervalo); `naoEncontrados` é alias obsoleto de `ignorados`.
- **UI:** prévia com a ação de cada linha, aviso destacado para SUBSTITUIR com contagem, template `template_jogadores.xlsx` com 1 linha de **exemplo fictício** ("João Silva").
- **Problemas:** P3 (duplicatas); **[PROBLEMA P9]** SUBSTITUIR apaga jogadores sem tocar nos sorteios, então o histórico passa a referenciar ids que não existem mais e **todas as estatísticas e deltas se perdem** (os novos jogadores recebem ids novos). Não há confirmação extra além do botão. A importação não é transacional (uma falha no meio deixa estado parcial).

### R15. Validações de formulários e da API

| Campo / ação | Regra | Onde |
|---|---|---|
| Nome do jogador | Obrigatório, não vazio (UI e `@NotBlank`) | `JogadorForm`, `JogadorRequest` |
| Notas | 0 ≤ x ≤ 10, decimais permitidos | `@DecimalMin/Max`, `NotaInput` (ajusta ao limite) |
| `levantador` | Obrigatório no POST/PUT | `@NotNull` |
| Seleção | 14 distintos, 2 levantadores distintos e contidos | `SorteioRequest`, `SorteioService`, `NovoSorteio.mensagemValidacao` |
| Placar | Ambos obrigatórios, inteiros ≥ 0 | `PlacarRequest`, `Historico` |
| Data do sorteio | Obrigatória | `AtualizarDataRequest`, `SorteioService.atualizarData` |
| Importação | Lista não vazia, `nome` não nulo por item, notas 0–10 | `ImportarJogadoresRequest`, `validarNotas`, `parseNota` |

Mensagens de erro da API chegam à UI via `client.js` (`mensagem` + `detalhes`).

### R16. Critérios que não existem no sistema

- **Sexo:** existe apenas o booleano `mulher`, usado para filtros e para o equilíbrio do sorteio (R7). Não há categoria nem nível.
- **Mensalista × avulso:** booleano usado **apenas** para filtros e para "Selecionar mensalistas". Não há cobrança, presença ou prioridade.
- **Diferença máxima entre médias:** não existe limite configurável.
- **Restrições por posição:** apenas levantador.

---

## 5. Modelos de dados

### 5.1 Jogador (`model/Jogador.java`, tabela `jogadores`)

| Atributo | Tipo Java | Padrão | Obrigatório | Validação |
|---|---|---|---|---|
| `id` | `UUID` | gerado em `@PrePersist` | sim | PK |
| `nome` | `String` | — | sim | `@NotBlank` no request; único por `trim+lowercase` (aplicação) |
| `levantador` | `boolean` | `false` | sim no request | preferência apenas |
| `ataque`, `defesa`, `saque`, `levantamento`, `bloqueio`, `constancia` | `double` | `0` (entidade) / `5` (formulário e importação) | sim | 0–10 |
| `evolucao` | `Double` | `0.0`; `null` lido como 0 | não | **obsoleto** (P5) |
| `mensalista` | `Boolean` | `true`; `null` lido como `true` | não | — |
| `mulher` | `Boolean` | `false`; `null` lido como `false` | não | — |

Relacionamentos: nenhum por chave estrangeira. Jogadores são referenciados por id dentro do JSON dos sorteios.

### 5.2 Sorteio / Partida (`model/Sorteio.java`, tabela `sorteios`)

| Atributo | Tipo | Padrão | Obrigatório | Observação |
|---|---|---|---|---|
| `id` | `UUID` | gerado | sim | |
| `data` | `Instant` (UTC) | agora | sim | editável |
| `jogadoresIdsJson` | `TEXT` (JSON `UUID[]`) | — | sim | os 14 ids |
| `timeAJson`, `timeBJson` | `TEXT` (JSON `JogadorResultado[]`) | — | sim | 7 cada; ordem: levantador, titulares de linha, reserva |
| `mediaTimeA`, `mediaTimeB`, `diferenca` | `double` | — | sim | média dos 6 titulares; congeladas no momento do sorteio/troca |
| `setsTimeA`, `setsTimeB` | `Integer` | `null` | não | `null` = sem placar |
| `resultado` | `ResultadoSorteio` (string) | `null` | não | derivado do placar |
| `evolucaoAplicadaJson` | `TEXT` | `null` | não | **obsoleto**, nunca escrito (P5) |

### 5.3 ResultadoSorteio (enum)

`TIME_A` | `TIME_B` | `EMPATE`.

### 5.4 JogadorResultado (item de time, dentro do JSON)

| Campo | Tipo | Significado |
|---|---|---|
| `jogadorId` | UUID | referência ao jogador |
| `nome` | String | **cópia** do nome no momento do sorteio |
| `levantador` | boolean | joga de levantador **neste** sorteio (posição) |
| `titular` | boolean | `false` = reserva |
| `score` | double | score ajustado no papel do sorteio, **congelado** |

### 5.5 Rascunho (frontend, `localStorage["rascunhos"]`)

`{ id, criadoEm, sorteio: { data, jogadoresIds, timeA, timeB, mediaTimeA, mediaTimeB, diferenca }, pedidoOriginal: { jogadoresIds, levantadorIds } }`, no máximo 5.

### 5.6 DTOs derivados (não persistidos)

- `JogadorResponse`: campos do jogador + `scoreLinha`, `scoreLevantador`, `evolucao`.
- `JogadorStatsResponse`: identidade, notas base, `deltaSets`, `deltaNota`, `deltaGanhoPorSet`, `deltaPerdaPorSet`, 6 notas ajustadas, `scoreLinhaAjustado`, `scoreLevantadorAjustado`, `setsGanhos`, `setsPerdidos`, `saldoSets`, `winRate`, `ultimosJogos[] {data, resultado, setsGanhos, setsPerdidos}`, `jogadorDoMes`, `pontuacaoDestaque`.
- `SorteioResponse`: `id, data, jogadoresIds, timeA, timeB, mediaTimeA, mediaTimeB, diferenca, setsTimeA, setsTimeB, resultado`.
- `ImportarJogadoresResult`: `atualizados, adicionados, ignorados, naoEncontrados (alias), erros`.
- `ApiError`: `timestamp, status, erro, mensagem, detalhes`.

### 5.7 Entidades pedidas que não existem

- **Time:** não é entidade; é uma lista dentro do sorteio.
- **Set:** não existe; só a contagem de sets por time.
- **Configuração:** não existe; tudo é constante no código.
- **Histórico:** é a lista de sorteios com ou sem placar.

---

## 6. Mapa de migração

| Componente Java / atual | Responsabilidade | Destino no projeto React | Estratégia de migração |
|---|---|---|---|
| `ScoreService` | Fórmulas de score | `src/services/ratingCalculator.js` (pesos em `src/domain/settings.js`) | Funções puras; pesos como constantes padrão, únicas para domínio e UI (elimina a duplicação em `JogadorForm`) |
| `SorteioService.calcular`, `montarCandidato`, `combinacoes` | Sorteio e balanceamento | `src/services/teamBalancer.js` | Reescrever como função pura `generateTeams(players, setterIds, matches, { random })` com aleatoriedade injetável; mesma enumeração de 1.848 candidatos |
| `SorteioService.calcularDeltaNota` + delta em `EstatisticasService.buildStats` | Delta elástico | `src/services/ratingDelta.js` | Uma única implementação usada por sorteio e estatísticas |
| `EstatisticasService` (stats, jogador do mês) | Estatísticas | `src/services/playerStatistics.js` | Funções puras sobre jogadores + partidas |
| `SorteioService.registrarPlacar`, `atualizarData`, `confirmar`, `excluir` | Partidas | `src/services/matchService.js` | Puras (recebem e devolvem estado); validação do conteúdo ao confirmar (P7) |
| `JogadorService` (CRUD, unicidade) | Jogadores | `src/services/playerService.js` | Puro; normalização de nome (`trim`) e unicidade |
| `JogadorService.importar` + parsing em `ImportarJogadores.jsx` | Importação | `src/services/playerImport.js` + componente de UI | Separar a leitura da planilha (adaptador) da aplicação dos modos (domínio) |
| Ações rápidas de `NovoSorteio.jsx` | Seleção | `src/services/selectionService.js` | Funções puras testáveis |
| Troca manual de `Resultado.jsx` | Ajuste de times | `src/services/teamSwap.js` | Pura, com recálculo de médias |
| `Jogador`, `JogadorRequest`, `JogadorResponse` | Modelo | `src/domain/player.js` | `createPlayer`, `validatePlayer`, `normalizePlayer`, (de)serialização |
| `Sorteio`, `JogadorResultado`, `ResultadoSorteio`, `PlacarRequest` | Modelo | `src/domain/match.js` (+ `team.js` para o item de time) | Times como arrays de objetos (não JSON em string) |
| Rascunho (frontend) | Modelo | `src/domain/draft.js` | Mesma estrutura, com versão |
| `JogadorRepository`, `SorteioRepository`, JPA/H2 | Persistência | `src/storage/*Storage.js` sobre `localStorage` | Repositórios com leitura/escrita seguras e versão de esquema |
| `localStorage` direto em 4 arquivos | Persistência de rascunhos | `src/storage/draftStorage.js` | Centralizar |
| `GlobalExceptionHandler`, exceções, `ApiError` | Erros | `src/utils/errors.js` (`ValidationError`, `BusinessRuleError`, `NotFoundError`) | Erros tipados; a UI mostra as mensagens |
| Bean Validation dos DTOs | Validação | `validate*` em `src/domain/` | Funções que retornam lista de erros por campo |
| `api/client.js` | Acesso à API | (removido) → serviços + storage | Manter as assinaturas próximas para facilitar a futura API REST |
| `CorsConfig`, `application*.properties`, `pom.xml` | Infra Java | — | Não migra (sem backend) |
| Páginas React (`Jogadores`, `EditarJogadores`, `NovoSorteio`, `Resultado`, `Rascunhos`, `Historico`) | Interface | `src/pages/` | Reaproveitar fluxo e textos; tirar as regras para `services/` e `hooks/` |
| `JogadorForm`, `NotaInput`, `ImportarJogadores`, `TimesResultado` | Componentes | `src/components/` | Reaproveitar com acessibilidade (labels já existem) |
| `app.css` | Estilo | `src/styles/` | Reaproveitar a identidade azul/laranja |
| `vite-plugin-pwa` | PWA | futuro | Fora da primeira versão, salvo decisão (D12) |
| SheetJS via CDN | Planilhas | dependência npm **ou** CSV | Decisão D11 |
| `SorteioServiceTest` | Testes | `src/tests/*.test.js` (Vitest) | Reproduzir as mesmas propriedades com semente fixa |
| `volei-pocket/` | App de console | — | Não migra (D1) |

---

## 7. Riscos da migração

**R1 — Perda dos dados reais (alto).** Os jogadores e o histórico atuais estão no H2 (`backend/data/voleidb.mv.db`). A nova versão só lê `localStorage`. Sem um caminho de importação, o grupo começa do zero e perde todos os deltas. Mitigação proposta: com o backend Java rodando, salvar as respostas de `GET /jogadores` e `GET /sorteios` (JSON) e criar na web um importador desse formato. Precisa de aprovação (D13).

**R2 — Regras misturadas com a interface (médio).** Seleção rápida, pré-marcação de levantador, troca manual, recálculo de média, rascunhos e parsing da planilha vivem nos componentes React. Precisam ir para `services/` com testes antes da UI.

**R3 — Código duplicado (médio).** Fórmula do delta em dois serviços; `clamp` em dois serviços; pesos no `ScoreService` e no `JogadorForm`; filtros de jogadores repetidos em três páginas. Unificar sem mudar o resultado.

**R4 — Fidelidade do algoritmo (alto).** Detalhes que mudam o resultado: média só dos 6 titulares, reserva = menor score de linha, filtro de mulheres com reserva e fallback, folga de 0,05, delta aplicado antes do sorteio, papel do dia no score, papel preferido no fator. A aleatoriedade impede comparar sorteio a sorteio; a equivalência deve ser testada por propriedades e pela "menor diferença possível", com função aleatória injetável. O desempenho (1.848 candidatos) é trivial no navegador.

**R5 — Ponto flutuante (baixo).** `double` do Java e `Number` do JS são IEEE 754; os resultados devem coincidir se a ordem das somas for a mesma. Comparações usam `EPSILON = 1e-9`.

**R6 — Dependências específicas do Java (baixo).** UUID (`crypto.randomUUID()` no navegador, que exige HTTPS ou localhost), `Instant` (ISO-8601 UTC), `ThreadLocalRandom` (função `random` injetável), Jackson (JSON nativo).

**R7 — Dados derivados congelados (médio).** Os times guardam `nome` e `score` do momento do sorteio, e as médias também. Isso é intencional (histórico fiel) e deve ser preservado.

**R8 — Regras pouco claras ou contraditórias (médio).** README × código (D3, D5), textos desatualizados na UI, "jogador do mês" sem filtro de mês (D10), troca manual sem recálculo de papel (D9).

**R9 — localStorage (médio).** Limite de cerca de 5 MB por origem, dados por navegador/dispositivo, podem ser apagados pelo usuário ou pelo navegador. Exige exportação/backup visível, versão de esquema e leitura tolerante a JSON inválido. Não há atomicidade: SUBSTITUIR e importações devem montar o novo estado em memória e gravar uma única vez.

**R10 — Funcionalidades que exigirão adaptação.** Importação XLSX (biblioteca), "Últimos 14 usados" (passa a ler do storage), PWA, console H2 (some), CORS/variáveis de ambiente (somem), `POST /sorteios` legado (não migra).

**R11 — Defeitos existentes (P1–P9).** Precisam de decisão explícita: reproduzir como está ou corrigir registrando a diferença. Nada será corrigido silenciosamente.

---

## 8. Funcionalidades da primeira versão web (proposta)

Tudo o que existe hoje, sem acrescentar regras:

1. **Jogadores:** cadastrar, editar, excluir com confirmação, listar, buscar, filtrar (levantador/linha, mensalista/avulso, mulher/homem), ordenar, nome único, notas 0–10 com passo 0,1, scores de linha e de levantador, painel de pesos.
2. **Importação de jogadores** (MESCLAR / ADICIONAR / SUBSTITUIR) com prévia e template — formato a decidir (D11).
3. **Seleção:** 14 jogadores + 2 levantadores do dia, pré-marcação, selecionados no topo, busca, filtros, "Últimos 14 usados", "Selecionar mensalistas", "Completar automaticamente", "Limpar seleção".
4. **Sorteio:** algoritmo exaustivo idêntico (R7), com delta (R8) e equilíbrio de mulheres.
5. **Rascunhos:** até 5, comparar, sortear de novo, troca manual com recálculo, desfazer, descartar, confirmar.
6. **Histórico:** listar, ver times, registrar/corrigir placar (empate permitido), editar data, excluir com confirmação.
7. **Estatísticas:** sets ganhos/perdidos, saldo, win rate por sets, delta elástico, notas e scores ajustados, últimos 5 jogos, jogador do mês.
8. **Persistência local** versionada, com **exportar/importar backup** (pedido nas instruções gerais; não existe no Java) e importação dos dados do backend Java, se aprovada (D13).

Fora da primeira versão: backend, autenticação, sincronização, `volei-pocket`, `evolucao`/Elo antigo, `POST /sorteios` direto, PWA (salvo decisão D12).

### Proposta resumida de arquitetura web

```
src/
├── domain/      player.js, match.js (sorteio + placar), team.js (item de time), draft.js, settings.js (pesos e constantes)
├── services/    ratingCalculator.js, ratingDelta.js, teamBalancer.js, teamSwap.js, playerStatistics.js,
│                matchService.js, playerService.js, playerImport.js, selectionService.js, draftService.js
├── storage/     storage.js (versão, leitura/escrita segura, backup), playerStorage.js, matchStorage.js, draftStorage.js
├── hooks/       usePlayers, useMatches, useDrafts (ligam serviços + storage ao React)
├── pages/       Jogadores, EditarJogadores, NovoSorteio, Resultado, Rascunhos, Historico (+ Backup)
├── components/  formulário, nota, cartões, lista de seleção, colunas de time, importação, confirmação
├── utils/       errors.js, random.js (seededRandom), dates.js
└── tests/
```

O detalhamento fica para a Etapa 2 (`docs/web-architecture.md`).

### Sequência recomendada

1. Etapa 2 — arquitetura (depois de validar as dúvidas abaixo).
2. Etapa 3 — inicializar o projeto (decidir antes o que fazer com a pasta `volleyball-team-manager-web` que já existe, D14).
3. Etapa 4 — modelos (`player`, `match`, `draft`, `settings`).
4. Etapa 5 — `ratingCalculator` → `ratingDelta` → `teamBalancer` → `matchService` → `playerStatistics` → `playerService`/`playerImport` → `selectionService`/`teamSwap`/`draftService`.
5. Etapa 6 — testes de equivalência (portar o `SorteioServiceTest` + cenários numéricos de score, delta e jogador do mês).
6. Etapa 7 — storage, backup e importação dos dados do Java.
7. Etapa 8 — telas, na ordem do fluxo.

---

## 9. Dúvidas para o responsável

| # | Pergunta | Interpretação mais provável (não implementada até validar) |
|---|---|---|
| D1 | O `volei-pocket` (console) precisa ser preservado? | Não; a referência é `backend/` + `frontend/` |
| D2 | Existe "média geral" além do score ponderado? | Não; manter só os dois scores |
| D3 | Desempate: folga de 0,05 (código) ou só a diferença mínima exata (README)? | Seguir o código (0,05) |
| D4 | O equilíbrio de mulheres deve contar o reserva? | Manter como está (conta) |
| D5 | A regra vigente de evolução é o delta elástico, e `evolucao`/Elo podem ser descartados? | Sim |
| D6 | O fator elástico deve usar o papel preferido, mesmo quando o jogador jogou no outro papel? | Manter (papel preferido) |
| D7 | Placar 0×0 deve ser aceito? | Manter aceito, igual ao Java |
| D8 | "Desfazer alterações" deve voltar ao sorteio original ou ao último estado salvo? | Manter como está |
| D9 | Na troca manual, o score deve ser recalculado pelo novo papel? | Manter como está e documentar |
| D10 | O "jogador do mês" deve considerar só o mês atual? | Manter todo o histórico (igual ao Java) |
| D11 | Importação: manter XLSX (dependência `xlsx`/SheetJS) ou trocar por CSV sem dependência? | Manter XLSX, instalando pela npm em vez do CDN |
| D12 | O PWA entra na primeira versão? | Não; fica para depois (a estrutura já permite) |
| D13 | Quer importar os dados atuais do banco H2 para a versão web? | Sim, via JSON exportado da API Java |
| D14 | Já existe uma pasta `volleyball-team-manager-web` no seu computador (esqueleto da tentativa anterior). Recomeçar do zero ou aproveitar? | Recomeçar, guardando a antiga como referência |
| D15 | Os defeitos P1–P9 devem ser reproduzidos ou corrigidos? | Corrigir P1, P3, P4, P6 e P7 registrando a diferença; manter P8 até decidir D9; P9 com confirmação reforçada |
| D16 | "Completar automaticamente" pode passar de 14 jogadores (P10). Corrigir? | Manter como no Java até decidir; proposta de correção: só adicionar levantador se houver vaga |

---

## Apêndice A — `volei-pocket` (aplicação de console)

Classes: `Pessoa` (abstrata: `id`, `nome`, `getTipo()`), `Jogador extends Pessoa` (as mesmas 6 notas e 3 booleanos; as mesmas fórmulas de score), `Time` (lista de jogadores + `levantadorId`; média = **média dos 7**, sem reserva), `Sorteio` (id, `LocalDateTime`, 2 times, ids), `SorteioService` (1.000 embaralhamentos aleatórios, guarda o de menor diferença; **sem** reserva, mulheres, delta ou placar), `Persistencia` (`jogadores.txt` e `sorteios.txt` com `|`; exportação/importação CSV com `,`), `Main` (menus de console, CRUD, importação com os mesmos 3 modos, comparação de nome **sem trim**, sem bloqueio de nome duplicado no cadastro).

Defeito encontrado: a exportação CSV usa `%.1f` com o locale do sistema; em pt-BR gera `10,0`, o que quebra o próprio CSV (o `jogadores.csv` da pasta já está nesse estado e não pode ser reimportado).

## Apêndice B — Correções em relação à versão anterior deste documento

- Não existe `RecursoNaoEncontradoException`; a classe é `ResourceNotFoundException`. `ApiError` era citado, mas faltava na árvore de pacotes.
- O SheetJS não é dependência npm; é carregado por CDN em `index.html`.
- Faltavam os componentes `NotaInput.jsx` e `TimesResultado.jsx` (este não é usado).
- Faltavam o `volei-pocket` e o `roteiro.docx`.
- `evolucao` já aparecia como campo legado, mas não estavam registradas as divergências README × código (desempate com folga de 0,05, modelo Elo), o "jogador do mês" sem filtro de mês, as duplicatas na importação, a falta de validação em `confirmar`, nem o problema da troca manual de levantador.
- Faltava o risco de perda dos dados reais do H2.
