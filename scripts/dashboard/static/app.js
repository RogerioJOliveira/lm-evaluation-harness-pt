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

function handleModelSelectChange(val) {
  const container = document.getElementById('customModelContainer');
  const customInput = document.getElementById('runnerCustomModel');
  if (val === 'custom') {
    if (container) container.classList.remove('hidden');
    if (customInput) {
      customInput.focus();
    }
  } else {
    if (container) container.classList.add('hidden');
  }
}

function getSavedCustomModels() {
  try {
    const raw = localStorage.getItem('saved_custom_models');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveManualModel(explicitName) {
  const customInput = document.getElementById('runnerCustomModel');
  const modelName = (explicitName || (customInput ? customInput.value : '')).trim();

  if (!modelName || modelName.toLowerCase() === 'custom') {
    alert('Por favor, digite o nome do modelo para salvar.');
    return null;
  }

  let list = getSavedCustomModels();
  if (!list.includes(modelName)) {
    list.push(modelName);
    localStorage.setItem('saved_custom_models', JSON.stringify(list));
  }

  loadSavedCustomModels(modelName);

  // Seleciona o modelo recém salvo e oculta o container
  const select = document.getElementById('runnerModel');
  if (select) {
    select.value = modelName;
  }
  const container = document.getElementById('customModelContainer');
  if (container) container.classList.add('hidden');
  if (customInput) customInput.value = '';

  return modelName;
}

function loadSavedCustomModels(selectThisModel) {
  const optGroup = document.getElementById('savedModelsOptGroup');
  const countBadge = document.getElementById('savedModelsCountBadge');
  if (!optGroup) return;

  const models = getSavedCustomModels();
  optGroup.innerHTML = '';

  if (countBadge) {
    if (models.length > 0) {
      countBadge.classList.remove('hidden');
      countBadge.innerText = `${models.length} salvo(s)`;
    } else {
      countBadge.classList.add('hidden');
    }
  }

  if (models.length === 0) {
    const emptyOpt = document.createElement('option');
    emptyOpt.disabled = true;
    emptyOpt.innerText = '(Nenhum modelo customizado salvo ainda)';
    optGroup.appendChild(emptyOpt);
    return;
  }

  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = `⭐ ${m}`;
    optGroup.appendChild(opt);
  });

  if (selectThisModel && models.includes(selectThisModel)) {
    const select = document.getElementById('runnerModel');
    if (select) select.value = selectThisModel;
  }
}

async function loadSystemConfig() {
  try {
    loadSavedCustomModels();

    const res = await fetch('/api/config');
    const cfg = await res.json();
    
    // Atualiza status da chave .env
    const badge = document.getElementById('envKeyStatusBadge');
    if (badge) {
      if (cfg.has_env_key) {
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-mono';
        badge.innerText = `Chave .env ativa (${cfg.key_preview})`;
      } else {
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-500/30';
        badge.innerText = 'Sem chave no .env';
      }
    }

    // Carrega do localStorage ou default
    const savedBaseUrl = localStorage.getItem('llm_base_url');
    const baseUrlInput = document.getElementById('configBaseUrl');
    if (baseUrlInput) {
      baseUrlInput.value = savedBaseUrl || cfg.default_base_url || 'https://api.xiaomimimo.com/v1';
    }

    const savedApiKey = localStorage.getItem('llm_api_key');
    const apiKeyInput = document.getElementById('configApiKey');
    if (apiKeyInput && savedApiKey) {
      apiKeyInput.value = savedApiKey;
    }
  } catch (err) {
    console.warn('Erro ao carregar configurações do sistema:', err);
  }
}

function setBaseUrlPreset(url, defaultModel) {
  const baseUrlInput = document.getElementById('configBaseUrl');
  if (baseUrlInput) {
    baseUrlInput.value = url;
    localStorage.setItem('llm_base_url', url);
  }
  const runnerModel = document.getElementById('runnerModel');
  if (runnerModel && defaultModel) {
    runnerModel.value = defaultModel;
  }
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('configApiKey');
  const eyeIcon = document.getElementById('eyeIcon');
  if (!apiKeyInput) return;

  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
  } else {
    apiKeyInput.type = 'password';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}

