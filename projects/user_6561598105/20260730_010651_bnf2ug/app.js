/* ============================================================
   بوابة نتيجة الثانوية العامة — ٢٠٢٥ / ٢٠٢٦
   بحث برقم الجلوس أو بالاسم في ١٬٧٣٠٬٣٧٦ طالبًا وطالبة.

   البيانات ثابتة ومُقسَّمة إلى شرائح (data/seat/*.txt و data/name/*.txt)،
   فلا يُحمَّل من قاعدة البيانات إلا الشريحة التي تخصّ البحث الحالي.
   ============================================================ */
"use strict";

/* ━━━ الإعدادات ━━━ */
const CONFIG = {
  authority: "وزارة التربية والتعليم والتعليم الفني",
  examTitle: "نتيجة الثانوية العامة",
  year: "2025 / 2026",
  dataDir: "data",
  maxNameShards: 3,   // أقصى عدد شرائح تُجلب لبحث اسم واحد
  maxMatches: 60,     // أقصى عدد نتائج تُعرض للاختيار
  shardCache: 8,      // عدد الشرائح المحفوظة في الذاكرة
};

// عدّاد الزيارات (خدمة مجانية بدون تسجيل).
const COUNTER = { enabled: true, namespace: "natiga-thanawy-2026", key: "visits" };

/* ━━━ التقديرات ━━━ */
const GRADES = [
  { min: 90, label: "امتياز" },
  { min: 80, label: "جيد جدًا" },
  { min: 65, label: "جيد" },
  { min: 50, label: "مقبول" },
];

// رموز الحالة كما وردت في المصدر (manifest.cases)
const CASE_PASS = 0, CASE_SECOND = 1, CASE_FAIL = 2, CASE_ABSENT = 3;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   أدوات
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toWesternDigits(s) {
  return String(s == null ? "" : s)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0);
}

/* مفتاح البحث بالاسم — يجب أن يطابق name_key() في tools/build_data.py حرفًا بحرف:
   حروف عربية فقط، بلا مسافات ولا تشكيل ولا همزات. */
function nameKey(s) {
  return String(s == null ? "" : s)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")   // tashkeel + tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")  // alef forms -> alef
    .replace(/\u0649/g, "\u064A")   // alef maqsura -> ya
    .replace(/\u0629/g, "\u0647")   // ta marbuta   -> ha
    .replace(/\u0624/g, "\u0648")   // waw hamza    -> waw
    .replace(/\u0626/g, "\u064A")   // ya hamza     -> ya
    .replace(/[^\u0622-\u064A]/g, "");  // arabic letters only
}


const arNum = n => (n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("ar-EG"));
const toArDigits = s => String(s).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

function fmtMark(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2).replace(/\.?0+$/, "") + "%";
}
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   طبقة البيانات
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Data = {
  manifest: null,
  seatShards: null,      // Set من معرّفات شرائح رقم الجلوس الموجودة
  top: null,
  cache: new Map(),      // مسار الشريحة → بياناتها المُحلَّلة
  ready: false,
  failed: false,
};

async function fetchText(path) {
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(path + " → " + res.status);
  return res.text();
}

function cachePut(key, value) {
  Data.cache.set(key, value);
  while (Data.cache.size > CONFIG.shardCache) {
    Data.cache.delete(Data.cache.keys().next().value);
  }
}

async function loadManifest() {
  const m = JSON.parse(await fetchText(CONFIG.dataDir + "/manifest.json"));
  Data.manifest = m;
  Data.seatShards = new Set(m.seat.shards);
  Data.ready = true;
  return m;
}

async function loadTop() {
  if (!Data.top) Data.top = JSON.parse(await fetchText(CONFIG.dataDir + "/top.json"));
  return Data.top;
}

/* سجل الطالب الموحَّد */
function makeStudent(seat, name, d2, caseCode, oldScale) {
  return {
    seat: seat,
    name: name,
    d2: d2,                                  // الدرجة × ٢
    total: d2 / 2,
    case: caseCode,
    group: Math.floor(seat / 1000000),       // ١ أو ٢
    scale: oldScale ? 410 : 320,
  };
}

/* ── البحث برقم الجلوس ── */
async function lookupSeat(seat) {
  const div = Data.manifest.seat.div;
  const sid = Math.floor(seat / div);
  if (!Data.seatShards.has(sid)) return null;

  const path = CONFIG.dataDir + "/seat/" + sid + ".txt";
  let map = Data.cache.get(path);
  if (!map) {
    const text = await fetchText(path);
    const lines = text.split(/\r?\n/);
    const base = parseInt(lines[0], 10);
    map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split("|");
      if (p.length < 4) continue;
      const s = base + (+p[0]);
      map.set(s, makeStudent(s, p[1], +p[2], +p[3], p[4] === "1"));
    }
    cachePut(path, map);
  }
  return map.get(seat) || null;
}

