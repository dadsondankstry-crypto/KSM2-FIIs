const API_BASE = (window.CRONOS_CONFIG?.API_BASE || '').replace(/\/$/, '');
const APP_VERSION = '2026.05.27-cloudflare-pwa';

const state = {
  rows: [],
  filtered: [],
  favoritos: new Set(),
  sortOrder: [{ key: 'notaFinal', desc: true, label: 'Nota Final' }],
  favoritesOnly: false,
  hiddenColumns: new Set(JSON.parse(localStorage.getItem('cronosHiddenColumns') || '[]')),
  columnOrder: [],
};

const calcDefaults = {
  valor: '10000',
  meses: '12',
  modo: 'dy_variacao',
  variacaoProporcional: true,
};

const labels = {
  ticker: 'Fundo',
  nome: 'Nome',
  patrimonioLiquido: 'Patrimônio Líquido',
  cotacaoAtual: 'Cotação Atual',
  pvp: 'P/VP',
  dividendYield12m: 'Dividend Yield',
  dyMedio5Anos: 'DY Médio 5 anos',
  variacao12m: 'Variação 12m',
  variacao24m: 'Variação 24m',
  variacao5Anos: 'Variação 5 anos',
  ultimoDividendo: 'Último Dividendo',
  porcentagemUltDiv: '% Último Dividendo',
  dataCom: 'Data Com/Base',
  dataPagamento: 'Data Pagamento',
  tipo: 'Tipo de Fundo',
  segmento: 'Segmento',
  liquidez: 'Liquidez',
  notaFinal: 'Nota Final',
  simCotas: 'Cotas',
  simValorUsado: 'Valor Usado',
  simSobra: 'Sobra',
  simRendaMensal: 'Renda/mês',
  simDividendos: 'Dividendos Est.',
  simVariacaoValor: 'Valorização Est.',
  simTotalFinal: 'Total Final',
  simLucro: 'Lucro Est.',
  simRentabilidade: 'Rentab. Est.',
};

const defaultColumns = [
  'ticker','patrimonioLiquido','cotacaoAtual','pvp','dividendYield12m','dyMedio5Anos','variacao12m','variacao24m','variacao5Anos','ultimoDividendo',
  'porcentagemUltDiv','dataCom','dataPagamento','tipo','segmento','liquidez','notaFinal',
  'simCotas','simValorUsado','simSobra','simRendaMensal','simDividendos','simVariacaoValor','simTotalFinal','simLucro','simRentabilidade'
];
const columns = defaultColumns;
const simulationColumns = new Set(['simCotas','simValorUsado','simSobra','simRendaMensal','simDividendos','simVariacaoValor','simTotalFinal','simLucro','simRentabilidade']);
const mainColumns = new Set(['ticker','cotacaoAtual','pvp','dividendYield12m','variacao12m','ultimoDividendo','dataCom','tipo','segmento','liquidez','notaFinal','simCotas','simRendaMensal','simDividendos','simLucro','simRentabilidade']);

function normalizeColumnOrder(order) {
  const valid = new Set(defaultColumns);
  const list = Array.isArray(order) ? order : [];
  const ordered = list.filter(col => valid.has(col));
  const missing = defaultColumns.filter(col => !ordered.includes(col));
  return [...ordered, ...missing];
}

function readColumnOrder() {
  try { return JSON.parse(localStorage.getItem('cronosColumnOrder') || '[]'); } catch (e) { return []; }
}

state.columnOrder = normalizeColumnOrder(readColumnOrder());

const moneyColumns = new Set([
  'cotacaoAtual','ultimoDividendo','simValorUsado','simSobra','simRendaMensal','simDividendos','simVariacaoValor','simTotalFinal','simLucro'
]);
const pctColumns = new Set(['dividendYield12m','dyMedio5Anos','variacao12m','variacao24m','variacao5Anos','porcentagemUltDiv','simRentabilidade']);

