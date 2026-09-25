/**
 * Open Portuguese LLM Benchmark - Dashboard de Desempenho
 * Aplicação cliente interativa com gerenciamento de estado e gráficos.
 */

// Estado da Aplicação
const state = {
  currentTab: 'leaderboard',
  leaderboard: [],
  runs: [],
  activeRunId: null,
  activeRunData: null,
  questionFilter: 'all', // 'all' | 'correct' | 'wrong'
  questionCategory: 'all',
  questionSearch: '',
  charts: {
    radar: null,
    categories: null
  },
  pollingInterval: null,
  eventSource: null
};

function toggleCustomModelInput(val) {
  const customInput = document.getElementById('runnerCustomModel');
  if (customInput) {
    if (val === 'custom') {
      customInput.classList.remove('hidden');
      customInput.focus();
    } else {
      customInput.classList.add('hidden');
    }
  }
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  setupEventListeners();
  loadLeaderboard();
  loadRunsList();
  checkRunnerStatus();
});

function setupEventListeners() {
  const runSelector = document.getElementById('runSelector');
  if (runSelector) {
    runSelector.addEventListener('change', (e) => {
      selectRun(e.target.value);
    });
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadLeaderboard();
      loadRunsList();
      if (state.activeRunId) {
        selectRun(state.activeRunId);
      }
    });
  }

  const lbSearch = document.getElementById('leaderboardSearch');
  if (lbSearch) {
    lbSearch.addEventListener('input', (e) => {
      filterLeaderboard(e.target.value);
    });
  }
}

// ============================================================================
// NAVEGAÇÃO DE ABAS (5 VISÕES)
// ============================================================================
function switchTab(tabName) {
  state.currentTab = tabName;
  const tabs = ['leaderboard', 'runner', 'questions', 'categories', 'suggestions'];

  tabs.forEach(tab => {
    const btn = document.getElementById(`tabBtn-${tab}`);
    const view = document.getElementById(`view-${tab}`);
    if (tab === tabName) {
      if (btn) {
        btn.classList.add('active');
        btn.classList.remove('text-gray-400');
        btn.classList.add('text-indigo-400');
      }
      if (view) view.classList.remove('hidden');
    } else {
      if (btn) {
        btn.classList.remove('active');
        btn.classList.remove('text-indigo-400');
        btn.classList.add('text-gray-400');
      }
      if (view) view.classList.add('hidden');
    }
  });

  if (window.lucide) {
    lucide.createIcons();
  }

  // Redimensionar gráficos quando suas abas são exibidas
  if (tabName === 'leaderboard' && state.charts.radar) {
    setTimeout(() => state.charts.radar.resize(), 50);
  }
  if (tabName === 'categories' && state.charts.categories) {
    setTimeout(() => state.charts.categories.resize(), 50);
  }
}

// ============================================================================
// VISÃO 1: LEADERBOARD GERAL
// ============================================================================
async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    state.leaderboard = data.leaderboard || [];
    renderLeaderboard(state.leaderboard);
    renderRadarChart(state.leaderboard);
  } catch (err) {
    console.error('Erro ao carregar leaderboard:', err);
  }
}

