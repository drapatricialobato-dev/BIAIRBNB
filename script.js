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

// Inverso: abreviação → nome completo
const ABBR_TO_MONTH = Object.fromEntries(
  Object.entries(MONTH_ABBR).map(([k,v]) => [v, k])
);

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
// 2. ESTADO DOS FILTROS CRUZADOS
// ------------------------------------------------

const filters = {
  year: null,   // null = todos | 2023/2024/2025/2026
  month: null   // null = todos | 'JANEIRO' etc.
};

// ------------------------------------------------
// 3. UTILITÁRIOS
// ------------------------------------------------

function formatBRL(value) {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  return (value < 0 ? '-' : '') + 'R$' + formatted;
}

function animateValue(el, start, end, duration = 700) {
  const startTime = performance.now();
  function update(t) {
    const p = Math.min((t - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = formatBRL(start + (end - start) * ease);
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Retorna dados filtrados pelo estado atual
function getFilteredData() {
  let years = Object.keys(RAW_DATA).map(Number);
  if (filters.year) years = years.filter(y => y === filters.year);

  const result = {}; // { year: { month: value } }
  years.forEach(y => {
    result[y] = {};
    Object.entries(RAW_DATA[y]).forEach(([m, v]) => {
      if (!filters.month || m === filters.month) {
        result[y][m] = v;
      }
    });
  });
  return result;
}

// Soma total dos dados filtrados
function sumFiltered(data) {
  return Object.values(data)
    .flatMap(months => Object.values(months))
    .reduce((a, b) => a + b, 0);
}

// ------------------------------------------------
// 4. CHIPS DE FILTRO ATIVO (feedback visual)
// ------------------------------------------------

function updateFilterBadges() {
  const badge = document.getElementById('filterBadge');
  if (!badge) return;

  const parts = [];
  if (filters.year)  parts.push(`Ano: ${filters.year}`);
  if (filters.month) parts.push(`Mês: ${filters.month.charAt(0) + filters.month.slice(1).toLowerCase()}`);

  if (parts.length === 0) {
    badge.innerHTML = '';
    badge.style.display = 'none';
  } else {
    badge.style.display = 'flex';
    badge.innerHTML = parts.map(p =>
      `<span class="badge">${p} <button onclick="clearFilter('${p.startsWith('Ano') ? 'year' : 'month'}')">×</button></span>`
    ).join('');
  }
}

function clearFilter(type) {
  filters[type] = null;
  if (type === 'year') {
    document.getElementById('filterAno').value = 'Todos';
  }
  refreshAll();
}

// ------------------------------------------------
// 5. INSTÂNCIAS DOS GRÁFICOS
// ------------------------------------------------

let chartLucroMes   = null;
let chartLucroAno   = null;
let chartLucroGeral = null;

// ------------------------------------------------
// 6. PLUGIN DE LABELS NAS BARRAS
// ------------------------------------------------

const labelsPlugin = {
  id: 'barLabels',
  afterDatasetsDraw(chart, args, opts = {}) {
    const { ctx, data } = chart;
    const maxDatasets = opts.maxDatasets ?? 99;
    if (data.datasets.length > maxDatasets) return;

    const fontSize = opts.fontSize ?? 10;
    data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, j) => {
        const v = ds.data[j];
        if (v == null) return;
        ctx.save();
        ctx.font = `600 ${fontSize}px "IBM Plex Mono"`;
        ctx.fillStyle = v >= 0 ? '#ccc' : '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = v >= 0 ? 'bottom' : 'top';
        ctx.fillText(formatBRL(v), bar.x, v >= 0 ? bar.y - 4 : bar.y + bar.height + 4);
        ctx.restore();
      });
    });
  }
};
Chart.register(labelsPlugin);

// ------------------------------------------------
// 7. GRÁFICO: LUCRO POR MÊS
// ------------------------------------------------