const $ = (id) => document.getElementById(id);

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseInputNumber(value) {
  if (value === null || value === undefined) return 0;
  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s+/g, '');
  const negative = /^-/.test(text) || /\(.*\)/.test(text);
  text = text.replace(/[()]/g, '').replace(/^-/, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  const n = Number(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
}

function fmtMoney(v) {
  const n = num(v);
  if (n === null) return '-';
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
}

function fmtBigMoney(v) {
  const n = num(v);
  if (n === null) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `R$ ${(n/1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits:2 })} bi`;
  if (abs >= 1_000_000) return `R$ ${(n/1_000_000).toLocaleString('pt-BR', { maximumFractionDigits:2 })} mi`;
  return fmtMoney(n);
}

function fmtPct(v) {
  const n = num(v);
  if (n === null) return '-';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })}%`;
}

function fmtNum(v, digits = 2) {
  const n = num(v);
  if (n === null) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtInt(v) {
  const n = num(v);
  if (n === null) return '-';
  return Math.floor(n).toLocaleString('pt-BR');
}

function fmtDate(value) {
  if (!value) return '-';
  const txt = String(value).slice(0, 10);
  const parts = txt.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

function setStatus(text) {
  $('statusText').textContent = text;
}

function saveColumnPrefs() {
  state.columnOrder = normalizeColumnOrder(state.columnOrder);
  localStorage.setItem('cronosColumnOrder', JSON.stringify(state.columnOrder));
  localStorage.setItem('cronosHiddenColumns', JSON.stringify([...state.hiddenColumns]));
}

function getVisibleColumns() {
  const visible = state.columnOrder.filter(col => !state.hiddenColumns.has(col));
  return visible.length ? visible : ['ticker'];
}

function moveColumn(col, direction) {
  const idx = state.columnOrder.indexOf(col);
  const next = idx + direction;
  if (idx < 0 || next < 0 || next >= state.columnOrder.length) return;
  const order = [...state.columnOrder];
  [order[idx], order[next]] = [order[next], order[idx]];
  state.columnOrder = order;
  saveColumnPrefs();
  renderColumnManager();
  renderTable();
}

function setColumnVisibility(col, visible) {
  if (visible) state.hiddenColumns.delete(col);
  else state.hiddenColumns.add(col);
  saveColumnPrefs();
  renderColumnManager();
  renderTable();
}

function setTableWidth(visibleCols) {
  const table = $('fiisTable');
  if (!table) return;
  const extraTicker = visibleCols.includes('ticker') ? 130 : 0;
  const minWidth = Math.max(920, 92 + (visibleCols.length * 126) + extraTicker);
  table.style.minWidth = `${minWidth}px`;
  table.style.width = `max(100%, ${minWidth}px)`;
}

function getCalcSettings() {
  const valor = parseInputNumber($('calcValor')?.value ?? calcDefaults.valor);
  const meses = Math.max(1, Math.floor(parseInputNumber($('calcMeses')?.value ?? calcDefaults.meses) || 1));
  const modo = $('calcModo')?.value || calcDefaults.modo;
  const variacaoProporcional = $('calcVarProporcional')?.checked ?? calcDefaults.variacaoProporcional;
  return { valor, meses, modo, variacaoProporcional };
}

function loadCalcSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('cronosCalcSettings') || '{}'); } catch (e) { saved = {}; }
  const config = { ...calcDefaults, ...saved };
  if ($('calcValor')) $('calcValor').value = config.valor;
  if ($('calcMeses')) $('calcMeses').value = config.meses;
  if ($('calcModo')) $('calcModo').value = config.modo;
  if ($('calcVarProporcional')) $('calcVarProporcional').checked = config.variacaoProporcional !== false;
}

function saveCalcSettings() {
  const s = getCalcSettings();
  localStorage.setItem('cronosCalcSettings', JSON.stringify({
    valor: String(s.valor || 0),
    meses: String(s.meses || 1),
    modo: s.modo,
    variacaoProporcional: s.variacaoProporcional,
  }));
}

function calculateRowSimulation(row) {
  const { valor, meses, modo, variacaoProporcional } = getCalcSettings();
  const cotacao = num(row.cotacaoAtual);
  if (!cotacao || cotacao <= 0 || !valor || valor <= 0) {
    return {
      simCotas: null,
      simValorUsado: null,
      simSobra: null,
      simRendaMensal: null,
      simDividendos: null,
      simVariacaoValor: null,
      simTotalFinal: null,
      simLucro: null,
      simRentabilidade: null,
    };
  }

  const cotas = Math.floor(valor / cotacao);
  const valorUsado = cotas * cotacao;
  const sobra = Math.max(0, valor - valorUsado);
  const ultimoDiv = num(row.ultimoDividendo) || 0;
  const dy = num(row.dividendYield12m) || 0;
  const variacao12 = num(row.variacao12m) || 0;

  const dividendosUltimo = cotas * ultimoDiv * meses;
  const dividendosDY = valorUsado * (dy / 100) * (meses / 12);
  const dividendos = modo.startsWith('ultimo') ? dividendosUltimo : dividendosDY;
  const fatorVariacao = variacaoProporcional ? (meses / 12) : 1;
  const variacaoValor = modo.includes('variacao') ? valorUsado * (variacao12 / 100) * fatorVariacao : 0;
  const rendaMensal = meses > 0 ? dividendos / meses : 0;
  const totalFinal = valorUsado + sobra + dividendos + variacaoValor;
  const lucro = totalFinal - valor;
  const rentabilidade = valor > 0 ? (lucro / valor) * 100 : 0;

  return {
    simCotas: cotas,
    simValorUsado: round2(valorUsado),
    simSobra: round2(sobra),
    simRendaMensal: round2(rendaMensal),
    simDividendos: round2(dividendos),
    simVariacaoValor: round2(variacaoValor),
    simTotalFinal: round2(totalFinal),
    simLucro: round2(lucro),
    simRentabilidade: round2(rentabilidade),
  };
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function refreshSimulation() {
  state.rows = state.rows.map(row => ({ ...row, ...calculateRowSimulation(row) }));
}

async function loadFavoritos() {
  try {
    const saved = JSON.parse(localStorage.getItem('cronosFavoritos') || '[]');
    state.favoritos = new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch (e) {
    state.favoritos = new Set();
  }
}

async function saveFavoritos() {
  localStorage.setItem('cronosFavoritos', JSON.stringify([...state.favoritos]));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: options.method === 'POST' ? 'no-store' : 'default', ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function loadLocalFallback() {
  const data = await fetchJson('dados_fiis.json?local=' + Date.now(), { cache: 'no-store' });
  return { ...data, fallbackLocal: true };
}

async function loadData(refresh = false, extras = '') {
  document.body.classList.add('loading');
  setStatus(refresh ? 'Atualizando dados pelo Worker...' : 'Carregando dados pelo Worker...');
  try {
    let data;
    if (!API_BASE) {
      data = await loadLocalFallback();
    } else {
      const url = refresh ? `${API_BASE}/api/refresh` : `${API_BASE}/api/fiis`;
      data = await fetchJson(url, {
        method: refresh ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: refresh ? JSON.stringify({ tickers: extras || '' }) : undefined,
      });
      if (!data.rows || !data.rows.length) data = await loadLocalFallback();
    }

    state.rows = (data.rows || []).map(r => ({ ...r, ticker: String(r.ticker || '').toUpperCase() })).filter(r => r.ticker);
    fillFilters();
    applyAll();

    const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-BR') : 'sem data';
    const invText = data.sources?.investidor10Ativo ? `Investidor10 ${data.sources?.investidor10Count || 0}` : 'Investidor10 indisponível';
    const yahooText = data.sources?.yahooAtivo ? `Yahoo ${data.sources?.yahooCount || 0}` : 'Yahoo indisponível';
    const localText = data.fallbackLocal ? ' • fallback local' : '';
    setStatus(`${state.rows.length} fundos carregados • atualizado em ${updated} • ${invText} • ${yahooText}${localText}`);
  } catch (e) {
    try {
      const data = await loadLocalFallback();
      state.rows = (data.rows || []).map(r => ({ ...r, ticker: String(r.ticker || '').toUpperCase() })).filter(r => r.ticker);
      fillFilters();
      applyAll();
      setStatus(`${state.rows.length} fundos carregados pelo fallback local • Worker falhou: ${e.message}`);
    } catch (localErr) {
      setStatus(`Erro ao carregar: ${e.message}`);
    }
  } finally {
    document.body.classList.remove('loading');
  }
}

function fillFilters() {
  const typeSel = $('typeFilter');
  const segSel = $('segmentFilter');
  const currentType = typeSel.value;
  const currentSeg = segSel.value;

  const types = [...new Set(state.rows.map(r => r.tipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const segs = [...new Set(state.rows.map(r => r.segmento).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  typeSel.innerHTML = '<option value="">Todos</option>' + types.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  segSel.innerHTML = '<option value="">Todos</option>' + segs.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  typeSel.value = types.includes(currentType) ? currentType : '';
  segSel.value = segs.includes(currentSeg) ? currentSeg : '';
}

function applyAll() {
  refreshSimulation();
  const q = $('searchInput').value.trim().toLowerCase();
  const type = $('typeFilter').value;
  const seg = $('segmentFilter').value;

  state.filtered = state.rows.filter(r => {
    const hay = `${r.ticker} ${r.nome || ''} ${r.tipo || ''} ${r.segmento || ''}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (type && r.tipo !== type) return false;
    if (seg && r.segmento !== seg) return false;
    if (state.favoritesOnly && !state.favoritos.has(r.ticker)) return false;
    return true;
  });

  sortRows();
  renderSortTrail();
  renderStats();
  renderTable();
  updateActiveButtons();
}