/* ── البحث بالاسم ── */
// أي شرائح قد تحوي أسماء تبدأ بـ q؟ (الشرائح مرتّبة أبجديًا بمفتاح الاسم)
function nameShardRange(q) {
  const firsts = Data.manifest.name.firsts;
  const hi = q + "￿";
  // أكبر i حيث firsts[i] <= q  (وإلا 0)
  let lo = 0, a = 0, b = firsts.length - 1;
  while (a <= b) {
    const mid = (a + b) >> 1;
    if (firsts[mid] <= q) { lo = mid; a = mid + 1; } else b = mid - 1;
  }
  // أكبر i حيث firsts[i] <= hi
  let up = lo; a = lo; b = firsts.length - 1;
  while (a <= b) {
    const mid = (a + b) >> 1;
    if (firsts[mid] <= hi) { up = mid; a = mid + 1; } else b = mid - 1;
  }
  return [lo, up];
}

async function loadNameShard(sid) {
  const path = CONFIG.dataDir + "/name/" + sid + ".txt";
  let rows = Data.cache.get(path);
  if (!rows) {
    const text = await fetchText(path);
    rows = [];
    for (const line of text.split(/\r?\n/)) {
      const p = line.split("|");
      if (p.length < 4) continue;
      const st = makeStudent(+p[1], p[0], +p[2], +p[3], p[4] === "1");
      st.key = nameKey(st.name);
      rows.push(st);
    }
    cachePut(path, rows);
  }
  return rows;
}

async function lookupName(rawQuery) {
  const q = nameKey(rawQuery);
  if (!q) return { status: "empty" };
  if (q.length < 4) return { status: "short" };

  const [lo, up] = nameShardRange(q);
  const span = up - lo + 1;
  if (span > CONFIG.maxNameShards) return { status: "broad", span };

  const shards = [];
  for (let i = lo; i <= up; i++) shards.push(loadNameShard(i));
  const loaded = await Promise.all(shards);

  const exact = [];
  for (const rows of loaded) {
    for (const st of rows) if (st.key.startsWith(q)) exact.push(st);
  }
  if (exact.length) return { status: "ok", matches: exact };

  // تسامح: كل أجزاء الاسم موجودة داخل الشرائح المُحمَّلة
  const parts = String(rawQuery).trim().split(/\s+/).map(nameKey).filter(Boolean);
  const loose = [];
  if (parts.length > 1) {
    for (const rows of loaded) {
      for (const st of rows) if (parts.every(p => st.key.includes(p))) loose.push(st);
    }
  }
  return loose.length ? { status: "ok", matches: loose, loose: true } : { status: "none" };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   حساب النتيجة
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function gradeOf(pct) {
  for (const g of GRADES) if (pct >= g.min) return g.label;
  return "—";
}

function computeResult(st) {
  const scale = Data.manifest.scales[String(st.scale)] || Data.manifest.scales["320"];
  const max = scale.max;
  const hasScore = st.d2 > 0;
  const pct = hasScore ? (st.total / max) * 100 : 0;
  const official = st.case >= 0;

  let kind, status, detail;
  if (official) {
    if (st.case === CASE_ABSENT) {
      kind = "absent"; status = "غياب كلّي"; detail = "لم يؤدِّ الطالب امتحانات الدور الأول.";
    } else if (st.case === CASE_PASS) {
      kind = "pass"; status = "ناجح";
      detail = hasScore ? "اجتاز الطالب امتحانات الدور الأول بنجاح."
                        : "ناجح — لم تُرصد الدرجات في هذا الكشف.";
    } else if (st.case === CASE_SECOND) {
      kind = "second"; status = "له دور ثانٍ"; detail = "على الطالب أداء امتحان الدور الثاني.";
    } else {
      kind = "fail"; status = "غير حاصل على النجاح"; detail = "يُرجى مراجعة الإدارة التعليمية للتفاصيل.";
    }
  } else if (!hasScore) {
    kind = "unknown"; status = "لا توجد درجات مرصودة";
    detail = "لم تُرصد درجات لهذا الرقم في كشف النتيجة.";
  } else if (pct >= (Data.manifest.passRatio || 0.5) * 100) {
    kind = "pass"; status = "ناجح";
    detail = "المجموع يتجاوز حدّ النجاح (٥٠٪ من المجموع الكلي).";
  } else {
    kind = "below"; status = "أقل من حدّ النجاح";
    detail = "المجموع دون ٥٠٪ — الحالة الرسمية غير مُدرجة في كشف هذه المجموعة.";
  }

  const grade = hasScore && (kind === "pass" || kind === "second") ? gradeOf(pct)
              : hasScore ? gradeOf(pct) : "—";

  // الترتيب: يُعرض فقط على سُلّم ٣٢٠ (المجموعة الكاملة والموثوقة إحصائيًا)
  let rank = null, rankOf = null, topPct = null;
  if (hasScore && st.scale === 320 && scale.rank) {
    rank = scale.rank[st.d2] || null;
    rankOf = scale.count;
    if (rank) topPct = (rank / rankOf) * 100;
  }

  return { max, total: st.total, pct, hasScore, official, kind, status, detail, grade, rank, rankOf, topPct };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const dom = {};
["searchView", "resultView", "topView", "statsView", "searchForm", "searchInput", "searchHint",
 "searchBtn", "statePanel", "matchesPanel", "certificate", "dataBadge", "backBtn", "printBtn",
 "certBtn", "brandHome", "counterWrap", "visitCount", "podium", "topBoard", "statGrid",
 "chart", "statNote"].forEach(id => { dom[id] = document.getElementById(id); });
dom.segBtns = document.querySelectorAll(".seg__btn");
dom.seg = document.querySelector(".seg");
dom.navtabs = document.querySelectorAll(".navtab");

const State = { mode: "seat", view: "search", current: null, navigating: false };

/* ━━━ التنقّل بين الأقسام ━━━ */
function setView(view, opts) {
  State.view = view;
  dom.searchView.hidden = view !== "search";
  dom.resultView.hidden = view !== "result";
  dom.topView.hidden = view !== "top";
  dom.statsView.hidden = view !== "stats";
  dom.navtabs.forEach(b => {
    const on = b.dataset.view === view || (view === "result" && b.dataset.view === "search");
    b.classList.toggle("is-active", on);
  });
  if (!(opts && opts.keepScroll)) window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "top") renderTop();
  if (view === "stats") renderStats();
}

function setHash(h) {
  State.navigating = true;
  if (location.hash !== h) location.hash = h;
  setTimeout(() => { State.navigating = false; }, 0);
}

async function applyHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (h === "top") return setView("top");
  if (h === "stats") return setView("stats");
  const m = h.match(/^seat=(\d+)$/);
  if (m) {
    setView("search", { keepScroll: true });
    await runSeatSearch(m[1], true);
    return;
  }
  setView("search");
  hidePanels();
}