async function runQuickApiTest() {
  const baseUrl = document.getElementById('configBaseUrl')?.value.trim();
  const apiKey = document.getElementById('configApiKey')?.value.trim();
  let model = document.getElementById('runnerModel')?.value || 'mimo-v2.6-flash';
  if (model === 'custom') {
    const custom = document.getElementById('runnerCustomModel')?.value.trim();
    if (custom) {
      model = saveManualModel(custom) || custom;
    }
  }

  const btn = document.getElementById('btnQuickTest');
  const feedback = document.getElementById('quickTestFeedback');

  if (baseUrl) localStorage.setItem('llm_base_url', baseUrl);
  if (apiKey) localStorage.setItem('llm_api_key', apiKey);

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-1.5">⏳</span> Testando conexão...`;
  }

  if (feedback) {
    feedback.className = 'text-xs rounded-lg p-2.5 border bg-indigo-950/30 border-indigo-500/30 text-indigo-300';
    feedback.innerHTML = `<span class="animate-pulse">Enviando ping para ${baseUrl || 'endpoint'} com modelo ${model}...</span>`;
    feedback.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: baseUrl || null,
        api_key: apiKey || null,
        model: model,
        prompt: 'Olá! Responda em uma frase curta confirmando o modelo.'
      })
    });

    const data = await res.json();

    if (data.success) {
      feedback.className = 'text-xs rounded-lg p-3 border bg-emerald-950/40 border-emerald-500/40 text-emerald-200 space-y-1.5';
      feedback.innerHTML = `
        <div class="flex items-center justify-between font-semibold text-emerald-400">
          <span class="flex items-center gap-1.5">🟢 Conexão Estabelecida com Sucesso!</span>
          <span class="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">${data.latency_ms}ms</span>
        </div>
        <p class="text-[11px] text-gray-300 bg-gray-950/60 p-2 rounded border border-emerald-500/20 italic">"${escapeHtml(data.response)}"</p>
        <div class="text-[10px] text-emerald-400/80 flex items-center justify-between">
          <span>Modelo: <b>${data.model}</b></span>
          <span>Endpoint: <b>${data.base_url}</b></span>
        </div>
      `;
    } else {
      feedback.className = 'text-xs rounded-lg p-3 border bg-rose-950/40 border-rose-500/40 text-rose-200 space-y-1';
      feedback.innerHTML = `
        <div class="flex items-center justify-between font-semibold text-rose-400">
          <span class="flex items-center gap-1.5">🔴 Falha na Conexão</span>
          ${data.latency_ms ? `<span class="text-[10px] bg-rose-500/20 px-1.5 py-0.5 rounded font-mono">${data.latency_ms}ms</span>` : ''}
        </div>
        <p class="text-[11px] text-rose-300">${escapeHtml(data.error || 'Erro desconhecido ao conectar com a API.')}</p>
        <p class="text-[10px] text-gray-400">Verifique a API Key, a Base URL e se o modelo está liberado para sua conta.</p>
      `;
    }
  } catch (err) {
    feedback.className = 'text-xs rounded-lg p-2.5 border bg-rose-950/40 border-rose-500/40 text-rose-200';
    feedback.innerHTML = `🔴 <b>Erro de requisição:</b> ${escapeHtml(err.message)}`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="zap" class="w-3.5 h-3.5"></i><span>Testar Conexão Rápida</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  setupEventListeners();
  loadSystemConfig();
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

  const fmtScore = (val) => {
    if (val !== undefined && val !== null && !isNaN(val)) {
      return `${Number(val).toFixed(2)}%`;
    }
    return '<span class="text-gray-600">—</span>';
  };

  models.forEach((m) => {
    const tr = document.createElement('tr');
    const isCustom = m.is_custom;
    tr.className = `hover:bg-gray-800/40 transition duration-150 ${isCustom ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''}`;

    let rankBadge = `<span class="text-gray-400 font-bold">${m.rank}</span>`;
    if (m.rank === 1) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 font-bold text-xs">🥇</span>`;
    if (m.rank === 2) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-300 font-bold text-xs">🥈</span>`;
    if (m.rank === 3) rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/20 text-amber-600 font-bold text-xs">🥉</span>`;

    let actionBtn = '';
    if (isCustom && m.run_id) {
      actionBtn = `
        <button onclick="selectRun('${m.run_id}'); switchTab('questions');" class="ml-2 px-1.5 py-0.5 text-[9px] rounded bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 border border-indigo-500/40 font-semibold transition" title="Inspecionar questões desta rodada">
          🔍 Ver Detalhes
        </button>
      `;
    }

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center">${rankBadge}</td>
      <td class="py-2.5 px-4 font-sans">
        <div class="flex items-center space-x-1.5 flex-wrap">
          <span class="font-semibold ${isCustom ? 'text-indigo-300 font-bold' : 'text-gray-200'}">${escapeHtml(m.model)}</span>
          ${isCustom ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Avaliado no SQLite</span>' : ''}
          ${actionBtn}
        </div>
        <span class="text-[10px] text-gray-500">${escapeHtml(m.provider)}</span>
      </td>
      <td class="py-2.5 px-3 text-right font-bold ${isCustom ? 'text-indigo-400 font-mono text-xs' : 'text-emerald-400'}">${m.average.toFixed(2)}%</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${fmtScore(m.enem)}</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${fmtScore(m.bluex)}</td>
      <td class="py-2.5 px-3 text-right text-gray-300">${fmtScore(m.oab)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.assin2_rte)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.assin2_sts)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.faquad_nli)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.hatebr)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.pt_hate_speech)}</td>
      <td class="py-2.5 px-3 text-right text-gray-400">${fmtScore(m.tweetsentbr)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Atualiza os Cards de Destaque no Topo do Leaderboard
  if (models && models.length > 0) {
    const leader = models[0];
    const topName = document.getElementById('lbTopModelName');
    const topScore = document.getElementById('lbTopModelScore');
    if (topName) topName.innerHTML = `<i data-lucide="crown" class="w-4 h-4 text-amber-400"></i> ${escapeHtml(leader.model)}`;
    if (topScore) topScore.innerText = `${leader.average.toFixed(2)}% Méd.`;

    const customModel = models.find(m => m.is_custom);
    const customName = document.getElementById('lbCustomModelName');
    const customScore = document.getElementById('lbCustomModelScore');
    if (customName && customModel) {
      customName.innerHTML = `<i data-lucide="zap" class="w-4 h-4 text-indigo-400"></i> ${escapeHtml(customModel.model)}`;
      if (customScore) customScore.innerText = `${customModel.average.toFixed(2)}% (${customModel.rank}º Lugar)`;
    }

    const totalCount = document.getElementById('lbTotalModelsCount');
    if (totalCount) totalCount.innerText = `${models.length} Modelos`;

    if (window.lucide) lucide.createIcons();
  }
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
  if (!canvas || !models || models.length === 0) return;

  const top1 = models.find(m => m.rank === 1) || models[0];
  const top3 = models.find(m => m.rank === 3) || models[2] || models[0];
  const mimo = models.find(m => m.is_custom) || models[1] || models[0];

  const labels = ['ENEM', 'BlueX', 'OAB Exams', 'NLI / STS', 'Moderação'];

  const getScores = (m) => [
    m.enem ?? m.average ?? 80,
    m.bluex ?? m.average ?? 80,
    m.oab ?? m.average ?? 80,
    ((m.assin2_rte ?? m.average ?? 80) + (m.faquad_nli ?? m.average ?? 80)) / 2,
    ((m.hatebr ?? m.average ?? 80) + (m.pt_hate_speech ?? m.average ?? 80)) / 2
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
          label: `${top1.model.substring(0, 18)} (Líder)`,
          data: getScores(top1),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: `${top3.model.substring(0, 18)} (3º)`,
          data: getScores(top3),
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: `${mimo.model.substring(0, 18)} (Avaliado)`,
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
          min: 50,
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
      model = saveManualModel(customInput.value.trim()) || customInput.value.trim();
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

  const baseUrl = document.getElementById('configBaseUrl')?.value.trim() || null;
  const apiKey = document.getElementById('configApiKey')?.value.trim() || null;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        tasks: tasks,
        limit: limit,
        num_fewshot: fewshot,
        is_simulation: isSimulation,
        base_url: baseUrl,
        api_key: apiKey
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

      es.onmessage = async (event) => {
        try {
          const status = JSON.parse(event.data);
          updateRunnerUI(status);

          if (!status.is_running && (status.progress_pct === 100 || status.progress_pct === 0)) {
            es.close();
            state.eventSource = null;
            await loadRunsList(status.run_id);
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
      await loadRunsList(status.run_id);
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
async function loadRunsList(targetRunId) {
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

    // Se um runId específico foi fornecido, seleciona-o com prioridade
    if (targetRunId && state.runs.some(r => r.id === targetRunId)) {
      selector.value = targetRunId;
      await selectRun(targetRunId);
    } else if (!state.activeRunId || !state.runs.some(r => r.id === state.activeRunId)) {
      selector.value = state.runs[0].id;
      await selectRun(state.runs[0].id);
    } else {
      // Mantém o item ativo selecionado no dropdown
      selector.value = state.activeRunId;
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

function normalizeChoice(c, index) {
  if (typeof c === 'string') {
    const m = c.match(/^([A-Za-z0-9])[\)\.\:\-]\s*(.*)$/);
    if (m) {
      return { label: m[1].toUpperCase(), text: m[2].trim() };
    }
    return { label: String.fromCharCode(65 + index), text: c.trim() };
  }
  if (c && typeof c === 'object') {
    return {
      label: (c.label || String.fromCharCode(65 + index)).toString().trim().toUpperCase(),
      text: (c.text || '').toString().trim()
    };
  }
  return { label: String.fromCharCode(65 + index), text: String(c || '') };
}

function renderRunData(data) {
  if (!data) return;
  const questions = data.questions || [];
  const diagnostics = data.diagnostics || {};
  const summary = diagnostics.summary || {
    total: questions.length,
    correct: questions.filter(q => q.is_correct).length,
    wrong: questions.filter(q => !q.is_correct).length,
    accuracy: questions.length > 0 ? (questions.filter(q => q.is_correct).length / questions.length) * 100 : 0
  };

  // 1. Atualizar KPIs
  const kTotal = document.getElementById('kpiTotal');
  const kCorr = document.getElementById('kpiCorrect');
  const kWrong = document.getElementById('kpiWrong');
  const kAcc = document.getElementById('kpiAccuracy');
  if (kTotal) kTotal.innerText = summary.total;
  if (kCorr) kCorr.innerText = summary.correct;
  if (kWrong) kWrong.innerText = summary.wrong;
  if (kAcc) kAcc.innerText = `${summary.accuracy.toFixed(1)}%`;

  // Badges nas abas
  const badgeQ = document.getElementById('tabBadgeQuestions');
  if (badgeQ) badgeQ.innerText = summary.total;
  const badgeS = document.getElementById('tabBadgeSuggestions');
  if (badgeS) badgeS.innerText = (diagnostics.suggestions || []).length;

  // 2. Preencher opções do dropdown de categoria
  try {
    populateCategoryFilter(questions);
  } catch (e) {
    console.error('Erro em populateCategoryFilter:', e);
  }

  // 3. Renderizar Lista de Questões
  try {
    applyQuestionFilters();
  } catch (e) {
    console.error('Erro em applyQuestionFilters:', e);
  }

  // 4. Renderizar Categorias & Gráfico
  try {
    let cats = diagnostics.categories || [];
    if ((!cats || cats.length === 0) && questions.length > 0) {
      const catMap = {};
      questions.forEach(q => {
        const cat = q.category || 'Geral';
        if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, correct: 0, wrong: 0, accuracy: 0 };
        catMap[cat].total++;
        if (q.is_correct) catMap[cat].correct++;
        else catMap[cat].wrong++;
      });
      cats = Object.values(catMap).map(c => {
        c.accuracy = c.total > 0 ? (c.correct / c.total) * 100 : 0;
        return c;
      });
    }
    renderCategoriesView(cats);
  } catch (e) {
    console.error('Erro em renderCategoriesView:', e);
  }

  // 5. Renderizar Sugestões
  try {
    renderSuggestionsView(diagnostics.suggestions || []);
  } catch (e) {
    console.error('Erro em renderSuggestionsView:', e);
  }
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

  // 1. Atualizar Estilos dos Botões de Filtro
  const btnAll = document.getElementById('qFilterAll');
  const btnWrong = document.getElementById('qFilterWrong');
  const btnCorrect = document.getElementById('qFilterCorrect');
  const btnNegation = document.getElementById('qFilterNegation');

  if (btnAll) {
    btnAll.className = (status === 'all')
      ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md transition flex items-center gap-1.5'
      : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800 transition flex items-center gap-1.5';
  }

  if (btnWrong) {
    btnWrong.className = (status === 'wrong')
      ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-500 transition flex items-center gap-1.5'
      : 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/40 hover:border-rose-500 transition flex items-center gap-1.5 shadow-sm';
  }

  if (btnCorrect) {
    btnCorrect.className = (status === 'correct')
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-500 transition flex items-center gap-1.5'
      : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 transition flex items-center gap-1.5';
  }

  if (btnNegation) {
    btnNegation.className = (status === 'negation')
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white shadow-lg shadow-amber-600/30 border border-amber-500 transition flex items-center gap-1.5'
      : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800 hover:border-amber-500/40 transition flex items-center gap-1.5';
  }

  // 2. Destacar visualmente o KPI Card correspondente
  const kpiTotal = document.getElementById('kpiCardTotal');
  const kpiWrong = document.getElementById('kpiCardWrong');
  const kpiCorrect = document.getElementById('kpiCardCorrect');

  if (kpiTotal) {
    if (status === 'all') kpiTotal.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-950/40');
    else kpiTotal.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-950/40');
  }
  if (kpiWrong) {
    if (status === 'wrong') kpiWrong.classList.add('ring-2', 'ring-rose-500', 'bg-rose-950/50');
    else kpiWrong.classList.remove('ring-2', 'ring-rose-500', 'bg-rose-950/50');
  }
  if (kpiCorrect) {
    if (status === 'correct') kpiCorrect.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-950/50');
    else kpiCorrect.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-950/50');
  }

  // 3. Sincronizar Dropdown de Status
  const statusSelect = document.getElementById('questionStatusSelect');
  if (statusSelect && statusSelect.value !== status) {
    statusSelect.value = status;
  }

  applyQuestionFilters();
}

function applyQuestionFilters() {
  if (!state.activeRunData) return;
  const allQuestions = state.activeRunData.questions || [];

  // Contadores nos botões de filtro
  const totalCount = allQuestions.length;
  const correctCount = allQuestions.filter(q => (q.is_correct === true || q.is_correct === 1 || q.is_correct === 'true')).length;
  const wrongCount = totalCount - correctCount;

  const cAll = document.getElementById('countFilterAll');
  const cCorr = document.getElementById('countFilterCorrect');
  const cWrong = document.getElementById('countFilterWrong');
  if (cAll) cAll.innerText = totalCount;
  if (cCorr) cCorr.innerText = correctCount;
  if (cWrong) cWrong.innerText = wrongCount;

  const categoryFilter = document.getElementById('questionCategoryFilter') ? document.getElementById('questionCategoryFilter').value : 'all';
  const searchTerm = (document.getElementById('questionSearch') ? document.getElementById('questionSearch').value : '').toLowerCase().trim();

  const filtered = allQuestions.filter(q => {
    const isCorr = (q.is_correct === true || q.is_correct === 1 || q.is_correct === 'true');

    // Filtro por status
    if (state.questionFilter === 'correct' && !isCorr) return false;
    if (state.questionFilter === 'wrong' && isCorr) return false;
    if (state.questionFilter === 'negation' && !q.has_negation) return false;

    // Filtro por categoria
    if (categoryFilter !== 'all' && q.category !== categoryFilter) return false;

    // Filtro de busca textual
    if (searchTerm) {
      const matchText = (q.question || '').toLowerCase().includes(searchTerm);
      const matchChoices = (q.choices || []).some((c, cIdx) => {
        const norm = normalizeChoice(c, cIdx);
        return norm.text.toLowerCase().includes(searchTerm) || norm.label.toLowerCase().includes(searchTerm);
      });
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
    if (state.questionFilter === 'wrong') {
      container.innerHTML = `
        <div class="glass-panel p-8 rounded-2xl text-center text-gray-300 border border-emerald-500/30 bg-emerald-950/10">
          <i data-lucide="award" class="w-10 h-10 mx-auto mb-2 text-emerald-400"></i>
          <h4 class="font-bold text-white text-base mb-1">Nenhum Erro Encontrado!</h4>
          <p class="text-xs text-emerald-300/80 mb-3">O modelo acertou 100% das questões analisadas sob os filtros atuais.</p>
          <button onclick="setQuestionFilter('all')" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition">
            Ver Todas as Questões (${(state.activeRunData.questions || []).length})
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="glass-panel p-8 rounded-2xl text-center text-gray-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
          <p class="text-sm">Nenhuma questão encontrada para os filtros selecionados.</p>
        </div>
      `;
    }
    if (window.lucide) lucide.createIcons();
    return;
  }

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    const isCorrect = Boolean(q.is_correct);
    card.className = `glass-panel p-5 rounded-2xl border ${isCorrect ? 'border-emerald-500/20' : 'border-rose-500/20'} space-y-4 hover:border-gray-700 transition`;

    const modelAnswer = (q.model_answer || q.model_choice || '').toString().trim().toUpperCase();
    const goldAnswer = (q.gold_answer || q.gold || '').toString().trim().toUpperCase();
    const qIndex = (typeof q.index === 'number') ? q.index + 1 : idx + 1;

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
    const choicesHtml = (q.choices || []).map((c, cIdx) => {
      const norm = normalizeChoice(c, cIdx);
      const isModelChoice = (norm.label === modelAnswer);
      const isGoldChoice = (norm.label === goldAnswer);

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
            ${norm.label}
          </span>
          <span class="flex-1 leading-relaxed">${escapeHtml(norm.text)}</span>
          ${tagHtml}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <div class="flex items-center space-x-2 flex-wrap gap-y-1">
          <span class="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            #${qIndex} (${q.id || 'q' + qIndex})
          </span>
          <span class="text-xs text-gray-300 font-medium bg-gray-800 px-2 py-0.5 rounded">
            ${q.task || 'Tarefa'}
          </span>
          <span class="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            ${q.category || 'Geral'}
          </span>
          ${negationPill}
        </div>
        <div>${statusPill}</div>
      </div>

      <!-- Enunciado -->
      <div class="text-sm text-gray-200 leading-relaxed font-sans whitespace-pre-line">
        ${escapeHtml(q.question || '')}
      </div>

      <!-- Alternativas -->
      <div class="space-y-2 pt-1">
        ${choicesHtml}
      </div>

      <!-- Rodapé do Card com Resumo -->
      <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800/60">
        <div>
          <span>Escolha do Modelo: </span>
          <strong class="${isCorrect ? 'text-emerald-400' : 'text-rose-400'}">${modelAnswer || 'N/A'}</strong>
          <span class="mx-2">•</span>
          <span>Gabarito: </span>
          <strong class="text-emerald-400">${goldAnswer || 'N/A'}</strong>
        </div>
        <span class="text-[11px] text-gray-500">${q.word_count || (q.question ? q.question.split(' ').length : 0)} palavras</span>
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
        <td class="py-2 px-3 font-sans text-gray-200">${escapeHtml(c.category)}</td>
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
    state.charts.categories = null;
  }

  if (categories.length === 0) return;

  const ctx = canvas.getContext('2d');
  const labels = categories.map(c => c.category);
  const data = categories.map(c => c.accuracy);

  try {
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
  } catch (chartErr) {
    console.warn('Erro ao criar categoriesBarChart:', chartErr);
  }
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