function renderLeaderboard(models) {
  const tbody = document.getElementById('leaderboardTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  models.forEach((m) => {
    const tr = document.createElement('tr');
    const isCustom = m.is_custom;
    tr.className = `hover:bg-gray-800/40 transition duration-150 ${isCustom ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''}`;

    let rankBadge = `<span class="text-gray-400 font-bold">${m.rank}</span>`;
    if (m.rank === 1) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 font-bold text-xs">🥇</span>`;
    if (m.rank === 2) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-300 font-bold text-xs">🥈</span>`;
    if (m.rank === 3) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/20 text-amber-600 font-bold text-xs">🥉</span>`;

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center">${rankBadge}</td>
      <td class="py-2.5 px-4 font-sans">
        <div class="flex items-center space-x-2">
          <span class="font-semibold ${isCustom ? 'text-indigo-300' : 'text-gray-200'}">${m.model}</span>
          ${isCustom ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Avaliado Aqui</span>' : ''}
        </div>
        <span class="text-[10px] text-gray-500">${m.provider}</span>
      </td>
      <td class="py-2.5 px-3 text-right font-bold ${isCustom ? 'text-indigo-400' : 'text-emerald-400'}">${m.average.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${m.enem.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${m.bluex.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${m.oab.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.assin2_rte.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.assin2_sts.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.faquad_nli.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.hatebr.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.pt_hate_speech.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${m.tweetsentbr.toFixed(2)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterLeaderboard(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderLeaderboard(state.leaderboard);
    return;
  }
  const filtered = state.leaderboard.filter(m => 
    m.model.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)
  );
  renderLeaderboard(filtered);
}

function renderRadarChart(models) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;

  const top1 = models.find(m => m.rank === 1) || models[0];
  const top3 = models.find(m => m.rank === 3) || models[2];
  const mimo = models.find(m => m.is_custom) || models[3];

  const labels = ['ENEM', 'BlueX', 'OAB Exams', 'NLI / STS', 'Moderação'];

  const getScores = (m) => [
    m.enem,
    m.bluex,
    m.oab,
    (m.assin2_rte + m.faquad_nli) / 2,
    (m.hatebr + m.pt_hate_speech) / 2
  ];

  if (state.charts.radar) {
    state.charts.radar.destroy();
  }

  const ctx = canvas.getContext('2d');
  state.charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Gemini 2.5 Pro (Líder)',
          data: getScores(top1),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: 'Claude 3.7 Sonnet',
          data: getScores(top3),
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: 'Xiaomi MIMO v2.6 Flash',
          data: getScores(mimo),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.25)',
          borderWidth: 2.5,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 60,
          max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
          pointLabels: {
            color: '#9ca3af',
            font: { size: 10, family: 'Inter' }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            boxWidth: 10,
            color: '#9ca3af',
            font: { size: 10, family: 'Inter' }
          }
        }
      }
    }
  });
}

// ============================================================================
// ============================================================================
// VISÃO 2: EXECUTOR DE TESTES & MONITOR (MODO HÍBRIDO + SSE)
// ============================================================================
async function startEvaluationRun() {
  let model = document.getElementById('runnerModel').value;
  if (model === 'custom') {
    const customInput = document.getElementById('runnerCustomModel');
    if (customInput && customInput.value.trim()) {
      model = customInput.value.trim();
    } else {
      alert('Por favor, informe o identificador do modelo customizado.');
      return;
    }
  }

  const limit = parseInt(document.getElementById('runnerLimit').value) || 10;
  const fewshot = parseInt(document.getElementById('runnerFewshot').value) || 3;

  const modeRadio = document.querySelector('input[name="executionMode"]:checked');
  const isSimulation = modeRadio ? (modeRadio.value === 'simulation') : true;

  const taskCheckboxes = document.querySelectorAll('input[name="tasks"]:checked');
  const tasks = Array.from(taskCheckboxes).map(cb => cb.value);

  if (tasks.length === 0) {
    alert('Por favor, selecione ao menos uma tarefa para o teste.');
    return;
  }

  const btn = document.getElementById('btnStartRun');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Iniciando ${isSimulation ? 'Simulação' : 'Avaliação'}...`;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        tasks: tasks,
        limit: limit,
        num_fewshot: fewshot,
        is_simulation: isSimulation
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao iniciar teste.');
    }

    const data = await res.json();
    const modeTag = isSimulation ? '[SIMULAÇÃO ⚡]' : '[EXECUÇÃO REAL 🌐]';
    appendTerminalLog(`[SISTEMA] ${modeTag} Teste iniciado! Run ID: ${data.run_id}`);
    
    // Inicia escuta em tempo real (SSE com fallback para polling)
    startLiveLogStream();
  } catch (err) {
    alert(`Erro ao iniciar avaliação: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i><span>Iniciar Avaliação Sob Demanda</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

function startLiveLogStream() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  if (window.EventSource) {
    try {
      const es = new EventSource('/api/run/events');
      state.eventSource = es;

      es.onmessage = (event) => {
        try {
          const status = JSON.parse(event.data);
          updateRunnerUI(status);

          if (!status.is_running && (status.progress_pct === 100 || status.progress_pct === 0)) {
            es.close();
            state.eventSource = null;
            loadRunsList();
          }
        } catch (e) {
          console.error('Erro ao ler SSE:', e);
        }
      };

      es.onerror = () => {
        // Fallback para polling se SSE falhar
        es.close();
        state.eventSource = null;
        startPollingRunner();
      };
      return;
    } catch (e) {
      console.warn('SSE indisponível, usando polling:', e);
    }
  }

  startPollingRunner();
}