function renderLucroMes() {
  const canvas = document.getElementById('chartLucroMes');

  // Qual ano mostrar: filtro ativo ou mais recente
  const yearToShow = filters.year || 2026;
  const raw = RAW_DATA[yearToShow] || {};

  const months = MONTH_ORDER.filter(m =>
    !filters.month || m === filters.month
      ? raw[m] !== undefined
      : false
  );
  // Se mês filtrado não tem dados no ano, mostra todos do ano
  const finalMonths = months.length ? months : MONTH_ORDER.filter(m => raw[m] !== undefined);
  const values = finalMonths.map(m => raw[m]);
  const labels = finalMonths.map(m => MONTH_ABBR[m]);

  // Cores: destaca mês filtrado
  const bgColors = finalMonths.map(m => {
    if (filters.month && m === filters.month) return '#ffffff';
    if (filters.month && m !== filters.month) return '#3a3a3a';
    return values[finalMonths.indexOf(m)] >= 0 ? '#e0e0e0' : '#666';
  });

  if (chartLucroMes) chartLucroMes.destroy();
  chartLucroMes = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        hoverBackgroundColor: finalMonths.map(() => '#ffffff'),
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.75
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      onClick(e, elements) {
        if (!elements.length) {
          // Clicou em área vazia: limpa filtro de mês
          if (filters.month) { filters.month = null; refreshAll(); }
          return;
        }
        const idx = elements[0].index;
        const clickedMonth = finalMonths[idx];
        // Toggle: clica no mesmo → limpa; diferente → filtra
        filters.month = filters.month === clickedMonth ? null : clickedMonth;
        refreshAll();
      },
      plugins: {
        legend: { display: false },
        barLabels: { fontSize: 10, maxDatasets: 2 },
        tooltip: tooltipConfig(ctx => ' ' + formatBRL(ctx.parsed.y))
      },
      scales: baseScales(10),
      layout: { padding: { top: 32 } },
      cursor: 'pointer'
    }
  });

  // Título
  const titleEl = document.getElementById('titleLucroMes');
  if (titleEl) titleEl.textContent = `Lucro por Mês em ${yearToShow}`;
}

// ------------------------------------------------
// 8. GRÁFICO: LUCRO POR ANO
// ------------------------------------------------

function renderLucroAno() {
  const canvas = document.getElementById('chartLucroAno');
  const years = Object.keys(RAW_DATA).map(Number).sort();

  const values = years.map(y => {
    const months = filters.month
      ? (RAW_DATA[y][filters.month] ?? null)
      : Object.values(RAW_DATA[y]).reduce((a, b) => a + b, 0);
    return months;
  });

  // Cores: destaca ano filtrado
  const bgColors = years.map(y => {
    if (filters.year && y === filters.year) return '#ffffff';
    if (filters.year && y !== filters.year) return '#3a3a3a';
    const v = values[years.indexOf(y)];
    return v >= 0 ? '#e0e0e0' : '#666';
  });

  if (chartLucroAno) chartLucroAno.destroy();
  chartLucroAno = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        hoverBackgroundColor: years.map(() => '#ffffff'),
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.65,
        categoryPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      onClick(e, elements) {
        if (!elements.length) {
          if (filters.year) { filters.year = null; document.getElementById('filterAno').value = 'Todos'; refreshAll(); }
          return;
        }
        const idx = elements[0].index;
        const clickedYear = years[idx];
        filters.year = filters.year === clickedYear ? null : clickedYear;
        document.getElementById('filterAno').value = filters.year || 'Todos';
        refreshAll();
      },
      plugins: {
        legend: { display: false },
        barLabels: { fontSize: 10, maxDatasets: 1 },
        tooltip: tooltipConfig(ctx => ' ' + formatBRL(ctx.parsed.y))
      },
      scales: baseScales(11),
      layout: { padding: { top: 36 } }
    }
  });
}

// ------------------------------------------------
// 9. GRÁFICO GRANDE: LUCRO GERAL (todos anos × meses)
// ------------------------------------------------

