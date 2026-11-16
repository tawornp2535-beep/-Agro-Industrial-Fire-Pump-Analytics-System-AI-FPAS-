/* ==================================================================
   AI-FPAS Modern UI Module
   1) Control Room Dark / Light Mode
   2) Pump Readiness Score (0-100%)
   3) Auto-Watch Log Folder (File System Access API)
   ================================================================== */
(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════════
  //  1. CONTROL ROOM DARK / LIGHT MODE
  // ════════════════════════════════════════════════════════════════
  const THEME_KEY = "ai_fpas_theme";

  const DARK_CSS = `
    body.theme-dark {
      --text-secondary: #B6C2CF;
      --bg-highlight: #1C3329;
      --bg-dashboard: #0E1814;
      --text-primary: #E5E7EB;
      --bg-dark: #0E1814;
      --panel-bg: #15231E;
      --panel-border: #2A3B34;
      --panel-border-strong: #36504A;
      --card-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
      background: #0E1814 !important;
      color: #E5E7EB;
    }
    body, .glass-card, .kpi-card, .month-selector-bar, .modal-box, .events-table td {
      transition: background-color .25s ease, color .25s ease, border-color .25s ease;
    }
    body.theme-dark .app-header { background: #0B2A1F !important; border-bottom-color: #1B7354 !important; }
    body.theme-dark .content-area { background: #0E1814 !important; }
    body.theme-dark .glass-card,
    body.theme-dark .kpi-card,
    body.theme-dark .month-selector-bar,
    body.theme-dark .modal-box {
      background: #15231E !important;
      border-color: #2A3B34 !important;
      color: #E5E7EB;
    }
    body.theme-dark .kpi-title, body.theme-dark .kpi-sub { color: #B6C2CF !important; }
    body.theme-dark .kpi-value { color: #6EE7B7; }
    body.theme-dark .card-header h3 { color: #6EE7B7 !important; }
    body.theme-dark .events-table td { background: #15231E !important; color: #E5E7EB !important; border-color: #2A3B34 !important; }
    body.theme-dark .events-table tr:nth-child(even) td { background: #182A23 !important; }
    body.theme-dark .events-table tr:hover td { background: #1C3329 !important; }
    body.theme-dark input, body.theme-dark select, body.theme-dark textarea {
      background: #0E1814 !important; color: #E5E7EB !important; border-color: #36504A !important;
    }
    body.theme-dark [style*="background: #FFFFFF"], body.theme-dark [style*="background:#FFFFFF"],
    body.theme-dark [style*="background: #fff;"], body.theme-dark [style*="background:#fff;"],
    body.theme-dark [style*="background: white"], body.theme-dark [style*="background:white"],
    body.theme-dark [style*="background: #F3F7F4"], body.theme-dark [style*="background:#F3F7F4"],
    body.theme-dark [style*="background: #F9FBFA"], body.theme-dark [style*="background:#F9FBFA"],
    body.theme-dark [style*="background: #F9FAFB"], body.theme-dark [style*="background:#F9FAFB"],
    body.theme-dark [style*="background: #f8f9fa"], body.theme-dark [style*="background:#f8f9fa"],
    body.theme-dark [style*="background: var(--bg-dashboard)"], body.theme-dark [style*="background:var(--bg-dashboard)"],
    body.theme-dark [style*="background: var(--panel-bg)"], body.theme-dark [style*="background:var(--panel-bg)"] {
      background: #15231E !important;
      border-color: #2A3B34 !important;
    }
    body.theme-dark [style*="background: #E5F4E8"], body.theme-dark [style*="background:#E5F4E8"],
    body.theme-dark [style*="background: var(--bg-highlight)"], body.theme-dark [style*="background:var(--bg-highlight)"] {
      background: #1C3329 !important;
    }
    body.theme-dark :not(button):not(.btn-action)[style*="color: #1F2937"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:#1F2937"],
    body.theme-dark :not(button):not(.btn-action)[style*="color: #374151"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:#374151"],
    body.theme-dark :not(button):not(.btn-action)[style*="color: var(--text-primary)"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:var(--text-primary)"] {
      color: #E5E7EB !important;
    }
    body.theme-dark :not(button):not(.btn-action)[style*="color: #4B5563"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:#4B5563"],
    body.theme-dark :not(button):not(.btn-action)[style*="color: #6B7280"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:#6B7280"],
    body.theme-dark :not(button):not(.btn-action)[style*="color: #555"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:#555"] {
      color: #A7B4C2 !important;
    }
    body.theme-dark :not(button):not(.btn-action)[style*="; color: #155E43"],
    body.theme-dark :not(button):not(.btn-action)[style*=";color:#155E43"],
    body.theme-dark :not(button):not(.btn-action)[style^="color: #155E43"],
    body.theme-dark :not(button):not(.btn-action)[style^="color:#155E43"],
    body.theme-dark :not(button):not(.btn-action)[style*="; color: #1B7354"],
    body.theme-dark :not(button):not(.btn-action)[style*=";color:#1B7354"],
    body.theme-dark :not(button):not(.btn-action)[style^="color: #1B7354"],
    body.theme-dark :not(button):not(.btn-action)[style^="color:#1B7354"],
    body.theme-dark :not(button):not(.btn-action)[style*="color: var(--color-dark-green)"],
    body.theme-dark :not(button):not(.btn-action)[style*="color:var(--color-dark-green)"] {
      color: #6EE7B7 !important;
    }
    body.theme-dark canvas { filter: brightness(0.92) contrast(1.05); }

    /* Header pill buttons */
    .modern-hdr-btn { display:inline-flex; align-items:center; gap:6px; }
    .modern-hdr-btn.is-on { background: #F59E0B !important; border-color: #F59E0B !important; color: #1F2937 !important; font-weight: 800; }
    .header-actions { align-items: center; flex-wrap: nowrap; }
    .header-actions .btn-action { white-space: nowrap; }
    .hdr-icon-btn { padding: 6px 10px !important; }

    /* Live clock */
    .header-clock { text-align: center; padding: 4px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(229,244,232,0.25); min-width: 128px; }
    .header-clock .hc-time { font-size: 1.15rem; font-weight: 800; color: #FFFFFF; letter-spacing: 1px;
      font-variant-numeric: tabular-nums; line-height: 1.1; }
    .header-clock .hc-date { font-size: 0.66rem; color: #E5F4E8; opacity: .95; white-space: nowrap; }

    /* More dropdown */
    .hdr-more { position: relative; }
    .hdr-more-menu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 250px; background: #FFFFFF;
      border: 1px solid #E5E7EB; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); padding: 6px;
      display: none; z-index: 500; }
    .hdr-more-menu.open { display: block; animation: hdrMenuIn .15s ease; }
    @keyframes hdrMenuIn { from { opacity:0; transform: translateY(-4px); } to { opacity:1; transform:none; } }
    .hdr-more-item { width: 100%; display: flex; align-items: center; gap: 10px; background: transparent; border: none;
      padding: 9px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #1F2937; text-align: left; }
    .hdr-more-item small { margin-left: auto; font-size: 0.66rem; font-weight: 600; color: #6B7280; }
    .hdr-more-item:hover { background: #E5F4E8; color: #155E43; }
    .hdr-more-sep { height: 1px; background: #E5E7EB; margin: 4px 6px; }
    body.theme-dark .hdr-more-menu { background: #15231E; border-color: #2A3B34; }
    body.theme-dark .hdr-more-item { color: #E5E7EB; }
    body.theme-dark .hdr-more-item small { color: #A7B4C2; }
    body.theme-dark .hdr-more-item:hover { background: #1C3329; color: #6EE7B7; }
    body.theme-dark .hdr-more-sep { background: #2A3B34; }
    @media (max-width: 1400px) { .header-fileinfo .fn { display: none; } }
    @media (max-width: 1200px) { .header-model { display: none !important; } }
    .autowatch-dot { width:8px; height:8px; border-radius:50%; background:#9CA3AF; display:inline-block; }
    .autowatch-dot.live { background:#22C55E; box-shadow:0 0 0 0 rgba(34,197,94,.7); animation: awPulse 1.6s infinite; }
    .autowatch-dot.warn { background:#F59E0B; }
    @keyframes awPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.7);} 70%{box-shadow:0 0 0 8px rgba(34,197,94,0);} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0);} }

    /* Readiness card */
    .readiness-card { display:grid; grid-template-columns: auto 1fr; gap:18px; align-items:center;
      background:#FFFFFF; border:1px solid var(--panel-border); border-radius:14px; padding:14px 20px; box-shadow: var(--card-shadow); }
    body.theme-dark .readiness-card { background:#15231E; border-color:#2A3B34; }
    .readiness-gauge { width:112px; height:112px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      background: conic-gradient(#9CA3AF 0deg, #E5E7EB 0deg); transition: background .6s ease; }
    .readiness-gauge-inner { width:86px; height:86px; border-radius:50%; background:#FFFFFF; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    body.theme-dark .readiness-gauge-inner { background:#15231E; }
    .readiness-score { font-size:1.6rem; font-weight:900; line-height:1; }
    .readiness-unit { font-size:0.62rem; color:var(--text-secondary); font-weight:700; margin-top:2px; }
    .readiness-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
    .readiness-title { font-size:0.95rem; font-weight:800; color:var(--color-dark-green); }
    body.theme-dark .readiness-title { color:#6EE7B7; }
    .readiness-level { padding:4px 12px; border-radius:20px; font-size:0.74rem; font-weight:800; }
    .readiness-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
    .readiness-item { border:1px solid var(--panel-border); border-radius:10px; padding:8px 10px; background: var(--bg-dashboard); }
    .readiness-item-label { font-size:0.68rem; font-weight:700; color:var(--text-secondary); display:flex; justify-content:space-between; }
    .readiness-item-val { font-size:0.95rem; font-weight:800; margin:2px 0 4px; }
    .readiness-bar { height:5px; border-radius:4px; background: rgba(107,114,128,0.2); overflow:hidden; }
    .readiness-bar > div { height:100%; width:0%; border-radius:4px; transition: width .6s ease; }
    .readiness-item-note { font-size:0.64rem; color:var(--text-secondary); margin-top:4px; line-height:1.35; }
    @media (max-width: 1100px) { .readiness-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .readiness-card { grid-template-columns: 1fr; justify-items:center; } .readiness-grid { grid-template-columns: 1fr 1fr; width:100%; } }
  `;

  function injectCss() {
    if (document.getElementById("modernUiStyles")) return;
    const st = document.createElement("style");
    st.id = "modernUiStyles";
    st.textContent = DARK_CSS;
    document.head.appendChild(st);
  }

  function updateThemeButton() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const dark = document.body.classList.contains("theme-dark");
    btn.innerHTML = dark ? "<span>☀️</span>" : "<span>🌙</span>";
    btn.title = dark ? "สลับเป็นโหมดสว่าง (Light Mode)" : "สลับเป็นโหมดมืดสำหรับห้องควบคุม (Control Room Dark Mode)";
  }

  function applyTheme(mode) {
    document.body.classList.toggle("theme-dark", mode === "dark");
    try { localStorage.setItem(THEME_KEY, mode); } catch (_) {}
    updateThemeButton();
  }

  window.toggleThemeMode = function () {
    const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
    applyTheme(next);
    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(next === "dark" ? "🌙 เปิดโหมด Control Room (Dark Mode)" : "☀️ เปิดโหมดกลางวัน (Light Mode)");
    }
  };

  // ════════════════════════════════════════════════════════════════
  //  2. PUMP READINESS SCORE (0-100%)
  // ════════════════════════════════════════════════════════════════
  const W = { pressure: 25, battery: 30, test: 25, oil: 20 };

  function colorFor(score) {
    if (score === null || score === undefined) return "#9CA3AF";
    if (score >= 85) return "#16A34A";
    if (score >= 65) return "#D97706";
    return "#DC2626";
  }

  // Fallback: compute next NFPA 25 test date directly from the latest engine run session
  function computeTestScheduleFallback(evs) {
    try {
      if (typeof analyzeCrankAndRunSessions !== "function") return null;
      const cs = analyzeCrankAndRunSessions(evs);
      const sessions = (cs && cs.sessions) || [];
      if (!sessions.length) return null;
      const last = sessions[sessions.length - 1];
      let ymd = "";
      if (last.startDt && String(last.startDt).length >= 10) ymd = String(last.startDt).slice(0, 10);
      else if (last.startRaw) {
        const p = String(last.startRaw).split(" ")[0].split("-");
        if (p.length === 3) ymd = p[0].length === 4 ? `${p[0]}-${p[1]}-${p[2]}` : `${p[2]}-${p[1]}-${p[0]}`;
      }
      if (!ymd) return null;
      const freq = (typeof window.getTestFrequencyDays === "function") ? Number(window.getTestFrequencyDays()) || 7
        : (typeof getTestFrequencyDays === "function" ? Number(getTestFrequencyDays()) || 7 : 7);
      const [y, m, d] = ymd.split("-").map(Number);
      const next = new Date(y, m - 1, d + freq);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((next - today) / 86400000);
      const pad = n => String(n).padStart(2, "0");
      return { diffDays, freqDays: freq, nextDateDisplay: `${pad(next.getDate())}/${pad(next.getMonth() + 1)}/${next.getFullYear()}` };
    } catch (e) {
      console.warn("Readiness test fallback:", e);
      return null;
    }
  }

  function computeReadiness(events) {
    const evs = Array.isArray(events) && events.length ? events
      : ((typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS)) ? CURRENT_EVENTS : []);
    const out = { hasData: evs.length > 0, parts: {} };

    // Pressure
    let psi = null;
    for (let i = evs.length - 1; i >= 0; i--) {
      const p = parseFloat(evs[i] && evs[i].psi);
      if (!isNaN(p)) { psi = p; break; }
    }
    if (psi === null) {
      out.parts.pressure = { score: null, val: "- psi", note: "รอนำเข้าไฟล์ Log" };
    } else {
      const s = psi >= 120 ? 100 : psi >= 100 ? 80 : psi >= 80 ? 50 : 20;
      out.parts.pressure = { score: s, val: `${psi} psi`, note: s >= 80 ? "แรงดันระบบอยู่ในเกณฑ์ปกติ" : "แรงดันต่ำกว่าเกณฑ์ ควรตรวจสอบ Jockey / ท่อรั่ว" };
    }

    // Battery
    try {
      if (out.hasData && typeof computeBatteryMetrics === "function") {
        const m = computeBatteryMetrics(evs);
        const scores = [m.b1 && m.b1.score, m.b2 && m.b2.score].filter(v => typeof v === "number");
        if (scores.length) {
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          const minS = Math.min(...scores);
          out.parts.battery = {
            score: Math.round(avg * 0.6 + minS * 0.4),
            val: `B1 ${m.b1.score ?? "-"}% • B2 ${m.b2.score ?? "-"}%`,
            note: minS >= 80 ? "แบตเตอรี่ทั้งสองชุดพร้อมสตาร์ท" : "มีแบตเตอรี่ที่ควรตรวจสอบ (ดูกราฟ B1 vs B2)"
          };
        }
      }
    } catch (e) { console.warn("Readiness battery:", e); }
    if (!out.parts.battery) out.parts.battery = { score: null, val: "-", note: "รอข้อมูลแบตเตอรี่จากไฟล์ Log" };

    // Test schedule (NFPA 25)
    let info = (typeof window.getDynamicTestScheduleInfo === "function") ? window.getDynamicTestScheduleInfo() : null;
    if ((!info || info.diffDays === null || info.diffDays === undefined) && out.hasData) {
      info = computeTestScheduleFallback(evs);
    }
    if (!info || info.diffDays === null || info.diffDays === undefined || !out.hasData) {
      out.parts.test = { score: null, val: "-", note: "ยังไม่พบรอบเดินเครื่องทดสอบในไฟล์ Log" };
    } else {
      const d = Number(info.diffDays);
      const s = d >= 2 ? 100 : d >= 0 ? 85 : d >= -3 ? 50 : 20;
      out.parts.test = {
        score: s,
        val: d > 0 ? `อีก ${d} วัน` : d === 0 ? "ครบกำหนดวันนี้" : `เกิน ${Math.abs(d)} วัน`,
        note: `รอบทดสอบถัดไป: ${info.nextDateDisplay || info.nextDateStr || "-"}`
      };
    }

    // Oil PM
    const oil = window._lastOilPmInfo;
    if (!oil || !out.hasData) {
      out.parts.oil = { score: null, val: "-", note: "รอคำนวณชั่วโมง PM" };
    } else {
      const near = String(oil.remText || "").indexOf("⚠️") === 0;
      const s = oil.isDue ? 25 : near ? 70 : 100;
      out.parts.oil = {
        score: s,
        val: `${oil.currentHours || "-"} / ${oil.targetHours || "-"} ชม.`,
        note: oil.isDue ? "ถึงกำหนดเปลี่ยนถ่ายน้ำมันเครื่อง & ไส้กรอง" : (oil.remText || "")
      };
    }

    let sumW = 0, sumS = 0;
    Object.keys(W).forEach(k => {
      const p = out.parts[k];
      if (p && typeof p.score === "number") { sumW += W[k]; sumS += p.score * W[k]; }
    });
    out.total = sumW > 0 ? Math.round(sumS / sumW) : null;
    return out;
  }

  window.renderReadinessScore = function (events) {
    const card = document.getElementById("readinessCard");
    if (!card) return;
    const r = computeReadiness(events);
    const total = r.total;
    const col = colorFor(total);
    const deg = total === null ? 0 : Math.round(total * 3.6);

    const gauge = document.getElementById("readinessGauge");
    if (gauge) gauge.style.background = `conic-gradient(${col} ${deg}deg, rgba(107,114,128,0.18) ${deg}deg)`;
    const sc = document.getElementById("readinessScoreVal");
    if (sc) { sc.textContent = total === null ? "—" : `${total}%`; sc.style.color = col; }

    const lvl = document.getElementById("readinessLevel");
    if (lvl) {
      let txt = "⏳ รอนำเข้าไฟล์ Log", bg = "rgba(107,114,128,0.15)";
      if (total !== null) {
        if (total >= 85) { txt = "✅ พร้อมใช้งานสูง (Ready)"; bg = "rgba(22,163,74,0.14)"; }
        else if (total >= 65) { txt = "⚠️ ควรเฝ้าระวัง (Attention)"; bg = "rgba(217,119,6,0.15)"; }
        else { txt = "🚨 ต้องดำเนินการ (Action Required)"; bg = "rgba(220,38,38,0.14)"; }
      }
      lvl.textContent = txt; lvl.style.background = bg; lvl.style.color = col;
    }

    const labels = { pressure: "💧 แรงดันน้ำ", battery: "🔋 แบตเตอรี่ B1/B2", test: "📋 รอบทดสอบ NFPA 25", oil: "🛢️ PM น้ำมันเครื่อง" };
    const grid = document.getElementById("readinessGrid");
    if (grid) {
      grid.innerHTML = Object.keys(W).map(k => {
        const p = r.parts[k] || {};
        const c = colorFor(p.score);
        return `
          <div class="readiness-item">
            <div class="readiness-item-label"><span>${labels[k]}</span><span>${W[k]}%</span></div>
            <div class="readiness-item-val" style="color:${c};">${p.score === null || p.score === undefined ? "—" : p.score + "%"} <small style="font-size:0.66rem;font-weight:600;color:var(--text-secondary);">${p.val || ""}</small></div>
            <div class="readiness-bar"><div style="width:${p.score || 0}%;background:${c};"></div></div>
            <div class="readiness-item-note">${p.note || ""}</div>
          </div>`;
      }).join("");
    }
    const upd = document.getElementById("readinessUpdated");
    if (upd) upd.textContent = `อัปเดต ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
  };

  // ════════════════════════════════════════════════════════════════
  //  3. AUTO-WATCH LOG FOLDER
  // ════════════════════════════════════════════════════════════════
  const AW_DB = "ai_fpas_autowatch_db";
  const AW_STORE = "handles";
  const AW_LASTKEY = "ai_fpas_autowatch_lastkey";
  const AW_INTERVAL_MS = 30000;
  let awHandle = null;
  let awTimer = null;
  let awBusy = false;

  function awDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(AW_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(AW_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function awSaveHandle(h) {
    const db = await awDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(AW_STORE, "readwrite");
      if (h) tx.objectStore(AW_STORE).put(h, "dir"); else tx.objectStore(AW_STORE).delete("dir");
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }
  async function awLoadHandle() {
    const db = await awDb();
    return new Promise((res) => {
      const tx = db.transaction(AW_STORE, "readonly");
      const rq = tx.objectStore(AW_STORE).get("dir");
      rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null);
    });
  }

  function awSetUi(state, detail) {
    const btn = document.getElementById("autoWatchBtn");
    const dot = document.getElementById("autoWatchDot");
    const lbl = document.getElementById("autoWatchLabel");
    if (!btn || !dot || !lbl) return;
    dot.className = "autowatch-dot" + (state === "live" ? " live" : state === "warn" ? " warn" : "");
    btn.classList.toggle("is-on", state === "live");
    if (state === "live") lbl.textContent = "Auto ON";
    else if (state === "warn") lbl.textContent = "กดอนุญาต";
    else lbl.textContent = "Auto Log";
    btn.title = detail || (state === "live"
      ? `กำลังเฝ้าโฟลเดอร์ "${awHandle ? awHandle.name : ""}" ตรวจไฟล์ .TXT ใหม่ทุก ${AW_INTERVAL_MS / 1000} วินาที (คลิกเพื่อตรวจทันที / เปลี่ยน / หยุด)`
      : state === "warn"
        ? `คลิกเพื่ออนุญาตเฝ้าโฟลเดอร์ "${awHandle ? awHandle.name : ""}" อีกครั้ง`
        : "เฝ้าโฟลเดอร์ Log อัตโนมัติ: เลือกโฟลเดอร์เก็บไฟล์ Log ของ MarkIIXG ระบบจะนำเข้าไฟล์ใหม่และแจ้ง LINE OA ให้อัตโนมัติ");
  }

  function awToast(msg) {
    if (typeof window.showSettingsToast === "function") window.showSettingsToast(msg);
    else console.log(msg);
  }

  async function awScan(force) {
    if (!awHandle || awBusy) return;
    awBusy = true;
    try {
      let latest = null;
      for await (const entry of awHandle.values()) {
        if (entry.kind !== "file" || !/\.txt$/i.test(entry.name)) continue;
        const f = await entry.getFile();
        if (!latest || f.lastModified > latest.lastModified) latest = f;
      }
      if (!latest) { awSetUi("live", "ไม่พบไฟล์ .TXT ในโฟลเดอร์ที่เลือก"); return; }
      const key = `${latest.name}|${latest.lastModified}|${latest.size}`;
      const lastKey = localStorage.getItem(AW_LASTKEY);
      if (!force && key === lastKey) return;
      localStorage.setItem(AW_LASTKEY, key);
      awToast(`📂 พบไฟล์ Log ใหม่/อัปเดต: ${latest.name} — กำลังนำเข้าอัตโนมัติ...`);
      const runner = (typeof window.processLogFile === "function") ? window.processLogFile
        : (typeof processLogFile === "function" ? processLogFile : null);
      if (runner) {
        await runner(latest);
        setTimeout(() => {
          if (typeof closeModal === "function") closeModal("modalImport");
          if (typeof window.renderReadinessScore === "function") window.renderReadinessScore();
        }, 5000);
      }
    } catch (e) {
      console.warn("AutoWatch scan error:", e);
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        awStop(false);
        awSetUi("warn", "สิทธิ์การอ่านโฟลเดอร์หมดอายุ กรุณาคลิกเพื่ออนุญาตอีกครั้ง");
      }
    } finally {
      awBusy = false;
    }
  }

  function awStart() {
    if (awTimer) clearInterval(awTimer);
    awSetUi("live");
    awScan(false);
    awTimer = setInterval(() => awScan(false), AW_INTERVAL_MS);
  }

  function awStop(clearHandle) {
    if (awTimer) { clearInterval(awTimer); awTimer = null; }
    if (clearHandle) {
      awHandle = null;
      awSaveHandle(null).catch(() => {});
      localStorage.removeItem(AW_LASTKEY);
      awSetUi("off");
    }
  }

  window.toggleAutoWatchFolder = async function () {
    if (typeof window.showDirectoryPicker !== "function") {
      alert("เบราว์เซอร์นี้ไม่รองรับการเฝ้าโฟลเดอร์อัตโนมัติ\nกรุณาใช้ Google Chrome หรือ Microsoft Edge (เวอร์ชันล่าสุด) และเปิดผ่าน http://localhost");
      return;
    }
    try {
      // Re-grant permission for a remembered folder
      if (awHandle && !awTimer) {
        const perm = await awHandle.requestPermission({ mode: "read" });
        if (perm === "granted") { awStart(); awToast(`✅ กลับมาเฝ้าโฟลเดอร์ ${awHandle.name} แล้ว`); return; }
      }
      // Running → offer stop / change
      if (awHandle && awTimer) {
        const choice = prompt(
          `กำลังเฝ้าโฟลเดอร์: ${awHandle.name}\n\nพิมพ์ 1 = ตรวจไฟล์ทันที\nพิมพ์ 2 = เปลี่ยนโฟลเดอร์\nพิมพ์ 3 = หยุดเฝ้าโฟลเดอร์`, "1");
        if (choice === "1") { await awScan(true); return; }
        if (choice === "3") { awStop(true); awToast("⏹️ หยุดเฝ้าโฟลเดอร์ Log อัตโนมัติแล้ว"); return; }
        if (choice !== "2") return;
      }
      const dir = await window.showDirectoryPicker({ id: "firetrol-log-folder", mode: "read" });
      awHandle = dir;
      localStorage.removeItem(AW_LASTKEY);
      await awSaveHandle(dir);
      awToast(`📂 เริ่มเฝ้าโฟลเดอร์ ${dir.name} — ตรวจไฟล์ใหม่ทุก ${AW_INTERVAL_MS / 1000} วินาที`);
      awStart();
    } catch (e) {
      if (e && e.name === "AbortError") return;
      console.warn("AutoWatch:", e);
      alert("ไม่สามารถเลือกโฟลเดอร์ได้: " + (e && e.message ? e.message : e));
    }
  };

  async function awRestore() {
    if (typeof window.showDirectoryPicker !== "function") { awSetUi("off", "เบราว์เซอร์ไม่รองรับ (ใช้ Chrome / Edge)"); return; }
    try {
      const h = await awLoadHandle();
      if (!h) { awSetUi("off"); return; }
      awHandle = h;
      const perm = await h.queryPermission({ mode: "read" });
      if (perm === "granted") awStart();
      else awSetUi("warn");
    } catch (e) {
      awSetUi("off");
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  HEADER: LIVE CLOCK + MORE MENU
  // ════════════════════════════════════════════════════════════════
  const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  function tickClock() {
    const d = new Date();
    const t = document.getElementById("hdrClockTime");
    const dt = document.getElementById("hdrClockDate");
    const p = n => String(n).padStart(2, "0");
    if (t) t.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    if (dt) dt.textContent = `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  window.toggleHeaderMoreMenu = function (ev) {
    if (ev) ev.stopPropagation();
    const m = document.getElementById("hdrMoreMenu");
    if (m) m.classList.toggle("open");
  };
  window.closeHeaderMoreMenu = function () {
    const m = document.getElementById("hdrMoreMenu");
    if (m) m.classList.remove("open");
  };
  document.addEventListener("click", (e) => {
    const m = document.getElementById("hdrMoreMenu");
    if (m && m.classList.contains("open") && !e.target.closest(".hdr-more")) m.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.closeHeaderMoreMenu(); });

  // ════════════════════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════════════════════
  function init() {
    injectCss();
    tickClock();
    setInterval(tickClock, 1000);
    let saved = "light";
    try { saved = localStorage.getItem(THEME_KEY) || "light"; } catch (_) {}
    applyTheme(saved);
    setTimeout(() => window.renderReadinessScore(), 600);
    setInterval(() => window.renderReadinessScore(), 60000);
    awRestore();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
