/* ===========================================================
   app.js — UI + logic ของ "เงินของฉัน" (vanilla, no build)
   โหมด: simple (รับ-จ่าย) / advanced (กระเป๋า+โอน+หนี้)
   =========================================================== */
(function () {
  'use strict';
  const S = window.Store;

  /* ---------- utils ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;
  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const mode = () => S.settings().mode;

  const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  /* ---------- บันทึกการอัปเดต (แสดงในตั้งค่า > เกี่ยวกับ) ----------
     ทุกครั้งที่อัปเดตแอป เพิ่มรายการใหม่ไว้บนสุด */
  const CHANGELOG = [
    { v: '0.3', date: '7 ก.ค. 2569', items: [
      'เพิ่มชุดสี “ธีมดวงดาว” ✦ (กลางคืน/กลางวัน) เลือกได้ในตั้งค่า',
      'แก้บั๊ก: หน้าลงเงินในธีมมืดโปร่งใสจนอ่านยาก',
    ] },
    { v: '0.2', date: '6 ก.ค. 2569', items: [
      'เพิ่มระบบติดตั้งแอป (PWA) ลงเครื่อง ใช้ออฟไลน์ได้',
    ] },
  ];
  const APP_VERSION = CHANGELOG[0].v;
  const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const thYear = (y) => y + 543;
  const monthLabel = (y, m0) => `${MONTHS_FULL[m0]} ${thYear(y)}`;
  const dayLabel = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymKey = (y, m0) => `${y}-${pad2(m0 + 1)}`;

  const ICON_CHOICES = ['i-food', 'i-car', 'i-bag', 'i-receipt', 'i-home', 'i-health', 'i-fun', 'i-edu',
    'i-save', 'i-wallet', 'i-bank', 'i-gift', 'i-brief', 'i-trend', 'i-grid', 'i-list', 'i-clock', 'i-cal', 'i-bell'];
  const currSymbol = (c) => ({ THB: '฿', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[c] || c);
  const COLOR_CHOICES = ['#FB923C', '#2DD4BF', '#60A5FA', '#A78BFA', '#F472B6', '#F87171',
    '#FBBF24', '#38BDF8', '#34D399', '#22C55E', '#14B8A6', '#84CC16'];

  /* ---------- state ---------- */
  let current = 'home';
  const now = new Date();
  const hist = { mode: 'month', y: now.getFullYear(), m: now.getMonth(), start: '', end: '', search: '', typeFilter: 'all', walletId: '' };
  let add = null, bill = null, catEdit = null, debtE = null, wal = null, pay = null, fxConvert = null;
  let catType = 'expense', taxCatOpen = false, taxDedOpen = false;
  let deferredPrompt = null;
  const openFlags = {};

  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (('standalone' in navigator) && navigator.standalone);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  function maybeShowInstall() {
    if (isStandalone() || localStorage.getItem('ngern.installDismissed')) return;
    if (deferredPrompt || isIOS()) $('#installBanner').hidden = false;
  }

  /* =========================================================
     NAV
     ========================================================= */
  function navItems() {
    const items = [{ k: 'home', ic: 'i-home', t: 'หน้าหลัก' }, { k: 'history', ic: 'i-cal', t: 'ประวัติ' }, { k: 'bills', ic: 'i-bell', t: 'บิล' }];
    if (mode() === 'advanced') items.push({ k: 'debt', ic: 'i-users', t: 'หนี้' });
    if (S.settings().taxEnabled) items.push({ k: 'tax', ic: 'i-receipt', t: 'ภาษี' });
    items.push({ k: 'settings', ic: 'i-gear', t: 'ตั้งค่า' });
    return items;
  }
  function buildNav() {
    $('#nav').innerHTML = navItems().map((it) => `<button data-nav="${it.k}">${icon(it.ic)}${it.t}</button>`).join('');
    $('#nav').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));
  }

  function go(name) {
    current = name;
    document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.dataset.screen !== name));
    document.querySelectorAll('#nav button').forEach((b) => {
      const active = b.dataset.nav === name || (['categories', 'wallets'].includes(name) && b.dataset.nav === 'settings');
      b.classList.toggle('on', active);
    });
    const scr = $('#screen-' + name); if (scr) scr.scrollTop = 0;
    setChrome(name); render(name);
  }

  function setChrome(name) {
    const titles = { home: '', history: 'ประวัติ', bills: 'บิลประจำ', debt: 'หนี้', tax: 'ภาษี', wallets: 'จัดการกระเป๋า', categories: 'จัดการหมวดหมู่', settings: 'ตั้งค่า' };
    const left = $('#appbarLeft'), right = $('#appbarRight'), fab = $('#fab');
    let title = titles[name];
    if (name === 'home') title = monthLabel(now.getFullYear(), now.getMonth());
    if (name === 'categories' || name === 'wallets')
      left.innerHTML = `<button class="icon-btn" onclick="App.go('settings')">${icon('i-back')}</button><h1>${esc(title)}</h1>`;
    else left.innerHTML = `<h1>${esc(title)}</h1>`;
    right.innerHTML = '';
    if (name === 'home' || name === 'history') { fab.hidden = false; fab.innerHTML = icon('i-plus') + ' ลงเงิน'; fab.onclick = () => App.openAdd(); }
    else if (name === 'bills') { fab.hidden = false; fab.innerHTML = icon('i-plus') + ' เพิ่มบิล'; fab.onclick = () => App.openBill(); }
    else if (name === 'debt') { fab.hidden = false; fab.innerHTML = icon('i-plus') + ' เพิ่มหนี้'; fab.onclick = () => App.openDebt(); }
    else fab.hidden = true;
  }

  function render(name) {
    ({ home: renderHome, history: renderHistory, bills: renderBills, debt: renderDebt,
       tax: renderTax, wallets: renderWallets, categories: renderCategories, settings: renderSettings }[name] || (() => {}))();
  }

  /* =========================================================
     shared bits
     ========================================================= */
  function donutCard(list, labelText) {
    const bd = S.breakdown(list);
    const tot = bd.reduce((a, b) => a + b.amount, 0);
    if (!tot) return `<div class="card"><div class="empty">ยังไม่มีรายจ่ายในช่วงนี้</div></div>`;
    let acc = 0;
    const stops = bd.map((b) => { const from = (acc / tot) * 100; acc += b.amount; return `${b.color} ${from}% ${(acc / tot) * 100}%`; }).join(', ');
    const legend = bd.slice(0, 6).map((b) => `<div class="l"><span class="sw" style="background:${b.color}"></span><span class="name">${esc(b.name)}</span><span class="pct">${b.pct}%</span><span class="num">${fmt(b.amount)}</span></div>`).join('');
    return `<div class="card"><div class="donut-row">
      <div class="donut" style="background:conic-gradient(${stops})"><div class="mid"><div class="k">จ่าย</div><div class="v num">${fmt(tot)}</div></div></div>
      <div class="legend"><div class="cap">${esc(labelText || 'รายจ่ายตามหมวด')}</div>${legend}</div></div></div>`;
  }

  function txRow(t) {
    if (t.type === 'transfer') {
      const from = S.wallet(t.walletId), to = S.wallet(t.toWalletId);
      const fromCur = (from && from.currency) || 'THB';
      const toCur = (to && to.currency) || 'THB';
      const amtLabel = t.toAmount != null
        ? `${currSymbol(fromCur)}${fmt(t.amount)} → ${currSymbol(toCur)}${fmt(t.toAmount)}`
        : `${currSymbol(fromCur)}${fmt(t.amount)}`;
      return `<div class="rowitem tap" onclick="App.openAdd('${t.id}')">
        <div class="avatar" style="color:var(--trust)">${icon('i-transfer')}</div>
        <div class="body"><div class="t">${t.remit ? 'โอนเข้าไทย' : 'โอนเงิน'}</div><div class="s">${esc(from ? from.name : '?')} → ${esc(to ? to.name : '?')} · ${dayLabel(t.date)}</div></div>
        <div class="amt" style="color:var(--muted)"><span class="num">${amtLabel}</span></div></div>`;
    }
    const c = S.category(t.categoryId);
    const w = S.wallet(t.walletId);
    const color = t.type === 'income' ? 'var(--income)' : 'var(--expense)';
    const sub = `${esc(c ? c.name : '')} · ${dayLabel(t.date)}${mode() === 'advanced' && w ? ' · ' + esc(w.name) : ''}`;
    return `<div class="rowitem tap" onclick="App.openAdd('${t.id}')">
      <div class="avatar" style="color:${color}">${icon(c ? c.icon : 'i-save')}</div>
      <div class="body"><div class="t">${esc(t.note || (c ? c.name : ''))}</div><div class="s">${sub}</div></div>
      <div class="amt ${t.type === 'income' ? 'inc' : 'exp'}">${icon(t.type === 'income' ? 'i-up' : 'i-down', 'sm')}<span class="num">${fmt(t.amount)}</span></div></div>`;
  }
  const txList = (list) => list.length ? list.map(txRow).join('') : `<div class="empty">ยังไม่มีรายการ</div>`;

  function walletRow(w) {
    const bal = S.walletBalance(w.id);
    const def = w.id === S.defaultWalletId();
    const cur = w.currency || 'THB';
    const balStr = cur === 'THB' ? '฿' + fmt(bal) : currSymbol(cur) + fmt(bal) + ' ' + cur;
    return `<div class="rowitem" style="${w.enabled === false ? 'opacity:.45' : ''}">
      <div class="avatar" style="color:${w.color}">${icon(w.icon)}</div>
      <div class="body"><div class="t">${esc(w.name)}${def ? ' <span class="badge">เริ่มต้น</span>' : ''}${cur !== 'THB' ? ` <span class="badge" style="background:var(--trust)">${cur}</span>` : ''}</div></div>
      <span class="wallet-bal num" style="color:${bal < 0 ? 'var(--expense)' : 'var(--ink)'}"> ${balStr}</span></div>`;
  }
  const walletChips = (sel, fn, thbOnly) => S.wallets().filter((w) => w.enabled !== false && ((w.currency || 'THB') === 'THB' || (!thbOnly && S.settings().foreignIncomeEnabled))).map((w) => {
    const cur = w.currency || 'THB';
    return `<span class="cchip ${w.id === sel ? 'on' : ''}" onclick="${fn}('${w.id}')">${esc(w.name)}${cur !== 'THB' ? ' ' + cur : ''}</span>`;
  }).join('');

  /* =========================================================
     HOME
     ========================================================= */
  function renderHome() {
    const adv = mode() === 'advanced';
    const ym = ymKey(now.getFullYear(), now.getMonth());
    const list = S.txInMonth(ym); const t = S.totals(list);
    const up = S.upcomingBills();
    const recent = S.transactions().filter((x) => S.monthKey(x.date) === ym).slice(0, 6);
    const heroVal = adv ? S.totalBalance() : t.balance;

    const upHtml = up.map((b) => {
      const s = b.daysLeft < 0 ? `เลยกำหนด ${-b.daysLeft} วัน` : b.daysLeft === 0 ? 'ครบวันนี้' : `อีก ${b.daysLeft} วัน`;
      const cls = b.daysLeft <= 1 ? 's-warn' : 's-mut';
      const amt = b.variable ? 'ผันแปร' : '฿' + fmt(b.amount);
      return `<div class="bill"><span style="color:var(--expense)">${icon('i-bell')}</span>
        <div class="info"><div class="t">${esc(b.name)}</div><div class="s ${cls}">ครบวันที่ ${b.dueDay} · ${s}</div></div>
        <span class="num" style="margin-right:6px">${amt}</span>
        <button class="btn-pay" onclick="event.stopPropagation();App.payBill('${b.id}','${b.ym}')">จ่ายแล้ว</button></div>`;
    }).join('');

    let walletsSection = '';
    if (adv) {
      const thbWallets = S.wallets().filter((w) => (w.currency || 'THB') === 'THB' && w.enabled !== false);
      const fxWallets = S.settings().foreignIncomeEnabled ? S.wallets().filter((w) => (w.currency || 'THB') !== 'THB' && w.enabled !== false) : [];
      walletsSection = `<div class="section"><span>กระเป๋าเงิน</span><button class="link" onclick="App.openTransfer()">${icon('i-transfer', 'sm')} โอนเงิน</button></div>${thbWallets.map(walletRow).join('')}`;
      if (fxWallets.length) walletsSection += `<div class="section"><span>กระเป๋าต่างประเทศ</span><button class="link" onclick="App.go('wallets')">จัดการ →</button></div>${fxWallets.map((w) => {
        const bal = S.walletBalance(w.id); const cur = w.currency;
        return `<div class="rowitem tap" onclick="App.openFXConvert('${w.id}')">
          <div class="avatar" style="color:${w.color}">${icon(w.icon)}</div>
          <div class="body"><div class="t">${esc(w.name)} <span class="badge" style="background:var(--trust)">${cur}</span></div>
          <div class="s">กดเพื่อ ฝาก/ถอน แปลงสกุล</div></div>
          <span class="wallet-bal num" style="color:${bal < 0 ? 'var(--expense)' : 'var(--ink)'}"> ${currSymbol(cur)}${fmt(bal)} ${cur}</span></div>`;
      }).join('')}`;
    }

    let debtSection = '';
    if (adv) { const ds = S.debtSummary(); if (ds.iowe || ds.owed) debtSection = `<div class="section"><span>หนี้</span><button class="link" onclick="App.go('debt')">ดูทั้งหมด</button></div>
      <div class="sum-grid"><div class="sum-card exp"><div class="k">เราติดหนี้</div><div class="v num">${fmt(ds.iowe)}</div></div><div class="sum-card inc"><div class="k">คนติดเรา</div><div class="v num">${fmt(ds.owed)}</div></div></div>`; }

    $('#screen-home').innerHTML = `
      <div class="hero-label">${adv ? 'เงินทั้งหมด' : 'คงเหลือเดือนนี้'}</div>
      <div class="hero-amount"><span class="baht num">฿</span><span class="val num ${heroVal < 0 ? 'neg' : ''}">${fmt(heroVal)}</span></div>
      <div class="pills"><div class="pill inc">${icon('i-up', 'sm')} รับ <span class="num">${fmt(t.income)}</span></div>
        <div class="pill exp">${icon('i-down', 'sm')} จ่าย <span class="num">${fmt(t.expense)}</span></div></div>
      ${walletsSection}
      ${donutCard(list)}
      ${up.length ? `<div class="section"><span>บิลใกล้ครบกำหนด</span><button class="link" onclick="App.go('bills')">ดูทั้งหมด</button></div>${upHtml}` : ''}
      ${debtSection}
      <div class="section"><span>รายการล่าสุด</span><button class="link" onclick="App.go('history')">ดูประวัติ</button></div>
      ${txList(recent)}`;
  }

  /* =========================================================
     HISTORY
     ========================================================= */
  function renderHistory() {
    let rawList, label;
    if (hist.mode === 'month') { const ym = ymKey(hist.y, hist.m); rawList = S.txInMonth(ym); label = monthLabel(hist.y, hist.m); }
    else {
      if (!hist.start || !hist.end) { const d = S.todayISO(); hist.end = d; hist.start = d.slice(0, 8) + '01'; }
      rawList = S.txInRange(hist.start, hist.end); label = `${dayLabel(hist.start)} – ${dayLabel(hist.end)}`;
    }

    // apply filters
    let list = rawList;
    if (hist.typeFilter !== 'all') list = list.filter((tx) => tx.type === hist.typeFilter);
    if (hist.walletId) list = list.filter((tx) => tx.walletId === hist.walletId || tx.toWalletId === hist.walletId);
    if (hist.search) {
      const q = hist.search.toLowerCase();
      list = list.filter((tx) => {
        const c = S.category(tx.categoryId);
        return (tx.note || '').toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q));
      });
    }

    // split by currency via wallet lookup
    const txCur = (tx) => { const w = S.wallet(tx.walletId); return (w && w.currency) || 'THB'; };
    const byCur = {};
    for (const tx of list) { const c = txCur(tx); (byCur[c] = byCur[c] || []).push(tx); }
    const currencies = Object.keys(byCur).sort((a, b) => (a === 'THB' ? -1 : 1));
    const multiCur = currencies.length > 1;

    const sumBlock = (cur, txs) => {
      const t = S.totals(txs);
      const sym = currSymbol(cur);
      const fmtC = (n) => `${sym}${fmt(n)}`;
      return `
        ${multiCur ? `<div class="section" style="margin-top:12px"><span>${cur === 'THB' ? '฿ บาท' : `${sym} ${cur}`}</span></div>` : ''}
        <div class="sum-grid"><div class="sum-card inc"><div class="k">รายรับ</div><div class="v num">${fmtC(t.income)}</div></div><div class="sum-card exp"><div class="k">รายจ่าย</div><div class="v num">${fmtC(t.expense)}</div></div></div>
        <div class="sum-card" style="margin-top:10px"><div class="k">คงเหลือสุทธิ</div><div class="v num" style="color:${t.balance < 0 ? 'var(--expense)' : 'var(--ink)'}">${fmtC(t.balance)}</div></div>`;
    };

    const atCurrent = hist.y === now.getFullYear() && hist.m === now.getMonth();
    const monthCtrl = `<div class="hist-nav"><button class="icon-btn" onclick="App.histMonth(-1)">${icon('i-left')}</button>
      <span class="lbl">${esc(label)}</span><button class="icon-btn" onclick="App.histMonth(1)" ${atCurrent ? 'disabled' : ''}>${icon('i-right')}</button></div>`;
    const rangeCtrl = `<div class="range-row">
      <div class="col"><div class="field-label" style="margin-top:0">ตั้งแต่</div><input class="input" type="date" id="rangeStart" value="${hist.start}" max="${S.todayISO()}" onchange="App.histRange()"></div>
      <div class="col"><div class="field-label" style="margin-top:0">ถึง</div><input class="input" type="date" id="rangeEnd" value="${hist.end}" max="${S.todayISO()}" onchange="App.histRange()"></div></div>
      <div class="wrap-chips" style="margin-top:10px"><span class="cchip" onclick="App.histPreset(7)">7 วัน</span><span class="cchip" onclick="App.histPreset(30)">30 วัน</span><span class="cchip" onclick="App.histPreset(90)">90 วัน</span><span class="cchip" onclick="App.histPreset('year')">ปีนี้</span></div>`;

    const adv = mode() === 'advanced';
    const wallets = adv ? S.wallets().filter((w) => w.enabled !== false) : [];
    const walChips = wallets.length > 1 ? `<div class="wrap-chips" style="margin-top:8px">
      <span class="cchip${!hist.walletId ? ' on' : ''}" onclick="App.histWallet('')">ทั้งหมด</span>
      ${wallets.map((w) => `<span class="cchip${hist.walletId === w.id ? ' on' : ''}" onclick="App.histWallet('${w.id}')">${esc(w.name)}</span>`).join('')}
    </div>` : '';

    $('#screen-history').innerHTML = `
      <div class="mode-tabs"><button class="${hist.mode === 'month' ? 'on' : ''}" onclick="App.histSetMode('month')">รายเดือน</button><button class="${hist.mode === 'range' ? 'on' : ''}" onclick="App.histSetMode('range')">เลือกช่วง</button></div>
      ${hist.mode === 'month' ? monthCtrl : rangeCtrl}
      ${currencies.length ? currencies.map((c) => sumBlock(c, byCur[c])).join('') : `<div class="sum-grid"><div class="sum-card inc"><div class="k">รายรับ</div><div class="v num">฿0</div></div><div class="sum-card exp"><div class="k">รายจ่าย</div><div class="v num">฿0</div></div></div>`}
      ${donutCard(byCur['THB'] || [])}
      <div style="margin-top:12px"><input class="input" placeholder="ค้นหา note หรือหมวดหมู่…" value="${esc(hist.search)}" oninput="App.histSearch(this.value)"></div>
      <div class="wrap-chips" style="margin-top:8px">
        <span class="cchip${hist.typeFilter === 'all' ? ' on' : ''}" onclick="App.histType('all')">ทั้งหมด</span>
        <span class="cchip${hist.typeFilter === 'income' ? ' on' : ''}" onclick="App.histType('income')">รายรับ</span>
        <span class="cchip${hist.typeFilter === 'expense' ? ' on' : ''}" onclick="App.histType('expense')">รายจ่าย</span>
      </div>
      ${walChips}
      <div class="section"><span>รายการ (${list.length})</span></div>
      ${txList(list.slice().sort((a, b) => (a.date < b.date ? 1 : -1)))}`;
  }

  /* =========================================================
     BILLS
     ========================================================= */
  function renderBills() {
    const bills = S.billsWithStatus();
    if (!bills.length) { $('#screen-bills').innerHTML = `<div class="empty">ยังไม่มีบิล กด "เพิ่มบิล" ด้านล่าง</div>`; return; }
    const html = bills.map((b) => {
      const c = S.category(b.categoryId);
      let s, scls;
      if (!b.enabled) { s = `ทุกวันที่ ${b.dueDay} · ปิดอยู่`; scls = 's-mut'; }
      else if (b.paid) { s = `ทุกวันที่ ${b.dueDay} · จ่ายแล้วเดือนนี้`; scls = 's-ok'; }
      else if (b.daysLeft <= 1) { s = `ทุกวันที่ ${b.dueDay} · ยังไม่จ่าย · ${b.daysLeft < 0 ? 'เลยกำหนด' : b.daysLeft === 0 ? 'ครบวันนี้' : 'อีก 1 วัน'}`; scls = 's-warn'; }
      else { s = `ทุกวันที่ ${b.dueDay} · ยังไม่จ่าย`; scls = 's-mut'; }
      const amt = b.variable ? `<span style="color:var(--muted);font-size:13px">ผันแปร</span>` : `<span class="num" ${!b.enabled ? 'style="color:var(--muted)"' : ''}>฿${fmt(b.amount)}</span>`;
      return `<div class="card" style="margin-top:8px${!b.enabled ? ';opacity:.6' : ''}" onclick="App.openBill('${b.id}')"><div class="rowitem" style="padding:2px 0">
        <div class="avatar" style="color:${b.enabled ? (c ? c.color : 'var(--trust)') : 'var(--muted)'}">${icon(c ? c.icon : 'i-receipt')}</div>
        <div class="body"><div class="t">${esc(b.name)}</div><div class="s ${scls}">${s}</div></div>${amt}</div></div>`;
    }).join('');
    $('#screen-bills').innerHTML = `<div style="height:8px"></div>${html}`;
  }

  /* =========================================================
     DEBT
     ========================================================= */
  function renderDebt() {
    const ds = S.debtSummary(); const debts = S.debts();
    const iowe = debts.filter((d) => d.kind === 'iowe'), owed = debts.filter((d) => d.kind === 'owed');
    const rowsFor = (arr) => arr.map((d) => {
      const rem = S.debtRemaining(d), paid = S.debtPaid(d);
      const pct = d.principal ? Math.min(100, Math.round(paid / d.principal * 100)) : 0;
      const done = rem <= 0; const col = d.kind === 'iowe' ? 'var(--expense)' : 'var(--income)';
      return `<div class="card" style="margin-top:8px${done ? ';opacity:.6' : ''}" onclick="App.openDebt('${d.id}')"><div class="rowitem" style="padding:2px 0">
        <div class="avatar" style="color:${col}">${icon('i-users')}</div>
        <div class="body"><div class="t">${esc(d.person)}${done ? ' ✓' : ''}</div><div class="s">${done ? 'ชำระครบแล้ว' : 'เหลือ ฿' + fmt(rem) + ' / ฿' + fmt(d.principal)}${d.note ? ' · ' + esc(d.note) : ''}</div></div>
        <span class="num" style="color:${col}">฿${fmt(rem)}</span></div>
        <div class="progress"><span style="width:${pct}%"></span></div></div>`;
    }).join('');
    $('#screen-debt').innerHTML = `
      <div class="sum-grid" style="margin-top:14px"><div class="sum-card exp"><div class="k">เราติดหนี้ (ต้องจ่าย)</div><div class="v num">${fmt(ds.iowe)}</div></div><div class="sum-card inc"><div class="k">คนติดเรา (รอรับ)</div><div class="v num">${fmt(ds.owed)}</div></div></div>
      ${iowe.length ? `<div class="section"><span>เรายืม (ต้องจ่าย)</span></div>${rowsFor(iowe)}` : ''}
      ${owed.length ? `<div class="section"><span>ให้ยืม (รอรับคืน)</span></div>${rowsFor(owed)}` : ''}
      ${!debts.length ? '<div class="empty">ยังไม่มีรายการหนี้ กด "เพิ่มหนี้" ด้านล่าง</div>' : ''}`;
  }

  /* =========================================================
     TAX
     ========================================================= */

  function renderTax() {
    const st = S.settings(); const ts = S.taxSummary(); const ded = st.taxDeductions || {};
    let html = '';

    if (st.taxEnabled) {
      const taxCls = ts.estimatedTax > 0 ? ' has-tax' : '';
      const taxLbl = ts.estimatedTax > 0 ? '฿' + fmt(ts.estimatedTax) : ts.netIncome <= 0 ? 'ยังไม่ถึงเกณฑ์เสียภาษี' : '฿0';
      const dedRows = [
        ['ค่าใช้จ่าย 50% (สูงสุด ฿100,000)', ts.expenseDeduction],
        ['ลดหย่อนส่วนตัว', ts.personalDeduction],
        ded.socialSecurity ? ['ประกันสังคม', ded.socialSecurity] : null,
        ded.lifeInsurance ? ['ประกันชีวิต/สุขภาพ', ded.lifeInsurance] : null,
        ded.rmf ? ['RMF/SSF/กองทุน', ded.rmf] : null,
        ded.parents ? ['ลดหย่อนบิดา/มารดา', ded.parents] : null,
        ded.donation ? ['เงินบริจาค', ded.donation] : null,
      ].filter(Boolean).map(([label, val]) => `<div class="tax-row"><span>${label}</span><span class="num">-฿${fmt(val)}</span></div>`).join('');

      html += `
        <div class="tax-hero${taxCls}">
          <div class="tax-label">ภาษีประมาณการ ปี ${ts.year + 543}</div>
          <div class="tax-amount num">${taxLbl}</div>
          <div class="tax-net">เงินได้สุทธิ ฿${fmt(ts.netIncome)}</div>
        </div>
        <div class="section" style="margin-top:16px"><span>รายได้ที่ต้องเสียภาษี</span></div>
        <div class="tax-rows">
          <div class="tax-row"><span>รายได้ THB (หมวดที่ tag)</span><span class="num">฿${fmt(ts.taxableTHB)}</span></div>
          ${ts.remitTHB > 0 ? `<div class="tax-row"><span>รายได้ต่างประเทศ (โอนเข้าไทย)</span><span class="num">฿${fmt(ts.remitTHB)}</span></div>` : ''}
          <div class="tax-row total"><span>รายได้รวม</span><span class="num">฿${fmt(ts.totalIncome)}</span></div>
        </div>
        <div class="section" style="margin-top:16px"><span>หักค่าใช้จ่าย + ลดหย่อน</span></div>
        <div class="tax-rows">
          ${dedRows}
          <div class="tax-row total"><span>หักรวม</span><span class="num">-฿${fmt(ts.totalDeductions)}</span></div>
        </div>
        <div class="section" style="margin-top:16px;cursor:pointer" onclick="App.toggleTaxCatSection()">
          <span>หมวดหมู่รายรับ${taxCatOpen ? '' : ' ▸'}</span>
          ${taxCatOpen ? `<button class="link" onclick="event.stopPropagation();App.go('categories')">จัดการ →</button>` : ''}
        </div>
        ${taxCatOpen ? S.categories('income').map((c) => `<div class="rowitem tap" style="padding:10px 4px" onclick="App.toggleCatTax('${c.id}')">
          <div class="avatar" style="color:${c.color}">${icon(c.icon)}</div>
          <div class="body"><div class="t">${esc(c.name)}</div></div>
          <button class="sw-ui ${c.isTaxable ? 'on' : ''}" style="pointer-events:none"></button>
        </div>`).join('') : ''}`;
    }

    html += `<div class="empty" style="text-align:left;padding:12px 4px;font-size:12px">* ตัวเลขนี้เป็นการประมาณการ — ยืนยันกับผู้เชี่ยวชาญด้านภาษีก่อนยื่น<br>* รายได้ต่างประเทศจะถูกนับเข้าภาษีเมื่อ "โอนเข้าไทย" (แปลงจากกระเป๋า USD → THB)</div>`;
    $('#screen-tax').innerHTML = html;
  }


  /* =========================================================
     FX CONVERT (foreign wallet → THB)
     ========================================================= */
  function openFXConvert(walletId, dir) {
    if (!S.settings().foreignIncomeEnabled) return;
    const w = S.wallet(walletId); if (!w || (w.currency || 'THB') === 'THB') return;
    const bal = S.walletBalance(walletId);
    fxConvert = { walletId, currency: w.currency, dir: dir === 'out' ? 'out' : 'in',
      fromAmount: dir !== 'out' && bal > 0 ? String(Math.round(bal * 100) / 100) : '', toAmount: '', fxRate: '',
      thbWalletId: S.defaultWalletId(), catId: (S.categories('income').find((c) => c.isTaxable) || S.categories('income')[0] || {}).id,
      date: S.todayISO(), taxable: true };
    renderFXConvert();
  }
  function renderFXConvert() {
    const w = S.wallet(fxConvert.walletId); if (!w) return;
    const cur = fxConvert.currency; const isIn = fxConvert.dir === 'in';
    const bal = S.walletBalance(fxConvert.walletId);
    const thbWallets = S.wallets().filter((x) => (x.currency || 'THB') === 'THB' && x.enabled !== false);
    const catChips = S.categories('income').map((c) => `<span class="cchip ${fxConvert.catId === c.id ? 'on' : ''}" onclick="App.fxPick('catId','${c.id}')">${esc(c.name)}${c.isTaxable ? ' <span class="tax-badge">ภาษี</span>' : ''}</span>`).join('');
    // ต้นทาง/ปลายทางตามทิศ: in = ต่างชาติ→THB (ถอน), out = THB→ต่างชาติ (ฝาก)
    const fromLbl = isIn ? `จำนวน ${cur} ที่ถอน` : 'จำนวนเงินบาทที่ฝาก (THB)';
    const toLbl = isIn ? 'ยอด THB ที่ได้รับจริง (หลังค่าธรรมเนียม)' : `ยอด ${cur} ที่เข้าจริง (หลังค่าธรรมเนียม)`;
    const inner = `
      <h1 style="font-size:18px;margin-bottom:6px">${isIn ? 'ถอนเป็นเงินไทย' : 'ฝากเข้า'} — ${esc(w.name)}</h1>
      <div class="mode-tabs" style="margin-bottom:10px"><button class="${!isIn ? 'on' : ''}" onclick="App.fxSetDir('out')">ฝากเข้า (บาท→${cur})</button><button class="${isIn ? 'on' : ''}" onclick="App.fxSetDir('in')">ถอนออก (${cur}→บาท)</button></div>
      <div style="background:var(--surface);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="font-weight:600">ยอดคงเหลือ ${esc(w.name)}: ${currSymbol(cur)}${fmt(bal)} ${cur}</div>
      </div>
      <div class="field-label">กระเป๋าบาท (${isIn ? 'เข้า' : 'จ่ายจาก'})</div>
      <div class="wrap-chips">${thbWallets.map((x) => `<span class="cchip ${fxConvert.thbWalletId === x.id ? 'on' : ''}" onclick="App.fxPick('thbWalletId','${x.id}')">${esc(x.name)}</span>`).join('')}</div>
      <div class="field-label">${fromLbl}</div>
      <input class="input num" id="fxFrom" inputmode="decimal" value="${fxConvert.fromAmount}" placeholder="0.00" oninput="App._fxSync('fromAmount',this.value)">
      <div class="field-label">อัตราแลกเปลี่ยน (THB ต่อ 1 ${cur}) — อ้างอิง${isIn ? ' อัตรา BOT วันที่โอน' : ''}</div>
      <input class="input num" id="fxRate" inputmode="decimal" value="${fxConvert.fxRate}" placeholder="เช่น 35.50" oninput="App._fxSync('fxRate',this.value)">
      <div class="field-label">${toLbl}</div>
      <input class="input num" id="fxTo" inputmode="decimal" value="${fxConvert.toAmount}" placeholder="0" oninput="App._fxSync('toAmount',this.value)">
      <div class="field-label">วันที่</div>
      <input class="input" type="date" id="fxDate" value="${fxConvert.date}" max="${S.todayISO()}" onchange="App._fxSync('date',this.value)">
      ${isIn ? `<div class="switch-row" style="margin-top:12px"><div class="txt"><div class="t">นับเป็นรายได้ (เสียภาษี)</div><div class="s">ปิดถ้าเป็นเงินของคุณเองที่เคยฝากเข้าไป — เป็นแค่การโอนกลับ ไม่นับภาษี</div></div><button class="sw-ui ${fxConvert.taxable ? 'on' : ''}" onclick="App.fxToggleTaxable()"></button></div>
      ${fxConvert.taxable ? `<div class="field-label">หมวดหมู่รายรับ</div><div class="wrap-chips">${catChips}</div>` : ''}` : ''}
      <button class="btn-primary" onclick="App.saveFXConvert()">${!isIn ? 'บันทึกการฝากเข้า' : fxConvert.taxable ? 'บันทึก + นับเป็นรายได้' : 'บันทึกการโอนกลับ'}</button>`;
    sheetWrap(inner, 'fxconvert');
  }

  /* =========================================================
     WALLETS (manage)
     ========================================================= */
  function renderWallets() {
    const ws = S.wallets(); const def = S.defaultWalletId();
    const rows = ws.map((w, i) => {
      const bal = S.walletBalance(w.id);
      const cur = w.currency || 'THB';
      const balStr = cur === 'THB' ? '฿' + fmt(bal) : currSymbol(cur) + fmt(bal) + ' ' + cur;
      const isFX = cur !== 'THB';
      return `<div class="cat-row" style="${w.enabled === false ? 'opacity:.5' : ''}">
        <span style="display:flex;flex-direction:column;gap:2px">
          <button class="act" onclick="App.moveWallet('${w.id}',-1)" ${i === 0 ? 'disabled' : ''}>${icon('i-up', 'sm')}</button>
          <button class="act" onclick="App.moveWallet('${w.id}',1)" ${i === ws.length - 1 ? 'disabled' : ''}>${icon('i-down', 'sm')}</button></span>
        <span class="avatar" style="width:34px;height:34px;color:${w.color}">${icon(w.icon, 'sm')}</span>
        <span class="nm">${esc(w.name)}${isFX ? ` <span class="badge" style="background:var(--trust);font-size:10px">${cur}</span>` : ''}<div class="num" style="font-size:12px;color:${bal < 0 ? 'var(--expense)' : 'var(--muted)'}">${balStr}</div></span>
        ${isFX ? `<button class="act" title="ฝาก/ถอน แปลงสกุล" onclick="App.openFXConvert('${w.id}')" style="color:var(--trust)">${icon('i-transfer', 'sm')}</button>` : `<button class="act" title="ตั้งเป็นกระเป๋าเริ่มต้น" onclick="App.setDefaultWallet('${w.id}')" style="color:${w.id === def ? 'var(--trust)' : 'var(--muted)'}">${icon('i-check', 'sm')}</button>`}
        <button class="act" style="color:${w.enabled === false ? 'var(--muted)' : 'var(--ink)'}" onclick="App.walToggleEnabled('${w.id}')" title="${w.enabled === false ? 'เปิดใช้งาน' : 'ปิดซ่อน'}">${icon(w.enabled === false ? 'i-eye-off' : 'i-eye', 'sm')}</button>
        <button class="act" onclick="App.openWallet('${w.id}')">${icon('i-edit', 'sm')}</button>
        <button class="act del" onclick="App.delWallet('${w.id}')" ${ws.length <= 1 ? 'disabled' : ''}>${icon('i-trash', 'sm')}</button></div>`;
    }).join('');
    $('#screen-wallets').innerHTML = `
      <div class="section" style="margin-top:14px"><span>รวมกระเป๋า THB</span><span class="num" style="color:var(--ink);font-size:16px">฿${fmt(S.totalBalance())}</span></div>
      ${rows}
      <button class="add-btn" onclick="App.openWallet()">${icon('i-plus')} เพิ่มกระเป๋า</button>
      <div class="empty" style="text-align:left;padding:14px 4px">✓ สีเขียว = กระเป๋าเริ่มต้น · ปุ่มตา = ซ่อน/แสดง · ↔ = แปลง FX</div>`;
  }

  /* =========================================================
     CATEGORIES (manage)
     ========================================================= */
  function renderCategories() {
    const cats = S.categories(catType);
    const rows = cats.map((c, i) => `<div class="cat-row">
      <span style="display:flex;flex-direction:column;gap:2px">
        <button class="act" onclick="App.moveCat('${c.id}',-1)" ${i === 0 ? 'disabled' : ''}>${icon('i-up', 'sm')}</button>
        <button class="act" onclick="App.moveCat('${c.id}',1)" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('i-down', 'sm')}</button></span>
      <span class="avatar" style="width:34px;height:34px;color:${c.color}">${icon(c.icon, 'sm')}</span>
      <span class="nm">${esc(c.name)}${c.isTaxable && S.settings().taxEnabled ? '<span class="tax-badge">ภาษี</span>' : ''}</span>
      <button class="act" onclick="App.editCat('${c.id}')">${icon('i-edit', 'sm')}</button>
      <button class="act del" onclick="App.deleteCat('${c.id}')">${icon('i-trash', 'sm')}</button></div>`).join('');
    $('#screen-categories').innerHTML = `
      <div class="toggle" style="margin-top:14px"><button class="seg ${catType === 'expense' ? 'on-exp' : ''}" onclick="App.catType('expense')">หมวดจ่าย</button><button class="seg ${catType === 'income' ? 'on-inc' : ''}" onclick="App.catType('income')">หมวดรับ</button></div>
      ${rows || '<div class="empty">ยังไม่มีหมวด</div>'}
      <button class="add-btn" onclick="App.editCat()">${icon('i-plus')} เพิ่มหมวดหมู่</button>`;
  }

  /* =========================================================
     SETTINGS
     ========================================================= */
  function renderSettings() {
    const st = S.settings(); const adv = mode() === 'advanced';
    const theme = localStorage.getItem(S.THEME_KEY) || 'system';
    const palette = localStorage.getItem(S.PALETTE_KEY) || 'default';
    const tseg = (val, txt) => `<button class="seg seg-sm ${theme === val ? 'on-trust' : ''}" onclick="App.setTheme('${val}')">${txt}</button>`;
    const pseg = (val, txt) => `<button class="seg seg-sm ${palette === val ? 'on-trust' : ''}" onclick="App.setPalette('${val}')">${txt}</button>`;
    const mseg = (val, txt) => `<button class="seg seg-sm ${st.mode === val ? 'on-trust' : ''}" onclick="App.setMode('${val}')">${txt}</button>`;
    $('#screen-settings').innerHTML = `
      <div class="set-head">โหมดการใช้งาน</div>
      <div class="set-item"><span class="ic">${icon('i-grid')}</span>
        <div class="body"><div class="t">รูปแบบแอป</div><div class="s">ง่าย = แค่รับ-จ่าย · ละเอียด = กระเป๋า+โอน+หนี้</div></div>
        <div class="toggle" style="padding:3px;gap:2px">${mseg('simple', 'ง่าย')}${mseg('advanced', 'ละเอียด')}</div></div>

      <div class="divider"></div>
      <div class="set-head">จัดการ</div>
      <button class="set-item" onclick="App.go('bills')"><span class="ic">${icon('i-bell')}</span><div class="body"><div class="t">บิลประจำ</div><div class="s">เพิ่ม/แก้บิล และตั้งการเตือน</div></div>${icon('i-chev', 'sm')}</button>
      ${adv ? `<button class="set-item" onclick="App.go('wallets')"><span class="ic">${icon('i-bank')}</span><div class="body"><div class="t">กระเป๋าเงิน</div><div class="s">หลายกระเป๋า, ยอดตั้งต้น, ตั้งเริ่มต้น</div></div>${icon('i-chev', 'sm')}</button>` : ''}
      <button class="set-item" onclick="App.go('categories')"><span class="ic">${icon('i-grid')}</span><div class="body"><div class="t">จัดการหมวดหมู่</div><div class="s">เพิ่ม/ลบ/แก้ชื่อ และจัดเรียง</div></div>${icon('i-chev', 'sm')}</button>
      <div class="set-item"><span class="ic">${icon('i-clock')}</span><div class="body"><div class="t">เวลาเตือนลงรายจ่าย</div><div class="s">แจ้งเตือนเมื่อเปิดแอปหลังเวลานี้</div></div>
        <input class="input num" type="time" style="width:110px" value="${st.reminderTime || '20:00'}" onchange="App.setReminderTime(this.value)"></div>

      <div class="divider"></div>
      <div class="set-head">หน้าตา</div>
      <div class="set-item"><span class="ic">${icon('i-moon')}</span><div class="body"><div class="t">ธีม</div><div class="s">สว่าง / มืด / ตามระบบ</div></div>
        <div class="toggle" style="padding:3px;gap:2px">${tseg('light', 'สว่าง')}${tseg('dark', 'มืด')}${tseg('system', 'ระบบ')}</div></div>
      <div class="set-item"><span class="ic">${icon('i-save')}</span><div class="body"><div class="t">ชุดสี</div><div class="s">ค่าเริ่มต้น (เขียว) / ดวงดาว ✦ (กลางคืน)</div></div>
        <div class="toggle" style="padding:3px;gap:2px">${pseg('default', 'ค่าเริ่มต้น')}${pseg('star', 'ดวงดาว')}</div></div>

      <div class="divider"></div>
      <div class="set-head">ภาษีเงินได้บุคคลธรรมดา (PIT)</div>
      <div class="set-item"><span class="ic">${icon('i-receipt')}</span>
        <div class="body"><div class="t">เปิดโหมดภาษี PIT</div><div class="s">คำนวณภาษีประมาณการ · ลดหย่อน · tag หมวดรายรับ</div></div>
        <button class="sw-ui ${st.taxEnabled ? 'on' : ''}" onclick="App.setTaxEnabled()"></button></div>
      <div class="set-item"><span class="ic">${icon('i-transfer')}</span>
        <div class="body"><div class="t">ติดตามรายได้ต่างประเทศ</div><div class="s">บันทึก USD/EUR รอโอนเข้าไทย · แปลงเป็น THB · เพิ่มตอนลงเงิน</div></div>
        <button class="sw-ui ${st.foreignIncomeEnabled ? 'on' : ''}" onclick="App.setForeignIncomeEnabled()"></button></div>
      ${st.taxEnabled ? `
      <div class="set-item"><span class="ic">${icon('i-cal')}</span>
        <div class="body"><div class="t">ปีภาษี</div><div class="s">ปีที่คำนวณรายได้</div></div>
        <select class="input" style="width:110px;padding:6px 8px" onchange="App.setTaxYear(Number(this.value))">
          ${[-3, -2, -1, 0].map((offset) => { const y = now.getFullYear() + offset; return `<option value="${y}" ${(st.taxYear || now.getFullYear()) === y ? 'selected' : ''}>${y + 543}</option>`; }).join('')}
        </select></div>
      <div class="set-head" style="font-size:12px;padding-top:6px;cursor:pointer" onclick="App.toggleTaxDedSection()">ค่าลดหย่อนประจำปี${taxDedOpen ? ' ▾' : ' ▸ (กดดู)'}</div>
      ${taxDedOpen ? [
        ['ประกันสังคม', 'socialSecurity', 'ถูกหักจากเงินเดือน 5% สูงสุด ฿9,000/ปี — ดูจากสลิปเงินเดือน'],
        ['ประกันชีวิต/สุขภาพ', 'lifeInsurance', 'เบี้ยประกันชีวิต + ประกันสุขภาพ — รวมกันสูงสุด ฿100,000/ปี'],
        ['RMF / SSF / กองทุน', 'rmf', 'กองทุนรวม RMF, SSF, กองทุนสำรองเลี้ยงชีพ — ดูจากหนังสือรับรองกองทุน'],
        ['ลดหย่อนบิดา/มารดา', 'parents', 'หักได้ 30,000 บ./คน (สูงสุด 2 คน = 60,000) — บิดา/มารดาอายุ 60+ และรายได้ไม่เกิน 30,000/ปี'],
        ['เงินบริจาค', 'donation', 'บริจาคทั่วไปหักได้ 1 เท่า · บริจาคการศึกษา/กีฬา/โรงพยาบาลรัฐหักได้ 2 เท่า'],
      ].map(([lbl, k, desc]) => `<div class="set-item" style="align-items:flex-start;padding:12px 0"><div class="body"><div class="t">${lbl}</div><div class="s" style="line-height:1.5">${desc}</div></div><input class="input num" style="width:100px;margin-top:2px;flex-shrink:0" inputmode="decimal" value="${(st.taxDeductions || {})[k] || ''}" placeholder="0" onchange="App.setTaxDed('${k}',this.value)"></div>`).join('') : ''}
      ` : ''}

      <div class="divider"></div>
      <div class="set-head">สำรองข้อมูล</div>
      <button class="set-item" onclick="App.exportData()"><span class="ic">${icon('i-export')}</span><div class="body"><div class="t">ส่งออกข้อมูล (JSON)</div><div class="s">บันทึกไฟล์สำรองไว้เอง</div></div></button>
      <button class="set-item" onclick="App.importData()"><span class="ic">${icon('i-import')}</span><div class="body"><div class="t">นำเข้าข้อมูล (JSON)</div><div class="s">แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรอง</div></div></button>
      <button class="set-item" onclick="App.resetData()"><span class="ic" style="color:var(--danger)">${icon('i-trash')}</span><div class="body"><div class="t">ล้างข้อมูลทั้งหมด</div><div class="s">ลบรายการ/บิล/หนี้ เริ่มต้นใหม่หน้าว่าง</div></div></button>

      <div class="divider"></div>
      <div class="set-head">แอป</div>
      ${isStandalone()
        ? `<div class="set-item"><span class="ic" style="color:var(--income)">${icon('i-check')}</span><div class="body"><div class="t">ติดตั้งแล้ว</div><div class="s">เปิดจากหน้าจอโฮม ใช้ออฟไลน์ได้</div></div></div>`
        : `<button class="set-item" onclick="App.installApp()"><span class="ic">${icon('i-import')}</span><div class="body"><div class="t">ติดตั้งแอปลงเครื่อง</div><div class="s">เพิ่มลงหน้าจอโฮม · เปิดเร็ว · ใช้ออฟไลน์ได้</div></div>${icon('i-chev', 'sm')}</button>`}

      <div class="divider"></div>
      <div class="set-head">เกี่ยวกับ</div>
      <div class="set-item"><div class="body"><div class="t">เงินของฉัน · เวอร์ชัน ${APP_VERSION}</div><div class="s">ข้อมูลเก็บในเครื่อง ไม่มี server · ใช้ออฟไลน์ได้</div></div></div>
      <div class="set-head">มีอะไรใหม่</div>
      ${CHANGELOG.map((c) => `
        <div class="changelog">
          <div class="cl-head"><span class="cl-ver">v${c.v}</span><span class="cl-date">${c.date}</span></div>
          <ul class="cl-list">${c.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>`).join('')}
      <input type="file" id="importFile" accept="application/json,.json" hidden>`;
    $('#importFile').addEventListener('change', onImportFile);
  }

  /* =========================================================
     ADD / EDIT TRANSACTION (+ transfer)
     ========================================================= */
  function openAdd(editId) {
    const t = editId ? S.transactions().find((x) => x.id === editId) : null;
    const defW = S.defaultWalletId();
    const second = (S.wallets().find((w) => w.id !== defW && (w.currency || 'THB') === 'THB') || {}).id || defW;
    add = t
      ? { id: t.id, type: t.type, amount: String(t.amount), toAmount: t.toAmount != null ? String(t.toAmount) : '', categoryId: t.categoryId || null, walletId: t.walletId || defW, toWalletId: t.toWalletId || second, date: t.date, note: t.note || '' }
      : { id: null, type: 'expense', amount: '0', toAmount: '', categoryId: null, walletId: defW, toWalletId: second, date: S.todayISO(), note: '' };
    if (add.type !== 'transfer' && !add.categoryId) { const c = S.categories(add.type)[0]; add.categoryId = c && c.id; }
    renderAdd();
  }
  function openTransfer() {
    const defW = S.defaultWalletId();
    const second = (S.wallets().find((w) => w.id !== defW && (w.currency || 'THB') === 'THB') || {}).id || defW;
    add = { id: null, type: 'transfer', amount: '0', toAmount: '', categoryId: null, walletId: defW, toWalletId: second, date: S.todayISO(), note: '' };
    renderAdd();
  }

  function renderAdd() {
    const anim = add._opened ? '' : ' anim'; add._opened = true;
    const adv = mode() === 'advanced';
    const isT = add.type === 'transfer';
    const kindCls = add.type === 'income' ? 'inc' : add.type === 'expense' ? 'exp' : '';
    const valStyle = isT ? 'style="color:var(--trust)"' : '';
    const selWallet = mode() === 'advanced' && !isT ? S.wallet(add.walletId) : null;
    const addCurrency = (selWallet && selWallet.currency) || 'THB';
    const addCurrSym = currSymbol(addCurrency);

    const seg = `<button class="seg ${add.type === 'expense' ? 'on-exp' : ''}" onclick="App.setKind('expense')">จ่าย</button>
      <button class="seg ${add.type === 'income' ? 'on-inc' : ''}" onclick="App.setKind('income')">รับ</button>
      ${adv ? `<button class="seg ${isT ? 'on-trust' : ''}" onclick="App.setKind('transfer')">โอน</button>` : ''}`;

    let body;
    if (isT) {
      body = `<div class="field-label" style="margin-top:4px">จาก</div><div class="wrap-chips">${walletChips(add.walletId, 'App.transFrom', true)}</div>
        <div class="field-label">ไปยัง</div><div class="wrap-chips">${walletChips(add.toWalletId, 'App.transTo', true)}</div>
        ${S.settings().foreignIncomeEnabled ? `<div class="empty" style="text-align:left;padding:8px 2px;font-size:12px">* ฝาก/ถอน กระเป๋าต่างประเทศ (แปลงสกุล+ค่าธรรมเนียม) ทำที่หน้า "จัดการกระเป๋า" ปุ่ม ↔</div>` : ''}`;
    } else {
      const cats = S.categories(add.type);
      const chips = cats.map((c) => `<div class="chip ${c.id === add.categoryId ? 'sel' : ''}" onclick="App.pickCat('${c.id}')">${icon(c.icon)}<span class="nm">${esc(c.name)}</span></div>`).join('') +
        `<div class="chip add" onclick="App.quickAddCat()">${icon('i-plus')}<span class="nm">เพิ่มหมวด</span></div>`;
      body = `<div class="chips">${chips}</div>${adv ? `<div class="field-label" style="margin-top:4px">กระเป๋า</div><div class="wrap-chips">${walletChips(add.walletId, 'App.pickWallet')}</div>` : ''}`;
    }

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'bs'];
    const pad = keys.map((k) => k === 'bs' ? `<button class="key" onclick="App.key('bs')">${icon('i-bs')}</button>` : `<button class="key num" onclick="App.key('${k}')">${k}</button>`).join('');

    $('#overlay').innerHTML = `
      <div class="sheet-dim${anim}" onclick="if(event.target===this)App.closeSheet()">
        <div class="sheet">
          <div class="grab" onclick="App.closeSheet()"></div>
          <div class="toggle">${seg}</div>
          <div class="amount-big"><span class="baht num">${addCurrSym}</span><span class="val num ${kindCls}" id="amtVal" ${valStyle}>${displayAmount(add.amount)}</span>${addCurrency !== 'THB' ? `<span style="font-size:13px;color:var(--muted);margin-left:4px">${addCurrency}</span>` : ''}</div>
          ${body}
          <div class="range-row" style="margin-top:6px">
            <div class="col"><input class="input" type="date" value="${add.date}" max="${S.todayISO()}" onchange="App.setDate(this.value)"></div>
            <div class="col"><input class="input" placeholder="โน้ต (ไม่บังคับ)" value="${esc(add.note)}" oninput="App.setNote(this.value)"></div></div>
          <div class="pad">${pad}</div>
          <button class="save ${kindCls}" ${isT ? 'style="background:var(--trust)"' : ''} onclick="App.saveTx()">${add.id ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
          ${add.id ? `<button class="btn-ghost" onclick="App.deleteTx()">ลบรายการนี้</button>` : ''}
        </div></div>`;
    initSheetSwipe();
  }

  function displayAmount(str) { const [i, d] = String(str).split('.'); const ip = Number(i || 0).toLocaleString('en-US'); return d != null ? `${ip}.${d}` : ip; }

  /* =========================================================
     BILL EDIT
     ========================================================= */
  function openBill(editId) {
    const b = editId ? S.bills().find((x) => x.id === editId) : null;
    bill = b ? { ...b, reminderDays: [...(b.reminderDays || [])] }
      : { id: null, name: '', amount: '', variable: false, categoryId: S.categories('expense')[0].id, dueDay: 1, reminderDays: [3, 1], enabled: true };
    renderBillEdit();
  }
  function renderBillEdit() {
    const cats = S.categories('expense');
    const catChips = cats.map((c) => `<span class="cchip ${c.id === bill.categoryId ? 'on' : ''}" onclick="App.billCat('${c.id}')">${esc(c.name)}</span>`).join('');
    const remChips = bill.reminderDays.slice().sort((a, b) => b - a).map((d) => `<span class="cchip on" onclick="App.remDel(${d})">${d} วัน <span class="x">×</span></span>`).join('') + `<span class="cchip add" onclick="App.remAdd()">${icon('i-plus', 'sm')} เพิ่ม</span>`;
    const inner = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><h1 style="font-size:18px">${bill.id ? 'แก้ไขบิล' : 'เพิ่มบิล'}</h1>
        ${bill.id ? `<button class="icon-btn" style="color:var(--danger)" onclick="App.deleteBill()">${icon('i-trash')}</button>` : ''}</div>
      <div class="field-label">ชื่อบิล</div><input class="input" id="billName" value="${esc(bill.name)}" placeholder="เช่น ค่าเน็ต AIS">
      <div class="switch-row"><div class="txt"><div class="t">จำนวนผันแปร</div><div class="s">เช่น ค่าไฟ ค่าน้ำ ที่ไม่เท่ากันทุกเดือน</div></div><button class="sw-ui ${bill.variable ? 'on' : ''}" onclick="App.billVar()"></button></div>
      <div id="amtField" ${bill.variable ? 'hidden' : ''}><div class="field-label">จำนวนเงิน</div><input class="input num" id="billAmount" inputmode="decimal" value="${bill.amount != null ? bill.amount : ''}" placeholder="0"></div>
      <div class="field-label">หมวดหมู่</div><div class="wrap-chips">${catChips}</div>
      <div class="field-label">ครบกำหนดทุกวันที่ <b id="dueLbl">${bill.dueDay}</b> ของเดือน</div>
      <input type="range" min="1" max="31" value="${bill.dueDay}" style="width:100%;accent-color:var(--trust)" oninput="App.billDue(this.value)">
      <div class="field-label">เตือนล่วงหน้า</div><div class="wrap-chips">${remChips}</div>
      <div class="switch-row"><div class="txt"><div class="t">เปิดใช้งานบิลนี้</div></div><button class="sw-ui ${bill.enabled ? 'on' : ''}" onclick="App.billEnabled()"></button></div>
      <button class="btn-primary" onclick="App.saveBill()">${bill.id ? 'บันทึกบิล' : 'เพิ่มบิล'}</button>`;
    sheetWrap(inner, 'bill');
  }

  /* =========================================================
     CATEGORY EDIT
     ========================================================= */
  function editCat(id) {
    const c = id ? S.category(id) : null;
    catEdit = c ? { ...c } : { id: null, name: '', type: catType, icon: ICON_CHOICES[0], color: COLOR_CHOICES[0], isTaxable: false };
    catEdit._fromAdd = false; renderCatEdit();
  }
  function renderCatEdit() {
    const fa = catEdit._fromAdd ? 'true' : 'false';
    const icons = ICON_CHOICES.map((ic) => `<button class="chip" style="width:52px;${ic === catEdit.icon ? 'border-color:var(--trust)' : ''}" onclick="App.catPickIcon('${ic}')">${icon(ic)}</button>`).join('');
    const colors = COLOR_CHOICES.map((col) => `<button onclick="App.catPickColor('${col}')" style="width:30px;height:30px;border-radius:50%;background:${col};border:3px solid ${col === catEdit.color ? 'var(--ink)' : 'transparent'};cursor:pointer"></button>`).join('');
    const inner = `<h1 style="font-size:18px;margin-bottom:6px">${catEdit.id ? 'แก้ไขหมวด' : 'เพิ่มหมวด'} (${catEdit.type === 'income' ? 'รับ' : 'จ่าย'})</h1>
      <div class="field-label">ชื่อหมวด</div><input class="input" id="catName" value="${esc(catEdit.name)}" placeholder="เช่น กาแฟ">
      <div class="field-label">ไอคอน</div><div class="chips" style="flex-wrap:wrap">${icons}</div>
      <div class="field-label">สี</div><div class="wrap-chips" style="gap:10px">${colors}</div>
      ${catEdit.type === 'income' && S.settings().taxEnabled ? `<div class="switch-row" style="margin-top:8px"><div class="txt"><div class="t">นับเป็นรายได้ภาษี</div><div class="s">รายได้จากหมวดนี้จะถูกนำไปคำนวณ PIT</div></div><button class="sw-ui ${catEdit.isTaxable ? 'on' : ''}" onclick="App.catTaxable()"></button></div>` : ''}
      <button class="btn-primary" onclick="App.saveCat(${fa})">บันทึก</button>`;
    sheetWrap(inner, 'cat');
  }

  /* =========================================================
     WALLET EDIT
     ========================================================= */
  function openWallet(id) {
    const w = id ? S.wallet(id) : null;
    wal = w ? { ...w } : { id: null, name: '', icon: 'i-wallet', color: '#34D399', currency: 'THB', enabled: true, openingBalance: 0 };
    renderWalletEdit();
  }
  function walCapture() { const n = $('#walName'); if (n) wal.name = n.value; const o = $('#walOpen'); if (o) wal.openingBalance = o.value; }
  function renderWalletEdit() {
    const icons = ICON_CHOICES.map((ic) => `<button class="chip" style="width:52px;${ic === wal.icon ? 'border-color:var(--trust)' : ''}" onclick="App.walIcon('${ic}')">${icon(ic)}</button>`).join('');
    const colors = COLOR_CHOICES.map((col) => `<button onclick="App.walColor('${col}')" style="width:30px;height:30px;border-radius:50%;background:${col};border:3px solid ${col === wal.color ? 'var(--ink)' : 'transparent'};cursor:pointer"></button>`).join('');
    const curChips = ['THB', 'USD'].map((c) => `<span class="cchip ${(wal.currency || 'THB') === c ? 'on' : ''}" onclick="App.walCurrency('${c}')">${c}</span>`).join('');
    const inner = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><h1 style="font-size:18px">${wal.id ? 'แก้ไขกระเป๋า' : 'เพิ่มกระเป๋า'}</h1>
        ${wal.id ? `<button class="icon-btn" style="color:var(--danger)" onclick="App.delWallet('${wal.id}')">${icon('i-trash')}</button>` : ''}</div>
      <div class="field-label">ชื่อกระเป๋า</div><input class="input" id="walName" value="${esc(wal.name)}" placeholder="เช่น PayPal หรือ กสิกรไทย">
      <div class="field-label">สกุลเงิน</div><div class="wrap-chips">${curChips}</div>
      ${(wal.currency || 'THB') === 'THB' ? `<div class="field-label">ยอดตั้งต้น (เงินที่มีอยู่ตอนนี้)</div><input class="input num" id="walOpen" inputmode="decimal" value="${wal.openingBalance || 0}">` : `<div class="field-label" style="color:var(--muted);font-size:12px">กระเป๋าต่างประเทศ — ยอดเริ่มต้น 0 (ลงรายรับเพื่อเพิ่มยอด)</div>`}
      <div class="field-label">ไอคอน</div><div class="chips" style="flex-wrap:wrap">${icons}</div>
      <div class="field-label">สี</div><div class="wrap-chips" style="gap:10px">${colors}</div>
      <div class="switch-row"><div class="txt"><div class="t">เปิดใช้งานกระเป๋านี้</div><div class="s">ปิด = ซ่อนจากฟอร์มและหน้าหลัก (ข้อมูลยังอยู่)</div></div><button class="sw-ui ${wal.enabled !== false ? 'on' : ''}" onclick="App.walToggleEdit()"></button></div>
      <button class="btn-primary" onclick="App.walSave()">บันทึก</button>`;
    sheetWrap(inner, 'wallet');
  }

  /* =========================================================
     DEBT EDIT + PAYMENT
     ========================================================= */
  function openDebt(id) {
    const d = id ? S.debt(id) : null;
    debtE = d ? { id: d.id, kind: d.kind, person: d.person, principal: d.principal, note: d.note, date: d.date, startWalletId: null }
      : { id: null, kind: 'iowe', person: '', principal: '', note: '', date: S.todayISO(), startWalletId: null };
    renderDebtEdit();
  }
  function debtCapture() {
    const p = $('#debtPerson'); if (p) debtE.person = p.value;
    const pr = $('#debtPrincipal'); if (pr) debtE.principal = pr.value;
    const n = $('#debtNote'); if (n) debtE.note = n.value;
    const dt = $('#debtDate'); if (dt) debtE.date = dt.value;
  }
  function renderDebtEdit() {
    const d = debtE; const editing = !!d.id;
    let paymentsHtml = '';
    if (editing) {
      const real = S.debt(d.id); const rem = S.debtRemaining(real);
      const pays = (real.payments || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      paymentsHtml = `<div class="field-label">การชำระ (เหลือ <b>฿${fmt(rem)}</b> / ฿${fmt(real.principal)})</div>
        ${pays.length ? pays.map((p) => { const w = S.wallet(p.walletId); return `<div class="pay-row">${icon('i-check', 'sm')}<span>฿${fmt(p.amount)} · ${dayLabel(p.date)}${w ? ' · ' + esc(w.name) : ''}</span><button class="del" onclick="App.delPayment('${d.id}','${p.id}')">${icon('i-trash', 'sm')}</button></div>`; }).join('') : '<div class="empty" style="padding:8px">ยังไม่มีการชำระ</div>'}
        <button class="btn-ghost" onclick="App.openPay('${d.id}')">${d.kind === 'iowe' ? '＋ บันทึกการจ่าย' : '＋ บันทึกรับคืน'}</button>`;
    }
    const startLabel = d.kind === 'iowe' ? 'ได้รับเงินยืมเข้ากระเป๋าตอนนี้' : 'หักเงินที่ให้ยืมออกจากกระเป๋าตอนนี้';
    const inner = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><h1 style="font-size:18px">${editing ? 'แก้ไขหนี้' : 'เพิ่มหนี้'}</h1>
        ${editing ? `<button class="icon-btn" style="color:var(--danger)" onclick="App.deleteDebt()">${icon('i-trash')}</button>` : ''}</div>
      <div class="toggle"><button class="seg ${d.kind === 'iowe' ? 'on-exp' : ''}" onclick="App.debtKind('iowe')">เรายืม (ต้องจ่าย)</button><button class="seg ${d.kind === 'owed' ? 'on-inc' : ''}" onclick="App.debtKind('owed')">ให้ยืม (รอรับคืน)</button></div>
      <div class="field-label">${d.kind === 'iowe' ? 'เจ้าหนี้ (ยืมจากใคร)' : 'ลูกหนี้ (ใครยืมเรา)'}</div><input class="input" id="debtPerson" value="${esc(d.person)}" placeholder="ชื่อ" oninput="App._ds('person',this.value)">
      <div class="field-label">จำนวนเงินรวม</div><input class="input num" id="debtPrincipal" inputmode="decimal" value="${d.principal || ''}" placeholder="0" oninput="App._ds('principal',this.value)">
      <div class="field-label">โน้ต (ไม่บังคับ)</div><input class="input" id="debtNote" value="${esc(d.note)}" placeholder="เช่น ยืมค่าเทอม" oninput="App._ds('note',this.value)">
      <div class="field-label">วันที่</div><input class="input" type="date" id="debtDate" value="${d.date}" max="${S.todayISO()}" onchange="App._ds('date',this.value)">
      ${!editing ? `<div class="switch-row"><div class="txt"><div class="t">เชื่อมกระเป๋าตอนนี้</div><div class="s">${startLabel}</div></div><button class="sw-ui ${d.startWalletId ? 'on' : ''}" onclick="App.debtLinkToggle()"></button></div>
        ${d.startWalletId ? `<div class="wrap-chips" style="margin-top:8px">${walletChips(d.startWalletId, 'App.debtStartWallet')}</div>` : ''}` : ''}
      ${paymentsHtml}
      <button class="btn-primary" onclick="App.saveDebt()">${editing ? 'บันทึก' : 'เพิ่มหนี้'}</button>`;
    sheetWrap(inner, 'debt');
  }
  function renderPay() {
    const d = S.debt(pay.debtId);
    const inner = `<h1 style="font-size:18px;margin-bottom:6px">${d.kind === 'iowe' ? 'บันทึกการจ่าย' : 'บันทึกรับคืน'} · ${esc(d.person)}</h1>
      <div class="field-label">จำนวนเงิน (เหลือ ฿${fmt(S.debtRemaining(d))})</div><input class="input num" id="payAmount" inputmode="decimal" value="${pay.amount}" placeholder="0">
      <div class="field-label">${d.kind === 'iowe' ? 'หักจากกระเป๋า' : 'เข้ากระเป๋า'}</div><div class="wrap-chips">${walletChips(pay.walletId, 'App.payWallet')}</div>
      <div class="field-label">วันที่</div><input class="input" type="date" id="payDate" value="${pay.date}" max="${S.todayISO()}">
      <button class="btn-primary" onclick="App.paySave()">บันทึก</button>`;
    sheetWrap(inner, 'pay');
  }

  function renderIosInstall() {
    const inner = `<h1 style="font-size:18px;margin-bottom:2px">ติดตั้งลงหน้าจอโฮม</h1>
      <div class="s-mut" style="font-size:13px;margin-bottom:6px">บน iPhone / iPad — เปิดด้วย Safari แล้วทำตามนี้</div>
      <div class="step"><span class="n">1</span><div class="d">แตะปุ่ม <b>แชร์</b> ${icon('i-export', 'sm')} ที่แถบด้านล่างของ Safari</div></div>
      <div class="step"><span class="n">2</span><div class="d">เลื่อนหาแล้วแตะ <b>“เพิ่มลงในหน้าจอโฮม”</b><br><small>Add to Home Screen</small></div></div>
      <div class="step"><span class="n">3</span><div class="d">แตะ <b>“เพิ่ม”</b> มุมขวาบน — เสร็จ! ไอคอนแอปจะอยู่หน้าจอโฮม เปิดใช้ออฟไลน์ได้</div></div>
      <button class="btn-primary" onclick="App.closeSheet()">เข้าใจแล้ว</button>`;
    sheetWrap(inner, 'ios');
  }

  /* ---------- overlay + toast ---------- */
  function initSheetSwipe() {
    const sheet = $('#overlay .sheet');
    if (!sheet) return;
    let startY = 0, active = false;
    sheet.addEventListener('touchstart', (e) => {
      const grab = sheet.querySelector('.grab');
      const fromGrab = grab && grab.contains(e.target);
      if (!fromGrab && sheet.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      active = true;
      sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) { e.preventDefault(); sheet.style.transform = `translateY(${dy}px)`; }
    }, { passive: false });
    sheet.addEventListener('touchend', (e) => {
      if (!active) return;
      active = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) {
        sheet.style.transition = 'transform .2s ease';
        sheet.style.transform = 'translateY(100%)';
        setTimeout(App.closeSheet, 180);
      } else {
        sheet.style.transition = 'transform .2s ease';
        sheet.style.transform = '';
        setTimeout(() => { if (sheet.isConnected) sheet.style.transition = ''; }, 200);
      }
    }, { passive: true });
  }

  function sheetWrap(inner, key) {
    const first = !openFlags[key]; openFlags[key] = true;
    $('#overlay').innerHTML = `<div class="sheet-dim${first ? ' anim' : ''}" onclick="if(event.target===this)App.closeSheet()"><div class="sheet"><div class="grab" onclick="App.closeSheet()"></div>${inner}</div></div>`;
    initSheetSwipe();
  }
  function flashSaved() {
    const ab = $('#overlay .amount-big'); if (ab) { ab.classList.remove('saved'); void ab.offsetWidth; ab.classList.add('saved'); }
    const btn = $('#overlay .save'); if (btn) { btn.classList.remove('saved'); void btn.offsetWidth; btn.classList.add('saved'); }
    toast('บันทึกแล้ว ✓ — ลงต่อได้เลย');
  }
  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1800); }

  // สีของ status bar (meta theme-color) ต่อ [ชุดสี][โหมด]
  const THEME_COLORS = {
    default: { light: '#FBF6EE', dark: '#0E1613' },
    star: { light: '#EAF2FB', dark: '#0B1730' },
  };
  function applyTheme(pref) {
    let t = pref; if (pref === 'system' || !pref) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const pal = localStorage.getItem(S.PALETTE_KEY) || 'default';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-palette', pal);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', (THEME_COLORS[pal] || THEME_COLORS.default)[t]);
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */
  const App = {
    go, openAdd, openTransfer, openBill, openDebt, openWallet,
    payBill(id, ym) { S.toggleBillPaid(id, ym); toast('บันทึกว่าจ่ายแล้ว'); render(current); },

    // add sheet
    setKind(k) { add.type = k; if (k !== 'transfer') { const c = S.categories(k).find((x) => x.id === add.categoryId) || S.categories(k)[0]; add.categoryId = c && c.id; } renderAdd(); },
    pickCat(id) { add.categoryId = id; renderAdd(); },
    pickWallet(id) { add.walletId = id; renderAdd(); },
    transFrom(id) { add.walletId = id; if (add.toWalletId === id) add.toWalletId = (S.wallets().find((w) => w.id !== id && (w.currency || 'THB') === 'THB') || {}).id; renderAdd(); },
    transTo(id) { add.toWalletId = id; if (add.walletId === id) add.walletId = (S.wallets().find((w) => w.id !== id && (w.currency || 'THB') === 'THB') || {}).id; renderAdd(); },
    setDate(v) { add.date = v; },
    setNote(v) { add.note = v; },
    setToAmount(v) { if (add) add.toAmount = v; },
    key(k) {
      let a = add.amount;
      if (k === 'bs') a = a.length > 1 ? a.slice(0, -1) : '0';
      else if (k === '.') { if (!a.includes('.')) a += '.'; }
      else { if (a === '0') a = k; else if (/\.\d\d$/.test(a)) return; else a += k; }
      add.amount = a; $('#amtVal').textContent = displayAmount(a);
    },
    saveTx() {
      const amt = parseFloat(add.amount);
      if (!amt || amt <= 0) { toast('ใส่จำนวนเงินก่อน'); return; }
      if (add.type === 'transfer') {
        if (add.walletId === add.toWalletId) { toast('เลือกกระเป๋าต่างใบ'); return; }
        const fromW = S.wallet(add.walletId), toW = S.wallet(add.toWalletId);
        const isCross = ((fromW && fromW.currency) || 'THB') !== ((toW && toW.currency) || 'THB');
        const toAmt = isCross ? (parseFloat(add.toAmount) || 0) : null;
        if (isCross && !toAmt) { toast('ใส่จำนวน ' + ((toW && toW.currency) || '') + ' ที่ได้รับด้วย'); return; }
        if (add.id) S.updateTransaction(add.id, { type: 'transfer', amount: amt, toAmount: isCross ? toAmt : undefined, walletId: add.walletId, toWalletId: add.toWalletId, date: add.date, note: add.note });
        else S.addTransfer({ fromWalletId: add.walletId, toWalletId: add.toWalletId, amount: amt, toAmount: isCross ? toAmt : null, date: add.date, note: add.note });
      } else {
        const payload = { type: add.type, amount: amt, categoryId: add.categoryId, walletId: add.walletId, date: add.date, note: add.note };
        if (add.id) S.updateTransaction(add.id, payload); else S.addTransaction(payload);
      }
      if (add.id) { closeSheet(); toast('แก้ไขแล้ว'); render(current); return; }
      render(current); add.amount = '0'; add.note = ''; renderAdd(); flashSaved();
    },
    deleteTx() { if (confirm('ลบรายการนี้?')) { S.deleteTransaction(add.id); closeSheet(); toast('ลบแล้ว'); render(current); } },
    quickAddCat() { editCat(); catEdit.type = add.type; catEdit._fromAdd = true; renderCatEdit(); },

    // bill
    billVar() { bill.variable = !bill.variable; const f = $('#amtField'); if (f) f.hidden = bill.variable; },
    billCat(id) { bill.categoryId = id; renderBillEdit(); },
    billDue(v) { bill.dueDay = Number(v); $('#dueLbl').textContent = v; },
    billEnabled() { bill.enabled = !bill.enabled; renderBillEdit(); },
    remDel(d) { bill.reminderDays = bill.reminderDays.filter((x) => x !== d); renderBillEdit(); },
    remAdd() { const v = prompt('เตือนล่วงหน้ากี่วัน?', '7'); const n = parseInt(v, 10); if (n > 0 && !bill.reminderDays.includes(n)) { bill.reminderDays.push(n); renderBillEdit(); } },
    saveBill() {
      const name = $('#billName').value.trim(); if (!name) { toast('ใส่ชื่อบิลก่อน'); return; }
      const amount = bill.variable ? null : parseFloat($('#billAmount') ? $('#billAmount').value : bill.amount) || 0;
      const payload = { name, amount, variable: bill.variable, categoryId: bill.categoryId, dueDay: bill.dueDay, reminderDays: bill.reminderDays, enabled: bill.enabled };
      if (bill.id) S.updateBill(bill.id, payload); else S.addBill(payload);
      closeSheet(); toast('บันทึกบิลแล้ว'); current === 'bills' ? render('bills') : go('bills');
    },
    deleteBill() { if (confirm('ลบบิลนี้?')) { S.deleteBill(bill.id); closeSheet(); toast('ลบบิลแล้ว'); render('bills'); } },

    catTaxable() { catEdit.isTaxable = !catEdit.isTaxable; renderCatEdit(); },

    // categories
    catType(t) { catType = t; renderCategories(); },
    moveCat(id, dir) { S.reorderCategory(id, dir); renderCategories(); },
    editCat,
    deleteCat(id) {
      const used = S.all().transactions.some((t) => t.categoryId === id);
      if (used && !confirm('มีรายการใช้หมวดนี้อยู่ ลบต่อ? (รายการเดิมจะไม่มีหมวด)')) return;
      if (!used && !confirm('ลบหมวดนี้?')) return;
      S.deleteCategory(id); renderCategories();
    },
    catPickIcon(ic) { catEdit.icon = ic; renderCatEdit(); },
    catPickColor(col) { catEdit.color = col; renderCatEdit(); },
    saveCat(fromAdd) {
      const name = $('#catName').value.trim(); if (!name) { toast('ใส่ชื่อหมวดก่อน'); return; }
      if (catEdit.id) S.updateCategory(catEdit.id, { name, icon: catEdit.icon, color: catEdit.color, isTaxable: !!catEdit.isTaxable });
      else { const c = S.addCategory({ name, type: catEdit.type, icon: catEdit.icon, color: catEdit.color, isTaxable: !!catEdit.isTaxable }); if (fromAdd && add) add.categoryId = c.id; }
      if (fromAdd && add) { openFlags.cat = false; renderAdd(); } else { closeSheet(); if (current === 'categories') renderCategories(); }
      toast('บันทึกหมวดแล้ว');
    },

    // wallets
    moveWallet(id, dir) { S.reorderWallet(id, dir); renderWallets(); },
    setDefaultWallet(id) {
      const w = S.wallet(id); if (!w || (w.currency || 'THB') !== 'THB') { toast('กระเป๋าเริ่มต้นต้องเป็น THB'); return; }
      S.setDefaultWallet(id); renderWallets(); toast('ตั้งเป็นกระเป๋าเริ่มต้นแล้ว');
    },
    walIcon(ic) { walCapture(); wal.icon = ic; renderWalletEdit(); },
    walColor(col) { walCapture(); wal.color = col; renderWalletEdit(); },
    walCurrency(c) { walCapture(); wal.currency = c; renderWalletEdit(); },
    walToggleEdit() { walCapture(); wal.enabled = wal.enabled === false ? true : false; renderWalletEdit(); },
    walToggleEnabled(id) { const w = S.wallet(id); if (w) { S.updateWallet(id, { enabled: !w.enabled }); renderWallets(); } },
    walSave() {
      const name = ($('#walName') || {}).value; if (!name || !name.trim()) { toast('ใส่ชื่อกระเป๋าก่อน'); return; }
      const cur = wal.currency || 'THB';
      const opening = cur === 'THB' ? (parseFloat(($('#walOpen') || {}).value) || 0) : 0;
      const patch = { name: name.trim(), icon: wal.icon, color: wal.color, currency: cur, enabled: wal.enabled !== false, openingBalance: opening };
      if (wal.id) S.updateWallet(wal.id, patch); else S.addWallet(patch);
      closeSheet(); toast('บันทึกกระเป๋าแล้ว'); renderWallets();
    },
    delWallet(id) {
      if (S.wallets().length <= 1) { toast('ต้องมีอย่างน้อย 1 กระเป๋า'); return; }
      if (!confirm('ลบกระเป๋านี้? รายการที่ผูกไว้จะย้ายไปกระเป๋าอื่น')) return;
      S.deleteWallet(id); closeSheet(); renderWallets();
    },

    // FX convert
    openFXConvert,
    _fxSync(k, v) { if (fxConvert) fxConvert[k] = v; },
    fxSetDir(dir) { if (fxConvert) { fxConvert.dir = dir === 'out' ? 'out' : 'in'; renderFXConvert(); } },
    fxPick(k, v) { if (fxConvert) { fxConvert[k] = v; renderFXConvert(); } },
    fxToggleTaxable() { if (fxConvert) { fxConvert.taxable = !fxConvert.taxable; renderFXConvert(); } },
    saveFXConvert() {
      const cur = fxConvert.currency; const isIn = fxConvert.dir === 'in';
      const fromAmt = parseFloat($('#fxFrom').value) || 0; if (!fromAmt || fromAmt <= 0) { toast('ใส่จำนวน' + (isIn ? cur : 'บาท') + 'ที่' + (isIn ? 'ถอน' : 'ฝาก')); return; }
      const toAmt = parseFloat($('#fxTo').value) || 0; if (!toAmt || toAmt <= 0) { toast('ใส่ยอดที่ได้รับจริง (หลังค่าธรรมเนียม)'); return; }
      const rate = parseFloat($('#fxRate').value) || 0;
      const w = S.wallet(fxConvert.walletId);
      let tr;
      if (isIn) {
        // ถอน: ต่างชาติ → THB. remit เฉพาะตอนนับเป็นรายได้
        tr = { fromWalletId: fxConvert.walletId, toWalletId: fxConvert.thbWalletId, amount: fromAmt, toAmount: toAmt, date: fxConvert.date, note: (w ? w.name : '') + ' ถอน ' + cur + ' ' + fromAmt + (rate ? ' @ ' + rate : '') };
        if (fxConvert.taxable) { tr.remit = true; tr.categoryId = fxConvert.catId; }
      } else {
        // ฝาก: THB → ต่างชาติ (ไม่นับภาษี). toAmount = ยอดต่างชาติที่เข้าจริง
        tr = { fromWalletId: fxConvert.thbWalletId, toWalletId: fxConvert.walletId, amount: fromAmt, toAmount: toAmt, date: fxConvert.date, note: 'ฝากเข้า ' + (w ? w.name : '') + ' ฿' + fromAmt + (rate ? ' @ ' + rate : '') };
      }
      S.addTransfer(tr);
      fxConvert = null; closeSheet(); toast(!isIn ? 'ฝากเข้าแล้ว' : tr.remit ? 'ถอนเข้าไทยแล้ว (นับเป็นรายได้ภาษี)' : 'โอนกลับแล้ว (ไม่นับภาษี)'); render(current);
    },

    // debt
    _ds(k, v) { if (debtE) debtE[k] = v; },
    debtKind(k) { debtCapture(); debtE.kind = k; renderDebtEdit(); },
    debtLinkToggle() { debtCapture(); debtE.startWalletId = debtE.startWalletId ? null : S.defaultWalletId(); renderDebtEdit(); },
    debtStartWallet(id) { debtCapture(); debtE.startWalletId = id; renderDebtEdit(); },
    saveDebt() {
      debtCapture();
      const person = (debtE.person || '').trim(); const principal = parseFloat(debtE.principal) || 0;
      if (!person) { toast('ใส่ชื่อก่อน'); return; }
      if (!principal || principal <= 0) { toast('ใส่จำนวนเงิน'); return; }
      const patch = { kind: debtE.kind, person, principal, note: (debtE.note || '').trim(), date: debtE.date };
      if (debtE.id) S.updateDebt(debtE.id, patch); else S.addDebt({ ...patch, startWalletId: debtE.startWalletId });
      closeSheet(); toast('บันทึกหนี้แล้ว'); render('debt');
    },
    deleteDebt() { if (confirm('ลบรายการหนี้นี้?')) { S.deleteDebt(debtE.id); closeSheet(); toast('ลบแล้ว'); render('debt'); } },
    openPay(debtId) { pay = { debtId, amount: '', walletId: S.defaultWalletId(), date: S.todayISO() }; openFlags.pay = false; renderPay(); },
    payWallet(id) { const el = $('#payAmount'); if (el) pay.amount = el.value; pay.walletId = id; renderPay(); },
    paySave() {
      const amt = parseFloat($('#payAmount').value) || 0; if (!amt || amt <= 0) { toast('ใส่จำนวนเงิน'); return; }
      pay.date = $('#payDate').value;
      S.addPayment(pay.debtId, { amount: amt, walletId: pay.walletId, date: pay.date });
      pay = null; toast('บันทึกการชำระแล้ว'); renderDebtEdit();
    },
    delPayment(debtId, pid) { if (confirm('ลบรายการชำระนี้?')) { S.deletePayment(debtId, pid); renderDebtEdit(); } },

    // history
    histSetMode(m) { hist.mode = m; renderHistory(); },
    histMonth(dir) { let m = hist.m + dir, y = hist.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return; hist.m = m; hist.y = y; renderHistory(); },
    histRange() { hist.start = $('#rangeStart').value; hist.end = $('#rangeEnd').value; if (hist.start && hist.end && hist.start > hist.end) { const t = hist.start; hist.start = hist.end; hist.end = t; } renderHistory(); },
    histPreset(p) { const end = new Date(), start = new Date(); if (p === 'year') start.setMonth(0, 1); else start.setDate(end.getDate() - (p - 1)); const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; hist.start = iso(start); hist.end = iso(end); renderHistory(); },
    histSearch(v) { hist.search = v; renderHistory(); },
    histType(v) { hist.typeFilter = v; renderHistory(); },
    histWallet(v) { hist.walletId = v; renderHistory(); },

    // tax
    setTaxEnabled() { S.updateSettings({ taxEnabled: !S.settings().taxEnabled }); buildNav(); const st = S.settings(); if (!st.taxEnabled && !st.foreignIncomeEnabled && current === 'tax') go('home'); renderSettings(); },
    setForeignIncomeEnabled() { S.updateSettings({ foreignIncomeEnabled: !S.settings().foreignIncomeEnabled }); buildNav(); const st = S.settings(); if (!st.taxEnabled && !st.foreignIncomeEnabled && current === 'tax') go('home'); if (current === 'tax') renderTax(); renderSettings(); },
    setTaxYear(y) { S.updateSettings({ taxYear: y }); renderSettings(); if (current === 'tax') renderTax(); },
    setTaxDed(k, v) { const d = { ...(S.settings().taxDeductions || {}) }; d[k] = parseFloat(v) || 0; S.updateSettings({ taxDeductions: d }); if (current === 'tax') renderTax(); },
    toggleCatTax(id) { const c = S.category(id); if (!c || c.type !== 'income') return; S.updateCategory(id, { name: c.name, icon: c.icon, color: c.color, isTaxable: !c.isTaxable }); renderTax(); },
    toggleTaxCatSection() { taxCatOpen = !taxCatOpen; renderTax(); },
    toggleTaxDedSection() { taxDedOpen = !taxDedOpen; renderSettings(); },

    // settings
    setMode(v) { S.updateSettings({ mode: v }); buildNav(); if (v === 'simple' && (current === 'debt' || current === 'wallets')) { go('home'); } else { setChrome(current); renderSettings(); } toast('เปลี่ยนโหมดแล้ว'); },
    setReminderTime(v) { S.updateSettings({ reminderTime: v }); toast('บันทึกเวลาแล้ว'); },
    setTheme(v) { localStorage.setItem(S.THEME_KEY, v); applyTheme(v); renderSettings(); },
    setPalette(v) { localStorage.setItem(S.PALETTE_KEY, v); applyTheme(localStorage.getItem(S.THEME_KEY) || 'system'); renderSettings(); },
    exportData() { const blob = new Blob([S.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ngern-backup-${S.todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('ส่งออกแล้ว'); },
    importData() { $('#importFile').click(); },
    resetData() { if (confirm('ล้างข้อมูลทั้งหมด? รายการ/บิล/หนี้จะถูกลบ เริ่มต้นใหม่หน้าว่าง (หมวดหมู่+กระเป๋าเริ่มต้นยังอยู่)')) { S.resetAll(); toast('ล้างข้อมูลแล้ว'); buildNav(); go('home'); } },

    closeSheet() { $('#overlay').innerHTML = ''; add = bill = catEdit = debtE = wal = pay = fxConvert = null; for (const k in openFlags) delete openFlags[k]; },
    applyUpdate() { if (App._waiting) App._waiting.postMessage('skipWaiting'); $('#updateBanner').hidden = true; },

    // install (PWA)
    async installApp() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null; $('#installBanner').hidden = true;
        toast(outcome === 'accepted' ? 'กำลังติดตั้ง…' : 'ยกเลิกการติดตั้ง');
        if (current === 'settings') renderSettings();
        return;
      }
      if (isIOS()) { renderIosInstall(); return; }
      toast('เปิดเมนู ⋮ ของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป”');
    },
    dismissInstall() { localStorage.setItem('ngern.installDismissed', '1'); $('#installBanner').hidden = true; },
    _waiting: null,
  };
  function closeSheet() { App.closeSheet(); }

  function onImportFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { S.importJSON(reader.result); toast('นำเข้าข้อมูลแล้ว'); buildNav(); go('home'); } catch (err) { alert('ไฟล์ไม่ถูกต้อง: ' + err.message); } };
    reader.readAsText(file);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  window.App = App;
  buildNav();
  applyTheme(localStorage.getItem(S.THEME_KEY) || 'system');
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if ((localStorage.getItem(S.THEME_KEY) || 'system') === 'system') applyTheme('system'); });
  go('home');

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; maybeShowInstall(); if (current === 'settings') renderSettings(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#installBanner').hidden = true; toast('ติดตั้งแล้ว ✓'); if (current === 'settings') renderSettings(); });
  setTimeout(maybeShowInstall, 1500);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) { App._waiting = nw; $('#updateBanner').hidden = false; }
        });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }
})();
