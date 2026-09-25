# Plano de Implementação: Dashboard de Execução de Testes e Diagnóstico de Desempenho de LLMs

Este documento estabelece o plano estruturado de desenvolvimento para a consolidação e aprimoramento do Dashboard de Avaliação de LLMs no repositório `lm-evaluation-harness-pt`.

---

## 🎯 Decisões de Arquitetura (Aprovadas no Socratic Gate)

1. **Modo Híbrido de Execução**:
   - Suporte a **Execução Real** via motor `lm-eval` conectando às APIs (Xiaomi MIMO, OpenAI, etc.) com `limit` configurável (ex: 2 a 10 amostras para testes rápidos e econômicos).
   - Suporte a **Modo Simulação / Mock**: Permite testar todo o ciclo do dashboard instantaneamente sem custo de tokens, gerando amostras realistas com status, logs e métricas.
2. **Persistência Dupla (SQLite + JSON)**:
   - Banco de dados relacional local `scripts/dashboard/dashboard.db` em SQLite para indexação rápida, filtragem por questões, agregação estatística e consultas de alta performance.
   - Sincronização automática com os arquivos `.json` existentes em `scripts/dashboard/runs/` garantindo portabilidade.
3. **Comunicação em Tempo Real**:
   - Suporte híbrido a **Server-Sent Events (SSE)** (`/api/run/events`) e **Polling Assíncrono** (`/api/run/status`) para máxima resiliência e compatibilidade em qualquer navegador.

---

## 📋 Fases de Implementação

### Fase 1: Camada de Dados e Persistência SQLite (`scripts/dashboard/db.py`)
- [x] Criar módulo `db.py` com schema SQLite para:
  - Tabela `runs`: metadados da execução (id, model, tasks, limit, duration, timestamp, status, accuracy, total_questions, is_simulation).
  - Tabela `questions`: detalhes de cada item avaliado (run_id, task, question_text, choices, gold, model_choice, is_correct, category, explanation).
  - Tabela `diagnostics`: métricas por disciplina e recomendações de prompt/few-shot.
- [x] Implementar rotina de migração/sincronização que importa automaticamente runs em `.json` existentes para o SQLite.

### Fase 2: Motor de Execução Híbrido (`scripts/dashboard/runner.py`)
- [x] Adicionar parâmetro `is_simulation: bool` em `EvaluationRunner.start_run()`.
- [x] Implementar gerador de dados sintéticos realistas no modo simulação para ENEM, BlueX, OAB e tarefas de classificação.
- [x] Garantir que tanto execuções reais quanto simuladas salvem os dados tanto no SQLite quanto em arquivo JSON.
- [x] Manter fila de logs thread-safe com suporte a streaming em tempo real.

### Fase 3: Endpoints da API FastAPI (`scripts/dashboard/server.py`)
- [x] Atualizar endpoints `/api/runs` e `/api/runs/{run_id}` para consultar o SQLite com fallback para JSON.
- [x] Adicionar endpoint SSE `/api/run/events` para streaming contínuo de logs e progresso.
- [x] Adicionar parâmetro `is_simulation` no payload do endpoint `POST /api/run`.
- [x] Adicionar endpoint `DELETE /api/runs/{run_id}` para gerenciamento do histórico.

### Fase 4: Interface do Usuário e Visualizações (`scripts/dashboard/static/`)
- [x] Atualizar `index.html` e `app.js`:
  - Toggle de "Modo Real (API) vs Modo Simulação Instantânea" no Test Runner.
  - Conexão SSE com fallback para polling suave no terminal de logs.
  - Gráfico Radar interativo de habilidades na Visão 1 (Leaderboard).
  - Filtros ágeis na Visão 3 (Inspetor de Questões): Todos / Acertos / Erros / Busca por texto.
  - Gráficos de barras por disciplina na Visão 4.
  - Exibição limpa e acionável dos cards de diagnóstico na Visão 5.

### Fase 5: Verificação e Testes
- [x] Criar script de teste automatizado `tests/test_dashboard.py` para validar endpoints REST e SQLite.
- [x] Executar rodada em modo simulação e validar atualização instantânea das 5 visões.
- [x] Validar que todos os testes executam e passam sem erros.