function startPollingRunner() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(checkRunnerStatus, 1200);
}

async function checkRunnerStatus() {
  try {
    const res = await fetch('/api/run/status');
    const status = await res.json();
    updateRunnerUI(status);

    if (!status.is_running && state.pollingInterval) {
      clearInterval(state.pollingInterval);
      state.pollingInterval = null;
      loadRunsList();
    }
  } catch (err) {
    console.error('Erro ao verificar status do runner:', err);
  }
}

function updateRunnerUI(status) {
  const badge = document.getElementById('runnerStatusBadge');
  const bar = document.getElementById('runnerProgressBar');
  const taskText = document.getElementById('runnerCurrentTaskText');
  const pctText = document.getElementById('runnerProgressPctText');
  const btn = document.getElementById('btnStartRun');

  if (status.is_running) {
    const modeLabel = status.is_simulation ? 'Simulação' : 'API Real';
    if (badge) {
      badge.className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Em Execução [${modeLabel}] (${status.elapsed_seconds}s)</span>`;
    }
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Avaliando em Background...`;
    }
  } else {
    if (badge) {
      badge.className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700 flex items-center space-x-1.5';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-500"></span><span>Inativo</span>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i><span>Iniciar Avaliação Sob Demanda</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  if (bar) bar.style.width = `${status.progress_pct}%`;
  if (pctText) pctText.innerText = `${status.progress_pct}%`;
  if (taskText) taskText.innerText = status.current_task || 'Aguardando início...';

  // Atualizar terminal com logs
  if (status.logs && status.logs.length > 0) {
    const terminal = document.getElementById('terminalOutput');
    if (terminal) {
      terminal.innerHTML = status.logs.map(line => `<p>${escapeHtml(line)}</p>`).join('');
      terminal.scrollTop = terminal.scrollHeight;
    }
  }
}

function clearTerminal() {
  const terminal = document.getElementById('terminalOutput');
  if (terminal) terminal.innerHTML = '<p class="text-gray-500">Terminal limpo.</p>';
}

function appendTerminalLog(msg) {
  const terminal = document.getElementById('terminalOutput');
  if (terminal) {
    const p = document.createElement('p');
    p.innerText = msg;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
  }
}

// ============================================================================
// CARREGAR, SELECIONAR E EXCLUIR RODADAS (RUNS)
// ============================================================================
async function loadRunsList() {
  try {
    const res = await fetch('/api/runs');
    const data = await res.json();
    state.runs = data.runs || [];

    const selector = document.getElementById('runSelector');
    if (!selector) return;
    selector.innerHTML = '';

    if (state.runs.length === 0) {
      selector.innerHTML = '<option value="">Nenhuma rodada no banco</option>';
      return;
    }

    state.runs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      const modeTag = r.is_simulation ? '⚡' : '🌐';
      opt.innerText = `${modeTag} ${r.model} • ${r.accuracy.toFixed(1)}% (${r.timestamp})`;
      selector.appendChild(opt);
    });

    // Se nenhuma estiver selecionada, seleciona a primeira (mais recente)
    if (!state.activeRunId || !state.runs.some(r => r.id === state.activeRunId)) {
      selectRun(state.runs[0].id);
    }
  } catch (err) {
    console.error('Erro ao listar rodadas salvas:', err);
  }
}