function compareValues(a, b, desc) {
  const na = num(a);
  const nb = num(b);
  let result;
  if (na !== null || nb !== null) {
    result = (na ?? -Infinity) - (nb ?? -Infinity);
  } else {
    result = String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity:'base' });
  }
  return desc ? -result : result;
}

function sortRows() {
  state.filtered.sort((a,b) => {
    for (const item of state.sortOrder) {
      const cmp = compareValues(a[item.key], b[item.key], item.desc);
      if (cmp !== 0) return cmp;
    }
    return String(a.ticker).localeCompare(String(b.ticker));
  });
}

function addSort(key, desc, label) {
  state.sortOrder = state.sortOrder.filter(x => x.key !== key);
  state.sortOrder.push({ key, desc, label: label || labels[key] || key });
  applyAll();
}

function setOnlySort(key, desc, label) {
  state.sortOrder = [{ key, desc, label: label || labels[key] || key }];
  applyAll();
}

function renderSortTrail() {
  const box = $('sortTrail');
  if (!state.sortOrder.length) {
    box.innerHTML = '<span class="muted">Ordem atual: sem ordem escolhida</span>';
    return;
  }
  box.innerHTML = state.sortOrder.map((item, idx) => `
    <span class="sort-chip">
      ${idx + 1}º ${escapeHtml(item.label)} ${item.desc ? '↓' : '↑'}
      <button data-remove-sort="${escapeHtml(item.key)}" title="Remover">×</button>
    </span>
  `).join('');
  box.querySelectorAll('[data-remove-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-remove-sort');
      state.sortOrder = state.sortOrder.filter(x => x.key !== key);
      if (!state.sortOrder.length) state.sortOrder = [{ key:'notaFinal', desc:true, label:'Nota Final' }];
      applyAll();
    });
  });
}

