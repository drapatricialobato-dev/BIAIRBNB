/**
 * =============================================
 * DASHBOARD - CONTROLE APARTAMENTO
 * script.js — Dados, gráficos e filtros
 * =============================================
 */

// ------------------------------------------------
// 1. DADOS EXTRAÍDOS DA PLANILHA BI
// ------------------------------------------------

/** Ordem canônica dos meses em PT-BR */
const MONTH_ORDER = [
  'JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
  'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'
];

/** Abreviações para exibição nos eixos */
const MONTH_ABBR = {
  'JANEIRO':'jan','FEVEREIRO':'fev','MARÇO':'mar','ABRIL':'abr',
  'MAIO':'mai','JUNHO':'jun','JULHO':'jul','AGOSTO':'ago',
  'SETEMBRO':'set','OUTUBRO':'out','NOVEMBRO':'nov','DEZEMBRO':'dez'
};

/**
 * Lucro (RESULTADO) por ano → mês
 * Fonte: coluna RESULTADO da planilha BI
 */
const RAW_DATA = {
  2023: {
    'SETEMBRO': -733.85,
    'OUTUBRO': -1478.85,
    'NOVEMBRO': -226.96,
    'DEZEMBRO': 1237.48
  },
  2024: {
    'JANEIRO': 1218.91,
    'FEVEREIRO': 2688.08,
    'MARÇO': 2558.60,
    'ABRIL': 2292.44,
    'MAIO': 4707.64,
    'JUNHO': 2776.36,
    'JULHO': 3695.04,
    'AGOSTO': 4095.74,
    'SETEMBRO': 4107.00,
    'OUTUBRO': 797.46,
    'NOVEMBRO': 3676.23,
    'DEZEMBRO': 661.83
  },
  2025: {
    'JANEIRO': 1539.97,
    'FEVEREIRO': 3320.77,
    'MARÇO': 1584.67,
    'ABRIL': -144.89,
    'MAIO': 4485.29,
    'JUNHO': 1635.45,
    'JULHO': 1578.75,
    'AGOSTO': 1471.25,
    'SETEMBRO': 1696.97,
    'OUTUBRO': 708.90,
    'NOVEMBRO': 2751.75,
    'DEZEMBRO': -1415.58
  },
  2026: {
    'JANEIRO': 3359.82,
    'FEVEREIRO': 3859.36,
    'MARÇO': 4503.88,
    'ABRIL': 3703.32,
    'MAIO': 3746.79,
    'JUNHO': 2890.61
  }
};

/** KPIs globais (linha 0 da planilha + somas calculadas) */
const GLOBAL_KPI = {
  balancoTotal: -114764.63,
  recebimentos: 117834.00,
  gastos:        44306.13,
  lucro:         73350.23   // recebimentos - gastos (excluindo apt/obra)
};

// ------------------------------------------------
// 2. ESTADO DO FILTRO
// ------------------------------------------------
let selectedYear = 'Todos';

// ------------------------------------------------
// 3. UTILITÁRIOS
// ------------------------------------------------

/** Formata número como moeda BRL */
function formatBRL(value) {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? '-' : '') + 'R$' + formatted;
}

/** Anima contagem de números nos KPI cards */
function animateValue(el, start, end, duration = 900) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * ease;
    el.textContent = formatBRL(current);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ------------------------------------------------
// 4. GRÁFICOS — instâncias Chart.js
// ------------------------------------------------
let chartLucroMes   = null;  // Lucro por Mês (inferior esquerdo)
let chartLucroAno   = null;  // Lucro por Ano (inferior esquerdo baixo)
let chartLucroGeral = null;  // Lucro por Ano agrupado por mês (grande direito)

/** Configuração base para barras no estilo Power BI */
function getBaseBarConfig() {
  return {
    type: 'bar',
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#444',
          borderWidth: 1,
          titleColor: '#aaa',
          bodyColor: '#fff',
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 12, weight: '600' },
          padding: 10,
          callbacks: {
            label: ctx => ' ' + formatBRL(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#888',
            font: { family: 'IBM Plex Sans', size: 11 },
            maxRotation: 0
          },
          border: { color: '#333' }
        },
        y: {
          display: false,
          grid: { display: false }
        }
      },
      layout: { padding: { top: 30 } }
    }
  };
}

/** Cria dataset de barras com cores condicionais (positivo/negativo) */
function makeBarDataset(data, label = '') {
  const colors = data.map(v => v >= 0 ? '#e0e0e0' : '#666');
  const hover  = data.map(v => v >= 0 ? '#ffffff' : '#888');
  return {
    label,
    data,
    backgroundColor: colors,
    hoverBackgroundColor: hover,
    borderRadius: 3,
    borderSkipped: false,
    barPercentage: 0.7,
    categoryPercentage: 0.75
  };
}

