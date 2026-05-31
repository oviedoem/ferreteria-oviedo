// app.js — Aereostar Demo Dashboard Logic
// Todos los datos son simulados para demostración comercial.

// ── FORMATTERS ──────────────────────────────────────────────────────────────
const fmt = {
  number(n)   { return new Intl.NumberFormat('es-CL').format(n); },
  percent(n)  { return n.toFixed(2).replace('.', ',') + '%'; },
  currency(n) { return '$ ' + new Intl.NumberFormat('es-CL').format(n); },
  date(s)     {
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  },
  pctChange(val, prev) {
    const diff = ((val - prev) / prev) * 100;
    return { pct: Math.abs(diff).toFixed(1), up: diff >= 0 };
  },
};

function fmtKpi(val, format) {
  if (format === 'number')   return fmt.number(val);
  if (format === 'percent')  return fmt.percent(val);
  if (format === 'currency') return fmt.currency(val);
  return val;
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-section');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      btns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      sections.forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
    });
  });
}

// ── KPI GRID ─────────────────────────────────────────────────────────────────
function renderKPIs() {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  grid.innerHTML = KPIS.map(kpi => {
    const { pct, up } = fmt.pctChange(kpi.value, kpi.prev);
    const goodChange = kpi.invertChange ? !up : up;
    const arrow = up ? '↑' : '↓';

    const maxTrend = Math.max(...kpi.trend);
    const bars = kpi.trend.map(v => {
      const h = Math.round((v / maxTrend) * 100);
      return `<div class="sparkline-bar" style="height:${h}%"></div>`;
    }).join('');

    const badge = kpi.badge
      ? `<span class="kpi-badge">${kpi.badge}</span>`
      : '';

    return `
      <div class="kpi-card ${kpi.color}">
        <div class="kpi-top">
          <span class="kpi-label">${kpi.label}</span>
          <div class="kpi-icon">${kpi.icon}</div>
        </div>
        <div class="kpi-value">${fmtKpi(kpi.value, kpi.format)}${badge}</div>
        <div class="kpi-change ${goodChange ? 'up' : 'down'}${kpi.invertChange && goodChange ? ' good' : ''}">
          ${arrow} ${pct}% vs anterior
        </div>
        <div class="sparkline">${bars}</div>
      </div>`;
  }).join('');
}