/* ━━━ عدّاد الزيارات ━━━ */
async function loadCounter() {
  if (!COUNTER.enabled || !dom.counterWrap) return;
  const { namespace: ns, key } = COUNTER;
  const firstVisit = !sessionStorage.getItem("nt_visited");
  let value = null;
  try {
    const r = await fetch(`https://abacus.jasoncameron.dev/${firstVisit ? "hit" : "get"}/${ns}/${key}`);
    if (r.ok) { const j = await r.json(); if (typeof j.value === "number") value = j.value; }
  } catch (e) { /* غير متصل */ }
  if (value == null && firstVisit) {
    try {
      const r = await fetch(`https://api.counterapi.dev/v1/${ns}/${key}/up`);
      if (r.ok) { const j = await r.json(); if (typeof j.count === "number") value = j.count; }
    } catch (e) {}
  }
  if (value == null) { dom.counterWrap.hidden = true; return; }
  if (firstVisit) sessionStorage.setItem("nt_visited", "1");
  dom.counterWrap.hidden = false;
  animateCount(dom.visitCount, value);
}

function animateCount(node, to) {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || to < 1) { node.textContent = arNum(to); return; }
  const dur = 900, t0 = performance.now();
  (function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    node.textContent = arNum(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ━━━ حالات واجهة البحث ━━━ */
function setMode(next) {
  State.mode = next;
  dom.segBtns.forEach(b => {
    const active = b.dataset.mode === next;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  dom.seg.dataset.mode = next;
  if (next === "seat") {
    dom.searchInput.inputMode = "numeric";
    dom.searchInput.placeholder = "أدخل رقم الجلوس";
    dom.searchInput.setAttribute("aria-label", "رقم الجلوس");
    dom.searchHint.textContent = "اكتب رقم الجلوس المكوّن من ٧ أرقام ثم اضغط بحث.";
  } else {
    dom.searchInput.inputMode = "text";
    dom.searchInput.placeholder = "أدخل اسم الطالب من أوله";
    dom.searchInput.setAttribute("aria-label", "اسم الطالب");
    dom.searchHint.textContent = "اكتب الاسم من أوله (الاسم الأول فاسم الأب فالجد…) — كلما زاد الاسم دقّت النتيجة.";
  }
  dom.searchInput.value = "";
  hidePanels();
  dom.searchInput.focus();
}

function hidePanels() {
  dom.statePanel.hidden = true; dom.matchesPanel.hidden = true;
  dom.statePanel.innerHTML = ""; dom.matchesPanel.innerHTML = "";
}
function showLoading(msg) {
  hidePanels();
  dom.statePanel.hidden = false;
  dom.statePanel.innerHTML =
    `<div class="loader" role="status"><span></span><span></span><span></span></div>
     <p class="panel__text" style="margin-top:14px">${esc(msg || "جارٍ البحث…")}</p>`;
}
function showEmpty(title, msg) {
  hidePanels();
  dom.statePanel.hidden = false;
  dom.statePanel.innerHTML =
    `<div class="panel__icon">🔍</div><h3 class="panel__title">${esc(title)}</h3><p class="panel__text">${msg}</p>`;
}

function showMatches(list, total) {
  hidePanels();
  dom.matchesPanel.hidden = false;
  const shown = list.slice(0, CONFIG.maxMatches);
  const more = total > shown.length ? ` (تُعرض أول ${arNum(shown.length)} من ${arNum(total)})` : "";
  dom.matchesPanel.appendChild(el("p", "matches__head",
    `وُجد ${arNum(total)} طالبًا${more} — اختر الاسم لعرض النتيجة:`));
  shown.forEach((s, i) => {
    const r = computeResult(s);
    const card = el("button", "match");
    card.type = "button";
    card.style.animationDelay = `${Math.min(i, 12) * 0.03}s`;
    card.innerHTML =
      `<span class="match__seat" dir="ltr">${s.seat}</span>
       <span class="match__body">
         <span class="match__name">${esc(s.name)}</span>
         <span class="match__meta">${r.hasScore ? `المجموع ${fmtMark(r.total)} من ${r.max} · ${fmtPct(r.pct)}` : "لا توجد درجات"}</span>
       </span>
       <span class="match__go" aria-hidden="true">‹</span>`;
    card.addEventListener("click", () => openStudent(s));
    dom.matchesPanel.appendChild(card);
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   بطاقة النتيجة
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ringSvg(pct, kind) {
  const R = 52, C = 2 * Math.PI * R;
  const on = Math.max(0, Math.min(100, pct)) / 100 * C;
  return `
    <svg class="ring ring--${kind}" viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
      <circle cx="64" cy="64" r="${R}" class="ring__track"/>
      <circle cx="64" cy="64" r="${R}" class="ring__bar" stroke-dasharray="${on.toFixed(1)} ${C.toFixed(1)}"/>
    </svg>`;
}

function distributionBar(st, r) {
  const scale = Data.manifest.scales[String(st.scale)];
  if (!scale || !scale.hist || !r.hasScore) return "";
  const hist = scale.hist;
  const peak = Math.max.apply(null, hist);
  const mine = Math.min(hist.length - 1, Math.floor(st.d2 / 20));
  const bars = hist.map((v, i) => {
    const h = peak ? Math.max(2, Math.round((v / peak) * 100)) : 2;
    const cls = i === mine ? " is-me" : "";
    const from = i * 10, to = from + 9;
    return `<span class="dist__bar${cls}" style="height:${h}%" title="${from}–${to}: ${arNum(v)} طالب"></span>`;
  }).join("");
  return `
    <div class="dist reveal" style="animation-delay:.22s">
      <h3 class="grades__cap">موقع الطالب في توزيع المجاميع</h3>
      <div class="dist__chart">${bars}</div>
      <div class="dist__axis"><span>٠</span><span>${toArDigits(Math.round(r.max / 2))}</span><span>${toArDigits(r.max)}</span></div>
      <p class="dist__note">العمود المميّز هو الشريحة التي يقع فيها مجموع الطالب بين ${arNum(scale.count)} طالبًا وطالبة.</p>
    </div>`;
}

function renderResult(st) {
  State.current = st;
  const r = computeResult(st);
  const inner = el("div", "cert-inner");

  inner.appendChild(el("div", "cert-head reveal",
    `<p class="cert-head__auth">${esc(CONFIG.authority)}</p>
     <h2 class="cert-head__title">${esc(CONFIG.examTitle)}</h2>
     <p class="cert-head__year">العام الدراسي <span dir="ltr">${CONFIG.year}</span></p>`));

  const id = el("div", "cert-id reveal");
  id.style.animationDelay = ".05s";
  id.innerHTML =
    `<div class="id-name">
       <span class="id-name__label">اسم الطالب</span>
       <span class="id-name__value">${esc(st.name) || "—"}</span>
     </div>
     <div class="id-field id-field--seat"><p class="id-field__label">رقم الجلوس</p><p class="id-field__value" dir="ltr">${st.seat}</p></div>
     <div class="id-field"><p class="id-field__label">الشهادة</p><p class="id-field__value">الثانوية العامة — الدور الأول</p></div>`;
  inner.appendChild(id);

  // ── اللافتة: النسبة المئوية هي البطل ──
  const verdict = el("div", `verdict verdict--${r.kind} reveal`);
  verdict.style.animationDelay = ".1s";
  verdict.innerHTML =
    `<div class="verdict__ring">
       ${ringSvg(r.pct, r.kind)}
       <div class="ring__label">
         <b>${r.hasScore ? fmtPct(r.pct) : "—"}</b>
         <small>النسبة المئوية</small>
       </div>
     </div>
     <div class="verdict__main">
       <span class="verdict__status">${esc(r.status)}</span>
       <span class="verdict__detail">${esc(r.detail)}</span>
       ${r.official ? "" : `<span class="verdict__flag">الحالة مستنتجة من المجموع — كشف هذه المجموعة لا يتضمّن عمود الحالة.</span>`}
     </div>
     <div class="verdict__stats">
       <div class="vstat"><b>${r.hasScore ? fmtMark(r.total) : "—"}</b><span>من ${r.max}</span></div>
       <div class="vstat"><b>${r.hasScore ? fmtPct(r.pct) : "—"}</b><span>النسبة المئوية</span></div>
       <div class="vstat"><b>${esc(r.grade)}</b><span>التقدير</span></div>
     </div>`;
  inner.appendChild(verdict);

  // ── الترتيب ──
  if (r.rank) {
    const TROPHY = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0zM6 5H4a2 2 0 0 0 0 4h2m12-4h2a2 2 0 0 1 0 4h-2"/></svg>`;
    const CHART = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M7 21V10M12 21V4M17 21v-7"/></svg>`;
    const first = r.rank === 1;
    const ranks = el("div", "ranks reveal");
    ranks.style.animationDelay = ".16s";
    ranks.innerHTML =
      `<div class="rank-card${first ? " is-first" : ""}">
         <span class="rank-card__ic">${TROPHY}</span>
         <span class="rank-card__txt">
           <span class="rank-card__label">الترتيب على مستوى الجمهورية</span>
           <span class="rank-card__value">${first ? "<b>الأول</b>" : "<b>" + arNum(r.rank) + "</b>"} <small>من ${arNum(r.rankOf)}</small></span>
         </span>
       </div>
       <div class="rank-card">
         <span class="rank-card__ic">${CHART}</span>
         <span class="rank-card__txt">
           <span class="rank-card__label">الشريحة</span>
           <span class="rank-card__value"><b>أفضل ${fmtPct(r.topPct)}</b> <small>من الطلاب</small></span>
         </span>
       </div>`;
    inner.appendChild(ranks);
  }

  // ── ملخّص الدرجة ──
  const sum = el("div", "grades reveal");
  sum.style.animationDelay = ".2s";
  sum.appendChild(el("h3", "grades__cap", "ملخّص النتيجة"));
  const table = el("table", "gtable");
  table.innerHTML =
    `<thead><tr><th>البيان</th><th>القيمة</th></tr></thead>
     <tbody>
       <tr><td>المجموع الكلي</td><td class="score">${r.hasScore ? fmtMark(r.total) : "—"}</td></tr>
       <tr><td>الدرجة العظمى</td><td class="score">${r.max}</td></tr>
       <tr><td>النسبة المئوية</td><td class="score">${r.hasScore ? fmtPct(r.pct) : "—"}</td></tr>
       <tr><td>التقدير</td><td class="score">${esc(r.grade)}</td></tr>
       <tr class="is-total"><td>الحالة</td><td class="score">${esc(r.status)}</td></tr>
     </tbody>`;
  sum.appendChild(table);
  inner.appendChild(sum);

  inner.insertAdjacentHTML("beforeend", distributionBar(st, r));

  if (st.scale === 410) {
    inner.appendChild(el("p", "cert-warn reveal",
      "مجموع هذا الطالب محسوب من ٤١٠ درجات (النظام القديم)، ولذلك لا يُدرج ترتيبه ضمن ترتيب المجموع من ٣٢٠."));
  }

  inner.appendChild(el("div", "cert-foot reveal",
    `<span>تاريخ الاستخراج: <span dir="ltr">${new Date().toLocaleDateString("ar-EG")}</span></span>
     <span class="cert-foot__note">هذه النتيجة استرشادية — المرجع الرسمي هو كشف الإدارة التعليمية.</span>`));

  dom.certificate.innerHTML = "";
  dom.certificate.appendChild(inner);
  setView("result");
}

function openStudent(st) {
  renderResult(st);
  setHash("#seat=" + st.seat);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   البحث
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function ensureReady() {
  if (Data.ready) return true;
  showLoading("جارٍ تحميل فهرس النتيجة…");
  try {
    await loadManifest();
    return true;
  } catch (e) {
    Data.failed = true;
    showEmpty("تعذّر تحميل البيانات",
      "لم يتم العثور على مجلد <code>data/</code>. شغّل الموقع عبر خادم HTTP لا عبر فتح الملف مباشرة، وتأكد من تشغيل <code>tools/build_data.py</code>.");
    return false;
  }
}

async function runSeatSearch(raw, fromHash) {
  const seat = parseInt(toWesternDigits(raw).replace(/\D/g, ""), 10);
  if (!seat) return;
  if (!(await ensureReady())) return;
  showLoading("جارٍ البحث عن رقم الجلوس…");
  try {
    const st = await lookupSeat(seat);
    if (st) {
      renderResult(st);
      if (!fromHash) setHash("#seat=" + seat);
      else hidePanels();
    } else {
      setView("search", { keepScroll: !!fromHash });
      showEmpty("لا توجد نتيجة",
        `لم نعثر على طالب برقم الجلوس <strong dir="ltr">${esc(String(seat))}</strong>. تأكّد من الرقم وحاول مرة أخرى.`);
    }
  } catch (e) {
    console.error(e);
    showEmpty("تعذّر إتمام البحث", "حدث خطأ أثناء تحميل بيانات هذه الشريحة. حاول مرة أخرى.");
  }
}

async function runNameSearch(raw) {
  if (!(await ensureReady())) return;
  showLoading("جارٍ البحث بالاسم…");
  try {
    const res = await lookupName(raw);
    if (res.status === "short")
      return showEmpty("الاسم قصير جدًا", "اكتب أربعة أحرف على الأقل من بداية الاسم.");
    if (res.status === "broad")
      return showEmpty("الاسم شائع جدًا",
        `هذا الاسم يطابق آلاف الطلاب. أضف اسم الأب ثم الجدّ لتضييق البحث — مثال: <strong>محمد أحمد إبراهيم</strong>.`);
    if (res.status === "none" || !res.matches.length)
      return showEmpty("لا توجد نتيجة",
        `لم نعثر على طالب باسم <strong>${esc(raw)}</strong>. اكتب الاسم من أوله كما هو مقيّد رسميًا، أو ابحث برقم الجلوس.`);
    if (res.matches.length === 1) return openStudent(res.matches[0]);
    res.matches.sort((a, b) => b.d2 - a.d2);
    showMatches(res.matches, res.matches.length);
  } catch (e) {
    console.error(e);
    showEmpty("تعذّر إتمام البحث", "حدث خطأ أثناء تحميل شرائح الأسماء. حاول مرة أخرى.");
  }
}

function doSearch(e) {
  if (e) e.preventDefault();
  const raw = dom.searchInput.value.trim();
  if (!raw) { dom.searchInput.focus(); return; }
  if (State.mode === "seat") runSeatSearch(raw);
  else runNameSearch(raw);
}

function goHome() {
  setHash("#");
  setView("search");
  dom.searchInput.value = "";
  hidePanels();
  dom.searchInput.focus();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   الأوائل
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let topRendered = false;
async function renderTop() {
  if (topRendered) return;
  if (!(await ensureReady())) return;
  dom.topBoard.innerHTML = `<div class="loader" role="status"><span></span><span></span><span></span></div>`;
  let data;
  try { data = await loadTop(); }
  catch (e) { dom.topBoard.innerHTML = `<p class="panel__text">تعذّر تحميل قائمة الأوائل.</p>`; return; }
  topRendered = true;

  const list = (data["320"] || []).map(o => makeStudent(o.s, o.n, o.d, -1, false));
  const max = 320;

  dom.podium.innerHTML = "";
  list.slice(0, 3).forEach((s, i) => {
    const card = el("div", `podium__card podium__card--${i + 1}`);
    card.innerHTML =
      `<span class="podium__rank">${["الأول", "الثاني", "الثالث"][i]}</span>
       <span class="podium__name">${esc(s.name)}</span>
       <span class="podium__score">${fmtMark(s.total)} <small>من ${max}</small></span>
       <span class="podium__pct">${fmtPct((s.total / max) * 100)}</span>
       <span class="podium__seat" dir="ltr">${s.seat}</span>`;
    card.addEventListener("click", () => openStudent(s));
    dom.podium.appendChild(card);
  });

  const table = el("table", "board__table");
  table.innerHTML = `<thead><tr><th>#</th><th>الاسم</th><th>المجموع</th><th>النسبة</th><th>رقم الجلوس</th></tr></thead>`;
  const tbody = el("tbody");
  list.forEach((s, i) => {
    const tr = el("tr");
    tr.innerHTML =
      `<td class="board__i">${arNum(i + 1)}</td>
       <td class="board__name">${esc(s.name)}</td>
       <td class="score">${fmtMark(s.total)}</td>
       <td class="score">${fmtPct((s.total / max) * 100)}</td>
       <td class="board__seat" dir="ltr">${s.seat}</td>`;
    tr.addEventListener("click", () => openStudent(s));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  dom.topBoard.innerHTML = "";
  dom.topBoard.appendChild(el("p", "board__hint", `أعلى ${arNum(list.length)} مجموع على مستوى الجمهورية — اضغط أي اسم لعرض بطاقته.`));
  dom.topBoard.appendChild(table);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   الإحصائيات
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let statsRendered = false;
async function renderStats() {
  if (statsRendered) return;
  if (!(await ensureReady())) return;
  statsRendered = true;
  const m = Data.manifest;
  const s320 = m.scales["320"];
  const passPct = s320.scored ? (s320.pass / s320.scored) * 100 : 0;

  const cards = [
    { k: "إجمالي الطلاب", v: arNum(m.total), s: "طالبًا وطالبة" },
    { k: "بلغوا حدّ النجاح", v: fmtPct(passPct), s: `${arNum(s320.pass)} من ${arNum(s320.scored)} برصد درجات` },
    { k: "متوسط المجموع", v: fmtMark(s320.avg), s: `من ${s320.max} · ${fmtPct((s320.avg / s320.max) * 100)}` },
    { k: "أعلى مجموع", v: fmtMark(s320.best), s: `من ${s320.max} · ${fmtPct((s320.best / s320.max) * 100)}` },
  ];
  dom.statGrid.innerHTML = cards.map(c =>
    `<div class="statcard"><span class="statcard__k">${esc(c.k)}</span><b class="statcard__v">${c.v}</b><span class="statcard__s">${c.s}</span></div>`
  ).join("");

  // مخطط التوزيع
  const hist = s320.hist, peak = Math.max.apply(null, hist);
  dom.chart.innerHTML = hist.map((v, i) => {
    const h = peak ? Math.max(1, Math.round((v / peak) * 100)) : 1;
    return `<span class="chart__bar" style="height:${h}%" title="${i * 10}–${i * 10 + 9}: ${arNum(v)} طالب"></span>`;
  }).join("");

  // تفصيل الحالات + المجموعات
  const cases = m.cases || [];
  let html = "";
  const g2 = m.groups["2"];
  if (g2 && g2.cases) {
    const rows = Object.keys(g2.cases).map(k => ({ label: cases[+k] || "—", n: g2.cases[k] }));
    const tot = rows.reduce((a, b) => a + b.n, 0);
    html += `<h3 class="grades__cap">حالات النتيجة الرسمية <small class="cap-note">(المجموعة التي تبدأ أرقام جلوسها بـ ٢)</small></h3>
      <div class="casebars">` +
      rows.map(r => `
        <div class="casebar">
          <div class="casebar__head"><span>${esc(r.label)}</span><b>${arNum(r.n)} <small>(${fmtPct(r.n / tot * 100)})</small></b></div>
          <div class="casebar__track"><span style="width:${(r.n / tot * 100).toFixed(2)}%"></span></div>
        </div>`).join("") + `</div>`;
  }

  html += `<h3 class="grades__cap">مجموعتا كشف النتيجة</h3>
    <table class="gtable">
      <thead><tr><th>المجموعة</th><th>عدد الطلاب</th><th>مدى أرقام الجلوس</th><th>متوسط المجموع</th><th>عمود الحالة</th></tr></thead>
      <tbody>` +
    ["1", "2"].map(g => {
      const o = m.groups[g];
      if (!o) return "";
      return `<tr>
        <td>المجموعة (${g === "1" ? "أ" : "ب"})</td>
        <td class="score">${arNum(o.count)}</td>
        <td class="score" dir="ltr">${o.seatFrom} – ${o.seatTo}</td>
        <td class="score">${fmtMark(o.avg)}</td>
        <td class="score">${o.hasStatus ? "متاح" : "غير متاح"}</td>
      </tr>`;
    }).join("") + `</tbody></table>`;

  const old = m.scales["410"];
  if (old) {
    html += `<p class="statnote__p">تُرصد ${arNum(old.count)} حالة بمجموع من ٤١٠ درجات (النظام القديم) داخل المجموعة (أ)،
      وتُعرض بطاقاتهم منسوبة إلى ٤١٠ لا إلى ٣٢٠.</p>`;
  }
  html += `<p class="statnote__p">المصدر: كشوف النتيجة الرسمية كما وردت. الأرقام استرشادية والمرجع النهائي هو الإدارة التعليمية.</p>`;
  dom.statNote.innerHTML = html;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   شهادة تقدير (PNG عالية الدقة — تُرسم على Canvas)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function onCertClick() {
  if (!State.current) return;
  const btn = dom.certBtn;
  btn.classList.add("is-busy");
  try {
    await drawAppreciation(State.current);
  } catch (e) {
    console.error(e);
    alert("تعذّر إنشاء الشهادة. حاول مرة أخرى.");
  } finally {
    btn.classList.remove("is-busy");
  }
}

function star8(ctx, cx, cy, rOut, rIn) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const r = i % 2 ? rIn : rOut;
    ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

async function drawAppreciation(student) {
  const r = computeResult(student);
  const C = {
    ink: "#0e4a42", inkDeep: "#07332d", gold: "#c2982f", goldB: "#d8af49",
    paper: "#f3ecd8", sheet: "#fffdf7", muted: "#7a6f59", line: "#d8cdb4",
  };
  try {
    await Promise.all([
      document.fonts.load("700 130px 'Aref Ruqaa'"),
      document.fonts.load("400 90px 'Aref Ruqaa'"),
      document.fonts.load("700 64px 'Reem Kufi'"),
      document.fonts.load("500 44px 'Tajawal'"),
      document.fonts.load("700 44px 'Tajawal'"),
    ]);
    await document.fonts.ready;
  } catch (e) { /* خطوط احتياطية */ }

  const W = 2000, H = 1414, cx = W / 2;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle";

  const center = (t, y, font, color) => { x.font = font; x.fillStyle = color; x.fillText(t, cx, y); };

  x.fillStyle = C.paper; x.fillRect(0, 0, W, H);
  const m = 56;
  x.fillStyle = C.sheet;
  x.beginPath(); x.roundRect(m, m, W - 2 * m, H - 2 * m, 22); x.fill();

  x.save(); x.globalAlpha = 0.05; x.fillStyle = C.ink;
  star8(x, cx, H / 2 + 40, 470, 200); x.fill(); x.restore();

  x.strokeStyle = C.gold; x.lineWidth = 5;
  x.beginPath(); x.roundRect(m + 22, m + 22, W - 2 * (m + 22), H - 2 * (m + 22), 14); x.stroke();
  x.strokeStyle = C.goldB; x.lineWidth = 2;
  x.beginPath(); x.roundRect(m + 34, m + 34, W - 2 * (m + 34), H - 2 * (m + 34), 10); x.stroke();
  x.save(); x.translate(cx, 214);
  x.fillStyle = C.gold; star8(x, 0, 0, 54, 23); x.fill();
  x.fillStyle = C.sheet; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill();
  x.fillStyle = C.ink; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill();
  x.restore();

  center("شهادة تقدير", 352, "700 132px 'Aref Ruqaa', serif", C.inkDeep);
  x.strokeStyle = C.gold; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(cx - 230, 434); x.lineTo(cx - 34, 434); x.moveTo(cx + 34, 434); x.lineTo(cx + 230, 434); x.stroke();
  x.fillStyle = C.gold; x.font = "400 40px 'Reem Kufi'"; x.fillText("۞", cx, 436);

  center("تتقدّم بوابة النتائج بأطيب التهاني والتقدير", 530, "500 46px 'Tajawal', sans-serif", C.muted);
  center("إلى", 592, "700 46px 'Reem Kufi', sans-serif", C.ink);

  center(student.name || "—", 700, "700 92px 'Aref Ruqaa', serif", C.inkDeep);
  x.font = "700 92px 'Aref Ruqaa', serif";
  const nameW = Math.min(W - 320, x.measureText(student.name || "—").width + 120);
  x.strokeStyle = C.gold; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx - nameW / 2, 762); x.lineTo(cx - 22, 762); x.moveTo(cx + 22, 762); x.lineTo(cx + nameW / 2, 762); x.stroke();
  x.fillStyle = C.gold; x.beginPath(); x.moveTo(cx, 754); x.lineTo(cx + 11, 762); x.lineTo(cx, 770); x.lineTo(cx - 11, 762); x.closePath(); x.fill();

  const reason = r.hasScore && r.grade !== "—"
    ? `بمناسبة الحصول على تقدير «${r.grade}» في نتيجة الثانوية العامة`
    : "بمناسبة أداء امتحانات الثانوية العامة";
  center(reason, 832, "500 48px 'Tajawal', sans-serif", C.ink);
  center(`للعام الدراسي ${toArDigits(CONFIG.year)}`, 894, "500 40px 'Tajawal', sans-serif", C.muted);

  const chip = (label, value, ccx, ccy) => {
    x.font = "700 42px 'Reem Kufi', sans-serif";
    const vw = x.measureText(value).width;
    x.font = "500 32px 'Tajawal', sans-serif";
    const lw = x.measureText(label).width;
    const w = Math.max(vw, lw) + 90, h = 116;
    x.fillStyle = "rgba(194,152,47,0.10)";
    x.strokeStyle = C.line; x.lineWidth = 2;
    x.beginPath(); x.roundRect(ccx - w / 2, ccy - h / 2, w, h, 16); x.fill(); x.stroke();
    x.fillStyle = C.muted; x.font = "500 32px 'Tajawal', sans-serif"; x.fillText(label, ccx, ccy - 26);
    x.fillStyle = C.inkDeep; x.font = "700 42px 'Reem Kufi', sans-serif"; x.fillText(value, ccx, ccy + 22);
  };
  chip("المجموع الكلي", `${toArDigits(fmtMark(r.total))} من ${toArDigits(r.max)}`, cx + 250, 1024);
  chip("النسبة المئوية", `${toArDigits(fmtPct(r.pct)).replace("%", "٪")}`, cx - 250, 1024);
  if (r.rank) {
    chip("الترتيب على الجمهورية", r.rank === 1 ? "الأول" : toArDigits(arNum(r.rank)), cx + 250, 1160);
    chip("الشريحة", `أفضل ${toArDigits(fmtPct(r.topPct)).replace("%", "٪")}`, cx - 250, 1160);
  } else {
    center(r.status, 1150, "500 40px 'Tajawal', sans-serif", C.muted);
  }

  x.save(); x.translate(cx, 1268);
  x.strokeStyle = C.gold; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 78, 0, 7); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 66, 0, 7); x.stroke();
  x.fillStyle = C.gold; x.font = "400 26px 'Reem Kufi'"; x.fillText("تقدير", 0, -22);
  x.fillStyle = C.inkDeep; x.font = "700 44px 'Aref Ruqaa'";
  x.fillText(r.grade !== "—" ? r.grade.split(" ")[0] : r.status.split(" ")[0], 0, 18);
  x.restore();

  x.fillStyle = C.muted; x.font = "500 32px 'Tajawal', sans-serif";
  x.textAlign = "right"; x.fillText(`رقم الجلوس: ${toArDigits(student.seat)}`, W - m - 60, H - m - 70);
  x.textAlign = "left"; x.fillText(CONFIG.examTitle, m + 60, H - m - 70);
  x.textAlign = "center";

  const blob = await new Promise(res => cv.toBlob(res, "image/png"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `شهادة-تقدير-${student.seat}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   التهيئة
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function init() {
  dom.segBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  dom.navtabs.forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.view;
    setHash(v === "search" ? "#" : "#" + v);
    setView(v);
  }));
  dom.searchForm.addEventListener("submit", doSearch);
  dom.backBtn.addEventListener("click", goHome);
  dom.printBtn.addEventListener("click", () => window.print());
  dom.certBtn.addEventListener("click", onCertClick);
  dom.brandHome.addEventListener("click", e => { e.preventDefault(); goHome(); });
  window.addEventListener("hashchange", () => { if (!State.navigating) applyHash(); });

  loadCounter();

  dom.dataBadge.hidden = false;
  dom.dataBadge.classList.add("is-loading");
  dom.dataBadge.textContent = "جارٍ تحميل فهرس النتيجة…";
  dom.searchInput.focus();

  try {
    const m = await loadManifest();
    dom.dataBadge.classList.remove("is-loading");
    dom.dataBadge.classList.add("is-ready");
    dom.dataBadge.textContent =
      `جاهز للبحث — ${arNum(m.total)} طالب وطالبة · المجموع من ${toArDigits(m.scales["320"].max)}`;
  } catch (e) {
    dom.dataBadge.classList.remove("is-loading");
    dom.dataBadge.textContent = "تعذّر تحميل قاعدة البيانات — شغّل الموقع عبر خادم HTTP.";
    console.error(e);
  }

  await applyHash();
}
document.addEventListener("DOMContentLoaded", init);
