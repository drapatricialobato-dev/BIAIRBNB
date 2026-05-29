/**
 * =============================================
 * DASHBOARD - CONTROLE APARTAMENTO
 * script.js — Dados, gráficos e filtros cruzados
 * =============================================
 */

// ------------------------------------------------
// 1. DADOS DA PLANILHA BI
// ------------------------------------------------

const MONTH_ORDER = [
  'JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
  'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'
];

const MONTH_ABBR = {
  'JANEIRO':'jan','FEVEREIRO':'fev','MARÇO':'mar','ABRIL':'abr',
  'MAIO':'mai','JUNHO':'jun','JULHO':'jul','AGOSTO':'ago',
  'SETEMBRO':'set','OUTUBRO':'out','NOVEMBRO':'nov','DEZEMBRO':'dez'
};

const RAW_DATA = {
  2023: {
    'SETEMBRO': -733.85, 'OUTUBRO': -1478.85,
    'NOVEMBRO': -226.96, 'DEZEMBRO': 1237.48
  },
  2024: {
    'JANEIRO': 1218.91, 'FEVEREIRO': 2688.08, 'MARÇO': 2558.60,
    'ABRIL': 2292.44,   'MAIO': 4707.64,       'JUNHO': 2776.36,
    'JULHO': 3695.04,   'AGOSTO': 4095.74,     'SETEMBRO': 4107.00,
    'OUTUBRO': 797.46,  'NOVEMBRO': 3676.23,   'DEZEMBRO': 661.83
  },
  2025: {
    'JANEIRO': 1539.97,  'FEVEREIRO': 3320.77, 'MARÇO': 1584.67,
    'ABRIL': -144.89,    'MAIO': 4485.29,       'JUNHO': 1635.45,
    'JULHO': 1578.75,    'AGOSTO': 1471.25,     'SETEMBRO': 1696.97,
    'OUTUBRO': 708.90,   'NOVEMBRO': 2751.75,   'DEZEMBRO': -1415.58
  },
  2026: {
    'JANEIRO': 3359.82, 'FEVEREIRO': 3859.36, 'MARÇO': 4503.88,
    'ABRIL': 3703.32,   'MAIO': 3746.79,       'JUNHO': 2890.61
  }
};

const GLOBAL_KPI = {
  balancoTotal: -114764.63,
  recebimentos: 117834.00,
  gastos: 44306.13,
  lucro: 73350.23
};

// ------------------------------------------------
// 2. PALETA DE CORES
// ------------------------------------------------

const COLORS = {
  barPos:      '#60a5fa',   // azul — lucro
  barPosHover: '#93c5fd',
  barNeg:      '#f87171',   // vermelho — prejuízo
  barNegHover: '#fca5a5',
  barDim:      '#2a3547',   // desfocada

  // Uma cor por ano para o gráfico grande
  year: {
    2023: { base: '#64748b', hover: '#94a3b8' },
    2024: { base: '#60a5fa', hover: '#93c5fd' },
    2025: { base: '#a78bfa', hover: '#c4b5fd' },
    2026: { base: '#34d399', hover: '#6ee7b7' }
  },

  // Labels nas barras
  labelPos: '#93c5fd',
  labelNeg: '#fca5a5',
  labelDim: '#4a5568'
};

// ------------------------------------------------
// 3. ESTADO DOS FILTROS
// ------------------------------------------------

const filters = { year: null, month: null };

// ------------------------------------------------
// 4. UTILITÁRIOS
// ------------------------------------------------

function formatBRL(value) {
  const abs = Math.abs(value);
  const str = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? '-' : '') + 'R$' + str;
}