function renderStats() {
  $('statTotal').textContent = state.filtered.length;
  const withDy = state.filtered.filter(r => num(r.dividendYield12m) !== null);
  $('statDy').textContent = withDy.length;
  const bestDy = [...withDy].sort((a,b)=>compareValues(a.dividendYield12m,b.dividendYield12m,true))[0];
  const bestScore = [...state.filtered].filter(r=>num(r.notaFinal)!==null).sort((a,b)=>compareValues(a.notaFinal,b.notaFinal,true))[0];
  const bestProfit = [...state.filtered].filter(r=>num(r.simLucro)!==null).sort((a,b)=>compareValues(a.simLucro,b.simLucro,true))[0];
  const bestIncome = [...state.filtered].filter(r=>num(r.simRendaMensal)!==null).sort((a,b)=>compareValues(a.simRendaMensal,b.simRendaMensal,true))[0];
  $('statBestDy').textContent = bestDy ? `${bestDy.ticker} ${fmtPct(bestDy.dividendYield12m)}` : '-';
  $('statBestScore').textContent = bestScore ? `${bestScore.ticker} ${fmtNum(bestScore.notaFinal, 1)}` : '-';
  $('statBestProfit').textContent = bestProfit ? `${bestProfit.ticker} ${fmtMoney(bestProfit.simLucro)}` : '-';
  $('statBestIncome').textContent = bestIncome ? `${bestIncome.ticker} ${fmtMoney(bestIncome.simRendaMensal)}` : '-';
}

function renderTableHeader(visibleCols = getVisibleColumns()) {
  const thead = $('tableHead');
  if (!thead) return;
  setTableWidth(visibleCols);
  thead.innerHTML = `
    <tr>
      <th class="col-fav"></th>
      ${visibleCols.map(col => `<th data-col="${escapeHtml(col)}">${escapeHtml(labels[col] || col)} ↕</th>`).join('')}
    </tr>
  `;
  thead.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      const current = state.sortOrder.find(x => x.key === key);
      const desc = current ? !current.desc : true;
      setOnlySort(key, desc, labels[key]);
    });
  });
}

