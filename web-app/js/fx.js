/* ===========================================================
   fx.js — ดึงอัตราแลกเปลี่ยนย้อนหลัง (ข้อมูล ECB ผ่าน frankfurter.dev)
   ไม่ต้องใช้ API key · CORS เปิด · ขอตามวันที่ได้ (เสาร์-อาทิตย์/วันหยุด
   ระบบถอยไปวันทำการก่อนหน้าให้เอง)

   ⚠️ ใช้เป็น "ตัวช่วยเติมค่า" เท่านั้น — เป็นเรตกลางตลาด ไม่ใช่อัตราอ้างอิง
   ธปท. หรือเรตธนาคารที่เรารับจริง ซึ่งเป็นอัตราที่ถูกต้องตามกฎหมาย
   (ป.132/2548) เพราะงั้นต้องแก้ทับด้วยมือได้เสมอ
   =========================================================== */
(function () {
  'use strict';

  const CACHE_KEY = 'ngern.fxcache';
  const API = 'https://api.frankfurter.dev/v1/';
  const TIMEOUT = 8000;

  let cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { cache = {}; }
  const persist = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* เต็มก็ช่าง */ } };

  const norm = (cur) => String(cur || 'USD').toUpperCase();

  function cached(date, cur) {
    const m = cache[norm(cur)];
    return m && m[date] != null ? m[date] : null;
  }
  function put(date, cur, rate) {
    const k = norm(cur);
    if (!cache[k]) cache[k] = {};
    cache[k][date] = rate;
    persist();
  }

  /* คืน { rate, from:'cache'|'net', asOf } — หรือ null ถ้าดึงไม่ได้
     (ออฟไลน์ / ยิงไม่ติด / สกุลไม่รองรับ) ผู้เรียกต้องรองรับ null เสมอ */
  async function rate(date, cur) {
    const c = norm(cur);
    if (c === 'THB') return { rate: 1, from: 'cache', asOf: date };

    const hit = cached(date, c);
    if (hit != null) return { rate: hit, from: 'cache', asOf: date };
    if (navigator.onLine === false) return null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${API}${date}?base=${c}&symbols=THB`, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      const r = j && j.rates && j.rates.THB;
      if (!r) return null;
      put(date, c, r); // เก็บใต้ "วันที่ที่ขอ" เพื่อไม่ต้องยิงซ้ำ
      return { rate: r, from: 'net', asOf: j.date };
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  window.FX = { rate, cached };
})();