function animateValue(el, start, end, duration = 700) {
  const t0 = performance.now();
  function tick(t) {
    const p    = Math.min((t - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = formatBRL(start + (end - start) * ease);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getFilteredData() {
  let years = Object.keys(RAW_DATA).map(Number);
  if (filters.year) years = years.filter(y => y === filters.year);
  const result = {};
  years.forEach(y => {
    result[y] = {};
    Object.entries(RAW_DATA[y]).forEach(([m, v]) => {
      if (!filters.month || m === filters.month) result[y][m] = v;
    });
  });
  return result;
}

function sumFiltered(data) {
  return Object.values(data).flatMap(m => Object.values(m)).reduce((a, b) => a + b, 0);
}

// ------------------------------------------------
// 5. BADGES DE FILTRO
// ------------------------------------------------

function updateFilterBadges() {
  const badge = document.getElementById('filterBadge');
  if (!badge) return;
  const parts = [];
  if (filters.year)  parts.push({ label: `Ano: ${filters.year}`,  type: 'year' });
  if (filters.month) parts.push({ label: `Mês: ${filters.month.charAt(0) + filters.month.slice(1).toLowerCase()}`, type: 'month' });

  if (!parts.length) { badge.innerHTML = ''; badge.style.display = 'none'; return; }
  badge.style.display = 'flex';
  badge.innerHTML = parts.map(p =>
    `<span class="badge">${p.label} <button onclick="clearFilter('${p.type}')">×</button></span>`
  ).join('');
}

function clearFilter(type) {
  filters[type] = null;
  if (type === 'year') document.getElementById('filterAno').value = 'Todos';
  refreshAll();
}

// ------------------------------------------------
// 6. INSTÂNCIAS DOS GRÁFICOS
// ------------------------------------------------

let chartLucroMes   = null;
let chartLucroAno   = null;
let chartLucroGeral = null;

// ------------------------------------------------
// 7. PLUGIN DE LABELS NAS BARRAS
// ------------------------------------------------

const labelsPlugin = {
  id: 'barLabels',
  afterDatasetsDraw(chart, _args, opts = {}) {
    const { ctx, data } = chart;
    if (data.datasets.length > (opts.maxDatasets ?? 99)) return;

    // Fonte maior: 11px mobile, 12px desktop
    const mobile   = window.innerWidth < 600;
    const fontSize = opts.fontSize ?? (mobile ? 11 : 12);

    data.datasets.forEach((ds, i) => {
      chart.getDatasetMeta(i).data.forEach((bar, j) => {
        const v = ds.data[j];
        if (v == null) return;

        const isDimmed = bar.options?.backgroundColor === COLORS.barDim;
        const isNeg    = v < 0;

        ctx.save();
        ctx.font      = `600 ${fontSize}px "IBM Plex Mono"`;
        ctx.fillStyle = isDimmed ? COLORS.labelDim : isNeg ? COLORS.labelNeg : COLORS.labelPos;
        ctx.textAlign    = 'center';
        ctx.textBaseline = isNeg ? 'top' : 'bottom';
        ctx.fillText(formatBRL(v), bar.x, isNeg ? bar.y + bar.height + 4 : bar.y - 4);
        ctx.restore();
      });
    });
  }
};
Chart.register(labelsPlugin);

// ------------------------------------------------
// 8. TOOLTIP PADRÃO
// ------------------------------------------------

function makeTooltip(labelFn) {
  return {
    backgroundColor: '#0d1117',
    borderColor: '#3d4f66',
    borderWidth: 1,
    titleColor: '#8896a8',
    bodyColor: '#e8edf4',
    titleFont: { family: 'IBM Plex Mono', size: 11 },
    bodyFont:  { family: 'IBM Plex Mono', size: 13, weight: '600' },
    padding: 10,
    callbacks: { label: labelFn }
  };
}

// ------------------------------------------------
// 9. ESCALA X PADRÃO
// ------------------------------------------------

function makeScaleX(tickSize = 11) {
  return {
    grid:  { color: 'rgba(255,255,255,0.03)' },
    ticks: { color: '#4a5568', font: { family: 'IBM Plex Sans', size: tickSize }, maxRotation: 0 },
    border: { color: '#2d3748' }
  };
}

// ------------------------------------------------
// 10. CORES DAS BARRAS (positivo/negativo/dimmed)
// ------------------------------------------------

function barColors(values, activeFilter) {
  return values.map((v, i) => {
    if (activeFilter !== null && i !== activeFilter) return COLORS.barDim;
    return v >= 0 ? COLORS.barPos : COLORS.barNeg;
  });
}

function barColorsHover(values) {
  return values.map(v => v >= 0 ? COLORS.barPosHover : COLORS.barNegHover);
}

// ------------------------------------------------
// 11. GRÁFICO: LUCRO POR MÊS
// ------------------------------------------------

function renderLucroMes() {
  const yearToShow  = filters.year || 2026;
  const raw         = RAW_DATA[yearToShow] || {};
  const allMonths   = MONTH_ORDER.filter(m => raw[m] !== undefined);
  const values      = allMonths.map(m => raw[m]);
  const labels      = allMonths.map(m => MONTH_ABBR[m]);
  const activeIdx   = filters.month ? allMonths.indexOf(filters.month) : null;

  const canvas = document.getElementById('chartLucroMes');
  if (chartLucroMes) chartLucroMes.destroy();

  chartLucroMes = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:                values,
        backgroundColor:     barColors(values, activeIdx),
        hoverBackgroundColor:barColorsHover(values),
        borderRadius:        4,
        borderSkipped:       false,
        barPercentage:       0.7,
        categoryPercentage:  0.75
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      onClick(e, elements) {
        if (!elements.length) { if (filters.month) { filters.month = null; refreshAll(); } return; }
        const m = allMonths[elements[0].index];
        filters.month = filters.month === m ? null : m;
        refreshAll();
      },
      plugins: {
        legend: { display: false },
        barLabels: { maxDatasets: 1 },
        tooltip: makeTooltip(ctx => ' ' + formatBRL(ctx.parsed.y))
      },
      scales: { x: makeScaleX(10), y: { display: false } },
      layout: { padding: { top: 34 } }
    }
  });

  // Atualiza título
  const el = document.getElementById('titleLucroMes');
  if (el) el.textContent = `Lucro por Mês em ${yearToShow}`;
}

// ------------------------------------------------
// 12. GRÁFICO: LUCRO POR ANO
// ------------------------------------------------

function renderLucroAno() {
  const years  = Object.keys(RAW_DATA).map(Number).sort();
  const values = years.map(y => {
    if (filters.month) return RAW_DATA[y][filters.month] ?? null;
    return Object.values(RAW_DATA[y]).reduce((a, b) => a + b, 0);
  });
  const activeIdx = filters.year ? years.indexOf(filters.year) : null;

  const canvas = document.getElementById('chartLucroAno');
  if (chartLucroAno) chartLucroAno.destroy();

  chartLucroAno = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [{
        data:                values,
        backgroundColor:     barColors(values, activeIdx),
        hoverBackgroundColor:barColorsHover(values),
        borderRadius:        4,
        borderSkipped:       false,
        barPercentage:       0.65,
        categoryPercentage:  0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      onClick(e, elements) {
        if (!elements.length) { if (filters.year) { filters.year = null; document.getElementById('filterAno').value = 'Todos'; refreshAll(); } return; }
        const y = years[elements[0].index];
        filters.year = filters.year === y ? null : y;
        document.getElementById('filterAno').value = filters.year || 'Todos';
        refreshAll();
      },
      plugins: {
        legend: { display: false },
        barLabels: { maxDatasets: 1 },
        tooltip: makeTooltip(ctx => ' ' + formatBRL(ctx.parsed.y))
      },
      scales: { x: makeScaleX(11), y: { display: false } },
      layout: { padding: { top: 38 } }
    }
  });
}

