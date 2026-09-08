// Frontend Logic for APPles Financial Dashboard
const API_BASE = `${window.location.origin}/api`;

const API_SECRET_KEY = 'apples_fin_sec_key_2026_x89';

// Interceptor global de fetch para añadir la clave de seguridad en todas las peticiones a /api/
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlString = String(url);
  if (urlString.includes('/api/')) {
    options.headers = {
      ...options.headers,
      'x-api-key': API_SECRET_KEY
    };
  }
  return originalFetch.call(this, url, options);
};

// Cache values for routing
let accounts = [];
let debts = [];
let transactions = [];
let currentDebtFilter = 'all'; // 'all', 'q1', 'q2'

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  checkAPIStatus();
  setupEventListeners();
  setupEditDebtForm();
  await initializeFirebase();
});

// 1. Verify connection to Backend
async function checkAPIStatus() {
  const indicator = document.querySelector('.status-indicator');
  const text = document.getElementById('api-status');
  
  try {
    const res = await fetch(`${window.location.origin}/health`);
    if (res.ok) {
      indicator.className = 'status-indicator online';
      text.innerText = 'Backend Conectado';
    } else {
      throw new Error();
    }
  } catch (err) {
    indicator.className = 'status-indicator';
    text.innerText = 'Backend Desconectado';
  }
}

// 2. Fetch and Load all models
async function loadData() {
  await fetchAccounts();
  await fetchTransactions();
  await fetchDebts();
}