// ── FUNNEL ────────────────────────────────────────────────────────────────────
function renderFunnel() {
  const container = document.getElementById('funnel-container');
  if (!container) return;

  const stagesHtml = FUNNEL.map((stage, i) => {
    const connectorHtml = i < FUNNEL.length - 1
      ? `<div class="funnel-connector">
           <div class="funnel-connector-line"></div>
           <div class="funnel-connector-rate">${FUNNEL[i+1].convRate} ${FUNNEL[i+1].convLabel}</div>
         </div>`
      : '';

    return `
      <div class="funnel-row">
        <div class="funnel-row-label">${stage.label}</div>
        <div class="funnel-bar-wrap">
          <div class="funnel-bar-bg"></div>
          <div class="funnel-bar-fill" style="width:0%; background:${stage.color}; transition:width .9s ${i * .15}s cubic-bezier(.4,0,.2,1);" data-width="${stage.visualW}">
            <span>${stage.label}</span>
          </div>
        </div>
        <div class="funnel-row-stats">
          <span class="funnel-stat-val">${fmt.number(stage.value)}</span>
          <span class="funnel-stat-pct">${stage.note}</span>
        </div>
      </div>
      ${connectorHtml}`;
  }).join('');

  container.innerHTML = `
    <div class="funnel-stages">${stagesHtml}</div>`;

  // Animate bars after render
  setTimeout(() => {
    container.querySelectorAll('.funnel-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 100);
}

// ── LEADS TABLE ───────────────────────────────────────────────────────────────
let currentFilter = 'all';
let currentSearch = '';

function buildCountPills() {
  const counts = {};
  LEADS.forEach(l => { counts[l.estado] = (counts[l.estado] || 0) + 1; });
  const all = LEADS.length;

  const pillsCfg = [
    { key:'all',         label:'Todos',         color:'#2563eb', bg:'#eff6ff' },
    { key:'nuevo',       ...STATUS_CONFIG.nuevo },
    { key:'contactado',  ...STATUS_CONFIG.contactado },
    { key:'cotizado',    ...STATUS_CONFIG.cotizado },
    { key:'cliente_real',...STATUS_CONFIG.cliente_real },
    { key:'perdido',     ...STATUS_CONFIG.perdido },
  ];

  return pillsCfg.map(p => {
    const cnt = p.key === 'all' ? all : (counts[p.key] || 0);
    return `<div class="count-pill" style="background:${p.bg};border-color:${p.color}20;color:${p.color}">
      <div class="dot" style="background:${p.color}"></div>
      ${p.label}: <strong>${cnt}</strong>
    </div>`;
  }).join('');
}

function renderLeadsTable() {
  const container = document.getElementById('leads-container');
  if (!container) return;

  const filtered = LEADS.filter(l => {
    const matchFilter = currentFilter === 'all' || l.estado === currentFilter;
    const q = currentSearch.toLowerCase();
    const matchSearch = !q || l.nombre.toLowerCase().includes(q) || l.destino.toLowerCase().includes(q) || l.origen.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const countPills = document.getElementById('leads-count-pills');
  if (countPills) countPills.innerHTML = buildCountPills();

  if (!filtered.length) {
    container.innerHTML = `<div class="table-wrap"><div class="no-results">No se encontraron leads con ese filtro.</div></div>`;
    return;
  }

  const rows = filtered.map(l => {
    const sc = STATUS_CONFIG[l.estado];
    const badge = `<span class="status-badge" style="background:${sc.bg};color:${sc.color}">
      <span class="status-dot" style="background:${sc.color}"></span>${sc.label}
    </span>`;

    return `<tr>
      <td data-label="Nombre"><div class="lead-name">${l.nombre}</div><div class="lead-date">${fmt.date(l.fecha)}</div></td>
      <td data-label="Origen"><span class="lead-origin">${l.origen}</span></td>
      <td data-label="Trayecto">${l.destino}</td>
      <td data-label="Vuelo / Hora">${l.vuelo} · ${l.hora}</td>
      <td data-label="Estado">${badge}</td>
      <td data-label="Valor"><span class="lead-value">${fmt.currency(l.valor)}</span></td>
      <td data-label="Notas"><span class="lead-notes" title="${l.notas}">${l.notas || '—'}</span></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="leads-table">
        <thead>
          <tr>
            <th>Nombre / Fecha</th>
            <th>Origen</th>
            <th>Trayecto</th>
            <th>Vuelo · Hora</th>
            <th>Estado</th>
            <th>Valor CLP</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function initLeads() {
  const searchInput = document.getElementById('lead-search');
  const filterBtns  = document.querySelectorAll('.leads-filters .filter-btn');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderLeadsTable();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === currentFilter));
      renderLeadsTable();
    });
  });
}

// ── RECOMMENDATIONS ──────────────────────────────────────────────────────────
function renderRecommendations() {
  const grid = document.getElementById('rec-grid');
  if (!grid) return;

  grid.innerHTML = RECOMMENDATIONS.map(r => `
    <div class="rec-card ${r.priority}">
      <div class="rec-emoji">${r.emoji}</div>
      <div class="rec-body">
        <div class="rec-top">
          <span class="rec-title">${r.title}</span>
          <span class="priority-badge ${r.priority}">${r.priority.charAt(0).toUpperCase() + r.priority.slice(1)} prioridad</span>
        </div>
        <p class="rec-desc">${r.desc}</p>
        <div class="rec-footer">
          <span class="rec-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            ${r.action}
          </span>
          <span class="rec-tag">${r.tag}</span>
          <span class="rec-impact">${r.impact}</span>
        </div>
      </div>
    </div>`).join('');
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────
function renderAudit() {
  const scoreCard  = document.getElementById('audit-score-card');
  const listCard   = document.getElementById('audit-list-card');
  if (!scoreCard || !listCard) return;

  const { score, items } = AUDIT;
  const ok      = items.filter(i => i.status === 'ok').length;
  const warning = items.filter(i => i.status === 'warning').length;
  const fail    = items.filter(i => i.status === 'fail').length;

  // SVG circle
  const r = 54, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';
  const grade = score >= 80 ? 'Bueno' : score >= 60 ? 'Mejorable' : 'Crítico';

  scoreCard.innerHTML = `
    <div class="audit-score-label">Puntuación de landing</div>
    <div class="audit-score-circle">
      <svg viewBox="0 0 120 120">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="10"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${scoreColor}" stroke-width="10"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="28" font-weight="800" fill="${scoreColor}">${score}</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="#94a3b8">de 100</text>
      </svg>
    </div>
    <div class="audit-score-grade">${grade}</div>
    <div class="audit-score-note">
      ✅ ${ok} correctos &nbsp; ⚠️ ${warning} por mejorar &nbsp; ❌ ${fail} faltan
    </div>`;

  const iconsMap = { ok: '✓', warning: '!', fail: '✗' };
  listCard.innerHTML = items.map(item => `
    <div class="audit-item">
      <div class="audit-status-icon ${item.status}">${iconsMap[item.status]}</div>
      <div class="audit-item-body">
        <div class="audit-item-label">${item.label}</div>
        <div class="audit-item-note">${item.note}</div>
      </div>
    </div>`).join('');
}

// ── HOW IT WORKS ─────────────────────────────────────────────────────────────
function renderFlow() {
  const container = document.getElementById('flow-container');
  if (!container) return;

  const stepsHtml = FLOW_STEPS.map((step, i) => {
    const arrowHtml = i < FLOW_STEPS.length - 1
      ? `<div class="flow-arrow">›</div>`
      : '';

    return `
      <div class="flow-step">
        <div class="flow-icon-wrap">
          <span class="flow-step-num">${step.step}</span>
          ${step.icon}
        </div>
        <div class="flow-body">
          <div class="flow-title">${step.title}</div>
          <div class="flow-desc">${step.desc}</div>
          <span class="flow-tag">${step.tag}</span>
        </div>
      </div>
      ${arrowHtml}`;
  }).join('');

  container.innerHTML = `<div class="flow-steps">${stepsHtml}</div>`;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderKPIs();
  renderFunnel();

  const pillsEl = document.getElementById('leads-count-pills');
  if (pillsEl) pillsEl.innerHTML = buildCountPills();
  renderLeadsTable();
  initLeads();

  renderRecommendations();
  renderAudit();
  renderFlow();

  // Animated "live" timestamp
  const ts = document.getElementById('update-ts');
  if (ts) ts.textContent = 'Actualizado hace 2 min';
});