function renderCell(row, col) {
  const fav = state.favoritos.has(row.ticker);
  const warn = row.erro ? `<span class="source-warn">${escapeHtml(row.erro)}</span>` : '';
  const negativeClass = (value) => num(value) < 0 ? 'neg' : '';
  const cell = {
    ticker: `
      <div class="asset-cell">
        <div class="asset-icon">▥</div>
        <div class="asset-main"><strong>${escapeHtml(row.ticker)}</strong><span>${escapeHtml(row.nome || '')}</span>${warn}</div>
      </div>
    `,
    patrimonioLiquido: fmtBigMoney(row.patrimonioLiquido),
    cotacaoAtual: fmtMoney(row.cotacaoAtual),
    pvp: fmtNum(row.pvp, 2),
    dividendYield12m: `<span class="badge ${negativeClass(row.dividendYield12m)}">${fmtPct(row.dividendYield12m)}</span>`,
    dyMedio5Anos: fmtPct(row.dyMedio5Anos),
    variacao12m: `<span class="badge ${negativeClass(row.variacao12m)}">${fmtPct(row.variacao12m)}</span>`,
    variacao24m: `<span class="badge ${negativeClass(row.variacao24m)}">${fmtPct(row.variacao24m)}</span>`,
    variacao5Anos: `<span class="badge ${negativeClass(row.variacao5Anos)}">${fmtPct(row.variacao5Anos)}</span>`,
    ultimoDividendo: fmtMoney(row.ultimoDividendo),
    porcentagemUltDiv: fmtPct(row.porcentagemUltDiv),
    dataCom: fmtDate(row.dataCom),
    dataPagamento: fmtDate(row.dataPagamento),
    tipo: escapeHtml(row.tipo || '-'),
    segmento: escapeHtml(row.segmento || '-'),
    liquidez: fmtBigMoney(row.liquidez),
    notaFinal: `<strong>${fmtNum(row.notaFinal, 1)}</strong>`,
    simCotas: `<strong>${fmtInt(row.simCotas)}</strong>`,
    simValorUsado: fmtMoney(row.simValorUsado),
    simSobra: fmtMoney(row.simSobra),
    simRendaMensal: fmtMoney(row.simRendaMensal),
    simDividendos: `<span class="badge">${fmtMoney(row.simDividendos)}</span>`,
    simVariacaoValor: `<span class="badge ${negativeClass(row.simVariacaoValor)}">${fmtMoney(row.simVariacaoValor)}</span>`,
    simTotalFinal: `<strong>${fmtMoney(row.simTotalFinal)}</strong>`,
    simLucro: `<span class="badge ${negativeClass(row.simLucro)}">${fmtMoney(row.simLucro)}</span>`,
    simRentabilidade: `<span class="badge ${negativeClass(row.simLucro)}">${fmtPct(row.simRentabilidade)}</span>`,
  };
  return cell[col] ?? escapeHtml(row[col] ?? '-');
}

function renderTable() {
  const tbody = $('tableBody');
  const visibleCols = getVisibleColumns();
  renderTableHeader(visibleCols);

  if (!state.filtered.length) {
    tbody.innerHTML = `<tr><td colspan="${visibleCols.length + 1}" class="muted">Nenhum fundo encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.filtered.map(row => {
    const fav = state.favoritos.has(row.ticker);
    return `
      <tr>
        <td class="col-fav"><button class="fav-btn ${fav ? 'on' : ''}" data-fav="${escapeHtml(row.ticker)}">${fav ? '♥' : '♡'}</button></td>
        ${visibleCols.map(col => `<td data-cell="${escapeHtml(col)}">${renderCell(row, col)}</td>`).join('')}
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ticker = btn.getAttribute('data-fav');
      if (state.favoritos.has(ticker)) state.favoritos.delete(ticker);
      else state.favoritos.add(ticker);
      await saveFavoritos();
      applyAll();
    });
  });
}

function updateColumnCounter() {
  const visibleCount = state.columnOrder.filter(col => !state.hiddenColumns.has(col)).length;
  const total = state.columnOrder.length;
  const counter = $('columnCounter');
  if (counter) counter.textContent = `${visibleCount} de ${total} colunas visíveis`;
}