async function fetchAccounts() {
  const container = document.getElementById('accounts-list');
  try {
    const res = await fetch(`${API_BASE}/accounts`);
    const data = await res.json();
    if (data.status === 'success') {
      accounts = data.data || [];
      renderAccounts();
      populateAccountSelects();
      renderCashFlowReport();
    } else {
      container.innerHTML = `<div class="loading-spinner">Error: ${escapeHTML(data.message || 'No se cargaron cuentas')}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="loading-spinner">Error al conectar con cuentas</div>`;
  }
}

async function fetchTransactions() {
  const container = document.getElementById('transactions-list');
  try {
    const res = await fetch(`${API_BASE}/transactions`);
    const data = await res.json();
    if (data.status === 'success') {
      transactions = data.data || [];
      renderTransactions();
      renderCashFlowReport();
    } else {
      container.innerHTML = `<div class="loading-spinner">Error: ${escapeHTML(data.message || 'No se cargaron movimientos')}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="loading-spinner">Error al conectar con movimientos</div>`;
  }
}

async function fetchDebts() {
  const container = document.getElementById('debts-list');
  const methodSelect = document.getElementById('select-method');
  const method = methodSelect ? methodSelect.value : 'Bola de Nieve';

  try {
    const res = await fetch(`${API_BASE}/debts`);
    const data = await res.json();
    if (data.status === 'success') {
      debts = data.data || [];
      renderDebts();
      renderOptimizationPlan(method);
      populateDebtSelect();
      renderCashFlowReport();
    } else {
      container.innerHTML = `<div class="loading-spinner">Error: ${escapeHTML(data.message || 'No se cargaron deudas')}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="loading-spinner">Error al conectar con deudas</div>`;
  }
}

// 3. Rendering Functions
function renderAccounts() {
  const container = document.getElementById('accounts-list');
  if (accounts.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No tienes cuentas registradas</div>`;
    return;
  }

  container.innerHTML = accounts.map(acc => `
    <div class="account-item">
      <div class="item-left">
        <div class="item-icon">
          <i class="${acc.tipo === 'SERVICIO' ? 'fa-solid fa-lightbulb' : acc.tipo === 'CREDITO' ? 'fa-solid fa-credit-card' : acc.tipo === 'EFECTIVO' ? 'fa-solid fa-money-bill-wave' : 'fa-solid fa-building-columns'}"></i>
        </div>
        <div class="item-info">
          <h4>${escapeHTML(acc.nombre)}</h4>
          <p>${acc.tipo === 'SERVICIO' ? 'Servicio Público / Fijo' : acc.tipo}</p>
        </div>
      </div>
      <div class="item-right">
        <div class="item-value">$${formatMoney(acc.saldo_actual)}</div>
        <div class="item-actions">
          <button class="btn-action-small delete-account-btn" data-id="${acc.id}" title="Eliminar cuenta">
            <i class="fa-solid fa-trash pointer-events-none"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderTransactions() {
  const container = document.getElementById('transactions-list');
  if (transactions.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No hay transacciones registradas</div>`;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const isGasto = tx.tipo === 'GASTO';
    // Find account name
    const acc = accounts.find(a => a.id === tx.cuenta_id);
    const accountName = acc ? acc.nombre : 'Cuenta desconocida';

    return `
      <div class="transaction-item">
        <div class="item-left">
          <div class="item-icon ${isGasto ? 'gasto' : 'ingreso'}">
            <i class="${isGasto ? 'fa-solid fa-arrow-up-right-from-square' : 'fa-solid fa-arrow-down-left-from-square'}"></i>
          </div>
          <div class="item-info">
            <h4>${escapeHTML(tx.descripcion)}</h4>
            <p>${escapeHTML(accountName)} • ${formatDate(tx.fecha_transaccion)}</p>
          </div>
        </div>
        <div class="item-right">
          <div class="transaction-value ${isGasto ? 'gasto' : 'ingreso'}">
            ${isGasto ? '-' : '+'}$${formatMoney(tx.monto)}
          </div>
          <div class="item-actions">
            <button class="btn-action-small delete-tx-btn" data-id="${tx.id}" title="Eliminar transacción">
              <i class="fa-solid fa-trash pointer-events-none"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDebts(prioritizationMethod) {
  const container = document.getElementById('debts-list');
  if (debts.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No tienes deudas registradas</div>`;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdueCount = 0;
  let overdueTotal = 0;
  let overdueMoraTotal = 0;

  // Calculate overdue status globally first so the summary alert banner is always accurate
  debts.forEach((debt) => {
    const isPaid = Number(debt.saldo_total) <= 0;
    if (isPaid) return;
    
    const limiteDate = parseLocalDate(debt.fecha_limite_pago);
    limiteDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - limiteDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays > 0;
    
    if (isOverdue) {
      const cuotasVencidas = Math.max(1, Math.ceil(diffDays / 30));
      const montoMora = cuotasVencidas * Number(debt.pago_minimo);
      overdueCount++;
      overdueTotal += Number(debt.saldo_total);
      overdueMoraTotal += montoMora;
    }
  });

  // Separate active debts (saldo > 0) from paid/cancelled debts (saldo <= 0)
  // Sort active debts by due date ascending (soonest first)
  const activeDebts = debts
    .filter(d => Number(d.saldo_total) > 0)
    .sort((a, b) => parseLocalDate(a.fecha_limite_pago).getTime() - parseLocalDate(b.fecha_limite_pago).getTime());
  const paidDebts = debts.filter(d => Number(d.saldo_total) <= 0);

  // Combine active debts first, then paid debts at the bottom
  let sortedDebts = [...activeDebts, ...paidDebts];

  // Calculate Biweekly Income (Cobro / Salario Quincenal vs Cuotas)
  let totalIncome = 0;
  let q1Income = 0;
  let q2Income = 0;
  let q1IncomeList = [];
  let q2IncomeList = [];

  transactions.forEach(t => {
    if (t.tipo === 'INGRESO') {
      const amount = Number(t.monto);
      totalIncome += amount;
      const day = getDueDateDay(t.fecha_transaccion);
      
      // Clasificación inteligente de nómina por ciclo de cobro:
      // - Cobro de Mitad de Mes (Días 15 al 24, ej: Nómina Asistia 18/8) -> Asignado a Q2 (para cuotas del 15 al 31)
      // - Cobro de Fin / Inicio de Mes (Días 25 al 31 y 1 al 14, ej: Nómina Ortomac 28/8) -> Asignado a Q1 (para cuotas del 1 al 14)
      if (day >= 15 && day <= 24) {
        q2Income += amount;
        q2IncomeList.push({ name: t.descripcion, amount });
      } else {
        q1Income += amount;
        q1IncomeList.push({ name: t.descripcion, amount });
      }
    }
  });

  // Fallback: If no specific Q1/Q2 income transactions exist, split total income equally
  if (q1Income === 0 && q2Income === 0 && totalIncome > 0) {
    q1Income = totalIncome / 2;
    q2Income = totalIncome / 2;
  }

  // Allow custom override if stored in local storage
  const savedIncome = localStorage.getItem('apples_custom_quincena_income');
  const userQuincenaSalary = savedIncome ? Number(savedIncome) : 2500000;

  const effectiveQ1Income = q1Income > 0 ? q1Income : userQuincenaSalary;
  const effectiveQ2Income = q2Income > 0 ? q2Income : userQuincenaSalary;

  const q1IncomeDetailText = q1IncomeList.length > 0
    ? q1IncomeList.map(i => `<strong>${i.name}</strong> ($${formatMoney(i.amount)})`).join(' + ')
    : `Cobro Estimado Q1 ($${formatMoney(effectiveQ1Income)})`;

  const q2IncomeDetailText = q2IncomeList.length > 0
    ? q2IncomeList.map(i => `<strong>${i.name}</strong> ($${formatMoney(i.amount)})`).join(' + ')
    : `Cobro Estimado Q2 ($${formatMoney(effectiveQ2Income)})`;

  const q1Debts = activeDebts.filter(d => {
    const dueDay = getDueDateDay(d.fecha_limite_pago);
    return dueDay >= 1 && dueDay <= 14;
  });

  const q2Debts = activeDebts.filter(d => {
    const dueDay = getDueDateDay(d.fecha_limite_pago);
    return dueDay >= 15 && dueDay <= 31;
  });

  const getDebtRequiredAmount = (d) => {
    const isPaid = Number(d.saldo_total) <= 0;
    if (isPaid) return 0;
    if (d.cubierto_por && String(d.cubierto_por).trim() !== '') return 0; // Cubierto por tercero = $0 sueldo de nómina
    
    const limiteDate = parseLocalDate(d.fecha_limite_pago);
    limiteDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - limiteDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays > 0;
    
    if (isOverdue) {
      const cuotasVencidas = Math.max(1, Math.ceil(diffDays / 30));
      return cuotasVencidas * Number(d.pago_minimo);
    }
    return Number(d.pago_minimo);
  };

  const totalQ1Cuotas = q1Debts.reduce((sum, d) => sum + getDebtRequiredAmount(d), 0);
  const totalQ2Cuotas = q2Debts.reduce((sum, d) => sum + getDebtRequiredAmount(d), 0);

  let quincenaCoverageHTML = '';

  if (currentDebtFilter === 'q1') {
    const diffQ1 = effectiveQ1Income - totalQ1Cuotas;
    const isCoveredQ1 = diffQ1 >= 0;

    quincenaCoverageHTML = `
      <div class="quincena-attention-card ${isCoveredQ1 ? 'covered' : 'shortage'}">
        <div class="quincena-attention-header">
          <span class="quincena-badge ${isCoveredQ1 ? 'bg-success' : 'bg-danger'}">
            <i class="fa-solid ${isCoveredQ1 ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            ${isCoveredQ1 ? 'Q1 CUBIERTA CON TU NÓMINA' : 'ATENCIÓN Q1 - FALTANTE EN NÓMINA'}
          </span>
          <div class="quincena-income-input-wrapper" style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
            <span>Mi cobro Q1 ($):</span>
            <input type="number" id="input-q1-income" value="${effectiveQ1Income}" step="50000" style="width:110px; padding:2px 6px; font-size:0.75rem; height:24px; border-radius:6px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); color:#fff; font-weight:700;">
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.6rem;">
          <i class="fa-solid fa-money-bill-wave text-success"></i> Asignado de tu cobro: ${q1IncomeDetailText}
        </div>
        <div class="quincena-stats-grid">
          <div class="quincena-stat-item">
            <span class="stat-label">💵 Cobro / Nómina Q1:</span>
            <span class="stat-value text-primary">$${formatMoney(effectiveQ1Income)}</span>
          </div>
          <div class="quincena-stat-item">
            <span class="stat-label">💳 Requerido Q1 (Ponerse Al Día):</span>
            <span class="stat-value text-warning">$${formatMoney(totalQ1Cuotas)}</span>
          </div>
          <div class="quincena-stat-item">
            <span class="stat-label">${isCoveredQ1 ? 'Sobrante de tu sueldo Q1:' : 'Faltante Real Q1:'}</span>
            <span class="stat-value ${isCoveredQ1 ? 'text-success' : 'text-danger'}">
              ${isCoveredQ1 ? '+' : '-'}$${formatMoney(Math.abs(diffQ1))}
            </span>
          </div>
        </div>
        <p class="quincena-diagnostic-msg">
          ${isCoveredQ1 
            ? `🟢 <strong>¡Tu nómina alcanza!</strong> Con tu cobro (${q1IncomeDetailText}), pagas todas las cuotas de Q1 ($${formatMoney(totalQ1Cuotas)}) y te quedan <strong style="color:#10b981;">+$${formatMoney(diffQ1)} libres</strong>.` 
            : `🔴 <strong>¡Atención al cobrar!</strong> Para ponerte 100% al día en Q1 necesitas $${formatMoney(totalQ1Cuotas)}. Con tu cobro (${q1IncomeDetailText}), te faltan <strong style="color:#ef4444;">-$${formatMoney(Math.abs(diffQ1))}</strong> de tu sueldo.`}
        </p>
      </div>
    `;
  } else if (currentDebtFilter === 'q2') {
    const diffQ2 = effectiveQ2Income - totalQ2Cuotas;
    const isCoveredQ2 = diffQ2 >= 0;

    quincenaCoverageHTML = `
      <div class="quincena-attention-card ${isCoveredQ2 ? 'covered' : 'shortage'}">
        <div class="quincena-attention-header">
          <span class="quincena-badge ${isCoveredQ2 ? 'bg-success' : 'bg-danger'}">
            <i class="fa-solid ${isCoveredQ2 ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            ${isCoveredQ2 ? 'Q2 CUBIERTA CON TU NÓMINA' : 'ATENCIÓN Q2 - FALTANTE EN NÓMINA'}
          </span>
          <div class="quincena-income-input-wrapper" style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
            <span>Mi cobro Q2 ($):</span>
            <input type="number" id="input-q2-income" value="${effectiveQ2Income}" step="50000" style="width:110px; padding:2px 6px; font-size:0.75rem; height:24px; border-radius:6px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); color:#fff; font-weight:700;">
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.6rem;">
          <i class="fa-solid fa-money-bill-wave text-success"></i> Asignado de tu cobro: ${q2IncomeDetailText}
        </div>
        <div class="quincena-stats-grid">
          <div class="quincena-stat-item">
            <span class="stat-label">💵 Cobro / Nómina Q2:</span>
            <span class="stat-value text-primary">$${formatMoney(effectiveQ2Income)}</span>
          </div>
          <div class="quincena-stat-item">
            <span class="stat-label">💳 Cuotas Requeridas Q2 (15-31):</span>
            <span class="stat-value text-warning">$${formatMoney(totalQ2Cuotas)}</span>
          </div>
          <div class="quincena-stat-item">
            <span class="stat-label">${isCoveredQ2 ? 'Sobrante de tu sueldo Q2:' : 'Faltante de tu sueldo Q2:'}</span>
            <span class="stat-value ${isCoveredQ2 ? 'text-success' : 'text-danger'}">
              ${isCoveredQ2 ? '+' : '-'}$${formatMoney(Math.abs(diffQ2))}
            </span>
          </div>
        </div>
        <p class="quincena-diagnostic-msg">
          ${isCoveredQ2 
            ? `🟢 <strong>¡Tu nómina alcanza!</strong> Con tu cobro (${q2IncomeDetailText}), pagas todas las cuotas del 15 al 31 ($${formatMoney(totalQ2Cuotas)}) y te quedan <strong style="color:#10b981;">+$${formatMoney(diffQ2)} libres</strong>.` 
            : `🔴 <strong>¡Atención al cobrar!</strong> Con tu cobro de esta quincena (${q2IncomeDetailText}), no alcanzas a pagar las cuotas del 15 al 31 ($${formatMoney(totalQ2Cuotas)}). Te faltan <strong style="color:#ef4444;">-$${formatMoney(Math.abs(diffQ2))}</strong> de tu sueldo.`}
        </p>
      </div>
    `;
  } else {
    // 'all' filter summary
    const diffQ1 = effectiveQ1Income - totalQ1Cuotas;
    const diffQ2 = effectiveQ2Income - totalQ2Cuotas;
    quincenaCoverageHTML = `
      <div class="quincena-attention-card summary">
        <div class="quincena-stats-grid">
          <div class="quincena-stat-item">
            <span class="stat-label">📆 Q1 (Cobro $${formatMoney(effectiveQ1Income)}):</span>
            <span class="stat-value ${diffQ1 >= 0 ? 'text-success' : 'text-danger'}">
              Cuotas: $${formatMoney(totalQ1Cuotas)} (${diffQ1 >= 0 ? '+$' + formatMoney(diffQ1) + ' libre' : '-$' + formatMoney(Math.abs(diffQ1)) + ' falta'})
            </span>
          </div>
          <div class="quincena-stat-item">
            <span class="stat-label">📆 Q2 (Cobro $${formatMoney(effectiveQ2Income)}):</span>
            <span class="stat-value ${diffQ2 >= 0 ? 'text-success' : 'text-danger'}">
              Cuotas: $${formatMoney(totalQ2Cuotas)} (${diffQ2 >= 0 ? '+$' + formatMoney(diffQ2) + ' libre' : '-$' + formatMoney(Math.abs(diffQ2)) + ' falta'})
            </span>
          </div>
        </div>
      </div>
    `;
  }

  const alertBanner = overdueCount > 0 ? `
    <div class="overdue-summary-alert">
      <i class="fa-solid fa-triangle-exclamation text-danger"></i>
      <div>
        <strong>¡Atención! Tienes ${overdueCount} deuda${overdueCount > 1 ? 's' : ''} VENCIDA${overdueCount > 1 ? 'S' : ''}</strong>
        <p>Monto requerido para ponerse al día (cuotas vencidas acumuladas): <strong style="color: #ef4444; font-size: 0.95rem;">$${formatMoney(overdueMoraTotal)}</strong>.</p>
      </div>
    </div>
  ` : `
    <div class="all-ok-summary-alert">
      <i class="fa-solid fa-circle-check text-success"></i>
      <span>Todas tus obligaciones están <strong>al día</strong>.</span>
    </div>
  `;

  // Apply Quincena (Fortnight) filter strictly
  sortedDebts = [...activeDebts, ...paidDebts];

  if (currentDebtFilter === 'q1') {
    // Only show active debts due between days 1 and 14
    sortedDebts = activeDebts.filter(d => {
      const dueDay = getDueDateDay(d.fecha_limite_pago);
      return dueDay >= 1 && dueDay <= 14;
    });
  } else if (currentDebtFilter === 'q2') {
    // Only show active debts due between days 15 and 31
    sortedDebts = activeDebts.filter(d => {
      const dueDay = getDueDateDay(d.fecha_limite_pago);
      return dueDay >= 15 && dueDay <= 31;
    });
  }

  if (sortedDebts.length === 0) {
    container.innerHTML = alertBanner + quincenaCoverageHTML + `<div class="loading-spinner">No hay deudas programadas para esta quincena</div>`;
    return;
  }

  let payrollTracker = currentDebtFilter === 'q1' 
    ? effectiveQ1Income 
    : (currentDebtFilter === 'q2' ? effectiveQ2Income : effectiveQ1Income + effectiveQ2Income);

  const debtItemsHTML = sortedDebts.map((debt) => {
    const acc = accounts.find(a => a.id === debt.cuenta_id);
    const accountName = acc ? acc.nombre : 'Cuenta';

    // Calculate overdue status and estimated overdue installments
    const isPaid = Number(debt.saldo_total) <= 0;
    const limiteDate = parseLocalDate(debt.fecha_limite_pago);
    limiteDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - limiteDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays > 0 && !isPaid;
    
    // Estimate overdue installments: 1 month per ~30 days overdue
    const cuotasVencidas = isOverdue ? Math.max(1, Math.ceil(diffDays / 30)) : 0;
    const montoMora = isOverdue ? cuotasVencidas * Number(debt.pago_minimo) : 0;
    const cuotaVal = Number(debt.pago_minimo);

    // Calculate exact number of installments covered by the biweekly payroll
    let individualCoverageBadge = '';
    if (!isPaid) {
      if (debt.cubierto_por && String(debt.cubierto_por).trim() !== '') {
        individualCoverageBadge = `
          <span class="badge-covered-other" title="Pago o cuota cubierta por otra persona (${escapeHTML(debt.cubierto_por)})">
            <i class="fa-solid fa-users-rectangle"></i> CUBIERTO POR: ${escapeHTML(debt.cubierto_por.toUpperCase())}
          </span>
        `;
      } else if (isOverdue) {
        // Evaluate multi-cuota coverage for overdue debts
        const cuotasCovered = Math.floor(payrollTracker / cuotaVal);
        if (cuotasCovered >= cuotasVencidas) {
          payrollTracker -= (cuotasVencidas * cuotaVal);
          individualCoverageBadge = `
            <span class="badge-covered-ok" title="Tu nómina cubre el 100% de las ${cuotasVencidas} cuotas vencidas ($${formatMoney(montoMora)})">
              <i class="fa-solid fa-circle-check"></i> CUBRE LAS ${cuotasVencidas} CUOTAS ($${formatMoney(montoMora)})
            </span>
          `;
        } else if (cuotasCovered > 0) {
          payrollTracker -= (cuotasCovered * cuotaVal);
          const faltanCuotas = cuotasVencidas - cuotasCovered;
          individualCoverageBadge = `
            <span class="badge-covered-partial" title="Tu nómina cubre ${cuotasCovered} de las ${cuotasVencidas} cuotas vencidas">
              <i class="fa-solid fa-circle-half-stroke"></i> CUBRE ${cuotasCovered} DE ${cuotasVencidas} CUOTAS (Faltan ${faltanCuotas} cuota${faltanCuotas > 1 ? 's' : ''})
            </span>
          `;
        } else {
          individualCoverageBadge = `
            <span class="badge-covered-none" title="Tu nómina de esta quincena ya no alcanza para pagar 1 cuota de esta deuda">
              <i class="fa-solid fa-circle-xmark"></i> NÓMINA NO ALCANZA PARA 1 CUOTA
            </span>
          `;
        }
      } else {
        // Regular 1-cuota coverage for current debts
        if (payrollTracker >= cuotaVal) {
          payrollTracker -= cuotaVal;
          individualCoverageBadge = `
            <span class="badge-covered-ok" title="Tu nómina cubre la cuota del mes ($${formatMoney(cuotaVal)})">
              <i class="fa-solid fa-circle-check"></i> CUBRE 1 CUOTA ($${formatMoney(cuotaVal)})
            </span>
          `;
        } else if (payrollTracker > 0) {
          const shortage = cuotaVal - payrollTracker;
          payrollTracker = 0;
          individualCoverageBadge = `
            <span class="badge-covered-partial" title="Tu nómina cubre solo una parte de la cuota">
              <i class="fa-solid fa-circle-half-stroke"></i> PARCIAL (Faltan $${formatMoney(shortage)})
            </span>
          `;
        } else {
          individualCoverageBadge = `
            <span class="badge-covered-none" title="Tu nómina de esta quincena ya se agotó y no cubre esta cuota">
              <i class="fa-solid fa-circle-xmark"></i> SIN COBERTURA EN NÓMINA
            </span>
          `;
        }
      }
    }

    // Calculate if it is due soon (within the next 7 days)
    const timeUntilDue = limiteDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(timeUntilDue / (1000 * 60 * 60 * 24));
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7 && !isPaid && !isOverdue;

    // Find active rank index (ONLY FOR PENDING ACTIVE DEBTS)
    const activeIndex = isPaid ? -1 : activeDebts.findIndex(d => d.id === debt.id);

    // Prioritized ranking badge (Only for active debts with pending balance)
    const badge = (prioritizationMethod && !isPaid && activeIndex !== -1) ? `
      <span class="debt-rank" title="Estrategia: ${prioritizationMethod}">
        ${prioritizationMethod === 'Avalancha' ? 'Avalancha' : 'Bola de Nieve'} #${activeIndex + 1}
      </span>
    ` : '';

    // Overdue or paid badge
    const isServiceAccount = acc && acc.tipo === 'SERVICIO';
    const overdueBadge = isPaid ? `
      <span class="badge-ok" title="${isServiceAccount ? 'Servicio cancelado o inactivo' : 'Deuda completamente pagada'}" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border-color: rgba(16, 185, 129, 0.4);">
        <i class="fa-solid fa-circle-check"></i> ${isServiceAccount ? 'CANCELADO / INACTIVO ($0)' : 'PAGADA ($0)'}
      </span>
    ` : (isOverdue ? `
      <span class="badge-overdue" title="Vencida desde ${formatDateOnly(debt.fecha_limite_pago)} (${diffDays} días de mora)">
        <i class="fa-solid fa-triangle-exclamation"></i> VENCIDA (${cuotasVencidas} cuota${cuotasVencidas > 1 ? 's' : ''})
      </span>
    ` : (isDueSoon ? `
      <span class="badge-warning" title="Vence pronto el ${formatDateOnly(debt.fecha_limite_pago)}">
        <i class="fa-solid fa-clock"></i> ${daysUntilDue === 0 ? 'VENCE HOY' : `VENCE EN ${daysUntilDue} DÍAS`}
      </span>
    ` : `
      <span class="badge-ok" title="Al día">
        <i class="fa-solid fa-circle-check"></i> AL DÍA
      </span>
    `));

    const itemStyle = isOverdue
      ? 'border-color: rgba(239, 68, 68, 0.6); box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);'
      : (isDueSoon
        ? 'border-color: rgba(245, 158, 11, 0.6); box-shadow: 0 0 15px rgba(245, 158, 11, 0.25); background: rgba(245, 158, 11, 0.04);'
        : (activeIndex === 0 && prioritizationMethod ? 'border-color: var(--primary); box-shadow: 0 0 15px var(--primary-glow);' : ''));

    // Category classification (Service vs Credit)
    const isService = Number(debt.tasa_interes_ea) === 0 || (debt.cuenta && (debt.cuenta.tipo === 'EFECTIVO' || debt.cuenta.tipo === 'DEBITO'));
    const categoryBadge = isService ? `
      <span class="badge-service" title="Servicio Público / Gasto Fijo Recurrente">
        <i class="fa-solid fa-lightbulb"></i> SERVICIO FIJO
      </span>
    ` : `
      <span class="badge-credit" title="Crédito Financiero">
        <i class="fa-solid fa-credit-card"></i> CRÉDITO
      </span>
    `;

    // Quincena payment period classification
    const dueDay = limiteDate.getDate();
    const isFirstFortnight = dueDay >= 1 && dueDay <= 14;
    const fortnightBadge = isPaid ? '' : (isFirstFortnight ? `
      <span class="badge-fortnight-first" title="Pagar con ingresos del 30/31 del mes anterior">
        <i class="fa-solid fa-calendar-days"></i> Quincena: Fin de Mes (1-14)
      </span>
    ` : `
      <span class="badge-fortnight-second" title="Pagar con ingresos del 15/16 del mes actual">
        <i class="fa-solid fa-calendar-days"></i> Quincena: Mitad de Mes (15-31)
      </span>
    `);

    return `
      <div class="debt-item" style="${itemStyle}">
        <div class="item-left">
          <div class="item-icon ${isOverdue ? 'overdue' : ''}">
            <i class="${isOverdue ? 'fa-solid fa-triangle-exclamation' : (isService ? 'fa-solid fa-lightbulb' : 'fa-solid fa-percent')}"></i>
          </div>
          <div class="item-info">
            <h4 style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              ${escapeHTML(accountName)}
              ${categoryBadge}
              ${fortnightBadge}
              ${individualCoverageBadge}
              ${badge}
              ${overdueBadge}
            </h4>
            <p>Cuota Mensual: $${formatMoney(debt.pago_minimo)} • Límite Inicial: <strong style="${isOverdue ? 'color: var(--danger); font-weight:700;' : ''}">${formatDateOnly(debt.fecha_limite_pago)}</strong></p>
            ${isOverdue ? `<p style="color: #fda4af; font-weight: 600; margin-top: 0.2rem;"><i class="fa-solid fa-fire-flame-curved"></i> Ponerse al día: $${formatMoney(montoMora)} (${cuotasVencidas} cuotas impagas)</p>` : ''}
          </div>
        </div>
        <div class="item-right">
          <div class="item-value" style="${isOverdue ? 'color: #fda4af;' : ''}">$${formatMoney(debt.saldo_total)}</div>
          <div class="debt-rate" title="Tasa Efectiva Anual">${debt.tasa_interes_ea}% E.A.</div>
          <div class="item-actions">
            <button class="btn-action-small cover-other-btn ${debt.cubierto_por ? 'active-covered' : ''}" data-id="${debt.id}" title="${debt.cubierto_por ? 'Cubierto por: ' + escapeHTML(debt.cubierto_por) + ' (haz clic para editar)' : 'Marcar como cubierto por otra persona'}">
              <i class="fa-solid fa-users-rectangle pointer-events-none"></i>
            </button>
            <button class="btn-action-small pay-debt-btn" data-id="${debt.id}" title="Abonar 1 cuota ($${formatMoney(debt.pago_minimo)}) y avanzar 1 mes">
              <i class="fa-solid fa-money-check-dollar pointer-events-none"></i>
            </button>
            <button class="btn-action-small unpaid-debt-btn" data-id="${debt.id}" title="Marcar cuota de este mes como NO PAGADA (+1 cuota de mora)">
              <i class="fa-solid fa-calendar-minus pointer-events-none text-danger"></i>
            </button>
            <button class="btn-action-small edit-debt-btn" data-id="${debt.id}" title="Editar fecha o saldo de la deuda">
              <i class="fa-solid fa-pen-to-square pointer-events-none"></i>
            </button>
            <button class="btn-action-small delete-debt-btn" data-id="${debt.id}" title="Eliminar deuda">
              <i class="fa-solid fa-trash pointer-events-none"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = alertBanner + quincenaCoverageHTML + debtItemsHTML;
}

let selectedOptDebtIds = new Set(); // Track user checked debts for budget calculation

function renderOptimizationPlan(method) {
  const container = document.getElementById('optimization-plan-list');
  const summaryBox = document.getElementById('opt-target-summary');
  if (!container || !summaryBox) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function checkIsOverdue(debt) {
    if (Number(debt.saldo_total) <= 0) return false;
    const limiteDate = new Date(debt.fecha_limite_pago);
    limiteDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - limiteDate.getTime();
    return Math.floor(diffTime / 86400000) > 0;
  }

  // Filter ONLY active debts with pending balance > 0
  const activeDebts = debts.filter(d => Number(d.saldo_total) > 0);

  if (activeDebts.length === 0) {
    summaryBox.innerHTML = `
      <div style="text-align:center; color:#10b981; padding:0.5rem;">
        <i class="fa-solid fa-trophy" style="font-size:2rem; margin-bottom:0.4rem; display:block;"></i>
        <strong style="font-size:1rem; color:#fff;">¡Felicidades! Estás 100% libre de deudas.</strong>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">No tienes obligaciones pendientes por liquidar.</p>
      </div>
    `;
    container.innerHTML = ``;
    return;
  }

  // Auto-select ONLY overdue debts on initial load (or debts requiring payment)
  if (selectedOptDebtIds.size === 0) {
    activeDebts.forEach(d => {
      if (checkIsOverdue(d)) {
        selectedOptDebtIds.add(d.id);
      }
    });
  }

  // Sort active debts: Overdue debts FIRST, then up to date debts
  // Within each group, sort by chosen strategy (Bola de Nieve / Avalancha)
  const sorted = [...activeDebts];
  sorted.sort((a, b) => {
    const aOverdue = checkIsOverdue(a);
    const bOverdue = checkIsOverdue(b);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    if (method === 'Avalancha') {
      return Number(b.tasa_interes_ea) - Number(a.tasa_interes_ea) || Number(a.saldo_total) - Number(b.saldo_total);
    } else {
      // Bola de Nieve (Menor saldo primero)
      return Number(a.saldo_total) - Number(b.saldo_total) || Number(b.tasa_interes_ea) - Number(a.tasa_interes_ea);
    }
  });

  // Calculate sum of selected minimum monthly payments
  let totalSelectedToPay = 0;
  let selectedCount = 0;
  sorted.forEach(d => {
    if (selectedOptDebtIds.has(d.id)) {
      totalSelectedToPay += Number(d.pago_minimo);
      selectedCount++;
    }
  });

  // Calculate total liquid available money (DEBITO & EFECTIVO accounts NOT linked to a debt)
  let availableFunds = 0;
  accounts.forEach(a => {
    const isDebtAccount = debts.some(d => d.cuenta_id === a.id);
    if (!isDebtAccount && (a.tipo === 'DEBITO' || a.tipo === 'EFECTIVO')) {
      availableFunds += Math.max(0, Number(a.saldo_actual));
    }
  });

  const diff = availableFunds - totalSelectedToPay;
  const isEnough = diff >= 0;

  // Target & Budget summary box
  summaryBox.innerHTML = `
    <div style="padding: 0.9rem; border-radius: 14px; background: ${isEnough ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}; border: 1px solid ${isEnough ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; margin-bottom: 0.8rem; transition: var(--transition);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:${isEnough ? '#10b981' : '#fca5a5'}; letter-spacing:0.5px;">
          🧮 Simulación de Pago (${selectedCount} seleccionada${selectedCount !== 1 ? 's' : ''})
        </span>
        <span style="font-size:0.72rem; background:${isEnough ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${isEnough ? '#10b981' : '#ef4444'}; padding:2px 8px; border-radius:10px; font-weight:800;">
          ${isEnough ? '✅ ¡TE ALCANZA!' : '⚠️ FALTAN $' + formatMoney(Math.abs(diff))}
        </span>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:0.5rem; gap:0.5rem;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total a Pagar Seleccionado:</span>
          <strong style="font-size:1.25rem; font-weight:800; color:#fff;">$${formatMoney(totalSelectedToPay)}</strong>
        </div>
        <div style="text-align:right;">
          <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Disponible en Cuentas/Efectivo:</span>
          <strong style="font-size:0.95rem; font-weight:700; color:#10b981;">$${formatMoney(availableFunds)}</strong>
        </div>
      </div>
      
      ${isEnough ? `
        <div style="margin-top:0.4rem; font-size:0.75rem; color:rgba(16, 185, 129, 0.9); font-weight:600;">
          💡 Te quedan de sobrante libre: <strong>+$${formatMoney(diff)}</strong>
        </div>
      ` : `
        <div style="margin-top:0.4rem; font-size:0.75rem; color:rgba(239, 68, 68, 0.9); font-weight:600;">
          🚨 El saldo actual en tus cuentas de débito y efectivo no cubre todas las cuotas marcadas.
        </div>
      `}
    </div>
  `;

  container.innerHTML = sorted.map((debt, idx) => {
    const acc = accounts.find(a => a.id === debt.cuenta_id);
    const name = acc ? acc.nombre : 'Deuda';
    const isOverdue = checkIsOverdue(debt);
    const isChecked = selectedOptDebtIds.has(debt.id);
    const isFirst = idx === 0 && isOverdue;

    const limiteDate = new Date(debt.fecha_limite_pago);
    limiteDate.setHours(0, 0, 0, 0);
    const diffTime = limiteDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7 && !isOverdue;

    const dueDay = limiteDate.getDate();
    const isFirstFortnight = dueDay >= 1 && dueDay <= 14;
    const fortnightBadge = isFirstFortnight ? `
      <span class="badge-fortnight-first" style="font-size: 0.65rem; padding: 1px 6px; border-radius: 6px; flex-shrink: 0;" title="Pagar con ingresos del 30/31">
        Q1 (1-14)
      </span>
    ` : `
      <span class="badge-fortnight-second" style="font-size: 0.65rem; padding: 1px 6px; border-radius: 6px; flex-shrink: 0;" title="Pagar con ingresos del 15/16">
        Q2 (15-31)
      </span>
    `;

    return `
      <div class="opt-step-item" style="padding:0.75rem 0.85rem; margin-bottom:0.5rem; border-radius:12px; background:${isChecked ? (isFirst ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)') : 'rgba(255,255,255,0.01)'}; border:1px solid ${isChecked ? (isFirst ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.04)'}; opacity:${isChecked ? '1' : '0.55'}; transition: var(--transition);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1;">
            <input type="checkbox" class="opt-debt-check" data-id="${debt.id}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer; flex-shrink:0;">
            <span style="font-size:0.8rem; font-weight:800; width:22px; height:22px; border-radius:50%; background:${isOverdue ? 'rgba(239,68,68,0.2)' : (isDueSoon ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)')}; color:${isOverdue ? '#ef4444' : (isDueSoon ? '#fb923c' : '#10b981')}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${idx + 1}
            </span>
            <div style="min-width:0; flex:1;">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap: wrap;">
                <strong style="font-size:0.9rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(name)}</strong>
                ${fortnightBadge}
                <span style="font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:6px; ${isOverdue ? 'background:rgba(239,68,68,0.2); color:#ef4444;' : (isDueSoon ? 'background:rgba(245,158,11,0.2); color:#fb923c;' : 'background:rgba(16,185,129,0.2); color:#10b981;')} flex-shrink:0;">
                  ${isOverdue ? 'VENCIDA' : (isDueSoon ? (daysUntilDue === 0 ? 'VENCE HOY' : `VENCE EN ${daysUntilDue} D.`) : 'AL DÍA')}
                </span>
              </div>
              <span style="font-size:0.75rem; color:var(--text-muted);">Cuota: $${formatMoney(debt.pago_minimo)} • ${debt.tasa_interes_ea}% E.A.</span>
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <span style="font-size:0.95rem; font-weight:700; color:${isOverdue ? '#fca5a5' : '#fff'}; display:block;">$${formatMoney(debt.saldo_total)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCashFlowReport() {
  const container = document.getElementById('cash-flow-report-content');
  if (!container) return;

  const getPayoffCost = (d, name) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('rapicredit')) {
      return 299602; // Discounted payoff cost today
    }
    return Number(d.saldo_total);
  };

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // Calculate total liquid funds first to determine budget and adjustments
  let availableLiquidity = 0;
  accounts.forEach(a => {
    const isLinkedToDebt = debts.some(d => d.cuenta_id === a.id);
    if (!isLinkedToDebt && (a.tipo === 'DEBITO' || a.tipo === 'EFECTIVO')) {
      availableLiquidity += Math.max(0, Number(a.saldo_actual));
    }
  });

  const budgetBox = document.getElementById('cash-flow-budget');
  if (budgetBox) {
    budgetBox.innerText = `$${formatMoney(Math.round(availableLiquidity))}`;
  }

  const budget = availableLiquidity;

  // 1. Calculate Monthly Incomes (all type INGRESO transactions in the last 30 days)
  let monthlyIncome = 0;
  transactions.forEach(t => {
    const txDate = new Date(t.fecha_transaccion);
    if (t.tipo === 'INGRESO' && txDate >= thirtyDaysAgo) {
      monthlyIncome += Number(t.monto);
    }
  });

  // Fallback to the sum of all type INGRESO transactions if none in the last 30 days
  if (monthlyIncome === 0) {
    transactions.forEach(t => {
      if (t.tipo === 'INGRESO') {
        monthlyIncome += Number(t.monto);
      }
    });
  }

  // 2. Calculate Egresos Fijos (Sum of all active debts' monthly payments)
  const activeDebts = debts.filter(d => Number(d.saldo_total) > 0);
  let monthlyExpenses = 0;
  activeDebts.forEach(d => {
    monthlyExpenses += Number(d.pago_minimo);
  });

  // 3. Classify Expenses by Concept (Vivienda/Arriendo, Servicios Públicos, Deudas/Créditos, Otros)
  let housingExpenses = 0;
  let utilityExpenses = 0;
  let creditExpenses = 0;
  let otherExpenses = 0;

  let housingDetails = [];
  let utilityDetails = [];
  let creditDetails = [];
  let otherDetails = [];

  activeDebts.forEach(d => {
    const acc = accounts.find(a => a.id === d.cuenta_id);
    const name = acc ? acc.nombre : 'Deuda';
    const nameLower = name.toLowerCase();
    const tipo = acc ? acc.tipo : '';
    const minVal = Number(d.pago_minimo);

    if (nameLower.includes('arriendo') || nameLower.includes('apto') || nameLower.includes('apartamento') || nameLower.includes('vivienda') || nameLower.includes('habitación')) {
      housingExpenses += minVal;
      housingDetails.push(`${name}: $${formatMoney(minVal)}`);
    } else if (tipo === 'SERVICIO') {
      utilityExpenses += minVal;
      utilityDetails.push(`${name}: $${formatMoney(minVal)}`);
    } else if (tipo === 'CREDITO') {
      creditExpenses += minVal;
      creditDetails.push(`${name}: $${formatMoney(minVal)}`);
    } else {
      otherExpenses += minVal;
      otherDetails.push(`${name}: $${formatMoney(minVal)}`);
    }
  });

  const housingTitle = housingDetails.length > 0 ? `Conceptos:\n${housingDetails.join('\n')}` : 'No hay gastos de vivienda registrados';
  const utilityTitle = utilityDetails.length > 0 ? `Conceptos:\n${utilityDetails.join('\n')}` : 'No hay servicios registrados';
  const creditTitle = creditDetails.length > 0 ? `Conceptos:\n${creditDetails.join('\n')}` : 'No hay créditos registrados';
  const otherTitle = otherDetails.length > 0 ? `Conceptos:\n${otherDetails.join('\n')}` : 'No hay otros compromisos registrados';

  // 4. Calculate and group variable expenses (transactions of type GASTO in the last 30 days, excluding debt payments)
  const variableGastosMap = {};
  let totalVariableExpenses = 0;

  transactions.forEach(t => {
    const txDate = new Date(t.fecha_transaccion);
    if (t.tipo === 'GASTO' && txDate >= thirtyDaysAgo) {
      const desc = t.descripcion;
      const descLower = desc.toLowerCase();
      // Skip debt payments to avoid double-counting
      if (descLower.includes('pago cuota') || descLower.includes('pago de cuota') || descLower.includes('abono a')) {
        return;
      }
      
      totalVariableExpenses += Number(t.monto);
      
      const key = desc.trim();
      if (!variableGastosMap[key]) {
        variableGastosMap[key] = { amount: 0, count: 0 };
      }
      variableGastosMap[key].amount += Number(t.monto);
      variableGastosMap[key].count += 1;
    }
  });


  // 5. Net Cash Flow calculation including variables
  const netCashFlow = monthlyIncome - monthlyExpenses - totalVariableExpenses;
  const isDeficit = netCashFlow < 0;

  // Helper to calculate recent payments made in the current billing cycle for a debt or service
  const getRecentPaidForDebt = (debtObj) => {
    const acc = accounts.find(a => a.id === debtObj.cuenta_id);
    const accName = acc ? acc.nombre.toLowerCase() : '';
    
    // Look at GASTO transactions registered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const paidTx = transactions.filter(t => {
      if (t.tipo !== 'GASTO') return false;
      const txDate = new Date(t.fecha_transaccion);
      if (txDate < thirtyDaysAgo) return false;

      const isSameAccount = debtObj.cuenta_id && t.cuenta_id === debtObj.cuenta_id;
      const isDescMatch = t.descripcion && accName && t.descripcion.toLowerCase().includes(accName);
      return isSameAccount || isDescMatch;
    });

    return paidTx.reduce((sum, t) => sum + Number(t.monto), 0);
  };

  // 6. Intelligent Quincenal Payment & Cash Flow Optimization Engine
  const creditDebts = [];
  const serviceDebts = [];

  activeDebts.forEach(d => {
    const acc = accounts.find(a => a.id === d.cuenta_id);
    const name = acc ? acc.nombre : 'Deuda';
    const isCredit = acc && acc.tipo === 'CREDITO';

    const dObj = {
      id: d.id,
      cuenta_id: d.cuenta_id,
      name,
      saldo: Number(d.saldo_total),
      cuota: Number(d.pago_minimo),
      fecha: new Date(d.fecha_limite_pago),
      tasa: Number(d.tasa_interes_ea) || 0,
      cost: getPayoffCost(d, name),
      isCredit
    };
    
    if (isCredit) {
      creditDebts.push(dObj);
    } else {
      serviceDebts.push(dObj);
    }
  });

  // (availableLiquidity and budget have been calculated at the start of the report)

  // Determine current quincena cycle limits
  const currentDate = new Date();
  currentDate.setHours(0,0,0,0);
  
  // Q1 is days 1-14, Q2 is 15-31.
  // If today is Aug 29, we are looking at debts due up to Sept 14th (Q1 cycle of next month)
  // Let's set the cycle end date dynamically to the 14th of the current or next month.
  const cycleEnd = new Date(currentDate);
  if (currentDate.getDate() <= 14) {
    cycleEnd.setDate(14);
  } else {
    // We are at the end of the month, so the Q1 cycle ends on the 14th of the NEXT month
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    cycleEnd.setDate(14);
  }

  const isCurrentCycle = (fecha) => {
    return fecha <= cycleEnd || fecha < currentDate;
  };

  // Debts due in the current cycle
  const cycleServices = serviceDebts.filter(d => isCurrentCycle(d.fecha));
  const cycleCredits = creditDebts.filter(d => isCurrentCycle(d.fecha));

  // Run the dynamic prioritization algorithm
  let remainingBudget = budget;
  const paymentRoute = [];
  const postponedList = [];
  let totalFreedFlow = 0;

  // Step 1: Cover critical services/housing due in current cycle (e.g. Cadena Q1)
  cycleServices.sort((a, b) => a.fecha - b.fecha);
  cycleServices.forEach(s => {
    if (s.cuota <= 0) return;
    if (remainingBudget >= s.cuota) {
      paymentRoute.push({
        name: s.name,
        amount: s.cuota,
        status: 'Pago Completo',
        desc: `Obligación fija/vivienda vence el ${formatDateOnly(s.fecha)}.`,
        freed: 0,
        icon: 'fa-house-chimney',
        color: '#c084fc'
      });
      remainingBudget -= s.cuota;
    } else if (remainingBudget > 0) {
      paymentRoute.push({
        name: s.name,
        amount: remainingBudget,
        status: 'Abono Parcial',
        desc: `Abonas $${formatMoney(remainingBudget)} de la cuota de $${formatMoney(s.cuota)} vence el ${formatDateOnly(s.fecha)}.`,
        freed: 0,
        icon: 'fa-house-chimney',
        color: '#c084fc'
      });
      remainingBudget = 0;
    } else {
      postponedList.push(s);
    }
  });

  // Step 2: Try to liquidate credits (starting with high efficiency: cuota / cost desc)
  // Let's sort ALL active credits by payoff efficiency (cuota / cost) desc
  const allActiveCredits = creditDebts.filter(c => c.saldo > 0);
  allActiveCredits.sort((a, b) => (b.cuota / b.cost) - (a.cuota / a.cost));

  allActiveCredits.forEach(c => {
    // If we can clear it completely
    if (remainingBudget >= c.cost) {
      paymentRoute.push({
        name: c.name,
        amount: c.cost,
        status: 'Liquidación TOTAL',
        desc: `Eliminas saldo completo ($${formatMoney(c.saldo)}) con ahorro. ¡Deuda extinguida!`,
        freed: c.cuota,
        icon: 'fa-circle-check',
        color: '#34d399'
      });
      totalFreedFlow += c.cuota;
      remainingBudget -= c.cost;
    } else {
      // If it is due in this cycle, we must at least pay the minimum cuota if budget allows
      const isDueSoon = isCurrentCycle(c.fecha);
      if (isDueSoon) {
        if (remainingBudget >= c.cuota) {
          paymentRoute.push({
            name: c.name,
            amount: c.cuota,
            status: 'Cuota Mínima',
            desc: `Cubre cuota obligatoria del ciclo vence el ${formatDateOnly(c.fecha)}.`,
            freed: 0,
            icon: 'fa-credit-card',
            color: '#fda4af'
          });
          remainingBudget -= c.cuota;
        } else if (remainingBudget > 0) {
          paymentRoute.push({
            name: c.name,
            amount: remainingBudget,
            status: 'Abono Parcial',
            desc: `Abono de $${formatMoney(remainingBudget)} a la cuota mínima de $${formatMoney(c.cuota)} vence el ${formatDateOnly(c.fecha)}.`,
            freed: 0,
            icon: 'fa-credit-card',
            color: '#fda4af'
          });
          remainingBudget = 0;
        } else {
          postponedList.push(c);
        }
      }
    }
  });

  // Step 3: Put remaining budget as abonos to high interest rate credits if any remains
  if (remainingBudget > 0) {
    // Find the highest interest rate credit that is not fully paid in this route
    const remainingCredits = allActiveCredits.filter(c => !paymentRoute.some(pr => pr.name === c.name && pr.status === 'Liquidación TOTAL'));
    remainingCredits.sort((a, b) => b.tasa - a.tasa);
    if (remainingCredits.length > 0) {
      const bestc = remainingCredits[0];
      paymentRoute.push({
        name: bestc.name,
        amount: remainingBudget,
        status: 'Abono Extra',
        desc: `Abono voluntario para amortizar capital con tasa del ${bestc.tasa}% E.A.`,
        freed: 0,
        icon: 'fa-bolt',
        color: '#fb923c'
      });
      remainingBudget = 0;
    }
  }

  // Build Route HTML
  let routeStepsHTML = '';
  if (paymentRoute.length > 0) {
    routeStepsHTML = paymentRoute.map((step, idx) => `
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); padding: 0.7rem; border-radius: 12px; display: flex; gap: 0.6rem; align-items: flex-start;">
        <span style="font-size: 1.15rem; color: ${step.color}; margin-top: 0.1rem;"><i class="fa-solid ${step.icon}"></i></span>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #fff; font-size: 0.8rem;">Paso ${idx + 1}: ${escapeHTML(step.name)}</strong>
            <span style="font-size: 0.7rem; padding: 2px 7px; border-radius: 6px; background: ${step.status.includes('TOTAL') ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${step.status.includes('TOTAL') ? '#34d399' : 'var(--text-muted)'}; font-weight: 700;">
              ${step.status}
            </span>
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.15rem 0 0.3rem; line-height: 1.3;">${step.desc}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 0.25rem; margin-top: 0.25rem;">
            <span style="color: var(--text-muted);">Monto a pagar:</span>
            <strong style="color: ${step.color};">$${formatMoney(step.amount)}</strong>
          </div>
          ${step.freed > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #34d399; margin-top: 0.15rem;">
              <span>Libera de cuota fija:</span>
              <strong>+$${formatMoney(step.freed)} / mes</strong>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  } else {
    routeStepsHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">
        No hay pagos recomendados para esta quincena con el presupuesto ingresado.
      </div>
    `;
  }

  // Build Postponed HTML
  let postponedHTML = '';
  // Remove duplicates from postponed list (if covered partially or fully, don't show as delayed)
  const uniquePostponed = postponedList.filter(p => !paymentRoute.some(pr => pr.name === p.name && (pr.status === 'Liquidación TOTAL' || pr.status === 'Pago Completo')));
  
  if (uniquePostponed.length > 0) {
    const listHTML = uniquePostponed.map(p => `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; padding: 0.25rem 0; border-bottom: 1px dashed rgba(255,255,255,0.03);">
        <span style="color: var(--text-muted);"><i class="fa-solid fa-calendar-xmark text-danger" style="margin-right: 0.3rem;"></i> ${escapeHTML(p.name)}:</span>
        <strong style="color: #fca5a5;">$${formatMoney(p.cuota)} (Vence ${formatDateOnly(p.fecha)})</strong>
      </div>
    `).join('');

    postponedHTML = `
      <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.85rem; border-radius: 14px; margin-top: 0.5rem;">
        <strong style="color: #fca5a5; font-size: 0.8rem; display:block; margin-bottom: 0.4rem;"><i class="fa-solid fa-clock-rotate-left"></i> Deudas Postergadas para el 15 de Septiembre</strong>
        <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0 0 0.5rem; line-height: 1.35;">
          Estas deudas se postergan para ser cubiertas el 15 de Septiembre con el ingreso de <strong>Nómina Asistia</strong>. 
          Los intereses de mora por estos días de retraso son insignificantes comparados con la liquidez y descuentos ganados hoy.
        </p>
        ${listHTML}
      </div>
    `;
  }

  // Summary Alert of survival buffer
  let survivalAlertHTML = '';
  if (remainingBudget > 0) {
    const isTight = remainingBudget < 100000;
    survivalAlertHTML = `
      <div style="background: ${isTight ? 'rgba(251, 146, 60, 0.06)' : 'rgba(16, 185, 129, 0.06)'}; border: 1px solid ${isTight ? 'rgba(251, 146, 60, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; padding: 0.75rem; border-radius: 12px; margin-top: 0.5rem; font-size: 0.75rem;">
        <strong style="color: ${isTight ? '#fdba74' : '#34d399'}; display:block; margin-bottom: 0.15rem;">
          <i class="fa-solid ${isTight ? 'fa-triangle-exclamation' : 'fa-wallet'}"></i> Colchón de Supervivencia Libre: $${formatMoney(remainingBudget)}
        </strong>
        <p style="color: var(--text-muted); margin: 0; line-height: 1.3;">
          ${isTight 
            ? '⚠️ <strong>¡Atención!</strong> Tu colchón restante es ajustado. Asegúrate de tener suficiente para tanquear tu moto (gasolina) y tus gastos diarios hasta el 15.'
            : '✅ Tienes un colchón de caja cómodo para tus gastos diarios y gasolina hasta recibir tu próximo pago.'
          }
        </p>
      </div>
    `;
  } else {
    survivalAlertHTML = `
      <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.75rem; border-radius: 12px; margin-top: 0.5rem; font-size: 0.75rem;">
        <strong style="color: #fca5a5; display:block; margin-bottom: 0.15rem;"><i class="fa-solid fa-triangle-exclamation"></i> Colchón de Supervivencia Agotado ($0)</strong>
        <p style="color: var(--text-muted); margin: 0; line-height: 1.3;">
          ⚠️ <strong>Riesgo de liquidez crítico</strong>. Has asignado el 100% de tu disponible. Se aconseja reducir abonos para conservar efectivo para transporte y comida.
        </p>
      </div>
    `;
  }

  // 6b. Calculate Sept 15 Paycheck Simulation (Q2)
  const nextPaycheck = 2696444; // Nomina Asistia on Sept 15
  
  // Regular Q2 fixed bills (due days 15-31)
  const q2Services = serviceDebts.filter(d => {
    const day = d.fecha.getDate();
    return d.saldo > 0 && day >= 15 && day <= 31 && d.cuota > 0;
  });

  const fullyCoveredIds = paymentRoute
    .filter(step => step.status === 'Liquidación TOTAL' || step.status === 'Pago Completo')
    .map(step => {
      const matchedDebt = activeDebts.find(d => {
        const acc = accounts.find(a => a.id === d.cuenta_id);
        return acc && acc.nombre === step.name;
      });
      return matchedDebt ? matchedDebt.id : null;
    })
    .filter(id => id !== null);

  const q1Postponed = [];
  activeDebts.forEach(d => {
    if (fullyCoveredIds.includes(d.id)) return;
    const acc = accounts.find(a => a.id === d.cuenta_id);
    const name = acc ? acc.nombre : 'Deuda';
    
    // Ignore overdue long-term credit cards/loans which are in Mora Crítica
    if (name.includes('Credito libre')) return;

    const isCredit = acc && acc.tipo === 'CREDITO';
    const dueDate = new Date(d.fecha_limite_pago);
    const dueDay = dueDate.getDate();
    const dueMonth = dueDate.getMonth();
    const isOverdue = dueDate < currentDate;
    const isQ1 = (dueMonth === cycleEnd.getMonth() && dueDay >= 1 && dueDay <= 14) || isOverdue;

    if (isQ1) {
      let remainingCuota = Number(d.pago_minimo);

      const partialStep = paymentRoute.find(pr => pr.name === name && (pr.status === 'Abono Parcial' || pr.status === 'Cuota Mínima'));
      if (partialStep) {
        remainingCuota = Math.max(0, remainingCuota - partialStep.amount);
      }
      if (remainingCuota > 0) {
        q1Postponed.push({
          name,
          amount: remainingCuota,
          fecha: new Date(d.fecha_limite_pago),
          isCredit
        });
      }
    }
  });

  const q2Obligations = [];
  q2Services.forEach(s => {
    q2Obligations.push({
      name: s.name,
      amount: s.cuota,
      fecha: s.fecha,
      type: 'Servicios/Arriendos'
    });
  });
  q1Postponed.forEach(p => {
    q2Obligations.push({
      name: p.name,
      amount: p.amount,
      fecha: p.fecha,
      type: 'Crédito Postergado'
    });
  });

  q2Obligations.sort((a, b) => a.fecha - b.fecha);

  const totalQ2Payments = q2Obligations.reduce((sum, ob) => sum + ob.amount, 0);
  const q2Surplus = nextPaycheck - totalQ2Payments;
  const hasQ2Surplus = q2Surplus >= 0;

  let q2SimulationHTML = '';
  if (q2Obligations.length > 0) {
    const obListHTML = q2Obligations.map(ob => `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; padding: 0.25rem 0; border-bottom: 1px dashed rgba(255,255,255,0.03);">
        <span style="color: var(--text-muted);">
          <i class="fa-solid ${ob.type.includes('Servicio') ? 'fa-house-chimney text-purple' : 'fa-credit-card text-pink'}" style="margin-right: 0.3rem; font-size: 0.7rem;"></i> 
          ${escapeHTML(ob.name)} <span style="font-size:0.65rem; color:#94a3b8;">(${ob.type})</span>:
        </span>
        <strong style="color: #fff;">$${formatMoney(ob.amount)} <span style="font-size:0.65rem; color:var(--text-muted); font-weight:normal;">(vence ${ob.fecha.getDate()})</span></strong>
      </div>
    `).join('');

    const criticalMoraDebts = activeDebts.filter(d => {
      if (fullyCoveredIds.includes(d.id)) return false;
      const acc = accounts.find(a => a.id === d.cuenta_id);
      const name = acc ? acc.nombre : '';
      return name.includes('Credito libre');
    });

    let moraSectionHTML = '';
    if (criticalMoraDebts.length > 0) {
      const moraItems = criticalMoraDebts.map(d => {
        const acc = accounts.find(a => a.id === d.cuenta_id);
        const name = acc ? acc.nombre : 'Crédito';
        const limiteDate = new Date(d.fecha_limite_pago);
        const diffTime = currentDate.getTime() - limiteDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const cuotasVencidas = Math.max(1, Math.ceil(diffDays / 30));
        const montoMora = cuotasVencidas * Number(d.pago_minimo);
        return `<p style="margin: 0.15rem 0; color: #fca5a5;">• <strong>${escapeHTML(name)}</strong>: $${formatMoney(montoMora)} en mora (${cuotasVencidas} cuotas)</p>`;
      }).join('');

      moraSectionHTML = `
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.65rem 0.8rem; border-radius: 10px; margin-top: 0.6rem; font-size: 0.7rem;">
          <strong style="color: #fca5a5; display:block; margin-bottom: 0.2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Deudas en Mora Crítica (Fuera de Presupuesto)</strong>
          ${moraItems}
          <p style="color: var(--text-muted); margin: 0.3rem 0 0; line-height: 1.3;">
            Estas obligaciones superan tu flujo de caja quincenal. Requieren refinanciación directa o usar tu excedente para abonos de negociación.
          </p>
        </div>
      `;
    }

    q2SimulationHTML = `
      <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.12); padding: 0.85rem; border-radius: 14px; margin-top: 0.6rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <strong style="color: #6ee7b7; font-size: 0.8rem;"><i class="fa-solid fa-scale-balanced"></i> Plan Quincenal (15 de Septiembre)</strong>
          <span style="font-size: 0.7rem; color: #6ee7b7; font-weight: 700; background: rgba(110, 231, 183, 0.15); padding: 1px 7px; border-radius: 6px;">Nómina: +$2.696.444</span>
        </div>
        <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0 0 0.5rem; line-height: 1.35;">
          Proyección de flujo para cubrir vivienda, servicios Q2 y cuotas aplazadas del ciclo anterior:
        </p>
        ${obListHTML}
        
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 700; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem; margin-top: 0.4rem; color: ${hasQ2Surplus ? '#6ee7b7' : '#fca5a5'};">
          <span>${hasQ2Surplus ? 'Excedente Libre Estimado:' : 'Déficit Estimado:'}</span>
          <span>$${formatMoney(Math.abs(q2Surplus))}</span>
        </div>
        ${moraSectionHTML}
      </div>
    `;
  }

  recommendationHTML = `
    <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="font-size: 0.85rem; color: #a7f3d0; margin: 0;"><i class="fa-solid fa-route"></i> Ruta de Pago Inteligente (Ciclo Actual)</h4>
        ${totalFreedFlow > 0 ? `<span style="font-size: 0.7rem; color: #34d399; font-weight: 700; background: rgba(52, 211, 153, 0.15); padding: 2px 8px; border-radius: 6px;">Libera: $${formatMoney(totalFreedFlow)}/mes</span>` : ''}
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.2rem;">
        ${routeStepsHTML}
      </div>
      
      ${survivalAlertHTML}
      ${postponedHTML}
      ${q2SimulationHTML}
    </div>
  `;

  // 7. Group Variable Expenses HTML
  let variableGastosHTML = '';
  if (totalVariableExpenses > 0) {
    const sortedKeys = Object.keys(variableGastosMap).sort((a, b) => variableGastosMap[b].amount - variableGastosMap[a].amount);
    const itemsHTML = sortedKeys.map(key => {
      const item = variableGastosMap[key];
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <span style="color: var(--text-muted);"><i class="fa-solid fa-tag" style="font-size: 0.7rem; width: 14px; color:#fb923c;"></i> ${escapeHTML(key)} (${item.count}x):</span>
          <strong style="color: #fff;">$${formatMoney(item.amount)}</strong>
        </div>
      `;
    }).join('');

    variableGastosHTML = `
      <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); padding: 0.85rem; border-radius: 14px;">
        <h4 style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">
          <i class="fa-solid fa-basket-shopping text-warning"></i> Gastos Variables (Últimos 30d)
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem;">
          ${itemsHTML}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed rgba(255,255,255,0.05); font-weight: 800;">
            <span style="color: var(--text-main);">Total Variables:</span>
            <strong style="color: #fb923c;">$${formatMoney(totalVariableExpenses)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // 8. Build HTML
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
      
      <!-- Cash Flow Gauge -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 14px; background: ${isDeficit ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'}; border: 1px solid ${isDeficit ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'};">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Flujo de Caja Real Neto</span>
          <strong style="font-size: 1.35rem; font-weight: 800; color: ${isDeficit ? '#fca5a5' : '#a7f3d0'};">$${isDeficit ? '-' : '+'}${formatMoney(Math.abs(netCashFlow))} / mes</strong>
        </div>
        <span style="font-size: 0.75rem; padding: 3px 10px; border-radius: 20px; font-weight: 800; background: ${isDeficit ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${isDeficit ? '#ef4444' : '#10b981'};">
          ${isDeficit ? '⚠️ DÉFICIT' : '✅ SUPERÁVIT'}
        </span>
      </div>

      <!-- Incomes vs Egresos Info -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: 12px;">
          <span style="font-size: 0.7rem; color: var(--text-muted); display:block; text-transform: uppercase;">Ingresos (30d)</span>
          <strong style="font-size: 1rem; color: #fff;">$${formatMoney(monthlyIncome)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: 12px;">
          <span style="font-size: 0.7rem; color: var(--text-muted); display:block; text-transform: uppercase;">Gastos Fijos / Cuotas</span>
          <strong style="font-size: 1rem; color: #fff;">$${formatMoney(monthlyExpenses)}</strong>
        </div>
      </div>

      <!-- Breakdown Table / Lists -->
      <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); padding: 0.85rem; border-radius: 14px;">
        <h4 style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">
          <i class="fa-solid fa-chart-pie text-secondary"></i> Gastos Fijos por Concepto
        </h4>
        
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: help;" title="${escapeHTML(housingTitle)}">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-house-chimney" style="width: 16px; color:#c084fc; margin-right: 0.35rem;"></i> Vivienda / Arriendos:</span>
            <strong style="color: #fff;">$${formatMoney(housingExpenses)}</strong>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: help;" title="${escapeHTML(utilityTitle)}">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-lightbulb" style="width: 16px; color:#60a5fa; margin-right: 0.35rem;"></i> Servicios Públicos:</span>
            <strong style="color: #fff;">$${formatMoney(utilityExpenses)}</strong>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: help;" title="${escapeHTML(creditTitle)}">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-credit-card" style="width: 16px; color:#fda4af; margin-right: 0.35rem;"></i> Créditos y Deudas:</span>
            <strong style="color: #fff;">$${formatMoney(creditExpenses)}</strong>
          </div>
          
          ${otherExpenses > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: help;" title="${escapeHTML(otherTitle)}">
              <span style="color: var(--text-muted);"><i class="fa-solid fa-wallet" style="width: 16px; color:#a7f3d0; margin-right: 0.35rem;"></i> Otros Compromisos:</span>
              <strong style="color: #fff;">$${formatMoney(otherExpenses)}</strong>
            </div>
          ` : ''}

        </div>
      </div>

      <!-- Variable Expenses -->
      ${variableGastosHTML}

      <!-- Live Recommendation -->
      ${recommendationHTML}
    </div>
  `;
}

// 4. Form Selects Population
function populateAccountSelects() {
  const selects = ['tx-cuenta', 'debt-cuenta'];
  
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const placeholder = id === 'tx-cuenta' ? 'Selecciona Cuenta' : 'Asociar a Cuenta';
    el.innerHTML = `
      <option value="" disabled selected>${placeholder}</option>
      ${accounts.map(acc => `<option value="${acc.id}">${escapeHTML(acc.nombre)} (${acc.tipo})</option>`).join('')}
    `;
  });
}

function populateDebtSelect() {
  const el = document.getElementById('sim-target-debt');
  if (!el) return;
  
  const currentValue = el.value;
  el.innerHTML = `
    <option value="auto">Automático (Según orden de optimización)</option>
    ${debts.map(d => {
      const acc = accounts.find(a => a.id === d.cuenta_id);
      const name = acc ? acc.nombre : 'Deuda';
      return `<option value="${d.id}">${escapeHTML(name)} ($${formatMoney(d.saldo_total)})</option>`;
    }).join('')}
  `;
  
  if (debts.some(d => d.id === currentValue) || currentValue === 'auto') {
    el.value = currentValue;
  } else {
    el.value = 'auto';
  }
}

function setupMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-nav-tabs .nav-tab');
  const cols = document.querySelectorAll('.dashboard-grid .grid-col');

  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (target === 'col-all') {
        cols.forEach(c => c.classList.remove('mobile-hidden'));
      } else {
        cols.forEach(c => {
          if (c.classList.contains(target)) {
            c.classList.remove('mobile-hidden');
          } else {
            c.classList.add('mobile-hidden');
          }
        });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// 5. Setup Events Listeners
function setupEventListeners() {
  setupMobileTabs();

  // Toggle Samsung S25 Plus Mobile View Simulation
  const simBtn = document.getElementById('btn-toggle-sim-mobile');
  if (simBtn) {
    simBtn.addEventListener('click', () => {
      document.body.classList.toggle('device-sim-active');
      simBtn.classList.toggle('active');
      const isSim = document.body.classList.contains('device-sim-active');
      simBtn.querySelector('span').textContent = isSim ? 'Vista Desktop' : 'Vista Celular';
    });
  }

  // Toggle Forms
  setupFormToggle('btn-show-add-account', 'form-add-account', 'btn-cancel-account');
  setupFormToggle('btn-show-add-debt', 'form-add-debt', 'btn-cancel-debt');
  setupFormToggle('btn-show-add-transaction', 'form-add-transaction', 'btn-cancel-tx');

  // Submit Add Account
  document.getElementById('form-add-account').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('acc-nombre').value;
    const tipo = document.getElementById('acc-tipo').value;
    const saldo_actual = document.getElementById('acc-saldo').value;

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, tipo, saldo_actual })
      });
      const data = await res.json();
      if (data.status === 'success') {
        document.getElementById('form-add-account').reset();
        document.getElementById('form-add-account').classList.add('hidden');
        await loadData();
        checkAPIStatus();
      }
    } catch (err) {
      alert('Error al registrar cuenta.');
    }
  });

  // Submit Add Debt
  document.getElementById('form-add-debt').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuenta_id = document.getElementById('debt-cuenta').value;
    const saldo_total = document.getElementById('debt-saldo').value;
    const tasa_interes_ea = document.getElementById('debt-tasa').value;
    const pago_minimo = document.getElementById('debt-pago').value;
    const fecha_corte = document.getElementById('debt-corte').value;
    const fecha_limite_pago = document.getElementById('debt-limite').value;
    const cubierto_por_val = document.getElementById('debt-cubierto-por') ? document.getElementById('debt-cubierto-por').value.trim() : '';

    try {
      const res = await fetch(`${API_BASE}/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuenta_id,
          saldo_total,
          tasa_interes_ea,
          pago_minimo,
          fecha_corte,
          fecha_limite_pago,
          cubierto_por: cubierto_por_val !== '' ? cubierto_por_val : null
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        document.getElementById('form-add-debt').reset();
        document.getElementById('form-add-debt').classList.add('hidden');
        await loadData();
      }
    } catch (err) {
      alert('Error al registrar deuda.');
    }
  });

  // Submit Add Transaction
  document.getElementById('form-add-transaction').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuenta_id = document.getElementById('tx-cuenta').value;
    const tipo = document.getElementById('tx-tipo').value;
    const monto = document.getElementById('tx-monto').value;
    const descripcion = document.getElementById('tx-descripcion').value;
    const fecha_transaccion = document.getElementById('tx-fecha').value;

    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuenta_id,
          tipo,
          monto,
          descripcion,
          fecha_transaccion
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        document.getElementById('form-add-transaction').reset();
        document.getElementById('form-add-transaction').classList.add('hidden');
        await loadData();
      }
    } catch (err) {
      alert('Error al registrar transacción.');
    }
  });

  // Webhook Simulator submit
  const webhookForm = document.getElementById('form-webhook');
  if (webhookForm) {
    webhookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('webhook-feedback');
      const cuenta_nombre = document.getElementById('web-cuenta').value;
      const tipo = document.getElementById('web-tipo').value;
      const monto = document.getElementById('web-monto').value;
      const descripcion = document.getElementById('web-descripcion').value;

      feedback.className = 'feedback-msg hidden';
      feedback.innerText = '';

      try {
        const res = await fetch(`${API_BASE}/webhooks/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cuenta_nombre,
            monto: Number(monto),
            tipo,
            fecha: new Date().toISOString(),
            descripcion
          })
        });

        const data = await res.json();
        if (data.status === 'success') {
          feedback.className = 'feedback-msg success';
          feedback.innerText = `Éxito: Transacción registrada. Cuenta ${cuenta_nombre} actualizada.`;
          webhookForm.reset();
          await loadData();
        } else {
          feedback.className = 'feedback-msg error';
          feedback.innerText = `Error: ${data.message || 'Error en el servidor.'}`;
        }
      } catch (err) {
        feedback.className = 'feedback-msg error';
        feedback.innerText = 'Error al enviar webhook al backend.';
      }
    });
  }

  // Change Prioritization Method
  const methodSelect = document.getElementById('select-method');
  if (methodSelect) {
    methodSelect.addEventListener('change', () => {
      renderOptimizationPlan(methodSelect.value);
    });
  }

  // Cash Flow Budget Input Listener removed

  // Quincena Debt Filters
  const filterAll = document.getElementById('filter-debt-all');
  const filterQ1 = document.getElementById('filter-debt-q1');
  const filterQ2 = document.getElementById('filter-debt-q2');
  
  if (filterAll && filterQ1 && filterQ2) {
    const setFilter = (filterVal, activeBtn, inactiveBtns) => {
      currentDebtFilter = filterVal;
      activeBtn.classList.add('active');
      inactiveBtns.forEach(btn => btn.classList.remove('active'));
      renderDebts();
    };
    
    filterAll.addEventListener('click', () => setFilter('all', filterAll, [filterQ1, filterQ2]));
    filterQ1.addEventListener('click', () => setFilter('q1', filterQ1, [filterAll, filterQ2]));
    filterQ2.addEventListener('click', () => setFilter('q2', filterQ2, [filterAll, filterQ1]));
  }

  // Live input listener for biweekly income adjustment
  document.addEventListener('input', (e) => {
    if (e.target.id === 'input-q1-income' || e.target.id === 'input-q2-income') {
      const val = Number(e.target.value);
      if (!isNaN(val) && val >= 0) {
        localStorage.setItem('apples_custom_quincena_income', val);
        renderDebts();
      }
    }
  });

  // Checkbox selection event in Optimization Plan
  const optListContainer = document.getElementById('optimization-plan-list');
  if (optListContainer) {
    optListContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('opt-debt-check')) {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          selectedOptDebtIds.add(id);
        } else {
          selectedOptDebtIds.delete(id);
        }
        const methodSelect = document.getElementById('select-method');
        const method = methodSelect ? methodSelect.value : 'Bola de Nieve';
        renderOptimizationPlan(method);
      }
    });
  }

  // Run Simulation Button
  const btnRunSim = document.getElementById('btn-run-simulation');
  if (btnRunSim) {
    btnRunSim.addEventListener('click', runSimulation);
  }

  // Auto-fill amount & description when selecting a debt account in transaction form
  document.getElementById('tx-cuenta').addEventListener('change', (e) => {
    const selectedCuentaId = e.target.value;
    const associatedDebt = debts.find(d => d.cuenta_id === selectedCuentaId);
    
    const montoInput = document.getElementById('tx-monto');
    const descInput = document.getElementById('tx-descripcion');
    const tipoSelect = document.getElementById('tx-tipo');

    if (associatedDebt) {
      if (montoInput) {
        montoInput.value = Number(associatedDebt.pago_minimo);
      }
      if (descInput) {
        const accName = associatedDebt.cuenta ? associatedDebt.cuenta.nombre : 'deuda';
        descInput.value = `Pago cuota ${accName}`;
      }
      if (tipoSelect) {
        tipoSelect.value = 'GASTO';
      }
    }
  });

  // Event delegation for delete and debt action buttons
  document.getElementById('accounts-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-account-btn');
    if (btn) {
      const id = btn.dataset.id;
      await deleteAccount(id);
    }
  });

  document.getElementById('debts-list').addEventListener('click', async (e) => {
    const payBtn = e.target.closest('.pay-debt-btn');
    if (payBtn) {
      const id = payBtn.dataset.id;
      await payDebtInstallment(id);
      return;
    }

    const coverOtherBtn = e.target.closest('.cover-other-btn');
    if (coverOtherBtn) {
      const id = coverOtherBtn.dataset.id;
      await promptCoveredByOther(id);
      return;
    }

    const unpaidBtn = e.target.closest('.unpaid-debt-btn');
    if (unpaidBtn) {
      const id = unpaidBtn.dataset.id;
      await markDebtUnpaid(id);
      return;
    }

    const editBtn = e.target.closest('.edit-debt-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      openEditDebtModal(id);
      return;
    }

    const deleteBtn = e.target.closest('.delete-debt-btn');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      await deleteDebt(id);
      return;
    }
  });

  document.getElementById('transactions-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-tx-btn');
    if (btn) {
      const id = btn.dataset.id;
      await deleteTransaction(id);
    }
  });
}

async function markDebtUnpaid(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentLimit = new Date(debt.fecha_limite_pago);
  currentLimit.setHours(0, 0, 0, 0);

  let newLimit = new Date(currentLimit);

  // Si la deuda está actualmente AL DIA (fecha futura u hoy), mover a ayer para forzar estado VENCIDA (1 CUOTA)
  if (currentLimit >= today) {
    newLimit = new Date(today);
    newLimit.setDate(newLimit.getDate() - 1);
  } else {
    // Si ya está vencida, restar 32 días para asegurar el incremento exacto de +1 cuota impaga
    newLimit.setDate(newLimit.getDate() - 32);
  }

  const confirmed = await showConfirm(
    `¿Deseas sumar 1 cuota de mora para ${debt.cuenta ? debt.cuenta.nombre : 'esta deuda'}?\n\nEsto sumará inmediatamente 1 cuota a tus alertas de mora en pantalla.`,
    'Marcar No Pagada'
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/debts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha_limite_pago: newLimit.toISOString()
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    } else {
      alert(`Error al actualizar estado: ${data.message}`);
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

async function payDebtInstallment(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  const pagoMin = Number(debt.pago_minimo);
  const debtAccountName = debt.cuenta ? debt.cuenta.nombre : 'Servicio / Deuda';

  // Buscar la cuenta bancaria de dinero líquido de donde se debitará (DEBITO o EFECTIVO no vinculada a deuda)
  const liquidAccounts = accounts.filter(a => {
    const isDebtAcc = debts.some(d => d.cuenta_id === a.id);
    return !isDebtAcc && (a.tipo === 'DEBITO' || a.tipo === 'EFECTIVO') && Number(a.saldo_actual) > 0;
  });

  const primaryLiquidAcc = liquidAccounts.length > 0 ? liquidAccounts[0] : null;
  const payCuentaId = primaryLiquidAcc ? primaryLiquidAcc.id : debt.cuenta_id;
  const payCuentaName = primaryLiquidAcc ? primaryLiquidAcc.nombre : debtAccountName;

  const confirmed = await showConfirm(
    `¿Deseas registrar el pago de 1 cuota ($${formatMoney(pagoMin)}) para ${debtAccountName} usando tu dinero disponible de ${payCuentaName}?\n\nEsto descontará $${formatMoney(pagoMin)} de tu disponible en ${payCuentaName}, registrará el GASTO en tu Historial y avanzará el recordatorio al próximo mes.`,
    'Abonar Cuota'
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuenta_id: payCuentaId,
        tipo: 'GASTO',
        monto: pagoMin,
        descripcion: `Pago cuota ${debtAccountName}`,
        fecha_transaccion: new Date().toISOString()
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    } else {
      alert(`Error al abonar cuota: ${data.message}`);
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

function openEditDebtModal(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  document.getElementById('edit-debt-id').value = debt.id;
  document.getElementById('edit-debt-nombre').value = debt.cuenta ? debt.cuenta.nombre : 'Deuda';
  document.getElementById('edit-debt-saldo').value = Number(debt.saldo_total);
  document.getElementById('edit-debt-pago').value = Number(debt.pago_minimo);
  if (document.getElementById('edit-debt-cubierto-por')) {
    document.getElementById('edit-debt-cubierto-por').value = debt.cubierto_por || '';
  }

  const limitDate = parseLocalDate(debt.fecha_limite_pago);
  const dateStr = limitDate.toISOString().split('T')[0];
  document.getElementById('edit-debt-limite').value = dateStr;

  document.getElementById('edit-debt-modal').classList.remove('hidden');
}

async function promptCoveredByOther(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  const currentCovered = debt.cubierto_por || '';
  const debtName = debt.cuenta ? debt.cuenta.nombre : 'esta deuda';
  const val = prompt(
    `Indica quién cubrió o pagará la cuota/deuda de "${debtName}" (Ej: Esposa, Mamá, Empresa):\n\n(Deja en blanco y pulsa Aceptar para quitar la marca de tercero):`,
    currentCovered
  );

  if (val === null) return; // Cancelado

  try {
    const res = await fetch(`${API_BASE}/debts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cubierto_por: val.trim() !== '' ? val.trim() : null
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    } else {
      alert(`Error al actualizar cobertura: ${data.message}`);
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

function setupEditDebtForm() {
  const modal = document.getElementById('edit-debt-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit-debt');
  const form = document.getElementById('form-edit-debt');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  const pauseBtn = document.getElementById('btn-pause-debt');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      document.getElementById('edit-debt-saldo').value = 0;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-debt-id').value;
      const saldo_total = Number(document.getElementById('edit-debt-saldo').value);
      const pago_minimo = Number(document.getElementById('edit-debt-pago').value);
      const fecha_limite_pago = document.getElementById('edit-debt-limite').value;
      const cubierto_por = document.getElementById('edit-debt-cubierto-por') 
        ? document.getElementById('edit-debt-cubierto-por').value.trim() 
        : '';

      try {
        const res = await fetch(`${API_BASE}/debts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saldo_total,
            pago_minimo,
            fecha_limite_pago,
            cubierto_por: cubierto_por !== '' ? cubierto_por : null
          })
        });

        const data = await res.json();
        if (data.status === 'success') {
          modal.classList.add('hidden');
          await loadData();
        } else {
          alert(`Error al actualizar deuda: ${data.message}`);
        }
      } catch (err) {
        alert('Error al conectar con el servidor.');
      }
    });
  }
}

function setupFormToggle(btnId, formId, cancelId) {
  const btn = document.getElementById(btnId);
  const form = document.getElementById(formId);
  const cancel = document.getElementById(cancelId);
  
  if (!btn || !form || !cancel) return;
  
  btn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (formId === 'form-add-transaction') {
      // Set default local time in input
      const localTimeInput = document.getElementById('tx-fecha');
      if (localTimeInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        localTimeInput.value = now.toISOString().slice(0, 16);
      }
    }
  });
  
  cancel.addEventListener('click', () => {
    form.classList.add('hidden');
    form.reset();
  });
}

// 6. Delete Action Functions (exposed globally)
function showConfirm(message, confirmText = 'Aceptar') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const text = document.getElementById('confirm-modal-text');
    const acceptBtn = document.getElementById('btn-confirm-accept');
    const cancelBtn = document.getElementById('btn-confirm-cancel');

    text.innerText = message;
    acceptBtn.innerText = confirmText;
    modal.classList.remove('hidden');

    const cleanUp = (value) => {
      modal.classList.add('hidden');
      acceptBtn.removeEventListener('click', onAccept);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
      resolve(value);
    };

    function onAccept() { cleanUp(true); }
    function onCancel() { cleanUp(false); }
    function onOverlay(e) { if (e.target === modal) cleanUp(false); }

    acceptBtn.addEventListener('click', onAccept);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
  });
}

window.deleteAccount = async function(id) {
  const confirmed = await showConfirm('¿Estás seguro de eliminar esta cuenta? Se eliminarán todas sus deudas y transacciones vinculadas.');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    } else {
      alert(`Error al eliminar cuenta: ${data.message || 'Error en el servidor.'}`);
    }
  } catch (err) {
    alert('Error al eliminar cuenta.');
  }
};

window.deleteTransaction = async function(id) {
  const confirmed = await showConfirm('¿Estás seguro de eliminar esta transacción? Se revertirá su impacto en el saldo de la cuenta.');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    }
  } catch (err) {
    alert('Error al eliminar transacción.');
  }
};

window.deleteDebt = async function(id) {
  const confirmed = await showConfirm('¿Estás seguro de eliminar esta obligación de pago?');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/debts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      await loadData();
    }
  } catch (err) {
    alert('Error al eliminar deuda.');
  }
};

// 7. Helper Formatting Functions
function formatMoney(amount) {
  return Number(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  }
  return new Date(dateStr);
}

function getDueDateDay(dateStr) {
  if (!dateStr) return 1;
  const localDate = parseLocalDate(dateStr);
  return localDate.getDate();
}

function formatDateOnly(dateStr) {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short'
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

async function runSimulation() {
  const extraInput = document.getElementById('sim-extra-monto');
  const extraAmount = Number(extraInput.value) || 0;
  const targetDebtId = document.getElementById('sim-target-debt').value;
  
  const summaryContainer = document.getElementById('simulation-summary');
  const timelineContainer = document.getElementById('simulation-timeline');

  summaryContainer.classList.add('hidden');
  timelineContainer.classList.add('hidden');

  if (debts.length === 0) {
    alert('Por favor registra al menos una deudada vinculada para simular.');
    return;
  }

  const method = document.getElementById('select-method').value;

  // 1. Prepare debts for simulation (deep copy)
  let debtsForSim = debts.map(d => ({
    id: d.id,
    nombre: d.cuenta ? d.cuenta.nombre : 'Deuda',
    saldo: Number(d.saldo_total),
    tasaEA: Number(d.tasa_interes_ea),
    minimo: Number(d.pago_minimo)
  }));

  // Sort based on current method
  if (method === 'Avalancha') {
    debtsForSim.sort((a, b) => b.tasaEA - a.tasaEA || a.saldo - b.saldo);
  } else if (method === 'Bola de Nieve') {
    debtsForSim.sort((a, b) => a.saldo - b.saldo || b.tasaEA - a.tasaEA);
  }

  // 2. RUN STANDARD SIMULATION (Extra Amount = 0)
  const standardResult = simulatePayoff(debtsForSim, 0, 'auto');

  // 3. RUN ACCELERATED SIMULATION (Extra Amount = extraAmount)
  const acceleratedResult = simulatePayoff(debtsForSim, extraAmount, targetDebtId);

  if (acceleratedResult.error) {
    summaryContainer.className = 'simulation-summary feedback-msg error';
    summaryContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${acceleratedResult.error}`;
    summaryContainer.classList.remove('hidden');
    return;
  }

  // 4. RENDER SUMMARY STATS
  summaryContainer.className = 'simulation-summary';
  const monthsSaved = standardResult.months - acceleratedResult.months;
  const interestSaved = standardResult.totalInterest - acceleratedResult.totalInterest;

  summaryContainer.innerHTML = `
    <h3>Proyección de Resultados (${method})</h3>
    <div class="sim-stats-grid">
      <div class="sim-stat-card">
        <span class="stat-value">${acceleratedResult.months} meses</span>
        <span class="stat-label">Tiempo Total</span>
      </div>
      <div class="sim-stat-card highlight">
        <span class="stat-value">${monthsSaved > 0 ? `${monthsSaved} meses` : '0 meses'}</span>
        <span class="stat-label">Tiempo Ahorrado</span>
      </div>
      <div class="sim-stat-card">
        <span class="stat-value">$${formatMoney(acceleratedResult.totalInterest)}</span>
        <span class="stat-label">Intereses Totales</span>
      </div>
      <div class="sim-stat-card highlight-green">
        <span class="stat-value">$${interestSaved > 0 ? formatMoney(interestSaved) : '0.00'}</span>
        <span class="stat-label">Intereses Ahorrados</span>
      </div>
    </div>
  `;
  summaryContainer.classList.remove('hidden');

  // 5. RENDER TIMELINE
  timelineContainer.innerHTML = `
    <h3>Cronograma de Pagos y Liquidaciones</h3>
    <div class="timeline-wrapper">
      ${acceleratedResult.timeline.map(step => `
        <div class="timeline-step">
          <div class="step-badge">Mes ${step.month}</div>
          <div class="step-content">
            <div class="step-payments">
              ${step.payments.map(p => `
                <div class="sim-payment-row">
                  <span class="sim-payment-name">${escapeHTML(p.nombre)}</span>
                  <span class="sim-payment-value">Pago: $${formatMoney(p.amount)} <small>(Saldo rest: $${formatMoney(p.remaining)})</small></span>
                </div>
              `).join('')}
            </div>
            ${step.liquidated.length > 0 ? `
              <div class="sim-liquidated-alert">
                ${step.liquidated.map(name => `<p><i class="fa-solid fa-fire"></i> ¡Deuda <strong>${escapeHTML(name)}</strong> liquidada por completo!</p>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  timelineContainer.classList.remove('hidden');
}

// Internal simulation engine
function simulatePayoff(initialDebts, extraAmount, targetDebtId) {
  let list = initialDebts.map(d => ({ ...d }));
  let month = 0;
  let totalInterest = 0;
  let timeline = [];
  
  const maxMonths = 360; // 30-year safety exit
  
  while (list.some(d => d.saldo > 0) && month < maxMonths) {
    month++;
    
    // First, calculate interest accrued
    let interestAccrued = 0;
    list.forEach(d => {
      if (d.saldo > 0) {
        // convert E.A. to monthly rate: i_m = (1 + EA/100)^(1/12) - 1
        const monthlyRate = Math.pow(1 + d.tasaEA / 100, 1 / 12) - 1;
        const interest = d.saldo * monthlyRate;
        d.saldo += interest;
        interestAccrued += interest;
        totalInterest += interest;
      }
    });

    // Check if extraAmount + active minimums is less than month's accrued interest
    const activeDebts = list.filter(d => d.saldo > 0);
    const sumMinimums = activeDebts.reduce((sum, d) => sum + d.minimo, 0);
    const totalCapacity = sumMinimums + extraAmount;

    if (month === 1 && totalCapacity <= interestAccrued) {
      return {
        error: 'Tu capacidad de pago total (mínimos + extra) es menor o igual a los intereses devengados este mes ($' + formatMoney(interestAccrued) + '). Tu deuda nunca disminuirá. Necesitas inyectar un mayor monto extra mensual.'
      };
    }

    let remainingCapacity = totalCapacity;
    let paymentsThisMonth = [];
    let liquidatedThisMonth = [];

    // Step 1: Pay minimums on all active debts
    activeDebts.forEach(d => {
      const payAmount = Math.min(d.saldo, d.minimo);
      d.saldo -= payAmount;
      remainingCapacity -= payAmount;
      paymentsThisMonth.push({
        id: d.id,
        nombre: d.nombre,
        amount: payAmount,
        remaining: d.saldo
      });

      if (d.saldo <= 0) {
        liquidatedThisMonth.push(d.nombre);
      }
    });

    // Step 2: Pay extra / snowball
    if (remainingCapacity > 0) {
      // 2a. Attempt to target the selected debt first
      if (targetDebtId && targetDebtId !== 'auto') {
        const targetDebt = list.find(d => d.id === targetDebtId);
        if (targetDebt && targetDebt.saldo > 0) {
          const payAmount = Math.min(targetDebt.saldo, remainingCapacity);
          targetDebt.saldo -= payAmount;
          remainingCapacity -= payAmount;
          
          const pRecord = paymentsThisMonth.find(p => p.id === targetDebt.id);
          if (pRecord) {
            pRecord.amount += payAmount;
            pRecord.remaining = targetDebt.saldo;
          } else {
            paymentsThisMonth.push({
              id: targetDebt.id,
              nombre: targetDebt.nombre,
              amount: payAmount,
              remaining: targetDebt.saldo
            });
          }

          if (targetDebt.saldo <= 0) {
            if (!liquidatedThisMonth.includes(targetDebt.nombre)) {
              liquidatedThisMonth.push(targetDebt.nombre);
            }
          }
        }
      }

      // 2b. Pay remaining capacity to other active debts in sorted order
      if (remainingCapacity > 0) {
        for (let i = 0; i < list.length; i++) {
          const d = list[i];
          if (d.saldo > 0) {
            const payAmount = Math.min(d.saldo, remainingCapacity);
            d.saldo -= payAmount;
            remainingCapacity -= payAmount;
            
            const pRecord = paymentsThisMonth.find(p => p.id === d.id);
            if (pRecord) {
              pRecord.amount += payAmount;
              pRecord.remaining = d.saldo;
            } else {
              paymentsThisMonth.push({
                id: d.id,
                nombre: d.nombre,
                amount: payAmount,
                remaining: d.saldo
              });
            }

            if (d.saldo <= 0) {
              if (!liquidatedThisMonth.includes(d.nombre)) {
                liquidatedThisMonth.push(d.nombre);
              }
            }

            if (remainingCapacity <= 0) break;
          }
        }
      }
    }

    // Save history step
    timeline.push({
      month,
      payments: paymentsThisMonth,
      liquidated: liquidatedThisMonth
    });
  }

  if (month >= maxMonths) {
    return {
      months: maxMonths,
      totalInterest,
      timeline,
      error: 'La simulación excedió los 30 años (360 meses). Aumenta tu cuota mensual o abonos adicionales.'
    };
  }

  return {
    months: month,
    totalInterest,
    timeline
  };
}

async function initializeFirebase() {
  const h = window.location.hostname;
  const isLocalhost = h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
  
  // Fallback para desarrollo local (localhost o red Wi-Fi local)
  if (isLocalhost) {
    console.log('Bypassing Auth for local development (localhost).');
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) loginOverlay.classList.add('hidden');
    const dashboardApp = document.getElementById('dashboard-app');
    if (dashboardApp) dashboardApp.classList.remove('hidden');
    
    await loadData();
    
    const statusEl = document.getElementById('api-status');
    if (statusEl) statusEl.innerText = 'Desarrollo Local (Sin Auth)';
    
    // Hide Logout Button in local dev
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    return;
  }

  // Inicializar Firebase SDK explícitamente (compatible con Vercel, Firebase o cualquier servidor)
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: "AIzaSyCI91OFTw7dcFvyi43GGxoQAL6cTHOQo18",
          authDomain: "appfinaciera-1be81.firebaseapp.com",
          projectId: "appfinaciera-1be81",
          storageBucket: "appfinaciera-1be81.firebasestorage.app",
          messagingSenderId: "490258842612"
        });
      }
      setupAuthListeners();
      return;
    }
  } catch (e) {
    console.error('Error al inicializar Firebase:', e);
  }

  alert('Error: No se pudo cargar la configuración de autenticación de Firebase.');
}

function setupAuthListeners() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded.');
    alert('Error al cargar Firebase. Revisa tu conexión de red.');
    return;
  }

  const auth = firebase.auth();
  
  auth.onAuthStateChanged(async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardApp = document.getElementById('dashboard-app');

    if (user) {
      if (loginOverlay) loginOverlay.classList.add('hidden');
      if (dashboardApp) dashboardApp.classList.remove('hidden');
      await loadData();
    } else {
      if (loginOverlay) loginOverlay.classList.remove('hidden');
      if (dashboardApp) dashboardApp.classList.add('hidden');
    }
  });

  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch((error) => {
        console.error('Login error:', error);
        alert('Error al iniciar sesión con Google: ' + error.message);
      });
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      auth.signOut().catch((error) => {
        console.error('Logout error:', error);
      });
    });
  }
}
