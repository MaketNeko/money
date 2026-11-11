// ทดสอบการคำนวณเงิน/ภาษี/หนี้/บิล กับ store.js ตัวจริง (localStorage ปลอม)
// รัน: node tests/calc.test.js   — ไม่ผ่านแม้ข้อเดียว exit code = 1
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../web-app/js/store.js'), 'utf8');
function fresh(data) {
  const mem = {}; if (data) mem['ngern.data.v1'] = JSON.stringify(data);
  const ctx = { window: {}, localStorage: { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) }, Date, Math, JSON, Number, Map, Set, String, Array, Object, console, Infinity };
  vm.runInNewContext(SRC, ctx); return ctx.window.Store;
}
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = Math.abs(got - want) < 1e-9 && Object.is(got, want) === Object.is(got, want); if (ok && !(Object.is(got, -0))) { pass++; console.log('  ok   ', name, '=', got); } else { fail++; console.log('  FAIL ', name, 'got', got, 'want', want); } };

console.log('\n[1] ยอดกระเป๋า + ถอน USD หมด (บั๊ก -0)');
let S = fresh(); S.updateSettings({ foreignIncomeEnabled: true });
S.addTransaction({ type: 'income', amount: 100.1, categoryId: 'c_side', walletId: 'w_payoneer' });
S.addTransaction({ type: 'income', amount: 0.2, categoryId: 'c_side', walletId: 'w_payoneer' });
S.addTransfer({ fromWalletId: 'w_payoneer', toWalletId: 'w_bank', amount: 100.3, toAmount: 3330.96 });
eq('Payoneer หลังถอนหมด', S.walletBalance('w_payoneer'), 0);
eq('ธนาคารได้ ฿', S.walletBalance('w_bank'), 3330.96);
eq('totalBalance (THB เท่านั้น)', S.totalBalance(), 3330.96);

console.log('\n[2] รายรับ/รายจ่ายเดือน (S.totals) — รวมสกุลปนกันไหม');
S.addTransaction({ type: 'income', amount: 50, categoryId: 'c_side', walletId: 'w_patreon' });   // $50
S.addTransaction({ type: 'income', amount: 1000, categoryId: 'c_salary', walletId: 'w_cash' });  // ฿1000
const ym = S.todayISO().slice(0, 7);
const isTHB = (x) => { const w = S.wallet(x.walletId); return !w || (w.currency || 'THB') === 'THB'; };
eq('รวมทุกสกุลแบบดิบ (ปน $) — ใช้ไม่ได้กับหน้าหลัก', S.totals(S.txInMonth(ym)).income, 1150.3);
eq('หน้าหลัก: รายรับเฉพาะกระเป๋าบาท', S.totals(S.txInMonth(ym).filter(isTHB)).income, 1000);

console.log('\n[3] ยอดตั้งต้นกระเป๋า (สูตรใหม่ v0.17)');
S = fresh(); S.updateWallet('w_cash', { openingBalance: 500 });
S.addTransaction({ type: 'expense', amount: 120, categoryId: 'c_food', walletId: 'w_cash' });
S.addTransaction({ type: 'income', amount: 1000, categoryId: 'c_salary', walletId: 'w_cash' });
const want = 5000, old = S.wallet('w_cash');
const flow = S.walletBalance('w_cash') - old.openingBalance;
S.updateWallet('w_cash', { openingBalance: Math.round((want - flow) * 100) / 100 });
eq('กรอก 5000 → ยอดกระเป๋า', S.walletBalance('w_cash'), 5000);
S.updateWallet('w_cash', { openingBalance: Math.round((want - (S.walletBalance('w_cash') - S.wallet('w_cash').openingBalance)) * 100) / 100 });
eq('บันทึกซ้ำอีกรอบ ไม่ทบ', S.walletBalance('w_cash'), 5000);

