/* ===========================================================
   store.js — ชั้นข้อมูลของ "เงินของฉัน"
   เก็บใน localStorage (ง่าย + สำรอง/กู้คืนเป็น JSON ได้ตรง ๆ)
   ทุกอย่าง sync ผ่าน window.Store
   =========================================================== */
(function () {
  'use strict';

  const DATA_KEY = 'ngern.data.v1';
  const THEME_KEY = 'ngern.theme';

  const uid = (p) =>
    (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const pad2 = (n) => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const monthKey = (iso) => iso.slice(0, 7); // YYYY-MM

  /* ---------- ค่าเริ่มต้น ---------- */
  const DEFAULT_CATEGORIES = [
    { id: 'c_food', name: 'อาหาร/เครื่องดื่ม', type: 'expense', icon: 'i-food', color: '#FB923C', order: 0 },
    { id: 'c_travel', name: 'เดินทาง/น้ำมัน', type: 'expense', icon: 'i-car', color: '#2DD4BF', order: 1 },
    { id: 'c_shop', name: 'ช้อปปิ้ง/ของใช้', type: 'expense', icon: 'i-bag', color: '#60A5FA', order: 2 },
    { id: 'c_bill', name: 'บิล/สาธารณูปโภค', type: 'expense', icon: 'i-receipt', color: '#A78BFA', order: 3 },
    { id: 'c_home', name: 'ที่พัก', type: 'expense', icon: 'i-home', color: '#F472B6', order: 4 },
    { id: 'c_health', name: 'สุขภาพ', type: 'expense', icon: 'i-health', color: '#F87171', order: 5 },
    { id: 'c_fun', name: 'บันเทิง', type: 'expense', icon: 'i-fun', color: '#FBBF24', order: 6 },
    { id: 'c_edu', name: 'การศึกษา', type: 'expense', icon: 'i-edu', color: '#38BDF8', order: 7 },
    { id: 'c_salary', name: 'เงินเดือน', type: 'income', icon: 'i-wallet', color: '#34D399', order: 0 },
    { id: 'c_bonus', name: 'โบนัส/ของขวัญ', type: 'income', icon: 'i-gift', color: '#22C55E', order: 1 },
    { id: 'c_side', name: 'งานเสริม', type: 'income', icon: 'i-brief', color: '#14B8A6', order: 2 },
    { id: 'c_invest', name: 'ลงทุน', type: 'income', icon: 'i-trend', color: '#84CC16', order: 3 },
    { id: 'c_other_in', name: 'อื่น ๆ', type: 'income', icon: 'i-save', color: '#4ADE80', order: 4 },
  ];

  const DEFAULT_WALLETS = [
    { id: 'w_cash', name: 'เงินสด', icon: 'i-wallet', color: '#34D399', openingBalance: 0, order: 0 },
    { id: 'w_bank', name: 'ธนาคาร', icon: 'i-bank', color: '#60A5FA', openingBalance: 0, order: 1 },
  ];

  function seedData() {
    const t = todayISO();
    const ym = t.slice(0, 8); // YYYY-MM-
    return {
      version: 2,
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      wallets: DEFAULT_WALLETS.map((w) => ({ ...w })),
      transactions: [
        { id: uid('t'), type: 'income', amount: 25000, categoryId: 'c_salary', walletId: 'w_bank', date: ym + '01', note: 'เงินเดือน' },
        { id: uid('t'), type: 'expense', amount: 700, categoryId: 'c_travel', walletId: 'w_bank', date: ym + '03', note: 'เติมน้ำมัน' },
        { id: uid('t'), type: 'expense', amount: 248, categoryId: 'c_shop', walletId: 'w_cash', date: ym + '03', note: '7-Eleven' },
        { id: uid('t'), type: 'expense', amount: 55, categoryId: 'c_food', walletId: 'w_cash', date: ym + '04', note: 'ข้าวมันไก่' },
      ],
      bills: [
        { id: uid('b'), name: 'ค่าเช่าหอ', amount: 4500, variable: false, categoryId: 'c_home', dueDay: 1, reminderDays: [3, 1], enabled: true, paidMonths: [] },
        { id: uid('b'), name: 'ค่าเน็ต AIS', amount: 590, variable: false, categoryId: 'c_bill', dueDay: 5, reminderDays: [3, 1], enabled: true, paidMonths: [] },
        { id: uid('b'), name: 'ค่าไฟ', amount: null, variable: true, categoryId: 'c_bill', dueDay: 15, reminderDays: [1], enabled: true, paidMonths: [] },
      ],
      debts: [
        { id: uid('d'), kind: 'iowe', person: 'เพื่อน', principal: 3000, note: 'ยืมค่าเทอม', date: ym + '01', startWalletId: null,
          payments: [{ id: uid('p'), amount: 1000, date: ym + '05', walletId: 'w_cash', note: '' }] },
      ],
      settings: { reminderTime: '20:00', defaultWalletId: 'w_cash', mode: 'simple' },
    };
  }

  /* ---------- โหลด / migrate / บันทึก ---------- */
  let data;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    data = raw ? JSON.parse(raw) : seedData();
  } catch (e) {
    data = seedData();
  }
  function migrate() {
    data.settings = data.settings || {};
    if (!Array.isArray(data.wallets) || !data.wallets.length) {
      data.wallets = DEFAULT_WALLETS.map((w) => ({ ...w }));
      data.settings.defaultWalletId = 'w_cash';
      for (const t of data.transactions || []) if (!t.walletId) t.walletId = 'w_cash';
    }
    if (!data.settings.defaultWalletId) data.settings.defaultWalletId = data.wallets[0].id;
    if (!data.settings.mode) data.settings.mode = 'simple';
    if (!Array.isArray(data.debts)) data.debts = [];
    for (const t of data.transactions || []) if (!t.walletId) t.walletId = data.settings.defaultWalletId;
    data.version = 2;
  }
  migrate();
  function persist() { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  persist();

  /* ---------- helpers ---------- */
  const catById = (id) => data.categories.find((c) => c.id === id);
  const walletById = (id) => data.wallets.find((w) => w.id === id);

  function txInMonth(ym) { return data.transactions.filter((t) => monthKey(t.date) === ym); }
  function txInRange(a, b) { return data.transactions.filter((t) => t.date >= a && t.date <= b); }

  function totals(list) {
    let income = 0, expense = 0;
    for (const t of list) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }
  function breakdown(list) {
    const map = new Map();
    for (const t of list) {
      if (t.type !== 'expense') continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()].map(([cid, amount]) => {
      const c = catById(cid);
      return { categoryId: cid, name: c ? c.name : 'อื่น ๆ', color: c ? c.color : '#94A3B8',
        icon: c ? c.icon : 'i-save', amount, pct: total ? Math.round((amount / total) * 100) : 0 };
    }).sort((a, b) => b.amount - a.amount);
  }

  /* ---------- wallet balances ---------- */
  function walletBalance(id) {
    const w = walletById(id);
    if (!w) return 0;
    let b = w.openingBalance || 0;
    for (const t of data.transactions) {
      if (t.type === 'income' && t.walletId === id) b += t.amount;
      else if (t.type === 'expense' && t.walletId === id) b -= t.amount;
      else if (t.type === 'transfer') {
        if (t.walletId === id) b -= t.amount;
        if (t.toWalletId === id) b += t.amount;
      }
    }
    for (const d of data.debts) {
      if (d.startWalletId === id) b += (d.kind === 'iowe' ? d.principal : -d.principal);
      for (const p of d.payments || []) {
        if (p.walletId !== id) continue;
        b += (d.kind === 'iowe' ? -p.amount : p.amount);
      }
    }
    return b;
  }
  function totalBalance() { return data.wallets.reduce((a, w) => a + walletBalance(w.id), 0); }

  /* ---------- debts ---------- */
  const debtPaid = (d) => (d.payments || []).reduce((a, p) => a + p.amount, 0);
  const debtRemaining = (d) => Math.max(0, d.principal - debtPaid(d));
  function debtSummary() {
    let iowe = 0, owed = 0;
    for (const d of data.debts) {
      const r = debtRemaining(d);
      if (d.kind === 'iowe') iowe += r; else owed += r;
    }
    return { iowe, owed };
  }

  /* ---------- bills ---------- */
  function billsWithStatus(refDate) {
    const now = refDate ? new Date(refDate) : new Date();
    const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return data.bills.map((b) => {
      const day = Math.min(b.dueDay, dim);
      const due = new Date(now.getFullYear(), now.getMonth(), day);
      const diff = Math.round((due - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      const paid = (b.paidMonths || []).includes(ym);
      return { ...b, ym, dueDate: due, daysLeft: diff, paid };
    });
  }
  function upcomingBills() {
    return billsWithStatus().filter((b) => b.enabled && !b.paid && b.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */
  const Store = {
    THEME_KEY,
    all: () => data,

    // categories
    categories: (type) => data.categories.filter((c) => !type || c.type === type).sort((a, b) => a.order - b.order),
    category: catById,

    // wallets
    wallets: () => data.wallets.slice().sort((a, b) => a.order - b.order),
    wallet: walletById,
    walletBalance, totalBalance,
    defaultWalletId: () => data.settings.defaultWalletId,
    addWallet(w) {
      const order = data.wallets.length;
      const rec = { id: uid('w'), name: w.name, icon: w.icon || 'i-wallet', color: w.color || '#34D399', openingBalance: Number(w.openingBalance) || 0, order };
      data.wallets.push(rec); persist(); return rec;
    },
    updateWallet(id, patch) { const w = walletById(id); if (w) { Object.assign(w, patch); if (patch.openingBalance != null) w.openingBalance = Number(patch.openingBalance) || 0; persist(); } return w; },
    deleteWallet(id) {
      if (data.wallets.length <= 1) return false;
      const fallback = data.wallets.find((w) => w.id !== id).id;
      data.transactions.forEach((t) => { if (t.walletId === id) t.walletId = fallback; if (t.toWalletId === id) t.toWalletId = fallback; });
      data.debts.forEach((d) => { if (d.startWalletId === id) d.startWalletId = null; (d.payments || []).forEach((p) => { if (p.walletId === id) p.walletId = fallback; }); });
      data.wallets = data.wallets.filter((w) => w.id !== id);
      if (data.settings.defaultWalletId === id) data.settings.defaultWalletId = fallback;
      persist(); return true;
    },
    reorderWallet(id, dir) {
      const arr = Store.wallets(); const i = arr.findIndex((w) => w.id === id); const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      const tmp = arr[i].order; arr[i].order = arr[j].order; arr[j].order = tmp; persist();
    },
    setDefaultWallet(id) { data.settings.defaultWalletId = id; persist(); },

    // transactions
    transactions: () => data.transactions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    txInMonth, txInRange, totals, breakdown,
    addTransaction(tx) {
      const rec = { id: uid('t'), type: tx.type, amount: Number(tx.amount), categoryId: tx.categoryId,
        walletId: tx.walletId || data.settings.defaultWalletId, date: tx.date || todayISO(), note: tx.note || '' };
      data.transactions.push(rec); persist(); return rec;
    },
    addTransfer(tr) {
      const rec = { id: uid('t'), type: 'transfer', amount: Number(tr.amount),
        walletId: tr.fromWalletId, toWalletId: tr.toWalletId, date: tr.date || todayISO(), note: tr.note || '' };
      data.transactions.push(rec); persist(); return rec;
    },
    updateTransaction(id, patch) { const t = data.transactions.find((x) => x.id === id); if (t) { Object.assign(t, patch); persist(); } return t; },
    deleteTransaction(id) { data.transactions = data.transactions.filter((t) => t.id !== id); persist(); },

    // categories CRUD
    addCategory(cat) { const order = data.categories.filter((c) => c.type === cat.type).length; const rec = { id: uid('c'), order, ...cat }; data.categories.push(rec); persist(); return rec; },
    updateCategory(id, patch) { const c = catById(id); if (c) { Object.assign(c, patch); persist(); } return c; },
    deleteCategory(id) { data.categories = data.categories.filter((c) => c.id !== id); persist(); },
    reorderCategory(id, dir) {
      const c = catById(id); if (!c) return;
      const sibs = Store.categories(c.type); const i = sibs.findIndex((x) => x.id === id); const j = i + dir;
      if (j < 0 || j >= sibs.length) return;
      const tmp = sibs[i].order; sibs[i].order = sibs[j].order; sibs[j].order = tmp; persist();
    },

    // bills
    bills: () => data.bills.slice(),
    billsWithStatus, upcomingBills,
    addBill(b) {
      const rec = { id: uid('b'), name: b.name, amount: b.variable ? null : Number(b.amount) || 0, variable: !!b.variable,
        categoryId: b.categoryId, dueDay: Number(b.dueDay) || 1, reminderDays: b.reminderDays || [1], enabled: b.enabled !== false, paidMonths: [] };
      data.bills.push(rec); persist(); return rec;
    },
    updateBill(id, patch) { const b = data.bills.find((x) => x.id === id); if (b) { Object.assign(b, patch); persist(); } return b; },
    deleteBill(id) { data.bills = data.bills.filter((b) => b.id !== id); persist(); },
    toggleBillPaid(id, ym) {
      const b = data.bills.find((x) => x.id === id); if (!b) return;
      b.paidMonths = b.paidMonths || [];
      const i = b.paidMonths.indexOf(ym);
      if (i >= 0) b.paidMonths.splice(i, 1);
      else {
        b.paidMonths.push(ym);
        if (!b.variable && b.amount) Store.addTransaction({ type: 'expense', amount: b.amount, categoryId: b.categoryId, date: todayISO(), note: b.name });
      }
      persist();
    },

    // debts
    debts: () => data.debts.slice(),
    debt: (id) => data.debts.find((d) => d.id === id),
    debtRemaining, debtPaid, debtSummary,
    addDebt(d) {
      const rec = { id: uid('d'), kind: d.kind || 'iowe', person: d.person || '', principal: Number(d.principal) || 0,
        note: d.note || '', date: d.date || todayISO(), startWalletId: d.startWalletId || null, payments: [] };
      data.debts.push(rec); persist(); return rec;
    },
    updateDebt(id, patch) { const d = Store.debt(id); if (d) { Object.assign(d, patch); if (patch.principal != null) d.principal = Number(patch.principal) || 0; persist(); } return d; },
    deleteDebt(id) { data.debts = data.debts.filter((d) => d.id !== id); persist(); },
    addPayment(debtId, p) {
      const d = Store.debt(debtId); if (!d) return;
      d.payments = d.payments || [];
      d.payments.push({ id: uid('p'), amount: Number(p.amount) || 0, date: p.date || todayISO(), walletId: p.walletId || data.settings.defaultWalletId, note: p.note || '' });
      persist();
    },
    deletePayment(debtId, pid) { const d = Store.debt(debtId); if (d) { d.payments = (d.payments || []).filter((p) => p.id !== pid); persist(); } },

    // settings + backup
    settings: () => data.settings,
    updateSettings(patch) { Object.assign(data.settings, patch); persist(); },
    exportJSON() { return JSON.stringify(data, null, 2); },
    importJSON(text) { const obj = JSON.parse(text); if (!obj || !Array.isArray(obj.categories)) throw new Error('ไฟล์ไม่ถูกต้อง'); data = obj; migrate(); persist(); },
    resetAll() { data = seedData(); persist(); },

    todayISO, monthKey,
  };

  window.Store = Store;
})();