function syncColumnOrderFromDom() {
  const box = $('columnManager');
  if (!box) return;
  const order = [...box.querySelectorAll('[data-column-item]')].map(el => el.dataset.columnItem).filter(Boolean);
  state.columnOrder = normalizeColumnOrder(order);
  saveColumnPrefs();
}

function renderColumnManager() {
  const box = $('columnManager');
  if (!box) return;
  updateColumnCounter();

  box.innerHTML = state.columnOrder.map((col) => {
    const checked = state.hiddenColumns.has(col) ? '' : 'checked';
    return `
      <div class="column-item ${checked ? '' : 'off'}" draggable="true" data-column-item="${escapeHtml(col)}" title="Segure e arraste para mudar a ordem">
        <span class="drag-handle" aria-hidden="true">☰</span>
        <label title="Mostrar ou ocultar ${escapeHtml(labels[col] || col)}">
          <input type="checkbox" data-toggle-col="${escapeHtml(col)}" ${checked}>
          <span>${escapeHtml(labels[col] || col)}</span>
        </label>
      </div>
    `;
  }).join('');

  box.querySelectorAll('[data-toggle-col]').forEach(input => {
    input.addEventListener('change', () => {
      const col = input.dataset.toggleCol;
      if (input.checked) state.hiddenColumns.delete(col);
      else state.hiddenColumns.add(col);
      const item = input.closest('.column-item');
      if (item) item.classList.toggle('off', !input.checked);
      saveColumnPrefs();
      updateColumnCounter();
      renderTable();
    });
  });

  box.querySelectorAll('[data-column-item]').forEach(item => {
    item.addEventListener('dragstart', (event) => {
      state.dragColumn = item.dataset.columnItem;
      item.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', state.dragColumn);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      state.dragColumn = null;
      syncColumnOrderFromDom();
      renderTable();
    });
  });

  box.ondragover = handleColumnDragOver;
  box.ondrop = (event) => {
    event.preventDefault();
    syncColumnOrderFromDom();
    renderColumnManager();
    renderTable();
  };
}

function handleColumnDragOver(event) {
  event.preventDefault();
  const box = $('columnManager');
  const dragging = box?.querySelector('.column-item.dragging');
  const target = event.target.closest?.('.column-item');
  if (!box || !dragging || !target || target === dragging || !box.contains(target)) return;

  const rect = target.getBoundingClientRect();
  const sameRow = event.clientY >= rect.top && event.clientY <= rect.bottom;
  const insertBefore = sameRow
    ? event.clientX < rect.left + rect.width / 2
    : event.clientY < rect.top + rect.height / 2;

  if (insertBefore) box.insertBefore(dragging, target);
  else box.insertBefore(dragging, target.nextSibling);
}

function applyColumnVisibility() {
  renderColumnManager();
  renderTable();
}

function updateActiveButtons() {
  const activeKey = state.sortOrder[state.sortOrder.length - 1]?.key;
  document.querySelectorAll('.rank-btn[data-sort]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === activeKey);
  });
  $('btnFavoritesOnly').classList.toggle('active', state.favoritesOnly);
}