console.log('\n[4] หนี้');
S = fresh();
const d = S.addDebt({ kind: 'iowe', person: 'ก้อง', principal: 1000, startWalletId: 'w_cash' });
eq('ยืมเข้ากระเป๋า', S.walletBalance('w_cash'), 1000);
S.addPayment(d.id, { amount: 333.33, walletId: 'w_cash' }); S.addPayment(d.id, { amount: 333.33, walletId: 'w_cash' });
eq('คงเหลือหนี้', S.debtRemaining(S.debt(d.id)), 333.34);
S.clearDebts([d.id], { walletId: 'w_cash' });
eq('เคลียหมด → เหลือ', S.debtRemaining(S.debt(d.id)), 0);
eq('กระเป๋าหลังคืนหมด', S.walletBalance('w_cash'), 0);
S.updateDebt(d.id, { principal: 1200 });
eq('แก้เงินต้น 1000→1200 กระเป๋า = +200 (เงินยืมเพิ่ม)', S.walletBalance('w_cash'), 200);
eq('แก้เงินต้น → หนี้เหลือ', S.debtRemaining(S.debt(d.id)), 200);
const d2 = S.addDebt({ kind: 'owed', person: 'บี', principal: 500 });
S.addPayment(d2.id, { amount: 800, walletId: 'w_cash' });   // รับคืนเกิน
eq('รับคืนเกิน: หนี้เหลือ (clamp 0)', S.debtRemaining(S.debt(d2.id)), 0);
eq('รับคืนเกิน: กระเป๋านับเต็ม 800 → ส่วนเกิน 300 ไม่โผล่ที่ไหนในหน้าหนี้', S.walletBalance('w_cash'), 1000);

console.log('\n[5] ภาษีเงินได้บุคคล (ขั้นบันได)');
S = fresh();
// เข้าถึง calcPIT ผ่าน taxSummary: รายได้ R, ไม่มีลดหย่อนอื่น → net = R − min(R/2,100k) − 60k
function taxFor(income, ded) {
  const st = fresh(); st.updateCategory('c_salary', { isTaxable: true }); st.updateSettings({ taxYear: Number(st.todayISO().slice(0, 4)), taxDeductions: ded || {} });
  st.addTransaction({ type: 'income', amount: income, categoryId: 'c_salary', walletId: 'w_cash' });
  return st.taxSummary();
}
let ts = taxFor(660000); eq('รายได้ 660k → เงินได้สุทธิ', ts.netIncome, 500000); eq('ภาษี (0+7,500+20,000)', ts.estimatedTax, 27500);
ts = taxFor(1160000); eq('รายได้ 1.16M → สุทธิ 1M → ภาษี 115,000', ts.estimatedTax, 115000);
ts = taxFor(200000); eq('รายได้ 200k → สุทธิ 40k → ภาษี 0', ts.estimatedTax, 0);

console.log('\n[6] เพดานลดหย่อน');
ts = taxFor(660000, { lifeInsurance: 150000 });
eq('ประกันชีวิตกรอก 150k (เพดาน 100k) → สุทธิควรเป็น 400k', ts.netIncome, 400000);
ts = taxFor(660000, { donation: 100000 });
eq('บริจาคทั่วไป 100k (เพดาน 10% ของ 500k = 50k) → สุทธิควรเป็น 450k', ts.netIncome, 450000);
ts = taxFor(660000, { rmf: 300000, pensionInsurance: 250000 });
eq('RMF 300k(≤30%=198k) + บำนาญ 250k(≤15%=99k) → สุทธิควรเป็น 203k', ts.netIncome, 203000);

console.log('\n[7] บิล');
S = fresh();
const b = S.addBill({ name: 'เน็ต', amount: 599, categoryId: 'c_bill', dueDay: 31, reminderDays: [3] });
const st = S.billsWithStatus('2026-02-10T12:00:00'); eq('บิลวันที่ 31 ในเดือน ก.พ. → ครบ 28 → อีก 18 วัน', st[0].daysLeft, 18);
S.toggleBillPaid(b.id, ym); eq('กดจ่ายบิล → สร้างรายจ่ายอัตโนมัติ', S.transactions().length, 1);
S.toggleBillPaid(b.id, ym); eq('กดยกเลิกจ่าย → รายจ่ายควรถูกลบ', S.transactions().length, 0);

console.log('\n[6b] เพดานลดหย่อน (ต่อ)');
ts = taxFor(660000, { donationEdu: 40000 });
eq('บริจาคการศึกษา 40k ×2 = 80k (เพดาน 50k) → สุทธิ 450k', ts.netIncome, 450000);
ts = taxFor(660000, { socialSecurity: 9000, lifeInsurance: 20000 });
eq('ไม่เกินเพดาน → หักเต็ม → สุทธิ 471k', ts.netIncome, 471000);

console.log('\n[8] ย้อนกลับ (snapshot/restore)');
S = fresh();
const tx = S.addTransaction({ type: 'expense', amount: 99, categoryId: 'c_food', walletId: 'w_cash' });
const snap = S.snapshot(); S.deleteTransaction(tx.id);
eq('ลบแล้ว', S.transactions().length, 0);
S.restore(snap);
eq('กดย้อนกลับ → รายการกลับมา', S.transactions().length, 1);
eq('ยอดกระเป๋ากลับเหมือนเดิม', S.walletBalance('w_cash'), -99);

console.log(`\nสรุป: ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
