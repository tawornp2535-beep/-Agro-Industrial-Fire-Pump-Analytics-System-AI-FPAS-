/* ==============================================================================
 *  AI-FPAS (Fire Pump Analytics System) - Google Sheets Integration Module
 *  เวอร์ชัน: 1.0 (Cloud Database Sync สำหรับ Firetrol MarkIIXG)
 * ============================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "ai_fpas_gsheets_config";

  const DEFAULT_CONFIG = {
    webAppUrl: "",
    autoSync: true,
    lastSyncTime: "",
    lastStatus: "ยังไม่ได้เชื่อมต่อ",
    sheetName: ""
  };

  function getGSheetsConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("GSheets config read error:", e);
    }
    return { ...DEFAULT_CONFIG };
  }

  function saveGSheetsConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {
      console.error("GSheets config save error:", e);
    }
    updateGSheetsUI();
  }

  // ---------------------------------------------------------------------------
  //  UI Updates
  // ---------------------------------------------------------------------------
  function updateGSheetsUI() {
    const cfg = getGSheetsConfig();
    const urlInput = document.getElementById("sysGSheetsUrl");
    const autoSyncCheckbox = document.getElementById("sysGSheetsAutoSync");
    const statusBadge = document.getElementById("sysGSheetsStatusBadge");
    const lastSyncEl = document.getElementById("sysGSheetsLastSync");
    const sheetNameEl = document.getElementById("sysGSheetsSheetName");

    if (urlInput && urlInput.value !== cfg.webAppUrl) {
      urlInput.value = cfg.webAppUrl || "";
    }
    if (autoSyncCheckbox) {
      autoSyncCheckbox.checked = cfg.autoSync !== false;
    }
    if (statusBadge) {
      if (cfg.webAppUrl && cfg.lastStatus === "เชื่อมต่อแล้ว") {
        statusBadge.innerHTML = "🟢 เชื่อมต่อ Cloud สำเร็จ";
        statusBadge.style.background = "#E5F4E8";
        statusBadge.style.color = "#155E43";
        statusBadge.style.borderColor = "#1B7354";
      } else if (cfg.webAppUrl) {
        statusBadge.innerHTML = "🟡 มี URL แล้ว (รอซิงค์)";
        statusBadge.style.background = "#FEF3C7";
        statusBadge.style.color = "#92400E";
        statusBadge.style.borderColor = "#F59E0B";
      } else {
        statusBadge.innerHTML = "⚪ ยังไม่ได้เชื่อมต่อ";
        statusBadge.style.background = "#F3F7F4";
        statusBadge.style.color = "#6B7280";
        statusBadge.style.borderColor = "#D1D5DB";
      }
    }
    if (lastSyncEl) {
      lastSyncEl.textContent = cfg.lastSyncTime ? `ซิงค์ล่าสุด: ${cfg.lastSyncTime}` : "ยังไม่มีประวัติการซิงค์";
    }
    if (sheetNameEl) {
      sheetNameEl.textContent = cfg.sheetName ? `Google Sheet: ${cfg.sheetName}` : "";
    }
  }

  // ---------------------------------------------------------------------------
  //  Test Connection
  // ---------------------------------------------------------------------------
  window.testGoogleSheetsConnection = async function () {
    const urlInput = document.getElementById("sysGSheetsUrl");
    const url = (urlInput ? urlInput.value.trim() : "") || getGSheetsConfig().webAppUrl;
    
    if (!url) {
      alert("⚠️ กรุณาวาง Web App URL ของ Google Apps Script ก่อนครับ");
      if (urlInput) urlInput.focus();
      return;
    }

    if (!url.startsWith("https://script.google.com/macros/s/")) {
      alert("⚠️ URL ดูไม่ถูกต้อง ต้องขึ้นต้นด้วย https://script.google.com/macros/s/...\nกรุณาตรวจสอบการ Deploy ใน Google Apps Script ครับ");
      return;
    }

    const btn = document.getElementById("btnTestGSheets");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.innerHTML = "⏳ กำลังทดสอบ...";
      btn.disabled = true;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "ping" })
      });

      const res = await response.json();
      if (res && res.status === "success") {
        const cfg = getGSheetsConfig();
        cfg.webAppUrl = url;
        cfg.lastStatus = "เชื่อมต่อแล้ว";
        cfg.sheetName = res.sheetName || "Connected Sheet";
        saveGSheetsConfig(cfg);

        if (typeof window.showSettingsToast === "function") {
          window.showSettingsToast(`✅ เชื่อมต่อ Google Sheet "${res.sheetName || ''}" สำเร็จ!`);
        } else {
          alert(`✅ เชื่อมต่อ Google Sheet "${res.sheetName || ''}" สำเร็จ!`);
        }
      } else {
        throw new Error(res ? res.message : "Invalid response");
      }
    } catch (err) {
      console.warn("GSheets connection test:", err);
      // Fallback: If redirected or CORS error, notify user with guidance
      alert(`⚠️ การเชื่อมต่อมีข้อผิดพลาด: ${err.message}\n\nข้อควรตรวจสอบใน Google Apps Script:\n1. ตอน Deploy ต้องเลือก Who has access = "Anyone" (ทุกคน)\n2. ต้องเป็น URL ของ Web App (ลงท้ายด้วย /exec)`);
    } finally {
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
      updateGSheetsUI();
    }
  };

  // ---------------------------------------------------------------------------
  //  Save Settings from Form
  // ---------------------------------------------------------------------------
  window.saveGoogleSheetsSettings = function () {
    const urlInput = document.getElementById("sysGSheetsUrl");
    const autoSyncCheckbox = document.getElementById("sysGSheetsAutoSync");

    const cfg = getGSheetsConfig();
    const newUrl = urlInput ? urlInput.value.trim() : "";
    if (newUrl !== cfg.webAppUrl) {
      cfg.webAppUrl = newUrl;
      cfg.lastStatus = newUrl ? "มี URL แล้ว" : "ยังไม่ได้เชื่อมต่อ";
    }
    if (autoSyncCheckbox) {
      cfg.autoSync = autoSyncCheckbox.checked;
    }
    saveGSheetsConfig(cfg);

    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast("✓ บันทึกการตั้งค่า Google Sheets แล้ว");
    }
  };

  // ---------------------------------------------------------------------------
  //  Sync All Data to Google Sheets
  // ---------------------------------------------------------------------------
  window.syncAllToGoogleSheets = async function (isSilent = false) {
    const cfg = getGSheetsConfig();
    const url = cfg.webAppUrl;
    if (!url) {
      if (!isSilent) alert("⚠️ ยังไม่ได้ตั้งค่า Web App URL ของ Google Sheets ครับ");
      return;
    }

    const btn = document.getElementById("btnSyncGSheetsNow");
    const origBtnText = btn ? btn.innerHTML : "";
    if (btn && !isSilent) {
      btn.innerHTML = "⏳ กำลังซิงค์ข้อมูล...";
      btn.disabled = true;
    }

    try {
      const events = (typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS)) ? CURRENT_EVENTS : [];
      const crankStats = (typeof analyzeCrankAndRunSessions === "function") ? analyzeCrankAndRunSessions(events) : { sessions: [] };
      const summary = (typeof DEFAULT_LOG_SUMMARY !== "undefined" && DEFAULT_LOG_SUMMARY) ? DEFAULT_LOG_SUMMARY : {};
      const appSettings = (typeof APP_SETTINGS !== "undefined" && APP_SETTINGS) ? APP_SETTINGS : {};
      const lineState = (typeof LINE_STATE !== "undefined" && LINE_STATE) ? LINE_STATE : {};
      const oilPm = window._lastOilPmInfo || null;

      const payload = {
        action: "sync_all",
        summary: {
          model: summary.model || "MarkIIXG (FTA1100-J)",
          sn: summary.sn || "00-574-537-03RE",
          stationTag: appSettings.stationTag || "-",
          company: appSettings.companyName || "-",
          department: appSettings.department || "-",
          pump_total: summary.pump_total || "0:00",
          controller_hours: summary.controller_hours || "-",
          mode: summary.mode || "-",
          lastPsi: events.length > 0 ? (events[events.length - 1].psi || "-") : "-",
          b1_v: summary.b1_v || "-",
          b1_a: summary.b1_a || "-",
          b2_v: summary.b2_v || "-",
          b2_a: summary.b2_a || "-",
          lastFile: localStorage.getItem("firetrol_last_file") || "-",
          totalEvents: events.length,
          totalRuns: crankStats.sessions ? crankStats.sessions.length : 0
        },
        sessions: (crankStats.sessions || []).map(s => ({
          idx: s.idx,
          crank: s.crank,
          startRaw: s.startRaw,
          stopRaw: s.stopRaw,
          durationStr: s.durationStr,
          durationShort: s.durationShort,
          durationSec: s.durationSec,
          psi: s.psi
        })),
        lineHistory: lineState.testRoundsHistory || [],
        oilPm: oilPm ? {
          currentHours: oilPm.currentHours,
          targetHours: oilPm.targetHours,
          remText: oilPm.remText,
          isDue: !!oilPm.isDue,
          technician: appSettings.inspectorName || "ช่างเทคนิค"
        } : null
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res && res.status === "success") {
        cfg.lastSyncTime = new Date().toLocaleString("th-TH");
        cfg.lastStatus = "เชื่อมต่อแล้ว";
        saveGSheetsConfig(cfg);

        const msg = `☁️ ซิงค์ Google Sheets สำเร็จ! (เพิ่มรอบเดินเครื่องใหม่: ${res.runsAdded || 0} รอบ, รอบทดสอบ LINE: ${res.lineAdded || 0} รอบ)`;
        if (typeof window.showSettingsToast === "function") {
          window.showSettingsToast(msg);
        } else if (!isSilent) {
          alert(msg);
        }
      } else {
        throw new Error(res ? res.message : "Sync failed");
      }

    } catch (err) {
      console.warn("GSheets sync error:", err);
      if (!isSilent) {
        alert("⚠️ เกิดข้อผิดพลาดในการซิงค์ขึ้น Google Sheets:\n" + err.message);
      }
    } finally {
      if (btn && !isSilent) {
        btn.innerHTML = origBtnText;
        btn.disabled = false;
      }
      updateGSheetsUI();
    }
  };

  // ---------------------------------------------------------------------------
  //  Auto-Sync Debounce Trigger
  // ---------------------------------------------------------------------------
  let autoSyncTimer = null;
  window.triggerGoogleSheetsAutoSync = function (triggerSource) {
    const cfg = getGSheetsConfig();
    if (!cfg.webAppUrl || cfg.autoSync === false) return;

    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => {
      console.log(`[GoogleSheets] Auto-sync triggered by ${triggerSource}`);
      window.syncAllToGoogleSheets(true);
    }, 2500); // 2.5s debounce
  };

  // ---------------------------------------------------------------------------
  //  Guide Modal
  // ---------------------------------------------------------------------------
  async function loadAppsScriptCode() {
    const codeEl = document.getElementById("gsheetsScriptCodeBlock");
    if (codeEl && !codeEl.textContent.trim()) {
      try {
        const resp = await fetch("google_sheets_apps_script.js");
        if (resp.ok) {
          codeEl.textContent = await resp.text();
        }
      } catch (e) {
        console.warn("Could not fetch apps script file:", e);
      }
    }
  }

  window.openGoogleSheetsGuideModal = function () {
    const modal = document.getElementById("modalGoogleSheetsGuide");
    if (modal) modal.classList.add("active");
    loadAppsScriptCode();
  };

  window.closeGoogleSheetsGuideModal = function () {
    const modal = document.getElementById("modalGoogleSheetsGuide");
    if (modal) modal.classList.remove("active");
  };

  window.copyGoogleSheetsScriptToClipboard = async function () {
    const codeEl = document.getElementById("gsheetsScriptCodeBlock");
    const code = codeEl ? codeEl.innerText : "";
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("📋 คัดลอกโค้ด Google Apps Script แล้ว!");
      } else {
        alert("📋 คัดลอกโค้ดเรียบร้อยแล้ว! สามารถนำไปวางใน Apps Script ได้ทันที");
      }
    } catch (err) {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("📋 คัดลอกโค้ดเรียบร้อยแล้ว!");
    }
  };

  // ---------------------------------------------------------------------------
  //  Initialize
  // ---------------------------------------------------------------------------
  function init() {
    updateGSheetsUI();
    loadAppsScriptCode();

    // Hook into file upload completion if available
    const originalProcessLogFile = window.processLogFile;
    if (typeof originalProcessLogFile === "function" && !window.__gsheetsHookInstalled) {
      window.__gsheetsHookInstalled = true;
      window.processLogFile = async function () {
        const res = await originalProcessLogFile.apply(this, arguments);
        window.triggerGoogleSheetsAutoSync("log_file_upload");
        return res;
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