function setupColumnDialog() {
  renderColumnManager();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function csvLine(cols) {
  return cols.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(';');
}


function exportTableCsv() {
  if (!state.filtered.length) return;
  const visibleCols = getVisibleColumns();
  const headers = visibleCols.map(col => labels[col] || col);
  const lines = [csvLine(headers)];
  state.filtered.forEach(r => {
    lines.push(csvLine(visibleCols.map(col => {
      if (moneyColumns.has(col)) return fmtMoney(r[col]);
      if (col === 'patrimonioLiquido' || col === 'liquidez') return fmtBigMoney(r[col]);
      if (pctColumns.has(col)) return fmtPct(r[col]);
      if (col === 'dataCom' || col === 'dataPagamento') return fmtDate(r[col]);
      if (col === 'simCotas') return fmtInt(r[col]);
      if (col === 'notaFinal') return fmtNum(r[col], 1);
      return r[col] ?? '';
    })));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ranking_fiis_cronos.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 600);
}

function exportSimulationCsv() {
  if (!state.filtered.length) return;
  const headers = [
    'FII','Nome','Patrimônio Líquido','Cotação Atual','P/VP','Dividend Yield 12m','DY Médio 5 anos','Variação 12m','Variação 24m','Variação 5 anos','Último Dividendo','% Último Dividendo','Data Com/Base','Data Pagamento','Tipo de Fundo','Segmento','Liquidez','Nota Final','Cotas','Valor Usado','Sobra','Renda/mês','Dividendos Est.','Valorização Est.','Total Final','Lucro Est.','Rentabilidade Est.'
  ];
  const lines = [csvLine(headers)];
  state.filtered.forEach(r => {
    lines.push(csvLine([
      r.ticker, r.nome, fmtBigMoney(r.patrimonioLiquido), fmtMoney(r.cotacaoAtual), fmtNum(r.pvp,2), fmtPct(r.dividendYield12m), fmtPct(r.dyMedio5Anos), fmtPct(r.variacao12m), fmtPct(r.variacao24m), fmtPct(r.variacao5Anos), fmtMoney(r.ultimoDividendo), fmtPct(r.porcentagemUltDiv), fmtDate(r.dataCom), fmtDate(r.dataPagamento), r.tipo, r.segmento, fmtBigMoney(r.liquidez), fmtNum(r.notaFinal,1),
      fmtInt(r.simCotas), fmtMoney(r.simValorUsado), fmtMoney(r.simSobra), fmtMoney(r.simRendaMensal), fmtMoney(r.simDividendos), fmtMoney(r.simVariacaoValor), fmtMoney(r.simTotalFinal), fmtMoney(r.simLucro), fmtPct(r.simRentabilidade)
    ]));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'simulacao_fiis_cronos.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 600);
}

function bindEvents() {
  $('btnExportCsv')?.addEventListener('click', exportTableCsv);
  $('btnRefresh').addEventListener('click', () => loadData(true, $('extraTickers').value));
  $('btnUseExtras').addEventListener('click', () => loadData(true, $('extraTickers').value));
  $('btnClearSort').addEventListener('click', () => {
    state.sortOrder = [{ key:'notaFinal', desc:true, label:'Nota Final' }];
    applyAll();
  });
  $('searchInput').addEventListener('input', applyAll);
  $('typeFilter').addEventListener('change', applyAll);
  $('segmentFilter').addEventListener('change', applyAll);

  ['calcValor','calcMeses','calcModo','calcVarProporcional'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const evt = el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change';
    el.addEventListener(evt, () => {
      saveCalcSettings();
      applyAll();
    });
  });
  $('btnExportSimulation').addEventListener('click', exportSimulationCsv);

  document.querySelectorAll('.rank-btn[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => addSort(btn.dataset.sort, btn.dataset.desc === 'true', btn.textContent.trim()));
  });


  document.querySelector('[data-action="favoritos"]').addEventListener('click', () => {
    state.sortOrder = [{ key:'notaFinal', desc:true, label:'Nota Final' }];
    state.filtered.sort((a,b) => {
      const af = state.favoritos.has(a.ticker) ? 1 : 0;
      const bf = state.favoritos.has(b.ticker) ? 1 : 0;
      return bf - af || compareValues(a.notaFinal, b.notaFinal, true);
    });
    renderTable();
  });

  $('btnFavoritesOnly').addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    applyAll();
  });


  $('btnShowAllColumns')?.addEventListener('click', () => {
    state.hiddenColumns.clear();
    saveColumnPrefs();
    renderColumnManager();
    renderTable();
  });

  $('btnOnlyMainColumns')?.addEventListener('click', () => {
    state.hiddenColumns = new Set(columns.filter(col => !mainColumns.has(col)));
    saveColumnPrefs();
    renderColumnManager();
    renderTable();
  });

  $('btnHideSimulationColumns')?.addEventListener('click', () => {
    simulationColumns.forEach(col => state.hiddenColumns.add(col));
    saveColumnPrefs();
    renderColumnManager();
    renderTable();
  });

  $('btnResetColumns')?.addEventListener('click', () => {
    state.columnOrder = [...defaultColumns];
    state.hiddenColumns.clear();
    saveColumnPrefs();
    renderColumnManager();
    renderTable();
  });
  $('btnCustomize').addEventListener('click', () => {
    renderColumnManager();
    const dialog = $('columnsDialog');
    if (dialog?.showModal) dialog.showModal();
  });

  $('columnsDialog')?.addEventListener('click', (event) => {
    const dialog = $('columnsDialog');
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedBackdrop = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (clickedBackdrop) dialog.close();
  });
}

(async function init(){
  loadCalcSettings();
  renderColumnManager();
  bindEvents();
  await loadFavoritos();
  await loadData(false);
})();