/** Plugin para exibir labels acima/abaixo das barras */
const datalabelsPlugin = {
  id: 'datalabelsCustom',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, j) => {
        const value = dataset.data[j];
        if (value === null || value === undefined) return;
        const label = formatBRL(value);
        ctx.save();
        ctx.font = '600 10px "IBM Plex Mono"';
        ctx.fillStyle = value >= 0 ? '#ccc' : '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = value >= 0 ? 'bottom' : 'top';
        const y = value >= 0 ? bar.y - 4 : bar.y + bar.height + 4;
        ctx.fillText(label, bar.x, y);
        ctx.restore();
      });
    });
  }
};

// ------------------------------------------------
// 5. RENDERIZAR GRÁFICO: LUCRO POR MÊS (ano atual)
// ------------------------------------------------
function renderLucroMes(year) {
  const data = RAW_DATA[year] || {};
  const months = MONTH_ORDER.filter(m => data[m] !== undefined);
  const values = months.map(m => data[m]);
  const labels = months.map(m => MONTH_ABBR[m]);

  const canvas = document.getElementById('chartLucroMes');
  const config = getBaseBarConfig();
  config.data = {
    labels,
    datasets: [makeBarDataset(values, 'Lucro')]
  };
  config.options.plugins.datalabelsCustom = true;
  config.options.scales.x.ticks.font = { family: 'IBM Plex Sans', size: 10 };

  if (chartLucroMes) chartLucroMes.destroy();
  chartLucroMes = new Chart(canvas, config);
  chartLucroMes.__customPlugin = datalabelsPlugin;

  // Registra plugin manualmente para este canvas
  Chart.register(datalabelsPlugin);
}

// ------------------------------------------------
// 6. RENDERIZAR GRÁFICO: LUCRO POR ANO (barras ano)
// ------------------------------------------------
function renderLucroAno() {
  const years = Object.keys(RAW_DATA).map(Number).sort();
  const values = years.map(y =>
    Object.values(RAW_DATA[y]).reduce((a, b) => a + b, 0)
  );
  const labels = years.map(String);

  const canvas = document.getElementById('chartLucroAno');
  const config = getBaseBarConfig();
  config.data = {
    labels,
    datasets: [makeBarDataset(values, 'Lucro Anual')]
  };
  config.options.scales.x.ticks.font = { family: 'IBM Plex Sans', size: 11 };
  config.options.layout = { padding: { top: 36 } };

  if (chartLucroAno) chartLucroAno.destroy();
  chartLucroAno = new Chart(canvas, config);
}

// ------------------------------------------------
// 7. RENDERIZAR GRÁFICO GRANDE: LUCRO POR ANO × MÊS
// ------------------------------------------------
function renderLucroGeral(filterYear) {
  /**
   * Estrutura: eixo X = meses, cada mês tem N barras (uma por ano).
   * O Power BI mostra barras agrupadas por mês com anos em sequência.
   */
  const allYears = Object.keys(RAW_DATA).map(Number).sort();
  const yearsToShow = filterYear === 'Todos'
    ? allYears
    : [Number(filterYear)];

  // Paleta de cinzas para diferenciar anos
  const yearColors = {
    2023: '#505050',
    2024: '#787878',
    2025: '#a0a0a0',
    2026: '#e0e0e0'
  };
  const yearColorsHover = {
    2023: '#686868',
    2024: '#909090',
    2025: '#bbbbbb',
    2026: '#ffffff'
  };

  // Meses que aparecem em pelo menos um dos anos filtrados
  const usedMonths = MONTH_ORDER.filter(m =>
    yearsToShow.some(y => RAW_DATA[y] && RAW_DATA[y][m] !== undefined)
  );

  const datasets = yearsToShow.map(year => ({
    label: String(year),
    data: usedMonths.map(m => RAW_DATA[year]?.[m] ?? null),
    backgroundColor: yearColors[year] || '#888',
    hoverBackgroundColor: yearColorsHover[year] || '#aaa',
    borderRadius: 2,
    borderSkipped: false,
    barPercentage: 0.85,
    categoryPercentage: 0.8
  }));

  const labels = usedMonths.map(m => MONTH_ABBR[m]);

  const canvas = document.getElementById('chartLucroGeral');

  if (chartLucroGeral) chartLucroGeral.destroy();

  chartLucroGeral = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutCubic' },
      plugins: {
        legend: {
          display: yearsToShow.length > 1,
          position: 'top',
          align: 'end',
          labels: {
            color: '#aaa',
            font: { family: 'IBM Plex Sans', size: 11 },
            boxWidth: 12,
            boxHeight: 12,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#444',
          borderWidth: 1,
          titleColor: '#aaa',
          bodyColor: '#fff',
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
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#888',
            font: { family: 'IBM Plex Sans', size: 11 },
            maxRotation: 0
          },
          border: { color: '#333' },
          stacked: false
        },
        y: {
          display: true,
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          ticks: {
            color: '#666',
            font: { family: 'IBM Plex Mono', size: 10 },
            callback: v => 'R$' + (v/1000).toFixed(0) + 'k'
          },
          border: { display: false }
        }
      },
      layout: { padding: { top: 8, bottom: 4 } }
    },
    plugins: [datalabelsPluginLarge]
  });
}

