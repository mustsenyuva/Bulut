/* Finansal Düzen — tüm veri tarayıcının localStorage alanında tutulur. */
(() => {
  const STORAGE_KEY = 'finansal-duzen-v1';
  const CATEGORIES = {
    expense: ['Kira / Konut', 'Market', 'Faturalar', 'Ulaşım', 'Yemek', 'Sağlık', 'Eğitim', 'Giyim', 'Eğlence', 'Abonelik', 'Borç / Kredi', 'Diğer'],
    income: ['Maaş', 'Ek gelir', 'Yatırım', 'Hediye', 'Diğer'],
  };

  const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  const fmtDate = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' });
  const money = (n) => fmt.format(n || 0);
  const $ = (id) => document.getElementById(id);

  // ---- Durum ----
  const defaults = { tx: [], fixed: [], settings: { budget: 0, goal: 0, saved: 0 } };
  let state = load();
  let month = currentMonth();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaults);
      const data = JSON.parse(raw);
      return { ...structuredClone(defaults), ...data, settings: { ...defaults.settings, ...(data.settings || {}) } };
    } catch { return structuredClone(defaults); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* özel pencere vb. */ }
  }
  function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // ---- Ay gezinme ----
  const monthPicker = $('monthPicker');
  function setMonth(m) { month = m; monthPicker.value = m; render(); }
  function shiftMonth(delta) {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  $('prevMonth').onclick = () => shiftMonth(-1);
  $('nextMonth').onclick = () => shiftMonth(1);
  monthPicker.onchange = () => { if (monthPicker.value) setMonth(monthPicker.value); };

  // ---- İşlem formu ----
  const txForm = $('txForm');
  const categorySelect = $('categorySelect');
  function fillCategories(type) {
    categorySelect.innerHTML = CATEGORIES[type].map((c) => `<option>${c}</option>`).join('');
  }
  txForm.type.forEach((r) => r.addEventListener('change', () => fillCategories(txForm.type.value)));
  fillCategories('expense');
  txForm.date.value = todayISO();

  txForm.onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(txForm.amount.value);
    if (!(amount > 0)) return;
    state.tx.push({
      id: uid(),
      type: txForm.type.value,
      amount,
      date: txForm.date.value,
      category: categorySelect.value,
      note: txForm.note.value.trim(),
    });
    save();
    txForm.amount.value = '';
    txForm.note.value = '';
    txForm.amount.focus();
    if (!txForm.date.value.startsWith(month)) setMonth(txForm.date.value.slice(0, 7)); else render();
  };

  $('txSearch').oninput = renderTransactions;

  // ---- Ayarlar (bütçe & hedef) ----
  const settingsForm = $('settingsForm');
  settingsForm.budget.value = state.settings.budget || '';
  settingsForm.goal.value = state.settings.goal || '';
  settingsForm.saved.value = state.settings.saved || '';
  settingsForm.onsubmit = (e) => {
    e.preventDefault();
    state.settings = {
      budget: +settingsForm.budget.value || 0,
      goal: +settingsForm.goal.value || 0,
      saved: +settingsForm.saved.value || 0,
    };
    save(); render();
  };

  // ---- Sabit giderler ----
  const fixedForm = $('fixedForm');
  fixedForm.onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(fixedForm.amount.value);
    if (!(amount > 0)) return;
    state.fixed.push({ id: uid(), name: fixedForm.name.value.trim(), amount, day: +fixedForm.day.value || null });
    save(); fixedForm.reset(); render();
  };
  $('applyFixed').onclick = () => {
    if (!state.fixed.length) return;
    const existing = new Set(monthTx().filter((t) => t.fixedId).map((t) => t.fixedId));
    const [y, mo] = month.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    let added = 0;
    for (const f of state.fixed) {
      if (existing.has(f.id)) continue;
      const day = Math.min(f.day || 1, lastDay);
      state.tx.push({
        id: uid(), fixedId: f.id, type: 'expense', amount: f.amount,
        date: `${month}-${String(day).padStart(2, '0')}`,
        category: 'Abonelik', note: f.name,
      });
      added++;
    }
    save(); render();
    alert(added ? `${added} sabit gider bu aya işlendi.` : 'Sabit giderler bu aya zaten işlenmiş.');
  };

  // ---- Dışa / içe aktarma ----
  $('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finansal-duzen-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.tx)) throw new Error('format');
      if (!confirm('Mevcut veriler içe aktarılan dosyayla değiştirilecek. Devam edilsin mi?')) return;
      state = { ...structuredClone(defaults), ...data, settings: { ...defaults.settings, ...(data.settings || {}) } };
      save();
      settingsForm.budget.value = state.settings.budget || '';
      settingsForm.goal.value = state.settings.goal || '';
      settingsForm.saved.value = state.settings.saved || '';
      render();
    } catch { alert('Dosya okunamadı. Geçerli bir yedek dosyası seçin.'); }
    e.target.value = '';
  };

  // ---- Olay delegasyonu: silme ----
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-tx]');
    if (btn) {
      state.tx = state.tx.filter((t) => t.id !== btn.dataset.delTx);
      save(); render(); return;
    }
    const fx = e.target.closest('[data-del-fixed]');
    if (fx) {
      state.fixed = state.fixed.filter((f) => f.id !== fx.dataset.delFixed);
      save(); render();
    }
  });

  // ---- Hesaplama & render ----
  function monthTx() { return state.tx.filter((t) => t.date && t.date.startsWith(month)); }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render() {
    renderSummary();
    renderTransactions();
    renderCategories();
    renderGoal();
    renderFixed();
  }

  function renderSummary() {
    const tx = monthTx();
    const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;
    $('sumIncome').textContent = money(income);
    $('sumExpense').textContent = money(expense);
    const netEl = $('sumNet');
    netEl.textContent = money(net);
    netEl.className = 'tile-value ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '');
    $('savingsRate').textContent = income > 0 ? `Tasarruf oranı %${Math.round((net / income) * 100)}` : 'Tasarruf oranı —';

    const budget = state.settings.budget;
    const left = $('budgetLeft'), meter = $('budgetMeter'), sub = $('budgetSub');
    if (budget > 0) {
      const ratio = expense / budget;
      left.textContent = money(budget - expense);
      left.className = 'tile-value ' + (ratio > 1 ? 'neg' : '');
      meter.style.width = `${Math.min(ratio * 100, 100)}%`;
      meter.className = 'meter-fill ' + (ratio > 1 ? 'over' : ratio > 0.85 ? 'near' : '');
      sub.textContent = `${money(expense)} / ${money(budget)} (%${Math.round(ratio * 100)})`;
    } else {
      left.textContent = '—'; left.className = 'tile-value';
      meter.style.width = '0'; sub.textContent = 'Bütçe belirlenmedi';
    }
  }

  function renderTransactions() {
    const q = $('txSearch').value.trim().toLocaleLowerCase('tr');
    const rows = monthTx()
      .filter((t) => !q || (t.note + ' ' + t.category).toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
    $('txBody').innerHTML = rows.map((t) => `
      <tr>
        <td>${fmtDate.format(new Date(t.date + 'T00:00:00'))}</td>
        <td>${esc(t.note) || '<span class="muted">—</span>'}</td>
        <td><span class="chip">${esc(t.category)}</span></td>
        <td class="num ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td>
        <td><button class="del" data-del-tx="${t.id}" aria-label="Sil" title="Sil">×</button></td>
      </tr>`).join('');
    $('txEmpty').hidden = rows.length > 0;
    $('txEmpty').textContent = q ? 'Aramayla eşleşen işlem yok.' : 'Bu ay için henüz işlem yok.';
  }

  function renderCategories() {
    const totals = {};
    for (const t of monthTx()) if (t.type === 'expense') totals[t.category] = (totals[t.category] || 0) + t.amount;
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const sum = entries.reduce((s, [, v]) => s + v, 0);
    const max = entries[0]?.[1] || 1;
    $('categoryBars').innerHTML = entries.map(([c, v]) => `
      <li>
        <span>${esc(c)}</span>
        <div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div>
        <span class="val">${money(v)}<span class="pct">%${Math.round((v / sum) * 100)}</span></span>
      </li>`).join('');
    $('catEmpty').hidden = entries.length > 0;
  }

  function renderGoal() {
    const { goal, saved } = state.settings;
    const pct = $('goalPct'), meter = $('goalMeter'), sub = $('goalSub');
    if (goal > 0) {
      const ratio = Math.min(saved / goal, 1);
      pct.textContent = `%${Math.round(ratio * 100)}`;
      meter.style.width = `${ratio * 100}%`;
      meter.className = 'meter-fill';
      sub.textContent = saved >= goal ? 'Hedefe ulaşıldı 🎉' : `${money(saved)} / ${money(goal)} — kalan ${money(goal - saved)}`;
    } else {
      pct.textContent = '—'; meter.style.width = '0'; sub.textContent = 'Hedef belirlenmedi';
    }
  }

  function renderFixed() {
    const total = state.fixed.reduce((s, f) => s + f.amount, 0);
    $('fixedTotal').textContent = `${money(total)} / ay`;
    $('fixedList').innerHTML = state.fixed.map((f) => `
      <li>
        <span class="name">${esc(f.name)}</span>
        ${f.day ? `<span class="day">her ayın ${f.day}. günü</span>` : ''}
        <span class="num">${money(f.amount)}</span>
        <button class="del" data-del-fixed="${f.id}" aria-label="Sil" title="Sil">×</button>
      </li>`).join('');
    $('fixedEmpty').hidden = state.fixed.length > 0;
    $('applyFixed').hidden = state.fixed.length === 0;
  }

  // ---- Başlat ----
  monthPicker.value = month;
  render();
})();