// ------------------------------------------------
// 13. GRÁFICO GRANDE: TODOS OS ANOS × MESES
// ------------------------------------------------

function renderLucroGeral() {
  const allYears    = Object.keys(RAW_DATA).map(Number).sort();
  const yearsToShow = filters.year ? [filters.year] : allYears;
  const usedMonths  = filters.month
    ? [filters.month]
    : MONTH_ORDER.filter(m => yearsToShow.some(y => RAW_DATA[y]?.[m] !== undefined));

  const datasets = yearsToShow.map(y => {
    const palette = COLORS.year[y] || { base: '#60a5fa', hover: '#93c5fd' };
    const values  = usedMonths.map(m => RAW_DATA[y]?.[m] ?? null);

    // Cada barra: cor do ano se positivo, vermelho se negativo
    const bgColors = values.map((v, i) => {
      if (v === null) return 'transparent';
      if (filters.month && usedMonths[i] !== filters.month) return palette.base + '33';
      return v < 0 ? COLORS.barNeg : palette.base;
    });

    const hoverColors = values.map(v =>
      v === null ? 'transparent' : v < 0 ? COLORS.barNegHover : palette.hover
    );

    return {
      label: String(y),
      data:  values,
      backgroundColor:      bgColors,
      hoverBackgroundColor: hoverColors,
      borderRadius:         3,
      borderSkipped:        false,
      barPercentage:        0.85,
      categoryPercentage:   0.8
    };
  });

  const canvas = document.getElementById('chartLucroGeral');
  if (chartLucroGeral) chartLucroGeral.destroy();

  chartLucroGeral = new Chart(canvas, {
    type: 'bar',
    data: { labels: usedMonths.map(m => MONTH_ABBR[m]), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      onClick(e, elements) {
        if (!elements.length) return;
        const clickedMonth = usedMonths[elements[0].index];
        const clickedYear  = yearsToShow[elements[0].datasetIndex];
        if (filters.month === clickedMonth && filters.year === clickedYear) {
          filters.month = null; filters.year = null;
          document.getElementById('filterAno').value = 'Todos';
        } else {
          filters.month = clickedMonth;
          filters.year  = clickedYear;
          document.getElementById('filterAno').value = clickedYear;
        }
        refreshAll();
      },
      plugins: {
        legend: {
          display: yearsToShow.length > 1,
          position: 'top', align: 'end',
          labels: {
            color: '#8896a8',
            font: { family: 'IBM Plex Sans', size: 11 },
            boxWidth: 10, boxHeight: 10, padding: 14,
            usePointStyle: true, pointStyle: 'circle'
          }
        },
        barLabels: { maxDatasets: 2, fontSize: 10 },
        tooltip: {
          backgroundColor: '#0d1117', borderColor: '#3d4f66', borderWidth: 1,
          titleColor: '#8896a8', bodyColor: '#e8edf4',
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont:  { family: 'IBM Plex Mono', size: 12, weight: '600' },
          padding: 10,
          callbacks: {
            title: items => items[0].label.toUpperCase(),
            label: ctx  => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: makeScaleX(11),
        y: {
          display: true,
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#4a5568',
            font:  { family: 'IBM Plex Mono', size: 10 },
            callback: v => 'R$' + (v / 1000).toFixed(0) + 'k'
          },
          border: { display: false }
        }
      },
      layout: { padding: { top: 8 } }
    }
  });
}

// ------------------------------------------------
// 14. KPIs
// ------------------------------------------------

function updateKPIs() {
  const filtered  = getFilteredData();
  const totalLucro = sumFiltered(filtered);
  const noFilter   = !filters.year && !filters.month;
  const ratio      = GLOBAL_KPI.lucro !== 0 ? Math.abs(totalLucro / GLOBAL_KPI.lucro) : 1;

  setKPI('kpiBalanco',      GLOBAL_KPI.balancoTotal);
  setKPI('kpiRecebimentos', noFilter ? GLOBAL_KPI.recebimentos : GLOBAL_KPI.recebimentos * ratio);
  setKPI('kpiGastos',       noFilter ? GLOBAL_KPI.gastos       : GLOBAL_KPI.gastos * ratio);
  setKPI('kpiLucro',        totalLucro);
}

function setKPI(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = parseFloat(el.dataset.value || '0');
  el.dataset.value = value;
  animateValue(el, prev, value);
  el.classList.toggle('negative', value < 0);
  el.classList.toggle('positive', value >= 0);
}

// ------------------------------------------------
// 15. RESPONSIVO
// ------------------------------------------------

function applyChartHeights() {
  const w = window.innerWidth;
  const s = w < 600  ? { mes: 180, ano: 160, geral: 280 }
          : w < 900  ? { mes: 210, ano: 190, geral: 340 }
          :            { mes: 240, ano: 195, geral: 470 };
  const set = (id, h) => { const el = document.getElementById(id); if (el) el.style.height = h + 'px'; };
  set('chartLucroMes',   s.mes);
  set('chartLucroAno',   s.ano);
  set('chartLucroGeral', s.geral);
}

// ------------------------------------------------
// 16. REFRESH CENTRAL
// ------------------------------------------------

function refreshAll() {
  applyChartHeights();
  updateKPIs();
  renderLucroMes();
  renderLucroAno();
  renderLucroGeral();
  updateFilterBadges();
}

// ------------------------------------------------
// 17. INICIALIZAÇÃO
// ------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }, 500);

  // Popula anos no select
  const select = document.getElementById('filterAno');
  if (select) {
    Object.keys(RAW_DATA).sort().reverse().forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      select.appendChild(opt);
    });
    select.addEventListener('change', e => {
      filters.year = e.target.value === 'Todos' ? null : Number(e.target.value);
      refreshAll();
    });
  }

  refreshAll();

  // Resize ao girar celular
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 200);
  });

  // Data no header
  const el = document.getElementById('headerDate');
  if (el) el.textContent = '— ' + new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
});