/** Plugin de labels para o gráfico grande (fonte menor, evitar sobreposição) */
const datalabelsPluginLarge = {
  id: 'datalabelsLarge',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    // Só exibe labels se poucos anos (evitar poluição visual)
    const numDatasets = data.datasets.length;
    if (numDatasets > 2) return; // Muito cheio para labels

    data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, j) => {
        const value = dataset.data[j];
        if (value === null || value === undefined) return;
        const label = formatBRL(value);
        ctx.save();
        ctx.font = '500 9px "IBM Plex Mono"';
        ctx.fillStyle = value >= 0 ? '#bbb' : '#777';
        ctx.textAlign = 'center';
        ctx.textBaseline = value >= 0 ? 'bottom' : 'top';
        const y = value >= 0 ? bar.y - 3 : bar.y + bar.height + 3;
        ctx.fillText(label, bar.x, y);
        ctx.restore();
      });
    });
  }
};

// ------------------------------------------------
// 8. ATUALIZAR KPIs CONFORME FILTRO
// ------------------------------------------------
function updateKPIs(year) {
  if (year === 'Todos') {
    // Valores globais da planilha
    updateKPIDisplay('kpiBalanco',       GLOBAL_KPI.balancoTotal, true);
    updateKPIDisplay('kpiRecebimentos',  GLOBAL_KPI.recebimentos, false);
    updateKPIDisplay('kpiGastos',        GLOBAL_KPI.gastos,       false);
    updateKPIDisplay('kpiLucro',         GLOBAL_KPI.lucro,        false);
  } else {
    const data = RAW_DATA[Number(year)] || {};
    const lucro = Object.values(data).reduce((a, b) => a + b, 0);

    // Para filtro por ano não temos gastos/recebimentos separados —
    // calcula lucro e exibe os demais como N/A parcial
    // Melhor: exibir só o lucro anual e manter globais para balanço
    updateKPIDisplay('kpiBalanco',      GLOBAL_KPI.balancoTotal, true);
    updateKPIDisplay('kpiRecebimentos', GLOBAL_KPI.recebimentos, false);
    updateKPIDisplay('kpiGastos',       GLOBAL_KPI.gastos,       false);
    updateKPIDisplay('kpiLucro',        lucro,                   false);
  }
}

function updateKPIDisplay(id, value, forceNegative) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseFloat(el.dataset.value || '0');
  el.dataset.value = value;
  animateValue(el, current, value);
  el.classList.toggle('negative', value < 0);
  el.classList.toggle('positive', value >= 0);
}

// ------------------------------------------------
// 9. TÍTULO DO GRÁFICO DE MÊS (atualiza com o ano)
// ------------------------------------------------
function updateChartTitles(year) {
  const titleEl = document.getElementById('titleLucroMes');
  if (titleEl) {
    titleEl.textContent = year === 'Todos'
      ? 'Lucro por Mês — Todos os Anos'
      : `Lucro por Mês em ${year}`;
  }
}

// ------------------------------------------------
// 10. FILTRO — HANDLER PRINCIPAL
// ------------------------------------------------
function applyFilter(year) {
  selectedYear = year;

  // Atualiza KPIs
  updateKPIs(year);

  // Gráfico de meses: mostra o ano selecionado ou 2026 (mais recente)
  const yearForMes = year === 'Todos' ? 2026 : Number(year);
  renderLucroMes(yearForMes);

  // Gráfico grande: filtra ou mostra todos
  renderLucroGeral(year);

  // Título
  updateChartTitles(yearForMes);
}

// ------------------------------------------------
// 11. INICIALIZAÇÃO
// ------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Esconde loading
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }, 600);

  // Popula select de anos
  const select = document.getElementById('filterAno');
  if (select) {
    const years = Object.keys(RAW_DATA).sort().reverse();
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      select.appendChild(opt);
    });

    select.addEventListener('change', e => applyFilter(e.target.value));
  }

  // Renderiza estado inicial (Todos)
  applyFilter('Todos');
  renderLucroAno();
});