async function deleteCurrentRun() {
  if (!state.activeRunId) {
    alert('Nenhuma rodada selecionada para exclusão.');
    return;
  }

  const confirmed = confirm(`Deseja realmente excluir a rodada '${state.activeRunId}' do histórico?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/runs/${state.activeRunId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao excluir rodada.');
    state.activeRunId = null;
    await loadRunsList();
  } catch (err) {
    alert(`Erro ao excluir: ${err.message}`);
  }
}

async function selectRun(runId) {
  if (!runId) return;
  state.activeRunId = runId;
  const selector = document.getElementById('runSelector');
  if (selector) selector.value = runId;

  try {
    const res = await fetch(`/api/runs/${runId}`);
    if (!res.ok) throw new Error('Não foi possível carregar os detalhes da rodada.');
    const runData = await res.json();
    state.activeRunData = runData;

    renderRunData(runData);
  } catch (err) {
    console.error(`Erro ao carregar detalhes da rodada ${runId}:`, err);
  }
}

function renderRunData(data) {
  const questions = data.questions || [];
  const diagnostics = data.diagnostics || {};
  const summary = diagnostics.summary || {
    total: questions.length,
    correct: questions.filter(q => q.is_correct).length,
    wrong: questions.filter(q => !q.is_correct).length,
    accuracy: questions.length > 0 ? (questions.filter(q => q.is_correct).length / questions.length) * 100 : 0
  };

  // 1. Atualizar KPIs
  document.getElementById('kpiTotal').innerText = summary.total;
  document.getElementById('kpiCorrect').innerText = summary.correct;
  document.getElementById('kpiWrong').innerText = summary.wrong;
  document.getElementById('kpiAccuracy').innerText = `${summary.accuracy.toFixed(1)}%`;

  // Badges nas abas
  const badgeQ = document.getElementById('tabBadgeQuestions');
  if (badgeQ) badgeQ.innerText = summary.total;
  const badgeS = document.getElementById('tabBadgeSuggestions');
  if (badgeS) badgeS.innerText = (diagnostics.suggestions || []).length;

  // 2. Preencher opções do dropdown de categoria
  populateCategoryFilter(questions);

  // 3. Renderizar Lista de Questões
  applyQuestionFilters();

  // 4. Renderizar Categorias & Gráfico
  renderCategoriesView(diagnostics.categories || []);

  // 5. Renderizar Sugestões
  renderSuggestionsView(diagnostics.suggestions || []);
}

// ============================================================================
// VISÃO 3: INSPETOR DE QUESTÕES
// ============================================================================
function populateCategoryFilter(questions) {
  const select = document.getElementById('questionCategoryFilter');
  if (!select) return;

  const categories = Array.from(new Set(questions.map(q => q.category))).filter(Boolean);
  select.innerHTML = '<option value="all">Todas as Disciplinas</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
}

function setQuestionFilter(status) {
  state.questionFilter = status;
  const filters = ['all', 'correct', 'wrong'];
  filters.forEach(f => {
    const btn = document.getElementById(`qFilter${capitalize(f)}`);
    if (btn) {
      if (f === status) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow transition';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800 transition';
      }
    }
  });
  applyQuestionFilters();
}

function applyQuestionFilters() {
  if (!state.activeRunData) return;
  const allQuestions = state.activeRunData.questions || [];

  // Contadores nos botões de filtro
  const totalCount = allQuestions.length;
  const correctCount = allQuestions.filter(q => q.is_correct).length;
  const wrongCount = totalCount - correctCount;

  document.getElementById('countFilterAll').innerText = totalCount;
  document.getElementById('countFilterCorrect').innerText = correctCount;
  document.getElementById('countFilterWrong').innerText = wrongCount;

  const categoryFilter = document.getElementById('questionCategoryFilter').value;
  const searchTerm = (document.getElementById('questionSearch').value || '').toLowerCase().trim();

  const filtered = allQuestions.filter(q => {
    // Filtro por status
    if (state.questionFilter === 'correct' && !q.is_correct) return false;
    if (state.questionFilter === 'wrong' && q.is_correct) return false;

    // Filtro por categoria
    if (categoryFilter !== 'all' && q.category !== categoryFilter) return false;

    // Filtro de busca textual
    if (searchTerm) {
      const matchText = q.question.toLowerCase().includes(searchTerm);
      const matchChoices = (q.choices || []).some(c => c.text.toLowerCase().includes(searchTerm));
      const matchId = (q.id || '').toLowerCase().includes(searchTerm);
      if (!matchText && !matchChoices && !matchId) return false;
    }

    return true;
  });

  renderQuestionsList(filtered);
}

function renderQuestionsList(questions) {
  const container = document.getElementById('questionsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (questions.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-8 rounded-2xl text-center text-gray-400">
        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
        <p class="text-sm">Nenhuma questão encontrada para os filtros selecionados.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    const isCorrect = q.is_correct;
    card.className = `glass-panel p-5 rounded-2xl border ${isCorrect ? 'border-emerald-500/20' : 'border-rose-500/20'} space-y-4 hover:border-gray-700 transition`;

    // Badges de cabeçalho
    let statusPill = isCorrect
      ? `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Acertou
        </span>`
      : `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <i data-lucide="x" class="w-3.5 h-3.5"></i> Errou
        </span>`;

    let negationPill = q.has_negation
      ? `<span class="px-2 py-0.5 text-[10px] rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium" title="Questão com comando negativo (NÃO, INCORRETO, EXCETO)">
          ⚠️ Pegadinha de Negação
        </span>`
      : '';

    // Render das Alternativas
    const choicesHtml = (q.choices || []).map(c => {
      const isModelChoice = (c.label.toUpperCase() === (q.model_answer || '').toUpperCase());
      const isGoldChoice = (c.label.toUpperCase() === (q.gold_answer || '').toUpperCase());

      let choiceStyle = 'bg-gray-900/50 border-gray-800 text-gray-300';
      let tagHtml = '';

      if (isGoldChoice) {
        choiceStyle = 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200';
        tagHtml = `<span class="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Gabarito Oficial</span>`;
      }
      if (isModelChoice && !isCorrect) {
        choiceStyle = 'bg-rose-950/30 border-rose-500/50 text-rose-200';
        tagHtml = `<span class="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Resposta Escolhida pela LLM</span>`;
      } else if (isModelChoice && isCorrect) {
        tagHtml = `<span class="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Resposta Escolhida (Correta)</span>`;
      }

      return `
        <div class="flex items-start space-x-3 p-2.5 rounded-xl border ${choiceStyle} text-xs transition">
          <span class="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-xs bg-gray-800 text-gray-200 shrink-0 mt-0.5">
            ${c.label}
          </span>
          <span class="flex-1 leading-relaxed">${escapeHtml(c.text)}</span>
          ${tagHtml}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <div class="flex items-center space-x-2 flex-wrap gap-y-1">
          <span class="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            #${q.index + 1} (${q.id})
          </span>
          <span class="text-xs text-gray-300 font-medium bg-gray-800 px-2 py-0.5 rounded">
            ${q.task}
          </span>
          <span class="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            ${q.category}
          </span>
          ${negationPill}
        </div>
        <div>${statusPill}</div>
      </div>

      <!-- Enunciado -->
      <div class="text-sm text-gray-200 leading-relaxed font-sans">
        ${escapeHtml(q.question)}
      </div>

      <!-- Alternativas -->
      <div class="space-y-2 pt-1">
        ${choicesHtml}
      </div>

      <!-- Rodapé do Card com Resumo -->
      <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800/60">
        <div>
          <span>Escolha do Modelo: </span>
          <strong class="${isCorrect ? 'text-emerald-400' : 'text-rose-400'}">${q.model_answer || 'N/A'}</strong>
          <span class="mx-2">•</span>
          <span>Gabarito: </span>
          <strong class="text-emerald-400">${q.gold_answer || 'N/A'}</strong>
        </div>
        <span class="text-[11px] text-gray-500">${q.word_count || 0} palavras</span>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ============================================================================
// VISÃO 4: CATEGORIAS & DISCIPLINAS
// ============================================================================
function renderCategoriesView(categories) {
  // 1. Tabela de Categorias
  const tbody = document.getElementById('categoriesTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    categories.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-800/40 transition';
      tr.innerHTML = `
        <td class="py-2 px-3 font-sans text-gray-200">${c.category}</td>
        <td class="py-2 px-2 text-center text-gray-400">${c.total}</td>
        <td class="py-2 px-2 text-center text-emerald-400 font-semibold">${c.correct}</td>
        <td class="py-2 px-2 text-center text-rose-400 font-semibold">${c.wrong}</td>
        <td class="py-2 px-3 text-right">
          <div class="flex items-center justify-end space-x-2">
            <span class="font-bold ${c.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'}">${c.accuracy.toFixed(1)}%</span>
            <div class="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full ${c.accuracy >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width: ${c.accuracy}%"></div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 2. Gráfico de Barras de Acurácia
  const canvas = document.getElementById('categoriesBarChart');
  if (!canvas) return;

  if (state.charts.categories) {
    state.charts.categories.destroy();
  }

  const ctx = canvas.getContext('2d');
  const labels = categories.map(c => c.category);
  const data = categories.map(c => c.accuracy);

  state.charts.categories = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Acurácia (%)',
        data: data,
        backgroundColor: data.map(val => val >= 70 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(245, 158, 11, 0.7)'),
        borderColor: data.map(val => val >= 70 ? '#10b981' : '#f59e0b'),
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af', font: { size: 10, family: 'Inter' } }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: '#e5e7eb',
            font: { size: 10, family: 'Inter' },
            callback: function(val) {
              const str = this.getLabelForValue(val);
              return str.length > 25 ? str.substring(0, 25) + '...' : str;
            }
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ============================================================================
// VISÃO 5: SUGESTÕES DE MELHORIAS & INSIGHTS
// ============================================================================
function renderSuggestionsView(suggestions) {
  const container = document.getElementById('suggestionsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (suggestions.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-8 rounded-2xl glass-panel text-center text-gray-400">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-400 mx-auto mb-2"></i>
        <p class="text-sm font-semibold text-gray-200">Nenhuma fraqueza crítica detectada!</p>
        <p class="text-xs text-gray-400 mt-1">O modelo obteve excelente taxa de acertos nas amostras avaliadas.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  suggestions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'glass-panel p-5 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition';

    let severityBadge = '';
    if (s.severity === 'high') {
      severityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">Alta Prioridade</span>`;
    } else if (s.severity === 'medium') {
      severityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Média Prioridade</span>`;
    } else {
      severityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Otimização</span>`;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2">
            <span class="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <i data-lucide="lightbulb" class="w-4 h-4"></i>
            </span>
            <h4 class="font-bold text-sm text-gray-100">${escapeHtml(s.title)}</h4>
          </div>
          ${severityBadge}
        </div>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">
          ${escapeHtml(s.description)}
        </p>
      </div>

      <div class="bg-gray-900/80 p-3 rounded-xl border border-gray-800 text-xs">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block mb-1">
          💡 Ação Recomendada:
        </span>
        <p class="text-gray-200 leading-relaxed font-sans">
          ${escapeHtml(s.recommendation)}
        </p>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