function renderLucroGeral() {
  const canvas = document.getElementById('chartLucroGeral');
  const allYears = Object.keys(RAW_DATA).map(Number).sort();

  // Anos visíveis
  const yearsToShow = filters.year ? [filters.year] : allYears;

  // Meses visíveis
  const usedMonths = filters.month
    ? [filters.month]
    : MONTH_ORDER.filter(m => yearsToShow.some(y => RAW_DATA[y]?.[m] !== undefined));

  const yearColors    = { 2023:'#505050', 2024:'#787878', 2025:'#a8a8a8', 2026:'#e0e0e0' };
  const yearColorsHov = { 2023:'#686868', 2024:'#909090', 2025:'#c0c0c0', 2026:'#ffffff' };

  const datasets = yearsToShow.map(y => ({
    label: String(y),
    data: usedMonths.map(m => RAW_DATA[y]?.[m] ?? null),
    backgroundColor: usedMonths.map(m => {
      const base = yearColors[y] || '#888';
      // Dimmer se há mês filtrado mas este não é o filtrado
      if (filters.month && m !== filters.month) return base + '55';
      return base;
    }),
    hoverBackgroundColor: yearColorsHov[y] || '#aaa',
    borderRadius: 2,
    borderSkipped: false,
    barPercentage: 0.85,
    categoryPercentage: 0.8
  }));

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
        const idx = elements[0].index;
        const clickedMonth = usedMonths[idx];
        const dsIdx = elements[0].datasetIndex;
        const clickedYear = yearsToShow[dsIdx];

        // Clique em barra: filtra mês E ano dessa barra
        const sameMonth = filters.month === clickedMonth;
        const sameYear  = filters.year  === clickedYear;

        if (sameMonth && sameYear) {
          // Toggle off
          filters.month = null;
          filters.year  = null;
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
            color: '#aaa',
            font: { family: 'IBM Plex Sans', size: 11 },
            boxWidth: 12, boxHeight: 12, padding: 16
          }
        },
        barLabels: { fontSize: 9, maxDatasets: 2 },
        tooltip: {
          backgroundColor: '#111', borderColor: '#444', borderWidth: 1,
          titleColor: '#aaa', bodyColor: '#fff',
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 12, weight: '600' },
          padding: 10,
          callbacks: {
            title: items => items[0].label.toUpperCase(),
            label: ctx => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { family: 'IBM Plex Sans', size: 11 }, maxRotation: 0 },
          border: { color: '#333' }
        },
        y: {
          display: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#666', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => 'R$'+(v/1000).toFixed(0)+'k' },
          border: { display: false }
        }
      },
      layout: { padding: { top: 8 } }
    }
  });
}

// ------------------------------------------------
// 10. ATUALIZAR KPIs
// ------------------------------------------------

function updateKPIs() {
  const filtered = getFilteredData();
  const totalLucro = sumFiltered(filtered);

  // Recebimentos e Gastos: escala proporcional ao filtro
  const allLucro = GLOBAL_KPI.lucro;
  const ratio = allLucro !== 0 ? totalLucro / allLucro : 1;

  const noFilter = !filters.year && !filters.month;

  setKPI('kpiBalanco',      GLOBAL_KPI.balancoTotal);
  setKPI('kpiRecebimentos', noFilter ? GLOBAL_KPI.recebimentos : GLOBAL_KPI.recebimentos * Math.abs(ratio));
  setKPI('kpiGastos',       noFilter ? GLOBAL_KPI.gastos       : GLOBAL_KPI.gastos * Math.abs(ratio));
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
// 11. CONFIGS REUTILIZÁVEIS
// ------------------------------------------------

function tooltipConfig(labelFn) {
  return {
    backgroundColor: '#111', borderColor: '#444', borderWidth: 1,
    titleColor: '#aaa', bodyColor: '#fff',
    titleFont: { family: 'IBM Plex Mono', size: 11 },
    bodyFont: { family: 'IBM Plex Mono', size: 12, weight: '600' },
    padding: 10,
    callbacks: { label: labelFn }
  };
}

function baseScales(tickSize = 11) {
  return {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#888', font: { family: 'IBM Plex Sans', size: tickSize }, maxRotation: 0 },
      border: { color: '#333' }
    },
    y: { display: false }
  };
}

// ------------------------------------------------
// 12. UTILITÁRIO RESPONSIVO
// ------------------------------------------------

function isMobile() { return window.innerWidth < 600; }

function applyChartHeights() {
  const w = window.innerWidth;
  const s = w < 600
    ? { mes: 180, ano: 160, geral: 280 }
    : w < 900
    ? { mes: 210, ano: 190, geral: 340 }
    : { mes: 240, ano: 195, geral: 470 };
  const set = (id, h) => { const el = document.getElementById(id); if (el) el.style.height = h + 'px'; };
  set('chartLucroMes', s.mes);
  set('chartLucroAno', s.ano);
  set('chartLucroGeral', s.geral);
}

// ------------------------------------------------
// 13. REFRESH CENTRAL — chama tudo junto
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
// 13. INICIALIZAÇÃO
// ------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Remove loading
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }, 500);

  // Popula select de anos
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

  // Render inicial
  refreshAll();

  // Reajusta ao girar o celular ou redimensionar janela
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => refreshAll(), 200);
  });

  // Data no header
  const now = new Date();
  const el = document.getElementById('headerDate');
  if (el) el.textContent = '— ' + now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
});
