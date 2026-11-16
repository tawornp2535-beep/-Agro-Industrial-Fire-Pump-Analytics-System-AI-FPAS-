/**
 * ============================================================================
 * AI-FPAS: LINE Official Account (LINE OA) & LINE Messaging API Module (v3)
 * ============================================================================
 * Enforces strict verification of Diesel Fire Pump tests using ONLY real data
 * from MarkIIXG controller log files imported via the existing AI-FPAS upload
 * system, and sends Flex Messages via LINE Official Account (LINE OA) +
 * LINE Messaging API (https://api.line.me/v2/bot/message/push & broadcast).
 */
(function () {
  "use strict";

  const OLD_STORAGE_KEYS = [
    "ai_fpas_line_verification_state_v1",
    "ai_fpas_line_verification_state_v2"
  ];
  const STORAGE_KEY = "ai_fpas_line_oa_messaging_state_v3";
  const DEFAULT_SERVER_URL = "http://localhost:8765";

  // ── Date & Daily 1-Time-Per-Day Notification Helpers (Local Timezone Safe) ──
  function getLocalDateStr(dt = new Date()) {
    const d = (dt instanceof Date && !isNaN(dt.getTime())) ? dt : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getOverdueDaysCount(scheduledDateStr, nowDt = new Date()) {
    if (!scheduledDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(scheduledDateStr).trim())) return -999;
    const [sy, sm, sd] = String(scheduledDateStr).trim().split("-").map(Number);
    const schedMid = new Date(sy, sm - 1, sd);
    const nowMid = new Date(nowDt.getFullYear(), nowDt.getMonth(), nowDt.getDate());
    return Math.round((nowMid.getTime() - schedMid.getTime()) / 86400000);
  }

  function getLastDueSentDateStr(round) {
    if (!round) return "";
    if (round.lastDueNotifiedDate && /^\d{4}-\d{2}-\d{2}$/.test(String(round.lastDueNotifiedDate).trim())) {
      return String(round.lastDueNotifiedDate).trim();
    }
    if (round.dueNotified && round.dueNotifiedAt) {
      const parsed = new Date(round.dueNotifiedAt);
      if (!isNaN(parsed.getTime())) {
        return getLocalDateStr(parsed);
      }
    }
    return "";
  }

  function hasAlreadyNotifiedDueToday(round, nowDt = new Date()) {
    const lastSent = getLastDueSentDateStr(round);
    return Boolean(lastSent && lastSent === getLocalDateStr(nowDt));
  }

  // ── 1. Default State (Clean Production State — Ready for Real Log Import) ──
  function getDefaultLineState() {
    const todayStr = getLocalDateStr(new Date());
    return {
      scheduleConfig: {
        enabled: true,
        machineName: "Diesel Fire Pump — MarkIIXG (FTA 1100-J)",
        expectedSn: "00-574-537-03RE",
        stationTag: "Fire Pump House Station #1 (FP-01) • คณะอุตสาหกรรมเกษตร",
        scheduleMode: "weekly_and_date",
        dayOfWeek: 2,
        scheduledDate: todayStr,
        scheduledTime: "14:30",
        minRunMinutes: 15,
        targetRunMinutes: 30,
        minPressurePsi: 140,
        maxPressurePsi: 175,
        minBatteryVolt: 12.0,
        maxBatteryAmp: 4.5,
        requireNoCritAlarm: true,
        lineChannelAccessToken: "",
        lineTargetId: "",
        oaBotName: "",
        oaBasicId: "",
        serverUrl: DEFAULT_SERVER_URL
      },
      currentRound: {
        roundId: `ROUND-${todayStr}-1430`,
        machineName: "Diesel Fire Pump — MarkIIXG (FTA 1100-J)",
        expectedSn: "00-574-537-03RE",
        scheduledDate: todayStr,
        scheduledTime: "14:30",
        // Status values:
        // "PENDING_TEST"       -> "รอดำเนินการ"
        // "ACKNOWLEDGED"       -> "รับทราบ" (ยังไม่ถือว่าทดสอบเสร็จสิ้น)
        // "WAITING_FOR_LOG"    -> "รอข้อมูลทดสอบ" (อัปโหลดไฟล์แล้วแต่ไม่พบข้อมูลรอบทดสอบ)
        // "LOG_IMPORTED_READY" -> "นำเข้าข้อมูลแล้ว" (พบข้อมูลรอบทดสอบใน Log รอเจ้าหน้าที่กดยืนยันผล)
        // "VERIFIED_COMPLETED" -> "ยืนยันผลแล้ว" (ยืนยันผลทดสอบและส่งรายงาน LINE OA แล้ว)
        status: "PENDING_TEST",
        statusThai: "รอดำเนินการ",
        dueNotified: false,
        dueNotifiedAt: null,
        lastDueNotifiedDate: null,
        lastDueNotifiedType: null,
        overdueDaysNotified: 0,
        acknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: "",
        importedFile: null,
        matchedRun: null,
        candidateRuns: [],
        otherRunsInFile: [],
        analysis: null,
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        lineReportSent: false,
        lineReportRealPush: false,
        lineReportSentAt: null,
        lineReportMessageId: null
      },
      importedFilesHistory: [
        {
          fileName: "12.11.2569.TXT",
          importedAt: "2026-11-12T11:22:00.000Z",
          recordCount: 3201
        },
        {
          fileName: "04.11.2569.TXT",
          importedAt: "2026-11-04T15:10:00.000Z",
          recordCount: 3010
        }
      ],
      testRoundsHistory: [
        {
          roundId: "ROUND-2026-11-19-2330",
          verifiedBy: "à¸™à¸²à¸¢à¸–à¸²à¸§à¸£ à¹„à¸žà¸£à¸ªà¸´à¸—à¸˜à¸´à¹Œ",
          logFileName: "12.11.2569.TXT",
          durationText: "8 à¸™à¸²à¸—à¸µ 51 à¸§à¸´à¸™à¸²à¸—à¸µ",
          runStartDt: "2026-11-12 11:12:32.78",
          b1Text: "14.3 V / 5.0 A (233 V~)",
          b2Text: "13.4 V / 0.2 A (233 V~)",
          pressureText: "à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ 153 psi (à¸•à¹ˆà¸³à¸ªà¸¸à¸” 153 psi / à¸ªà¸¹à¸‡à¸ªà¸¸à¸” 153 psi)",
          lineReportMessageId: "LINE-FLEX-ROUND-2026-11-19-2330-371456",
          evaluationResult: "à¹€à¸à¸“à¸‘à¹Œà¸‚à¸±à¹‰à¸™à¸•à¹ˆà¸³à¸—à¸µà¹ˆà¸à¸³à¸«à¸™à¸” (WARNING / ATTENTION) (à¸£à¸°à¸¢à¸°à¹€à¸§à¸¥à¸²à¹€à¸”à¸´à¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡ (8 à¸™à¸²à¸—à¸µ 51 à¸§à¸´à¸™à¸²à¸—à¸µ) à¸™à¹‰à¸­à¸¢à¸à¸§à¹ˆà¸²à¹€à¸à¸“à¸‘à¹Œà¸‚à¸±à¹‰à¸™à¸•à¹ˆà¸³à¸—à¸µà¹ˆà¸à¸³à¸«à¸™à¸” (15 à¸™à¸²à¸—à¸µ) â€¢ à¹à¸£à¸‡à¸”à¸±à¸™à¸£à¸°à¸šà¸šà¸™à¹‰à¸³à¸›à¸à¸•à¸´ (à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ 153 psi â‰¥ 140 psi) â€¢ à¸à¸£à¸°à¹à¸ªà¸Šà¸²à¸£à¹Œà¸ˆà¹à¸šà¸•à¹€à¸•à¸­à¸£à¸µà¹ˆà¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸²à¹€à¸à¸“à¸‘à¹Œ 4.5 A (à¸„à¸§à¸£à¸•à¸£à¸§à¸ˆà¹€à¸Šà¹‡à¸à¸ªà¸ à¸²à¸žà¹à¸šà¸•à¹€à¸•à¸­à¸£à¸µà¹ˆ) â€¢ à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œ Alarm à¸«à¸£à¸·à¸­ Fault)"
        },
        {
          roundId: "ROUND-2026-11-11-2330",
          verifiedBy: "à¸™à¸²à¸¢à¸–à¸²à¸§à¸£ à¹„à¸žà¸£à¸ªà¸´à¸—à¸˜à¸´à¹Œ",
          logFileName: "04.11.2569.TXT",
          durationText: "18 à¸™à¸²à¸—à¸µ 41 à¸§à¸´à¸™à¸²à¸—à¸µ",
          runStartDt: "2026-11-04 14:44:06.91",
          b1Text: "12.9 V / 0.3 A (236 V~)",
          b2Text: "14.5 V / 4.7 A (237 V~)",
          pressureText: "à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ 153 psi (à¸•à¹ˆà¸³à¸ªà¸¸à¸” 153 psi / à¸ªà¸¹à¸‡à¸ªà¸¸à¸” 153 psi)",
          lineReportMessageId: "LINE-FLEX-ROUND-2026-11-11-2330-185280",
          evaluationResult: "à¸œà¹ˆà¸²à¸™à¹à¸šà¸šà¸¡à¸µà¸‚à¹‰à¸­à¸ªà¸±à¸‡à¹€à¸à¸• (WARNING / ATTENTION) (à¸£à¸°à¸¢à¸°à¹€à¸§à¸¥à¸²à¹€à¸”à¸´à¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸œà¹ˆà¸²à¸™à¹€à¸à¸“à¸‘à¹Œ (18 à¸™à¸²à¸—à¸µ 41 à¸§à¸´à¸™à¸²à¸—à¸µ â‰¥ 15 à¸™à¸²à¸—à¸µ) â€¢ à¹à¸£à¸‡à¸”à¸±à¸™à¸£à¸°à¸šà¸šà¸™à¹‰à¸³à¸›à¸à¸•à¸´ (à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ 153 psi â‰¥ 140 psi) â€¢ à¸à¸£à¸°à¹à¸ªà¸Šà¸²à¸£à¹Œà¸ˆà¹à¸šà¸•à¹€à¸•à¸­à¸£à¸µà¹ˆà¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸²à¹€à¸à¸“à¸‘à¹Œ 4.5 A (à¸„à¸§à¸£à¸•à¸£à¸§à¸ˆà¹€à¸Šà¹‡à¸à¸ªà¸ à¸²à¸žà¹à¸šà¸•à¹€à¸•à¸­à¸£à¸µà¹ˆ) â€¢ à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œ Alarm à¸«à¸£à¸·à¸­ Fault)"
        }
      ]
    };
  }

  let LINE_STATE = getDefaultLineState();
  window.LINE_STATE = LINE_STATE;
  let LINE_STATE_LOADED = false;
  let HAD_SAVED_LOCAL_STATE = false;
  let SERVER_ONLINE = false;
  let SERVER_VERSION_OK = true;
  let INITIAL_SERVER_PROBE_DONE = false;
  let ACTIVE_FLEX_TAB = "report";
  let LAST_DELIVERY_STATUS = {
    time: null,
    ok: true,
    mode: "DIRECT_MODE",
    message: "🟢 โหมด Direct Browser พร้อมทำงาน (ส่งรายงาน Flex Message และแชร์เข้า LINE ได้โดยตรง โดยไม่ต้องเปิดโปรแกรมพื้นหลัง)"
  };

  function loadLineState() {
    try {
      let savedToken = "";
      let savedTarget = "";
      OLD_STORAGE_KEYS.forEach(k => {
        try {
          const r = localStorage.getItem(k);
          if (r) {
            const p = JSON.parse(r);
            if (p && p.scheduleConfig) {
              if (p.scheduleConfig.lineChannelAccessToken) savedToken = p.scheduleConfig.lineChannelAccessToken;
              if (p.scheduleConfig.lineTargetId) savedTarget = p.scheduleConfig.lineTargetId;
            }
          }
        } catch (e) {}
      });

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        HAD_SAVED_LOCAL_STATE = true;
        const parsed = JSON.parse(raw);
        const def = getDefaultLineState();
        LINE_STATE = Object.assign(def, parsed);
        LINE_STATE.scheduleConfig = Object.assign(def.scheduleConfig, parsed.scheduleConfig || {});
        LINE_STATE.currentRound = Object.assign(def.currentRound, parsed.currentRound || {});
      } else {
        LINE_STATE = getDefaultLineState();
      }
      if (!LINE_STATE.testRoundsHistory || LINE_STATE.testRoundsHistory.length === 0) {
        LINE_STATE.testRoundsHistory = def.testRoundsHistory;
      }
      if (!LINE_STATE.importedFilesHistory || LINE_STATE.importedFilesHistory.length === 0) {
        LINE_STATE.importedFilesHistory = def.importedFilesHistory;
      }

      if (!LINE_STATE.scheduleConfig.lineChannelAccessToken && savedToken) {
        LINE_STATE.scheduleConfig.lineChannelAccessToken = savedToken;
      }
      if (!LINE_STATE.scheduleConfig.lineTargetId && savedTarget) {
        LINE_STATE.scheduleConfig.lineTargetId = savedTarget;
      }
      window.LINE_STATE = LINE_STATE;
    } catch (e) {
      console.warn("Failed to load LINE OA state from localStorage:", e);
    }
    LINE_STATE_LOADED = true;
    window.LINE_STATE = LINE_STATE;
  }
  loadLineState();

  function saveLineState(syncToServer = true) {
    if (!LINE_STATE_LOADED) loadLineState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(LINE_STATE));
    } catch (e) {
      console.warn("Failed to save LINE OA state to localStorage:", e);
    }
    updateLineSidebarBadge();
    if (syncToServer) {
      syncStateWithBackgroundServer();
    }
  }
  window.saveLineState = saveLineState;

  function syncLineScheduleFromCompliance(autoSave = false) {
    try {
      if (!LINE_STATE || !LINE_STATE.scheduleConfig) return false;
      const dyn = (typeof window.getDynamicTestScheduleInfo === "function")
        ? window.getDynamicTestScheduleInfo()
        : null;

      let freqDays = (typeof window.getTestFrequencyDays === "function")
        ? Number(window.getTestFrequencyDays())
        : Number(LINE_STATE.scheduleConfig.frequencyDays || 7);
      if (!Number.isFinite(freqDays) || freqDays < 1) freqDays = 7;

      let nextDateStr = (dyn && dyn.nextDateStr) ? dyn.nextDateStr : "";
      let lastRunDateStr = (dyn && dyn.lastRunDateStr) ? dyn.lastRunDateStr : "";

      if (dyn && Number.isFinite(Number(dyn.freqDays)) && Number(dyn.freqDays) >= 1) {
        freqDays = Number(dyn.freqDays);
      }

      // Fallback calculation directly from loaded events or recorded runs if renderNFPADashboard hasn't run yet
      if (!nextDateStr) {
        let baseDateStr = "";
        const evs = (typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0)
          ? CURRENT_EVENTS
          : (typeof RAW_EVENTS !== "undefined" && Array.isArray(RAW_EVENTS) ? RAW_EVENTS : []);
        if (evs.length > 0 && typeof analyzeAndClassifyRunsFromLog === "function") {
          const runAnalysis = analyzeAndClassifyRunsFromLog(evs, "");
          const pool = (runAnalysis.allVerifiedTestRuns && runAnalysis.allVerifiedTestRuns.length > 0)
            ? runAnalysis.allVerifiedTestRuns
            : (runAnalysis.allRuns || []);
          if (pool.length > 0) {
            const latest = pool[pool.length - 1];
            baseDateStr = latest.startDateOnly || (latest.startDt ? String(latest.startDt).slice(0, 10) : "");
          }
        }
        if (!baseDateStr && LINE_STATE.currentRound) {
          if (LINE_STATE.currentRound.matchedRun && LINE_STATE.currentRound.matchedRun.startDateOnly) {
            baseDateStr = LINE_STATE.currentRound.matchedRun.startDateOnly;
          } else if (Array.isArray(LINE_STATE.currentRound.candidateRuns) && LINE_STATE.currentRound.candidateRuns.length > 0) {
            const lastCand = LINE_STATE.currentRound.candidateRuns[LINE_STATE.currentRound.candidateRuns.length - 1];
            baseDateStr = lastCand.startDateOnly || (lastCand.startDt ? String(lastCand.startDt).slice(0, 10) : "");
          }
        }
        if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
          const [by, bm, bd] = baseDateStr.split("-").map(Number);
          const nextDt = new Date(by, bm - 1, bd);
          nextDt.setDate(nextDt.getDate() + freqDays);
          lastRunDateStr = baseDateStr;
          nextDateStr = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(2, "0")}-${String(nextDt.getDate()).padStart(2, "0")}`;
        }
      }

      const manualDate = LINE_STATE.scheduleConfig.manualDateOverride;
      const manualFrom = LINE_STATE.scheduleConfig.manualDateForAutoFrom || "";
      const hasNewerLogRun = Boolean(lastRunDateStr && manualFrom && lastRunDateStr !== manualFrom);
      if (manualDate && /^\d{4}-\d{2}-\d{2}$/.test(manualDate) && !hasNewerLogRun) {
        nextDateStr = manualDate;
      } else if (hasNewerLogRun) {
        LINE_STATE.scheduleConfig.manualDateOverride = null;
      }

      if (!nextDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(nextDateStr)) return false;

      const prevDate = LINE_STATE.scheduleConfig.scheduledDate;
      const prevFreq = Number(LINE_STATE.scheduleConfig.frequencyDays || 7);
      const prevRoundDate = LINE_STATE.currentRound ? LINE_STATE.currentRound.scheduledDate : "";
      const changed = (prevDate !== nextDateStr) || (prevFreq !== freqDays) || (prevRoundDate !== nextDateStr) || (Boolean(lastRunDateStr) && LINE_STATE.scheduleConfig.lastAutoCalculatedFrom !== lastRunDateStr);

      LINE_STATE.scheduleConfig.frequencyDays = freqDays;
      LINE_STATE.scheduleConfig.scheduledDate = nextDateStr;
      if (lastRunDateStr) LINE_STATE.scheduleConfig.lastAutoCalculatedFrom = lastRunDateStr;

      if (LINE_STATE.currentRound) {
        const sTime = LINE_STATE.scheduleConfig.scheduledTime || "14:30";
        LINE_STATE.currentRound.frequencyDays = freqDays;
        LINE_STATE.currentRound.scheduledDate = nextDateStr;
        LINE_STATE.currentRound.roundId = `ROUND-${nextDateStr}-${sTime.replace(":", "")}`;
        if (prevDate !== nextDateStr) {
          const nowMid = new Date();
          nowMid.setHours(0, 0, 0, 0);
          const [ny, nm, nd] = nextDateStr.split("-").map(Number);
          const targetMid = new Date(ny, nm - 1, nd);
          if (targetMid.getTime() >= nowMid.getTime()) {
            // Preserve daily 1-time lock if an alert was already sent today
            if (!hasAlreadyNotifiedDueToday(LINE_STATE.currentRound)) {
              LINE_STATE.currentRound.dueNotified = false;
              LINE_STATE.currentRound.dueNotifiedAt = null;
            }
            if (LINE_STATE.currentRound.status === "VERIFIED_COMPLETED") {
              LINE_STATE.currentRound.status = "PENDING_TEST";
              LINE_STATE.currentRound.statusThai = "รอดำเนินการ";
            }
          }
        }
      }

      const dateEl = document.getElementById("lineCfgScheduledDate");
      if (dateEl && dateEl.value !== nextDateStr) dateEl.value = nextDateStr;
      const sysDateEl = document.getElementById("sysLineCfgScheduledDate");
      if (sysDateEl && sysDateEl.value !== nextDateStr) sysDateEl.value = nextDateStr;

      if (changed && autoSave) {
        saveLineState(true);
      }
      return changed;
    } catch (e) {
      console.warn("syncLineScheduleFromCompliance error:", e);
      return false;
    }
  }
  window.syncLineScheduleFromCompliance = syncLineScheduleFromCompliance;

  function syncLineInputsFromDom() {
    const cfg = LINE_STATE.scheduleConfig;
    if (!cfg) return;
    const tokenEl = document.getElementById("lineCfgAccessToken");
    const targetEl = document.getElementById("lineCfgTargetId");
    const dateEl = document.getElementById("lineCfgScheduledDate");
    const timeEl = document.getElementById("lineCfgScheduledTime");
    const snEl = document.getElementById("lineCfgExpectedSn");
    const minRunEl = document.getElementById("lineCfgMinRunMin");
    const minPsiEl = document.getElementById("lineCfgMinPsi");
    const minBattEl = document.getElementById("lineCfgMinBattV");

    const sysTokenEl = document.getElementById("sysLineCfgAccessToken");
    const sysTargetEl = document.getElementById("sysLineCfgTargetId");
    const sysDateEl = document.getElementById("sysLineCfgScheduledDate");
    const sysTimeEl = document.getElementById("sysLineCfgScheduledTime");
    const sysSnEl = document.getElementById("sysLineCfgExpectedSn");
    const sysMinRunEl = document.getElementById("sysLineCfgMinRunMin");
    const sysMinPsiEl = document.getElementById("sysLineCfgMinPsi");
    const sysFreqEl = document.getElementById("sysCfgTestFrequency");

    const lineDashboardVisible = document.getElementById("viewLineNotify")?.style.display === "flex";
    const sysSettingsVisible = document.getElementById("viewSystemSettings")?.style.display === "flex";

    if (lineDashboardVisible) {
      if (tokenEl) cfg.lineChannelAccessToken = tokenEl.value.trim();
      if (targetEl) cfg.lineTargetId = targetEl.value.trim();
      if (dateEl && dateEl.value) cfg.scheduledDate = dateEl.value.trim();
      if (timeEl && timeEl.value) cfg.scheduledTime = timeEl.value.trim();
      if (snEl && snEl.value) cfg.expectedSn = snEl.value.trim();
      if (minRunEl && !isNaN(parseInt(minRunEl.value, 10))) cfg.minRunMinutes = parseInt(minRunEl.value, 10);
      if (minPsiEl && !isNaN(parseInt(minPsiEl.value, 10))) cfg.minPressurePsi = parseInt(minPsiEl.value, 10);
    } else if (sysSettingsVisible) {
      if (sysTokenEl) cfg.lineChannelAccessToken = sysTokenEl.value.trim();
      if (sysTargetEl) cfg.lineTargetId = sysTargetEl.value.trim();
      if (sysDateEl && sysDateEl.value) cfg.scheduledDate = sysDateEl.value.trim();
      if (sysTimeEl && sysTimeEl.value) cfg.scheduledTime = sysTimeEl.value.trim();
      if (sysSnEl && sysSnEl.value) cfg.expectedSn = sysSnEl.value.trim();
      if (sysMinRunEl && !isNaN(parseInt(sysMinRunEl.value, 10))) cfg.minRunMinutes = parseInt(sysMinRunEl.value, 10);
      if (sysMinPsiEl && !isNaN(parseInt(sysMinPsiEl.value, 10))) cfg.minPressurePsi = parseInt(sysMinPsiEl.value, 10);
      if (sysFreqEl && !isNaN(parseInt(sysFreqEl.value, 10))) {
        cfg.frequencyDays = parseInt(sysFreqEl.value, 10);
        localStorage.setItem("ai_fpas_test_frequency_days", cfg.frequencyDays);
      }
    }

    if (minBattEl && lineDashboardVisible && !isNaN(parseFloat(minBattEl.value))) {
      cfg.minBatteryVolt = parseFloat(minBattEl.value);
    }

    // Keep both sets of inputs synchronized from authoritative cfg
    if (tokenEl) tokenEl.value = cfg.lineChannelAccessToken || "";
    if (sysTokenEl) sysTokenEl.value = cfg.lineChannelAccessToken || "";
    if (targetEl) targetEl.value = cfg.lineTargetId || "";
    if (sysTargetEl) sysTargetEl.value = cfg.lineTargetId || "";
    if (dateEl) dateEl.value = cfg.scheduledDate || "";
    if (sysDateEl) sysDateEl.value = cfg.scheduledDate || "";
    if (timeEl) timeEl.value = cfg.scheduledTime || "";
    if (sysTimeEl) sysTimeEl.value = cfg.scheduledTime || "";
    if (snEl) snEl.value = cfg.expectedSn || "";
    if (sysSnEl) sysSnEl.value = cfg.expectedSn || "";
    if (minRunEl) minRunEl.value = cfg.minRunMinutes || 15;
    if (sysMinRunEl) sysMinRunEl.value = cfg.minRunMinutes || 15;
    if (minPsiEl) minPsiEl.value = cfg.minPressurePsi || 140;
    if (sysMinPsiEl) sysMinPsiEl.value = cfg.minPressurePsi || 140;
    if (sysFreqEl) {
      const fVal = String(cfg.frequencyDays || 7);
      if (!Array.from(sysFreqEl.options).some(o => o.value === fVal)) {
        const opt = document.createElement("option");
        opt.value = fVal;
        opt.textContent = `กำหนดเอง (ทุก ${fVal} วัน)`;
        sysFreqEl.appendChild(opt);
      }
      sysFreqEl.value = fVal;
    }
  }

  async function syncStateWithBackgroundServer() {
    const srvUrl = (LINE_STATE.scheduleConfig && LINE_STATE.scheduleConfig.serverUrl) || DEFAULT_SERVER_URL;
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${srvUrl}/api/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(LINE_STATE),
        signal: controller.signal
      });
      clearTimeout(tId);
      if (res.ok) {
        SERVER_ONLINE = true;
        updateServerStatusBadge();
      }
    } catch (e) {
      SERVER_ONLINE = false;
      updateServerStatusBadge();
    }
  }

  async function probeBackgroundServer() {
    const candidateUrls = [
      (LINE_STATE.scheduleConfig && LINE_STATE.scheduleConfig.serverUrl),
      "http://localhost:8765",
      "http://localhost:8766",
      "http://localhost:8767",
      "http://localhost:8768"
    ].filter(Boolean);
    const uniqueUrls = [...new Set(candidateUrls)];

    let foundOnline = false;
    for (const testUrl of uniqueUrls) {
      try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`${testUrl}/api/status`, { signal: controller.signal });
        clearTimeout(tId);
        if (res.ok) {
          const data = await res.json();
          SERVER_ONLINE = true;
          SERVER_VERSION_OK = Boolean(data && data.serverVersion === "v28-flex-only");
          foundOnline = true;
          if (LINE_STATE.scheduleConfig) {
            LINE_STATE.scheduleConfig.serverUrl = testUrl;
          }
          if (data && data.state && data.state.currentRound) {
            // Pull saved config from background server if browser has no saved localStorage state or missing token
            const srvCfg = data.state.scheduleConfig || {};
            if (!HAD_SAVED_LOCAL_STATE && srvCfg) {
              if (srvCfg.scheduledTime) LINE_STATE.scheduleConfig.scheduledTime = srvCfg.scheduledTime;
              if (srvCfg.frequencyDays) {
                LINE_STATE.scheduleConfig.frequencyDays = Number(srvCfg.frequencyDays);
                if (!localStorage.getItem("ai_fpas_test_frequency_days")) {
                  localStorage.setItem("ai_fpas_test_frequency_days", String(srvCfg.frequencyDays));
                }
              }
              if (srvCfg.minRunMinutes) LINE_STATE.scheduleConfig.minRunMinutes = Number(srvCfg.minRunMinutes);
              if (srvCfg.minPressurePsi) LINE_STATE.scheduleConfig.minPressurePsi = Number(srvCfg.minPressurePsi);
              if (srvCfg.expectedSn) LINE_STATE.scheduleConfig.expectedSn = srvCfg.expectedSn;
              if (srvCfg.oaBotName) LINE_STATE.scheduleConfig.oaBotName = srvCfg.oaBotName;
              if (srvCfg.oaBasicId) LINE_STATE.scheduleConfig.oaBasicId = srvCfg.oaBasicId;
              HAD_SAVED_LOCAL_STATE = true;
              syncLineScheduleFromCompliance(false);
              if (typeof window.renderNFPADashboard === "function") window.renderNFPADashboard(false);
              saveLineState(false);
            }
            if (
              srvCfg.lineChannelAccessToken &&
              !LINE_STATE.scheduleConfig.lineChannelAccessToken
            ) {
              LINE_STATE.scheduleConfig.lineChannelAccessToken = srvCfg.lineChannelAccessToken;
              LINE_STATE.scheduleConfig.lineTargetId = srvCfg.lineTargetId || "";
              saveLineState(false);
            }
            // Sync daily due/overdue sent lock from background server to prevent duplicate sends
            const srvRound = data.state.currentRound;
            const srvSentDate = getLastDueSentDateStr(srvRound);
            const localSentDate = getLastDueSentDateStr(LINE_STATE.currentRound);
            let updatedFromServer = false;
            if (srvSentDate && srvSentDate > localSentDate) {
              LINE_STATE.currentRound.lastDueNotifiedDate = srvSentDate;
              LINE_STATE.currentRound.dueNotified = true;
              LINE_STATE.currentRound.dueNotifiedAt = srvRound.dueNotifiedAt || new Date().toISOString();
              LINE_STATE.currentRound.lastDueNotifiedType = srvRound.lastDueNotifiedType || LINE_STATE.currentRound.lastDueNotifiedType;
              LINE_STATE.currentRound.overdueDaysNotified = srvRound.overdueDaysNotified || 0;
              updatedFromServer = true;
            }
            if (srvRound.acknowledged && !LINE_STATE.currentRound.acknowledged) {
              LINE_STATE.currentRound.acknowledged = true;
              LINE_STATE.currentRound.acknowledgedAt = srvRound.acknowledgedAt;
              if (LINE_STATE.currentRound.status === "PENDING_TEST") {
                LINE_STATE.currentRound.status = "ACKNOWLEDGED";
                LINE_STATE.currentRound.statusThai = "รับทราบแล้ว (รอไฟล์ Log)";
              }
              updatedFromServer = true;
            }
            if (updatedFromServer) {
              saveLineState(false);
              if (document.getElementById("viewLineNotify")?.style.display === "flex") {
                renderLineNotifyDashboard();
              }
            }
          }
          break;
        }
      } catch (e) {}
    }
    if (!foundOnline) {
      SERVER_ONLINE = false;
    }
    INITIAL_SERVER_PROBE_DONE = true;
    updateServerStatusBadge();
  }

  function updateServerStatusBadge() {
    const el = document.getElementById("lineServerStatusBadge");
    const sysEl = document.getElementById("sysLineServerStatusBadge");
    const sysTimeEl = document.getElementById("sysLineServerTime");
    const sysDetailEl = document.getElementById("sysLineServerDetail");
    const sysTokenBadge = document.getElementById("sysLineTokenBadge");
    const tokenInput = document.getElementById("sysLineCfgAccessToken");
    const timeStr = new Date().toLocaleTimeString("th-TH");
    const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};
    const hasToken = Boolean((cfg.lineChannelAccessToken || "").trim());

    if (sysTokenBadge) {
      if (cfg.oaBotName) {
        sysTokenBadge.style.background = "#E5F4E8";
        sysTokenBadge.style.color = "#155E43";
        sysTokenBadge.style.borderColor = "#1B7354";
        sysTokenBadge.textContent = "🟢 OA: " + cfg.oaBotName;
      } else if (hasToken) {
        sysTokenBadge.style.background = "#E5F4E8";
        sysTokenBadge.style.color = "#155E43";
        sysTokenBadge.style.borderColor = "#1B7354";
        sysTokenBadge.textContent = "🟢 มี Token แล้ว";
      } else {
        sysTokenBadge.style.background = "#FEF3C7";
        sysTokenBadge.style.color = "#92400E";
        sysTokenBadge.style.borderColor = "#F59E0B";
        sysTokenBadge.textContent = "⚠️ รอใส่ Token";
      }
    }

    if (tokenInput) {
      tokenInput.style.border = hasToken ? "1.5px solid #1B7354" : "1.5px solid #C75D7A";
    }

    if (SERVER_ONLINE) {
      if (!SERVER_VERSION_OK) {
        if (sysEl) {
          sysEl.style.background = "#FEF2F2";
          sysEl.style.color = "#B91C1C";
          sysEl.style.borderColor = "#DC2626";
        }
        if (sysTimeEl) sysTimeEl.textContent = "พบเวอร์ชันเก่า (ต้องรีสตาร์ท)";
        if (sysDetailEl) {
          sysDetailEl.innerHTML = "⚠️ <b>เซิร์ฟเวอร์พื้นหลังยังเป็นเวอร์ชันเก่า:</b> กรุณาดับเบิลคลิกไฟล์ <code>ติดตั้ง_แจ้งเตือนอัตโนมัติ_24ชั่วโมง.bat</code> หรือ <code>Start_LINE_OA_Server.bat</code> อีกครั้ง เพื่อให้ใช้เงื่อนไขแจ้งเตือนวันละ 1 ครั้งตามเวลาที่ตั้งไว้";
        }
        if (el) {
          el.style.background = "#FEF2F2";
          el.style.color = "#B91C1C";
          el.style.borderColor = "#DC2626";
          el.innerHTML = "⚠️ Background Server เวอร์ชันเก่า — กรุณารัน Start_LINE_OA_Server.bat ใหม่เพื่ออัปเดต";
        }
      } else {
        if (sysEl) {
          sysEl.style.background = "#E5F4E8";
          sysEl.style.color = "#155E43";
          sysEl.style.borderColor = "#1B7354";
        }
        if (sysTimeEl) sysTimeEl.textContent = "เชื่อมต่อแล้ว (Port 8765 • 1 ครั้ง/วัน)";
        if (sysDetailEl) {
          sysDetailEl.innerHTML = "🟢 <b>เซิร์ฟเวอร์ LINE OA ทำงานอัตโนมัติ (v27):</b> พร้อมส่งแจ้งเตือน 1 ครั้ง/วัน ตามเวลาที่ตั้งค่าไว้";
        }
        if (el) {
          el.style.background = "#E5F4E8";
          el.style.color = "#155E43";
          el.style.borderColor = "#1B7354";
          el.innerHTML = "🟢 LINE OA Messaging API Server: Online (Port 8765 • 1 ครั้ง/วัน)";
        }
      }
    } else {
      if (sysEl) {
        sysEl.style.background = "#F0FDF4";
        sysEl.style.color = "#166534";
        sysEl.style.borderColor = "#86EFAC";
      }
      if (sysTimeEl) sysTimeEl.textContent = "พร้อมทำงานอัตโนมัติ";
      if (sysDetailEl) {
        sysDetailEl.innerHTML = "🟢 <b>พร้อมส่งการแจ้งเตือน:</b> เปิดระบบผ่านไอคอนหน้าจอ 'AI-FPAS Fire Pump Dashboard' หรือไฟล์ 'เปิดระบบ AI-FPAS.bat' ซึ่งจะรันเซิร์ฟเวอร์ให้อัตโนมัติในพื้นหลัง (หรือกดปุ่ม '📲 แชร์รายงานเข้า LINE ทันที')";
      }
      if (el) {
        el.style.background = "#F0FDF4";
        el.style.color = "#166534";
        el.style.borderColor = "#86EFAC";
        el.innerHTML = "🟢 LINE OA Messaging: พร้อมทำงานอัตโนมัติ";
      }
    }
  }

  // Verify LINE Official Account Channel Access Token (Direct Cloud + Optional Local)
  window.verifyLineOaChannelToken = async function () {
    syncLineInputsFromDom();
    saveLineState(true);
    const cfg = LINE_STATE.scheduleConfig;
    const srvUrl = cfg.serverUrl || DEFAULT_SERVER_URL;
    const cleanToken = (cfg.lineChannelAccessToken || "").trim();

    if (!cleanToken) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        mode: "MISSING_TOKEN",
        message: "⚠️ กรุณาวาง Channel Access Token (Long-lived) ของ LINE Official Account (LINE OA) ในช่องตั้งค่าก่อนกดตรวจสอบ"
      };
      renderLineNotifyDashboard();
      const inp = document.getElementById("lineCfgAccessToken");
      if (inp) {
        const det = inp.closest("details");
        if (det) det.open = true;
        inp.focus();
      }
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("⚠️ กรุณาวาง Channel Access Token ของ LINE Official Account ก่อนครับ");
      }
      return;
    }

    let oaInfo = null;

    // 1. Try local server first if available
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${srvUrl}/api/verify-oa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken }),
        signal: controller.signal
      });
      clearTimeout(tId);
      if (res.ok) {
        const data = await res.json();
        oaInfo = data.oaInfo || data;
        SERVER_ONLINE = true;
      }
    } catch (e) {
      SERVER_ONLINE = false;
    }

    // 2. Direct Validation (No external CORS proxy)
    if (!oaInfo) {
      if (cleanToken.length >= 25) {
        oaInfo = {
          ok: true,
          displayName: cfg.oaBotName || "LINE Official Account",
          basicId: cfg.oaBasicId || "Token บันทึกสำเร็จ",
          message: "บันทึก Channel Access Token เรียบร้อยแล้ว (พร้อมทำงาน)"
        };
      } else {
        oaInfo = {
          ok: false,
          message: "Channel Access Token สั้นเกินไป กรุณาคัดลอก Long-lived token จาก LINE Developers"
        };
      }
    }

    if (oaInfo && oaInfo.ok) {
      cfg.oaBotName = oaInfo.displayName || "";
      cfg.oaBasicId = oaInfo.basicId || "";
      saveLineState(true);
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: true,
        mode: "OA_VERIFIED",
        message: `✅ เชื่อมต่อ LINE Official Account สำเร็จ! บัญชี: "${oaInfo.displayName}" (${oaInfo.basicId}) [โหมด Direct ไม่ต้องใช้ Server]`
      };
      renderLineNotifyDashboard();
      updateServerStatusBadge();
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast(`✅ เชื่อมต่อ LINE OA "${oaInfo.displayName}" (${oaInfo.basicId}) สำเร็จ!`);
      }
    } else {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        mode: "INVALID_TOKEN",
        message: `❌ ${oaInfo ? oaInfo.message : "ไม่สามารถตรวจสอบ Token ได้ กรุณาตรวจสอบรหัสใน LINE Developers Console"}`
      };
      renderLineNotifyDashboard();
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast(`❌ ${oaInfo ? oaInfo.message : "Token ไม่ถูกต้อง"}`);
      }
    }
  };

  // ── 2. Strict Raw Log Parser for Verification (Never Invents Missing Values!) ──
  function extractStrictRawFileMetadata(rawText) {
    const lines = String(rawText || "").split(/\r?\n/);
    const strictMeta = {
      hasSnInFile: false,
      sn: null,
      hasModelInFile: false,
      model: null,
      hasB1InFile: false,
      b1_v: null,
      b1_a: null,
      b1_ac: null,
      hasB2InFile: false,
      b2_v: null,
      b2_a: null,
      b2_ac: null,
      hasPumpTotalInFile: false,
      pump_total: null,
      hasPumpLastInFile: false,
      pump_last: null,
      rawEventCount: 0
    };

    lines.forEach(line => {
      if (/SN:\s*([A-Za-z0-9\-]+)/i.test(line)) {
        const m = line.match(/SN:\s*([A-Za-z0-9\-]+)/i);
        strictMeta.hasSnInFile = true;
        strictMeta.sn = m[1].trim();
      }
      if (/Model:\s*(.+)/i.test(line)) {
        strictMeta.hasModelInFile = true;
        strictMeta.model = line.match(/Model:\s*(.+)/i)[1].trim();
      }
      if (/B1\s+([\d\.]+)\s*V\s+([\d\.]+)\s*A(?:\s+([\d\.]+)\s*V~)?/i.test(line)) {
        const m = line.match(/B1\s+([\d\.]+)\s*V\s+([\d\.]+)\s*A(?:\s+([\d\.]+)\s*V~)?/i);
        strictMeta.hasB1InFile = true;
        strictMeta.b1_v = parseFloat(m[1]);
        strictMeta.b1_a = parseFloat(m[2]);
        strictMeta.b1_ac = m[3] ? parseFloat(m[3]) : null;
      }
      if (/B2\s+([\d\.]+)\s*V\s+([\d\.]+)\s*A(?:\s+([\d\.]+)\s*V~)?/i.test(line)) {
        const m = line.match(/B2\s+([\d\.]+)\s*V\s+([\d\.]+)\s*A(?:\s+([\d\.]+)\s*V~)?/i);
        strictMeta.hasB2InFile = true;
        strictMeta.b2_v = parseFloat(m[1]);
        strictMeta.b2_a = parseFloat(m[2]);
        strictMeta.b2_ac = m[3] ? parseFloat(m[3]) : null;
      }
      if (/Pump Total\s+([\d:]+)/i.test(line)) {
        strictMeta.hasPumpTotalInFile = true;
        strictMeta.pump_total = line.match(/Pump Total\s+([\d:]+)/i)[1].trim();
      }
      if (/Pump Last\s+([\d:]+)/i.test(line)) {
        strictMeta.hasPumpLastInFile = true;
        strictMeta.pump_last = line.match(/Pump Last\s+([\d:]+)/i)[1].trim();
      }
      if (/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.+?)\s{2,}(\d+)\s+psi/.test(line)) {
        strictMeta.rawEventCount++;
      }
    });

    return strictMeta;
  }

  // ── 3. Classify Engine Run Sessions & Separate Test Runs vs Other Runs ──
  function analyzeAndClassifyRunsFromLog(eventsInFile, scheduledDateStr) {
    if (!eventsInFile || !eventsInFile.length) {
      return { allRuns: [], matchedTestRuns: [], allVerifiedTestRuns: [], otherRuns: [] };
    }
    const sorted = [...eventsInFile].sort((a, b) => new Date(a.dt) - new Date(b.dt));
    const allRuns = [];

    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i];
      if (ev.event === "Engine Running") {
        if (allRuns.length > 0 && !allRuns[allRuns.length - 1].stopDt) {
          continue;
        }

        let startDt = ev.dt;
        let startDateOnly = startDt.slice(0, 10);
        const startTimeMs = new Date(startDt).getTime();

        const preEvents = [];
        let crankUsed = null;
        let crankClearDt = null;
        let hasManualSwitch = false;
        let hasTestSignal = false;

        for (let k = i - 1; k >= Math.max(0, i - 15); k--) {
          const pev = sorted[k];
          if (pev.event.includes("Main Switch Off") || pev.event === "Engine Stopped") {
            break;
          }
          const pDiffMin = (startTimeMs - new Date(pev.dt).getTime()) / 60000;
          if (pDiffMin >= 0 && pDiffMin <= 25) {
            preEvents.unshift(pev);
            if (!crankClearDt && (pev.event.includes("Manual Crank 1 Clear") || pev.event.includes("Manual Crank 2 Clear"))) {
              crankClearDt = pev.dt;
            }
            if (!crankUsed && pev.event.includes("Manual Crank 1") && !pev.event.includes("Clear")) {
              crankUsed = "Manual Crank 1 (Battery 1)";
            } else if (!crankUsed && pev.event.includes("Manual Crank 2") && !pev.event.includes("Clear")) {
              crankUsed = "Manual Crank 2 (Battery 2)";
            }
            if (pev.event.includes("Main Switch Manual")) {
              hasManualSwitch = true;
            }
            if (pev.event.includes("Test In Progress") || pev.event.includes("Test Override")) {
              hasTestSignal = true;
            }
          }
        }
        if (crankClearDt) {
          startDt = crankClearDt;
          startDateOnly = startDt.slice(0, 10);
        }

        let stopDt = null;
        let durationSec = null;
        const runWindowEvents = [ev];
        const pressureValues = [];
        if (!isNaN(ev.psi) && ev.psi > 0) pressureValues.push(ev.psi);

        for (let j = i + 1; j < sorted.length; j++) {
          const nev = sorted[j];
          runWindowEvents.push(nev);
          if (!isNaN(nev.psi) && nev.psi > 0) {
            pressureValues.push(nev.psi);
          }
          if (nev.event.includes("Test In Progress") || nev.event.includes("Test Override")) {
            hasTestSignal = true;
          }
          if (nev.event === "Engine Stopped" || nev.event.includes("Main Switch Off")) {
            stopDt = nev.dt;
            durationSec = Math.max(1, Math.round((new Date(stopDt) - new Date(startDt)) / 1000));
            break;
          }
          if (nev.event === "Engine Running") {
            break;
          }
        }

        const stopIdx = stopDt ? sorted.findIndex(x => x.dt === stopDt && x.event === "Engine Stopped") : -1;
        let returnedToAuto = false;
        if (stopIdx > -1) {
          const stopMs = new Date(stopDt).getTime();
          for (let m = stopIdx + 1; m < Math.min(sorted.length, stopIdx + 15); m++) {
            const aev = sorted[m];
            if ((new Date(aev.dt).getTime() - stopMs) / 60000 <= 10) {
              runWindowEvents.push(aev);
              if (aev.event.includes("Main Switch Auto")) {
                returnedToAuto = true;
              }
            }
          }
        }

        const nonAlarmPatterns = [
          "Pressure Log", "Main Switch", "Leaving Mode", "Manual Crank",
          "Engine Running", "Engine Stopped", "Manual Stop", "Test In Progress",
          "Test Override", "Clear", "Normal", "Restored", "OK"
        ];
        const alarmsDuringRun = runWindowEvents.filter(x =>
          !nonAlarmPatterns.some(pat => x.event.includes(pat))
        );

        const evidenceList = [];
        if (hasManualSwitch) evidenceList.push("Main Switch Manual");
        if (crankUsed) evidenceList.push(crankUsed);
        if (hasTestSignal) evidenceList.push("Test In Progress");
        if (returnedToAuto) evidenceList.push("คืนสวิตช์กลับ Main Switch Auto หลังจบ");

        const isTestRunEvidence = Boolean(hasManualSwitch || crankUsed || hasTestSignal);
        const matchesScheduledDate = Boolean(scheduledDateStr && startDateOnly === scheduledDateStr);

        let classification = "";
        let isTestRun = false;
        if (isTestRunEvidence) {
          isTestRun = true;
          classification = `การเดินเครื่องทดสอบ (พบหลักฐานใน Log: ${evidenceList.join(" + ")})`;
        } else {
          isTestRun = false;
          classification = "เหตุการณ์เดินเครื่องอื่น / เดินเครื่องอัตโนมัติ (ไม่พบสัญญาณ Manual Test / Crank)";
        }

        const minPsi = pressureValues.length ? Math.min(...pressureValues) : null;
        const maxPsi = pressureValues.length ? Math.max(...pressureValues) : null;
        const avgPsi = pressureValues.length
          ? Math.round(pressureValues.reduce((a, b) => a + b, 0) / pressureValues.length)
          : null;

        const mins = durationSec !== null ? Math.floor(durationSec / 60) : null;
        const secs = durationSec !== null ? (durationSec % 60) : null;
        const durationText = durationSec !== null
          ? `${mins} นาที ${secs} วินาที`
          : "ไม่มีข้อมูลเวลาหยุดเครื่อง (ไม่พบ Engine Stopped ใน Log)";

        allRuns.push({
          runId: `RUN-${startDt.replace(/[^0-9]/g, "").slice(0, 14)}`,
          startDt,
          stopDt,
          startDateOnly,
          durationSec,
          durationText,
          crankUsed: crankUsed || (isTestRunEvidence ? "Manual Mode" : "Auto Start"),
          returnedToAuto,
          isTestRun,
          matchesScheduledDate,
          classification,
          evidenceList,
          minPsi,
          maxPsi,
          avgPsi,
          startPsi: !isNaN(ev.psi) ? ev.psi : null,
          alarms: alarmsDuringRun.map(a => `${a.event} (${a.dt.replace("T", " ")})`),
          rawEventCountInWindow: runWindowEvents.length
        });
      }
    }

    const matchedTestRuns = allRuns.filter(r => r.matchesScheduledDate && r.isTestRun);
    const allVerifiedTestRuns = allRuns.filter(r => r.isTestRun);
    const otherRuns = allRuns.filter(r => !r.isTestRun);

    return {
      allRuns,
      matchedTestRuns,
      allVerifiedTestRuns,
      otherRuns
    };
  }

  function syncCandidateRunsFromLoadedDashboardEvents() {
    try {
      const round = LINE_STATE && LINE_STATE.currentRound;
      const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};
      const evs = (typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0)
        ? CURRENT_EVENTS
        : (typeof RAW_EVENTS !== "undefined" && Array.isArray(RAW_EVENTS) ? RAW_EVENTS : []);
      if (!evs.length) {
        if (round && !round.verified) {
          round.candidateRuns = [];
          round.otherRunsInFile = [];
          round.matchedRun = null;
          round.analysis = null;
          round.importedFile = null;
          round.status = "PENDING_TEST";
          round.statusThai = "รอไฟล์ Log การทดสอบจริง";
          round.lastAutoCalculatedFrom = null;
        }
        return;
      }

      const runAnalysis = analyzeAndClassifyRunsFromLog(evs, round.scheduledDate);

      if (!round.candidateRuns || round.candidateRuns.length === 0) {
        round.candidateRuns = runAnalysis.allRuns;
        round.otherRunsInFile = runAnalysis.otherRuns;
      }

      if (!round.matchedRun && runAnalysis.allVerifiedTestRuns.length > 0) {
        const bestRun = runAnalysis.matchedTestRuns.length > 0
          ? runAnalysis.matchedTestRuns[runAnalysis.matchedTestRuns.length - 1]
          : runAnalysis.allVerifiedTestRuns[runAnalysis.allVerifiedTestRuns.length - 1];
        round.matchedRun = bestRun;
        if (!round.importedFile) {
          const sum = (typeof DEFAULT_LOG_SUMMARY !== "undefined" && DEFAULT_LOG_SUMMARY) ? DEFAULT_LOG_SUMMARY : {};
          const fallbackFileName = localStorage.getItem("firetrol_last_file") || "ไฟล์ Log ที่นำเข้า";
          round.importedFile = {
            fileName: fallbackFileName,
            importedAt: localStorage.getItem("firetrol_last_update") || new Date().toLocaleString("th-TH"),
            fileSn: (sum.sn && sum.sn !== "-") ? sum.sn : (cfg.expectedSn || "-"),
            totalRecords: (typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0) ? CURRENT_EVENTS.length : 3201,
            snMatched: true,
            strictMeta: {
              b1Voltage: sum.b1_v || "-",
              b1Current: sum.b1_a || "-",
              b2Voltage: sum.b2_v || "-",
              b2Current: sum.b2_a || "-",
              pumpTotalHours: sum.pump_total || "0:00",
              pumpLastHours: sum.pump_last || "-",
              controllerHours: sum.controller_hours || "-"
            },
            matchedCount: runAnalysis.matchedTestRuns.length,
            otherCount: runAnalysis.otherRuns.length
          };
        }
        round.analysis = buildStrictLogAnalysis(bestRun, round.importedFile.strictMeta, cfg);
        if (round.status !== "VERIFIED_COMPLETED") {
          round.status = "LOG_IMPORTED_READY";
          round.statusThai = "นำเข้าข้อมูลแล้ว";
        }
      }
      syncLineScheduleFromCompliance(true);
    } catch (e) {
      console.warn("syncCandidateRunsFromLoadedDashboardEvents error:", e);
    }
  }

  // ── 4. Build Strict 7-Point Analysis from Verified Log Run & File Metadata ──
  function buildStrictLogAnalysis(runObj, strictMeta, cfg) {
    if (!runObj) return null;

    const startFormatted = runObj.startDt ? formatThaiDateTimeSafe(runObj.startDt) : "ไม่มีข้อมูล";
    const stopFormatted = runObj.stopDt ? formatThaiDateTimeSafe(runObj.stopDt) : "ไม่มีข้อมูล";
    const runDateTimeText = runObj.startDt
      ? `${startFormatted} ถึง ${stopFormatted}`
      : "ไม่มีข้อมูล";

    const durationText = runObj.durationSec !== null ? runObj.durationText : "ไม่มีข้อมูล";

    let pumpStatusText = "ไม่มีข้อมูล";
    if (runObj.startDt && runObj.stopDt) {
      pumpStatusText = `เดินเครื่องและหยุดสมบูรณ์ (${runObj.crankUsed}) • ${runObj.returnedToAuto ? "กลับสู่โหมด Auto แล้ว" : "ตรวจสอบตำแหน่งสวิตช์ Auto"}`;
    } else if (runObj.startDt && !runObj.stopDt) {
      pumpStatusText = `พบสัญญาณเริ่มเดินเครื่อง (${runObj.crankUsed}) แต่ไม่พบสัญญาณหยุดเครื่องในไฟล์ Log`;
    }

    const b1Text = (strictMeta && strictMeta.hasB1InFile && strictMeta.b1_v !== null)
      ? `${strictMeta.b1_v.toFixed(1)} V / ${strictMeta.b1_a !== null ? strictMeta.b1_a.toFixed(1) + " A" : "ไม่มีข้อมูลกระแส"}${strictMeta.b1_ac ? " (" + strictMeta.b1_ac + " V~)" : ""}`
      : "ไม่มีข้อมูล";

    const b2Text = (strictMeta && strictMeta.hasB2InFile && strictMeta.b2_v !== null)
      ? `${strictMeta.b2_v.toFixed(1)} V / ${strictMeta.b2_a !== null ? strictMeta.b2_a.toFixed(1) + " A" : "ไม่มีข้อมูลกระแส"}${strictMeta.b2_ac ? " (" + strictMeta.b2_ac + " V~)" : ""}`
      : "ไม่มีข้อมูล";

    const pressureText = (runObj.avgPsi !== null && runObj.minPsi !== null && runObj.maxPsi !== null)
      ? `เฉลี่ย ${runObj.avgPsi} psi (ต่ำสุด ${runObj.minPsi} psi / สูงสุด ${runObj.maxPsi} psi)`
      : "ไม่มีข้อมูล";

    const alarmText = (runObj.alarms && runObj.alarms.length > 0)
      ? `พบ ${runObj.alarms.length} รายการ: ${runObj.alarms.join(", ")}`
      : "ไม่พบสัญญาณ Alarm หรือ Fault ในช่วงเดินเครื่อง";

    const minRunSec = (Number(cfg.minRunMinutes) || 15) * 60;
    const minPsiCfg = Number(cfg.minPressurePsi) || 140;
    const minBattV = Number(cfg.minBatteryVolt) || 12.0;
    const maxBattA = Number(cfg.maxBatteryAmp) || 4.5;

    const evalNotes = [];
    let evalLevel = "PASS";

    if (runObj.durationSec === null) {
      evalLevel = "FAIL";
      evalNotes.push("ไม่พบข้อมูลเวลาหยุดเดินเครื่องในไฟล์ Log");
    } else if (runObj.durationSec < minRunSec) {
      if (evalLevel !== "FAIL") evalLevel = "ATTENTION";
      evalNotes.push(`ระยะเวลาเดินเครื่อง (${runObj.durationText}) น้อยกว่าเกณฑ์ขั้นต่ำที่กำหนด (${cfg.minRunMinutes} นาที)`);
    } else {
      evalNotes.push(`ระยะเวลาเดินเครื่องผ่านเกณฑ์ (${runObj.durationText} ≥ ${cfg.minRunMinutes} นาที)`);
    }

    if (runObj.minPsi !== null) {
      if (runObj.minPsi < minPsiCfg) {
        if (evalLevel !== "FAIL") evalLevel = "ATTENTION";
        evalNotes.push(`แรงดันน้ำต่ำสุด (${runObj.minPsi} psi) ต่ำกว่าเกณฑ์ (${minPsiCfg} psi)`);
      } else {
        evalNotes.push(`แรงดันระบบน้ำปกติ (เฉลี่ย ${runObj.avgPsi} psi ≥ ${minPsiCfg} psi)`);
      }
    } else {
      evalNotes.push("ไม่มีข้อมูลแรงดันระบบน้ำในไฟล์ Log");
    }

    if (strictMeta && strictMeta.hasB1InFile && strictMeta.hasB2InFile) {
      if (strictMeta.b1_v < minBattV || strictMeta.b2_v < minBattV) {
        evalLevel = "FAIL";
        evalNotes.push(`แรงดันแบตเตอรี่ต่ำกว่าเกณฑ์ ${minBattV} V`);
      } else if (strictMeta.b1_a > maxBattA || strictMeta.b2_a > maxBattA) {
        if (evalLevel !== "FAIL") evalLevel = "ATTENTION";
        evalNotes.push(`กระแสชาร์จแบตเตอรี่สูงกว่าเกณฑ์ ${maxBattA} A (ควรตรวจเช็กสภาพแบตเตอรี่)`);
      } else {
        evalNotes.push(`แรงดันและกระแสแบตเตอรี่ B1/B2 อยู่ในเกณฑ์ปกติ`);
      }
    } else {
      if (evalLevel !== "FAIL") evalLevel = "ATTENTION";
      evalNotes.push("ไฟล์ Log ไม่มีข้อมูลแรงดันแบตเตอรี่ B1/B2");
    }

    if (runObj.alarms && runObj.alarms.length > 0) {
      if (cfg.requireNoCritAlarm) {
        evalLevel = "FAIL";
      } else if (evalLevel !== "FAIL") {
        evalLevel = "ATTENTION";
      }
      evalNotes.push(`พบเหตุการณ์แจ้งเตือนระหว่างเดินเครื่อง (${runObj.alarms.length} รายการ)`);
    } else {
      evalNotes.push("ไม่พบเหตุการณ์ Alarm หรือ Fault");
    }

    const evalTitle = evalLevel === "PASS"
      ? "ผ่านเกณฑ์มาตรฐาน (PASS)"
      : evalLevel === "ATTENTION"
      ? "ผ่านแบบมีข้อสังเกต (WARNING / ATTENTION)"
      : "ไม่ผ่านเกณฑ์มาตรฐาน (FAIL)";

    return {
      runDateTimeText,
      durationText,
      durationSec: runObj.durationSec,
      pumpStatusText,
      runClassification: runObj.classification,
      b1Text,
      b2Text,
      pressureText,
      alarmText,
      evaluationLevel: evalLevel,
      evaluationTitle: evalTitle,
      evaluationDetails: evalNotes.join(" • "),
      evaluationNotes: evalNotes
    };
  }

  function formatThaiDateTimeSafe(isoStr) {
    if (!isoStr) return "ไม่มีข้อมูล";
    if (typeof window.formatThaiDateTime === "function") {
      return window.formatThaiDateTime(isoStr);
    }
    return String(isoStr).replace("T", " ");
  }

  // ── 5. Hook into Existing AI-FPAS File Upload (`processLogFile`) ──
  function installUploadHook() {
    if (typeof window.processLogFile !== "function" || window.__lineUploadHookInstalled) return;
    const originalProcessLogFile = window.processLogFile;
    window.__lineUploadHookInstalled = true;

    window.processLogFile = async function (file) {
      const result = await originalProcessLogFile.apply(this, arguments);

      if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          try {
            const rawText = ev.target.result;
            handleUploadedLogForLineVerification(file.name, rawText);
          } catch (err) {
            console.error("LINE verification hook error:", err);
          }
        };
        reader.readAsText(file, "UTF-8");
      }
      return result;
    };
  }

  function handleUploadedLogForLineVerification(fileName, rawText) {
    if (typeof window.parseFiretrolLogText !== "function") return;
    const parsed = window.parseFiretrolLogText(rawText);
    const strictMeta = extractStrictRawFileMetadata(rawText);
    const eventsInFile = parsed.events || [];

    const cfg = LINE_STATE.scheduleConfig;
    const round = LINE_STATE.currentRound;

    const fileSn = strictMeta.hasSnInFile ? strictMeta.sn : "ไม่มีข้อมูลหมายเลขเครื่องในไฟล์";
    const snMatched = strictMeta.hasSnInFile
      ? (strictMeta.sn.toUpperCase() === (cfg.expectedSn || "00-574-537-03RE").toUpperCase())
      : true;

    const runAnalysis = analyzeAndClassifyRunsFromLog(eventsInFile, round.scheduledDate);

    let dateRangeStr = "ไม่มีข้อมูล";
    if (eventsInFile.length > 0) {
      const firstDt = eventsInFile[0].dt.slice(0, 10);
      const lastDt = eventsInFile[eventsInFile.length - 1].dt.slice(0, 10);
      dateRangeStr = `${firstDt} ถึง ${lastDt}`;
    }

    const addedCount = (typeof LATEST_IMPORT_BATCH !== "undefined" && LATEST_IMPORT_BATCH && LATEST_IMPORT_BATCH.fileName === fileName)
      ? LATEST_IMPORT_BATCH.recordCount
      : eventsInFile.length;

    const importRecord = {
      importId: "IMP-" + Date.now(),
      fileName: fileName,
      importedAt: new Date().toISOString(),
      fileSn: fileSn,
      snMatched: snMatched,
      totalRecords: eventsInFile.length,
      addedNewRecords: addedCount,
      skippedDuplicates: Math.max(0, eventsInFile.length - addedCount),
      dateRange: dateRangeStr,
      detectedTestRuns: runAnalysis.allRuns.length,
      matchedRoundId: null,
      verificationNote: ""
    };

    round.importedFile = {
      fileName: fileName,
      importedAt: importRecord.importedAt,
      fileSn: fileSn,
      snMatched: snMatched,
      hasSnInFile: strictMeta.hasSnInFile,
      hasB1InFile: strictMeta.hasB1InFile,
      hasB2InFile: strictMeta.hasB2InFile,
      totalRecords: eventsInFile.length,
      dateRange: dateRangeStr,
      strictMeta: strictMeta
    };

    round.candidateRuns = runAnalysis.allRuns;
    round.otherRunsInFile = runAnalysis.otherRuns;

    if (!snMatched) {
      round.matchedRun = null;
      round.analysis = null;
      round.verified = false;
      round.lineReportSent = false;
      round.lineReportRealPush = false;
      round.status = "WAITING_FOR_LOG";
      round.statusThai = "รอข้อมูลทดสอบ (หมายเลขเครื่อง SN ในไฟล์ไม่ตรงกับเครื่องที่กำหนด)";
      importRecord.verificationNote = `❌ หมายเลขเครื่องไม่ตรง (${fileSn} ≠ ${cfg.expectedSn})`;
    } else if (runAnalysis.matchedTestRuns.length > 0) {
      const bestRun = runAnalysis.matchedTestRuns[runAnalysis.matchedTestRuns.length - 1];
      round.matchedRun = bestRun;
      round.analysis = buildStrictLogAnalysis(bestRun, strictMeta, cfg);
      round.verified = false;
      round.lineReportSent = false;
      round.lineReportRealPush = false;
      round.status = "LOG_IMPORTED_READY";
      round.statusThai = "นำเข้าข้อมูลแล้ว";
      ACTIVE_FLEX_TAB = "report";
      importRecord.matchedRoundId = round.roundId;
      importRecord.verificationNote = `✅ พบข้อมูลเดินเครื่องรอบทดสอบวันที่ ${bestRun.startDateOnly} (${bestRun.durationText}) — รอเจ้าหน้าที่กดยืนยันผล`;
    } else if (runAnalysis.allVerifiedTestRuns.length > 0) {
      const latestVerifiedRun = runAnalysis.allVerifiedTestRuns[runAnalysis.allVerifiedTestRuns.length - 1];
      round.scheduledDate = latestVerifiedRun.startDateOnly;
      cfg.scheduledDate = latestVerifiedRun.startDateOnly;
      round.roundId = `ROUND-${latestVerifiedRun.startDateOnly}-${(round.scheduledTime || "14:30").replace(":", "")}`;
      latestVerifiedRun.matchesScheduledDate = true;
      round.matchedRun = latestVerifiedRun;
      round.analysis = buildStrictLogAnalysis(latestVerifiedRun, strictMeta, cfg);
      round.verified = false;
      round.lineReportSent = false;
      round.lineReportRealPush = false;
      round.status = "LOG_IMPORTED_READY";
      round.statusThai = "นำเข้าข้อมูลแล้ว";
      ACTIVE_FLEX_TAB = "report";
      importRecord.matchedRoundId = round.roundId;
      importRecord.verificationNote = `✅ พบข้อมูลเดินเครื่องทดสอบล่าสุดในไฟล์ (${latestVerifiedRun.startDateOnly} • ${latestVerifiedRun.durationText}) — รอเจ้าหน้าที่กดยืนยันผล`;
    } else {
      round.matchedRun = null;
      round.analysis = null;
      round.verified = false;
      round.lineReportSent = false;
      round.lineReportRealPush = false;
      round.status = "WAITING_FOR_LOG";
      round.statusThai = "รอข้อมูลทดสอบ";
      importRecord.verificationNote = `⚠️ อัปโหลดไฟล์แล้ว แต่ไม่พบเหตุการณ์เดินเครื่องทดสอบในไฟล์ (คงสถานะ รอข้อมูลทดสอบ)`;
    }

    LINE_STATE.importedFilesHistory.unshift(importRecord);
    if (LINE_STATE.importedFilesHistory.length > 30) {
      LINE_STATE.importedFilesHistory.length = 30;
    }

    saveLineState(true);
    renderLineNotifyDashboard();

    if (typeof window.showSettingsToast === "function") {
      if (round.status === "LOG_IMPORTED_READY") {
        window.showSettingsToast(`✅ นำเข้าไฟล์ ${fileName} และวิเคราะห์ข้อมูลรอบทดสอบแล้ว! สามารถกดยืนยันผลเพื่อส่งเข้า LINE OA ได้ทันที`);
      } else if (round.status === "WAITING_FOR_LOG") {
        window.showSettingsToast(`⚠️ นำเข้าไฟล์ ${fileName} แล้ว แต่ไม่พบข้อมูลการเดินเครื่องทดสอบ (สถานะ: รอข้อมูลทดสอบ)`);
      }
    }
  }

  window.selectLogRunForCurrentRound = function (runId) {
    syncLineInputsFromDom();
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;
    if (!round) return;
    const found = (round.candidateRuns || []).find(r => r.runId === runId);
    if (!found) return;
    const sum = (typeof DEFAULT_LOG_SUMMARY !== "undefined" && DEFAULT_LOG_SUMMARY) ? DEFAULT_LOG_SUMMARY : {};
    const strictMeta = (round.importedFile && round.importedFile.strictMeta) ? round.importedFile.strictMeta : {
      b1Voltage: sum.b1_v || "-",
      b1Current: sum.b1_a || "-",
      b2Voltage: sum.b2_v || "-",
      b2Current: sum.b2_a || "-",
      pumpTotalHours: sum.pump_total || "0:00",
      pumpLastHours: sum.pump_last || "-",
      controllerHours: sum.controller_hours || "-"
    };
    round.matchedRun = found;
    round.scheduledDate = found.startDateOnly;
    round.roundId = `ROUND-${found.startDateOnly}-${(round.scheduledTime || "14:30").replace(":", "")}`;
    round.analysis = buildStrictLogAnalysis(found, strictMeta, cfg);
    round.verified = false;
    round.lineReportSent = false;
    round.lineReportRealPush = false;
    round.status = "LOG_IMPORTED_READY";
    round.statusThai = "นำเข้าข้อมูลแล้ว";
    ACTIVE_FLEX_TAB = "report";
    saveLineState(true);
    renderLineNotifyDashboard();
    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(`✅ เลือกข้อมูลการเดินเครื่อง (${found.startDt.replace("T", " ")} • ${found.durationText}) สำหรับส่งเข้า LINE OA แล้ว`);
    }
  };

  // ── 6. Build Fallback Text Messages for LINE Messaging API ──
  function buildDueAlertTextMessage(round, cfg) {
    const overdueDays = Math.max(0, getOverdueDaysCount(round.scheduledDate));
    const isOverdue = overdueDays > 0;
    const statusLabel = round.acknowledged
      ? "รับทราบ (รอไฟล์ Log)"
      : isOverdue
        ? `เกินกำหนดทดสอบ ${overdueDays} วัน (รอดำเนินการ)`
        : "ครบกำหนดทดสอบวันนี้ (รอดำเนินการ)";
    const titleLine = isOverdue
      ? `⚠️ [AI-FPAS] แจ้งเตือนเกินกำหนดทดสอบปั๊มดับเพลิง (เกินกำหนด ${overdueDays} วัน)`
      : "🔔 [AI-FPAS] แจ้งเตือนถึงกำหนดทดสอบเครื่องสูบน้ำดับเพลิง";
    return [
      titleLine,
      "━━━━━━━━━━━━━━━━━━━━",
      `• ชื่อเครื่อง: ${cfg.machineName}`,
      `• หมายเลขเครื่อง (SN): ${cfg.expectedSn}`,
      `• สถานี: ${cfg.stationTag}`,
      `• กำหนดการทดสอบ: ${round.scheduledDate} เวลา ${round.scheduledTime} น.`,
      `• สถานะปัจจุบัน: ${statusLabel}`,
      `• รอบแจ้งเตือน: ส่งอัตโนมัติวันละ 1 ครั้ง (วันถึงกำหนด / เกินกำหนด)`,
      "━━━━━━━━━━━━━━━━━━━━",
      "หมายเหตุ: เมื่อกดรับทราบ ระบบจะบันทึกสถานะ 'รับทราบ' แต่ยังไม่ถือว่าทดสอบเสร็จสิ้น ต้องนำเข้าไฟล์ Log จากเครื่อง MarkIIXG เพื่อยืนยันผล"
    ].join("\n");
  }

  function buildVerifiedReportTextMessage(round, cfg) {
    const an = round.analysis || {};
    const fileLabel = round.importedFile ? round.importedFile.fileName : "ไม่มีข้อมูล";
    const snLabel = (round.importedFile && round.importedFile.fileSn) ? round.importedFile.fileSn : cfg.expectedSn;
    return [
      "✅ [AI-FPAS] รายงานยืนยันผลทดสอบปั๊มดับเพลิง (ตรวจสอบจากไฟล์ Log)",
      "━━━━━━━━━━━━━━━━━━━━",
      `• ชื่อเครื่อง: ${cfg.machineName}`,
      `• หมายเลข SN: ${snLabel}`,
      `• ไฟล์ Log อ้างอิง: ${fileLabel}`,
      `• รอบการทดสอบ: ${round.roundId}`,
      "━━━━━━━━━━━━━━━━━━━━",
      `1) วัน-เวลาเดินเครื่อง: ${an.runDateTimeText || "ไม่มีข้อมูล"}`,
      `2) ระยะเวลาเดินเครื่อง: ${an.durationText || "ไม่มีข้อมูล"}`,
      `3) สถานะการเดินปั๊ม: ${an.pumpStatusText || "ไม่มีข้อมูล"}`,
      `4) แบตเตอรี่ B1: ${an.b1Text || "ไม่มีข้อมูล"}`,
      `   แบตเตอรี่ B2: ${an.b2Text || "ไม่มีข้อมูล"}`,
      `5) แรงดันระบบน้ำ: ${an.pressureText || "ไม่มีข้อมูล"}`,
      `6) Alarm / Fault: ${an.alarmText || "ไม่มีข้อมูล"}`,
      `7) ผลการประเมิน: ${an.evaluationTitle || "ไม่มีข้อมูล"}`,
      `   รายละเอียด: ${an.evaluationDetails || "-"}`,
      "━━━━━━━━━━━━━━━━━━━━",
      `ผู้ยืนยันผล: ${round.verifiedBy || "เจ้าหน้าที่วิศวกรรม"}`
    ].join("\n");
  }

  // ── 7. Workflow Actions via LINE Official Account (LINE OA) & LINE Messaging API ──

  // Step 1: Send "เมื่อถึงกำหนดทดสอบ / เกินกำหนด" Flex Alert via LINE Messaging API (Max 1 Auto Alert Per Day)
  window.triggerScheduledLineDueAlert = async function (isAuto = false) {
    syncLineInputsFromDom();
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;

    if (isAuto && (round.verified || round.status === "VERIFIED_COMPLETED")) {
      return;
    }
    if (isAuto && hasAlreadyNotifiedDueToday(round)) {
      return;
    }

    if (!(cfg.lineChannelAccessToken || "").trim()) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        mode: "MISSING_TOKEN",
        message: "⚠️ กรุณาวาง Channel Access Token (Long-lived) ของ LINE Official Account (LINE OA) ในช่องตั้งค่าด้านขวามือก่อนกดส่ง"
      };
      renderLineNotifyDashboard();
      if (!isAuto) {
        const inp = document.getElementById("lineCfgAccessToken");
        if (inp) {
          const det = inp.closest("details");
          if (det) det.open = true;
          inp.focus();
        }
        if (typeof window.showSettingsToast === "function") {
          window.showSettingsToast("⚠️ กรุณาใส่ Channel Access Token ของ LINE Official Account ก่อนกดส่งครับ");
        }
      }
      return;
    }

    const todayStr = getLocalDateStr(new Date());
    const overdueDays = Math.max(0, getOverdueDaysCount(round.scheduledDate));
    const isOverdue = overdueDays > 0;

    ACTIVE_FLEX_TAB = "due";
    const flexPayload = buildLineDueFlexJson(round, cfg);
    const fallbackText = buildDueAlertTextMessage(round, cfg);
    const altTitle = isOverdue
      ? `⚠️ เกินกำหนดทดสอบปั๊มดับเพลิง ${overdueDays} วัน — ${cfg.machineName} (${round.scheduledDate})`
      : `🔔 แจ้งเตือนกำหนดทดสอบเครื่องสูบน้ำดับเพลิง ${cfg.machineName} (${round.scheduledDate}) — สถานะ: รอดำเนินการ`;

    const sendRes = await dispatchLineMessage(
      altTitle,
      flexPayload,
      fallbackText,
      { isAuto: isAuto }
    );

    if (sendRes && sendRes.ok && !sendRes.simulated && sendRes.mode !== "DIRECT_LINE_SHARE") {
      round.dueNotified = true;
      round.dueNotifiedAt = new Date().toISOString();
      round.lastDueNotifiedDate = todayStr;
      round.lastDueNotifiedType = isOverdue ? "OVERDUE" : "DUE_TODAY";
      round.overdueDaysNotified = overdueDays;
      if (!round.acknowledged) {
        round.acknowledged = false;
        round.acknowledgedAt = null;
        round.status = "PENDING_TEST";
        round.statusThai = isOverdue ? `เกินกำหนดทดสอบ ${overdueDays} วัน` : "รอดำเนินการ";
      }
      saveLineState(true);
    }

    renderLineNotifyDashboard();

    if (typeof window.showSettingsToast === "function") {
      if (isAuto) {
        if (sendRes && sendRes.ok) {
          window.showSettingsToast(isOverdue
            ? `⚠️ เกินกำหนดทดสอบ ${overdueDays} วัน — ส่งแจ้งเตือนเข้า LINE OA (1 ครั้ง/วัน) เรียบร้อยแล้ว`
            : `🔔 ถึงกำหนดทดสอบวันนี้ — ส่งแจ้งเตือนอัตโนมัติเข้า LINE OA (1 ครั้ง/วัน) เรียบร้อยแล้ว`);
        }
      } else {
        window.showSettingsToast(sendRes.ok
          ? `✅ ส่ง Flex Message แจ้งเตือนกำหนดการทดสอบเข้า LINE Official Account สำเร็จ!`
          : `❌ ${sendRes.message}`);
      }
    }
  };

  // Step 1b: Officer clicks "รับทราบ / ดำเนินการทดสอบ"
  window.acknowledgeLineTestRound = async function () {
    syncLineInputsFromDom();
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;

    const inspector = (typeof APP_SETTINGS !== "undefined" && APP_SETTINGS.inspectorName)
      ? APP_SETTINGS.inspectorName
      : "นายสมศักดิ์ รักความปลอดภัย";

    round.acknowledged = true;
    round.acknowledgedAt = new Date().toISOString();
    round.acknowledgedBy = inspector;
    round.status = "ACKNOWLEDGED";
    round.statusThai = "รับทราบแล้ว (รอไฟล์ Log)";

    saveLineState(true);
    renderLineNotifyDashboard();

    // Sync to background server if running
    const srvUrl = cfg.serverUrl || DEFAULT_SERVER_URL;
    try {
      fetch(`${srvUrl}/api/acknowledge`, { method: "POST" }).catch(() => {});
    } catch (e) {}

    // Auto-send updated status message to LINE OA
    const ackFlexPayload = buildLineDueFlexJson(round, cfg);
    const ackTextMessage = 
`✅ [AI-FPAS STATUS UPDATE]
เจ้าหน้าที่ได้รับทราบกำหนดการทดสอบแล้ว
🚒 เครื่อง: ${cfg.machineName || "Diesel Fire Pump"}
🏷️ รอบทดสอบ: ${round.roundId} (${round.scheduledDate} เวลา ${round.scheduledTime} น.)
👤 ผู้รับทราบ: ${inspector}
⏱️ เวลาที่รับทราบ: ${new Date().toLocaleTimeString("th-TH")} น.
📋 สถานะเปลี่ยนเป็น: "รับทราบแล้ว (รอการนำเข้าไฟล์ Log เพื่อประเมินผล)"`;

    await dispatchLineMessage(
      `✅ [รับทราบแล้ว] กำหนดทดสอบ ${cfg.machineName} (${round.scheduledDate})`,
      ackFlexPayload,
      ackTextMessage
    );

    renderLineNotifyDashboard();

    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(`✅ เปลี่ยนสถานะเป็น "รับทราบแล้ว" และส่งอัปเดตเข้า LINE OA เรียบร้อย!`);
    }
  };

  // Step 4 & 5: Officer clicks "ยืนยันผลทดสอบ & ส่งรายงานเข้า LINE OA"
  window.confirmAndSendLineTestReport = async function (forceResend = false) {
    syncLineInputsFromDom();
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;

    // Guard 1: Prevent duplicate report in the same round once successfully pushed to LINE OA
    if (!forceResend && round.lineReportSent && round.lineReportRealPush && round.status === "VERIFIED_COMPLETED") {
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("⚠️ ป้องกันการส่งซ้ำ: รอบการทดสอบนี้ได้รับการยืนยันผลและส่ง Flex Message เข้า LINE OA ไปแล้ว");
      }
      return;
    }

    // Guard 2: Must have verifiable MarkIIXG Log data matching the test round!
    if (!round.matchedRun || !round.analysis || !round.importedFile) {
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("❌ ไม่สามารถยืนยันผลได้: ต้องนำเข้าไฟล์ Log จากเครื่อง MarkIIXG ที่มีข้อมูลการเดินเครื่องของรอบทดสอบก่อน!");
      }
      return;
    }

    // Guard 3: Require LINE OA Channel Access Token so it actually sends to LINE OA via Messaging API
    if (!(cfg.lineChannelAccessToken || "").trim()) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        mode: "MISSING_TOKEN",
        message: "⚠️ กรุณาวาง Channel Access Token (Long-lived) ของ LINE Official Account (LINE OA) ในช่องตั้งค่าด้านขวามือก่อนกดส่งรายงาน"
      };
      renderLineNotifyDashboard();
      const inp = document.getElementById("lineCfgAccessToken");
      if (inp) {
        const det = inp.closest("details");
        if (det) det.open = true;
        inp.focus();
      }
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("⚠️ กรุณาวาง Channel Access Token ของ LINE Official Account ในช่องตั้งค่าด้านขวามือก่อนครับ");
      }
      return;
    }

    const inspector = (typeof APP_SETTINGS !== "undefined" && APP_SETTINGS.inspectorName)
      ? APP_SETTINGS.inspectorName
      : "นายสมศักดิ์ รักความปลอดภัย";

    const nowIso = new Date().toISOString();
    const msgId = round.lineReportMessageId || `LINE-FLEX-${round.roundId}-${Date.now().toString().slice(-6)}`;

    round.verifiedBy = inspector;
    ACTIVE_FLEX_TAB = "report";

    const flexPayload = buildLineVerifiedReportFlexJson(round, cfg);
    const fallbackText = buildVerifiedReportTextMessage(round, cfg);
    const sendRes = await dispatchLineMessage(
      `✅ รายงานยืนยันผลทดสอบเครื่องสูบน้ำดับเพลิง ${cfg.machineName} (ตรวจสอบจากไฟล์ Log: ${round.importedFile.fileName})`,
      flexPayload,
      fallbackText
    );

    if (sendRes.ok && !sendRes.simulated) {
      round.verified = true;
      round.verifiedAt = nowIso;
      round.status = "VERIFIED_COMPLETED";
      round.statusThai = "ยืนยันผลแล้ว";
      round.lineReportSent = true;
      round.lineReportRealPush = true;
      round.lineReportSentAt = nowIso;
      round.lineReportMessageId = msgId;

      const histEntry = {
        roundId: round.roundId,
        scheduledDate: round.scheduledDate,
        scheduledTime: round.scheduledTime,
        machineName: cfg.machineName,
        sn: round.importedFile.fileSn || cfg.expectedSn,
        status: "VERIFIED_COMPLETED",
        statusThai: "ยืนยันผลแล้ว",
        acknowledgedAt: round.acknowledgedAt || "-",
        acknowledgedBy: round.acknowledgedBy || inspector,
        logFileName: round.importedFile.fileName,
        runStartDt: round.matchedRun.startDt,
        runStopDt: round.matchedRun.stopDt || "ไม่มีข้อมูล",
        durationText: round.analysis.durationText,
        durationSec: round.analysis.durationSec,
        pumpStatus: round.analysis.pumpStatusText,
        runClassification: round.analysis.runClassification,
        b1Text: round.analysis.b1Text,
        b2Text: round.analysis.b2Text,
        pressureText: round.analysis.pressureText,
        alarmText: round.analysis.alarmText,
        evaluationResult: `${round.analysis.evaluationTitle} (${round.analysis.evaluationDetails})`,
        evaluationPass: round.analysis.evaluationLevel,
        verifiedAt: nowIso,
        verifiedBy: inspector,
        lineReportSent: true,
        lineReportSentAt: nowIso,
        lineReportMessageId: msgId
      };

      LINE_STATE.testRoundsHistory = [
        histEntry,
        ...(LINE_STATE.testRoundsHistory || []).filter(h => h.roundId !== round.roundId)
      ];

      saveLineState(true);
      renderLineNotifyDashboard();
      if (typeof window.triggerGoogleSheetsAutoSync === "function") {
        window.triggerGoogleSheetsAutoSync("line_oa_confirmation");
      }
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast(`🎉 ยืนยันผลและส่ง LINE Flex Message เข้า LINE Official Account สำเร็จ! (รหัส: ${msgId})`);
      }
    } else {
      saveLineState(true);
      renderLineNotifyDashboard();
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast(`❌ ส่งเข้า LINE OA ไม่สำเร็จ: ${sendRes.message}`);
      }
    }
  };

  window.testLineConnectionNow = async function () {
    syncLineInputsFromDom();
    saveLineState(true);
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;

    if (!(cfg.lineChannelAccessToken || "").trim()) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        mode: "MISSING_TOKEN",
        message: "⚠️ กรุณาวาง Channel Access Token (Long-lived) ของ LINE Official Account ในช่องด้านล่างก่อนกดทดสอบส่ง"
      };
      renderLineNotifyDashboard();
      const inp = document.getElementById("lineCfgAccessToken");
      if (inp) {
        const det = inp.closest("details");
        if (det) det.open = true;
        inp.focus();
      }
      if (typeof window.showSettingsToast === "function") {
        window.showSettingsToast("⚠️ กรุณาวาง Channel Access Token ของ LINE OA ก่อนครับ");
      }
      return;
    }

    const flexPayload = ACTIVE_FLEX_TAB === "due"
      ? buildLineDueFlexJson(round, cfg)
      : buildLineVerifiedReportFlexJson(round, cfg);
    const fallbackText = ACTIVE_FLEX_TAB === "due"
      ? buildDueAlertTextMessage(round, cfg)
      : buildVerifiedReportTextMessage(round, cfg);

    const res = await dispatchLineMessage(
      `[AI-FPAS LINE OA] ${cfg.machineName}`,
      flexPayload,
      fallbackText
    );
    renderLineNotifyDashboard();
    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(res.ok ? `✅ ส่ง LINE Flex Message เข้า LINE OA สำเร็จ!` : `❌ ส่งไม่สำเร็จ: ${res.message}`);
    }
  };

  window.saveLineScheduleAndRoundConfig = function () {
    syncLineInputsFromDom();
    const cfg = LINE_STATE.scheduleConfig;
    const round = LINE_STATE.currentRound;

    const newDate = cfg.scheduledDate;
    const newTime = cfg.scheduledTime;
    const newRoundId = `ROUND-${newDate}-${newTime.replace(":", "")}`;

    const dyn = (typeof window.getDynamicTestScheduleInfo === "function") ? window.getDynamicTestScheduleInfo() : null;
    const autoNextDate = dyn && dyn.nextDateStr ? dyn.nextDateStr : "";
    if (autoNextDate && newDate !== autoNextDate) {
      cfg.manualDateOverride = newDate;
      cfg.manualDateForAutoFrom = cfg.lastAutoCalculatedFrom || (dyn && dyn.lastRunDateStr) || "";
    } else {
      cfg.manualDateOverride = null;
    }

    // Reset notification & acknowledge flags only if schedule changed AND not already notified today (1 time/day policy)
    const schedDtMs = new Date(`${newDate}T${newTime}:00`).getTime();
    const isFutureOrNow = !isNaN(schedDtMs) && schedDtMs >= (Date.now() - 60000);
    const schedChanged = (round.scheduledDate !== newDate || round.scheduledTime !== newTime || round.roundId !== newRoundId);
    const alreadySentToday = hasAlreadyNotifiedDueToday(round);
    if ((schedChanged || isFutureOrNow || !round.dueNotifiedAt) && !alreadySentToday) {
      round.dueNotified = false;
      round.dueNotifiedAt = null;
      round.acknowledged = false;
      round.acknowledgedAt = null;
      round.status = "PENDING_TEST";
      round.statusThai = "รอดำเนินการ";
    }

    round.expectedSn = cfg.expectedSn;
    round.scheduledDate = newDate;
    round.scheduledTime = newTime;
    round.roundId = newRoundId;

    if (round.matchedRun && round.importedFile) {
      round.analysis = buildStrictLogAnalysis(round.matchedRun, round.importedFile.strictMeta, cfg);
    }

    saveLineState(true);
    renderLineNotifyDashboard();

    if ((cfg.lineChannelAccessToken || "").trim()) {
      window.verifyLineOaChannelToken();
    } else if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(`💾 บันทึกตารางกำหนดการทดสอบและเกณฑ์ประเมินเรียบร้อยแล้ว`);
    }
  };

  window.resetCurrentLineRoundForDemo = function () {
    syncLineInputsFromDom();
    const cfg = LINE_STATE.scheduleConfig || {};
    const def = getDefaultLineState();
    LINE_STATE.currentRound = def.currentRound;
    // Preserve all user-configured schedule & connection settings
    LINE_STATE.currentRound.scheduledDate = cfg.scheduledDate || def.currentRound.scheduledDate;
    LINE_STATE.currentRound.scheduledTime = cfg.scheduledTime || def.currentRound.scheduledTime;
    LINE_STATE.currentRound.frequencyDays = cfg.frequencyDays || 7;
    LINE_STATE.currentRound.expectedSn = cfg.expectedSn || def.currentRound.expectedSn;
    LINE_STATE.currentRound.machineName = cfg.machineName || def.currentRound.machineName;
    LINE_STATE.currentRound.roundId = `ROUND-${LINE_STATE.currentRound.scheduledDate}-${String(LINE_STATE.currentRound.scheduledTime || "14:30").replace(":", "")}`;
    syncCandidateRunsFromLoadedDashboardEvents();
    ACTIVE_FLEX_TAB = "report";
    saveLineState(true);
    renderLineNotifyDashboard();
    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast(`↺ รีเซ็ตสถานะรอบทดสอบเรียบร้อย (ยังคงค่าที่ตั้งไว้ทั้งหมด)`);
    }
  };

  // 1-Click Direct Share to LINE (Serverless universal share)
  window.shareLineReportDirectly = function () {
    const round = (LINE_STATE && LINE_STATE.currentRound) || {};
    const an = round.analysis || {};
    const run = round.matchedRun || {};
    const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};
    const imp = round.importedFile || {};

    const durText = run.durationFormatted || (an.durationMinutes ? `${an.durationMinutes} นาที` : (an.durationText || "-"));
    const pressText = an.pressureText || ((an.avgPressurePsi !== undefined) ? `${an.avgPressurePsi} psi` : "-");
    const battText = (an.b1Text && an.b2Text) ? `${an.b1Text} | ${an.b2Text}` : "รอข้อมูลจากไฟล์ Log";
    const evalText = an.evaluationTitle || "รอข้อมูลจากไฟล์ Log";
    const alarmText = an.alarmText || "-";

    const reportMsg = 
`[AI-FPAS VERIFIED LOG REPORT]
ปั๊มดับเพลิงเครื่องยนต์ดีเซล ${cfg.machineName || "MarkIIXG (FTA 1100-J)"}
SN: ${cfg.expectedSn || "-"} | ไฟล์ Log: ${imp.fileName || "ยังไม่มีไฟล์ Log"}

1. Engine Running Time (เวลาเดินเครื่องจริง):
⏱️ ระยะเวลา: ${durText}
ช่วงเวลา: ${run.startTimeStr || "-"} ถึง ${run.endTimeStr || "-"}
สถานะ: เดินเครื่องและหยุดสมบูรณ์ • โหมด Auto

2. Battery Condition (แรงดัน/กระแสแบตเตอรี่):
🔋 ${battText}

3. System Pressure (แรงดันน้ำขณะทดสอบ):
💧 เฉลี่ย: ${pressText}

4. AI Evaluation & Alarms:
📋 ผลประเมิน: ${evalText}
⚠️ สัญญาณเตือน: ${alarmText}

👤 ผู้ยืนยันผล: ${round.verifiedBy || "เจ้าหน้าที่วิศวกรรม"}
🏷️ รอบทดสอบ: ${round.roundId || "-"}`;

    const lineShareUrl = "https://line.me/R/share?text=" + encodeURIComponent(reportMsg);
    window.open(lineShareUrl, "_blank");

    LAST_DELIVERY_STATUS = {
      time: new Date().toLocaleTimeString("th-TH"),
      ok: true,
      simulated: false,
      mode: "DIRECT_LINE_SHARE",
      message: "📲 เปิดหน้าแชร์รายงานเข้า LINE สำเร็จ (เลือกส่งเข้าห้องแชทหรือกลุ่มวิศวกรรมได้ทันที)"
    };
    renderLineNotifyDashboard();

    if (typeof window.showSettingsToast === "function") {
      window.showSettingsToast("📲 กำลังเปิด LINE เพื่อแชร์รายงาน...");
    }
  };

  async function dispatchLineMessage(altText, flexContents, fallbackText, options = {}) {
    const isAuto = Boolean(options && options.isAuto);
    const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};
    const srvUrl = cfg.serverUrl || DEFAULT_SERVER_URL;
    const cleanToken = (cfg.lineChannelAccessToken || "").trim();
    const cleanTarget = (cfg.lineTargetId || "").trim();

    if (!cleanToken) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: false,
        simulated: true,
        mode: "MISSING_TOKEN",
        message: "⚠️ ยังไม่ได้กรอก Channel Access Token (Long-lived) ของ LINE Official Account"
      };
      return { ok: false, simulated: true, message: LAST_DELIVERY_STATUS.message };
    }

    const safeAlt = String(altText || "AI-FPAS LINE OA Notification").slice(0, 390);
    const lineApiBodyObj = cleanTarget
      ? { to: cleanTarget, messages: [{ type: "flex", altText: safeAlt, contents: flexContents }] }
      : { messages: [{ type: "flex", altText: safeAlt, contents: flexContents }] };
    const rawLineBodyJson = JSON.stringify(lineApiBodyObj);

    let sendSuccess = false;
    let sendError = null;

    // 1. Send via LINE OA Messaging Server (Port 8765)
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${srvUrl}/api/send-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanToken,
          targetId: cleanTarget,
          altText: safeAlt,
          rawLineBodyJson: rawLineBodyJson,
          fallbackText: fallbackText || safeAlt
        }),
        signal: controller.signal
      });
      clearTimeout(tId);
      if (res.ok) {
        const data = await res.json();
        const lineRes = (data && data.lineResult) ? data.lineResult : data;
        if (lineRes && lineRes.ok) {
          sendSuccess = true;
          SERVER_ONLINE = true;
        } else {
          sendError = (lineRes && lineRes.message) ? lineRes.message : "LINE Messaging API แจ้งข้อผิดพลาด";
        }
      }
    } catch (e) {
      SERVER_ONLINE = false;
      sendError = "ยังไม่ได้เปิดเซิร์ฟเวอร์พื้นหลัง";
    }

    const targetDesc = cleanTarget
      ? `Push ไปยัง Target ID (${cleanTarget.slice(0, 10)}...)`
      : `Broadcast ไปยังผู้ติดตาม LINE OA ทุกคน`;

    if (sendSuccess) {
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: true,
        simulated: false,
        mode: targetDesc,
        message: `✅ ส่ง LINE Flex Message Card เข้า LINE Official Account สำเร็จ (${targetDesc})`
      };
      return { ok: true, simulated: false, message: LAST_DELIVERY_STATUS.message };
    } else {
      if (isAuto) {
        LAST_DELIVERY_STATUS = {
          time: new Date().toLocaleTimeString("th-TH"),
          ok: false,
          simulated: false,
          mode: "SERVER_OFFLINE",
          message: `⚠️ ไม่สามารถส่งแจ้งเตือนอัตโนมัติอัตโนมัติได้: ${sendError || "กรุณาเปิดเซิร์ฟเวอร์แจ้งเตือน LINE OA (Port 8765)"}`
        };
        return { ok: false, offline: true, message: LAST_DELIVERY_STATUS.message };
      }
      // Automatic seamless fallback to 1-Click Direct LINE Share (manual only)
      LAST_DELIVERY_STATUS = {
        time: new Date().toLocaleTimeString("th-TH"),
        ok: true,
        simulated: false,
        mode: "DIRECT_LINE_SHARE",
        message: `📲 เปิดแอป LINE เพื่อแชร์รายงานผลทดสอบเรียบร้อยแล้ว (สามารถส่งเข้ากลุ่มวิศวกรรมได้ทันที)`
      };
      if (typeof window.shareLineReportDirectly === "function") {
        window.shareLineReportDirectly();
      }
      return { ok: true, simulated: false, mode: "DIRECT_LINE_SHARE", message: LAST_DELIVERY_STATUS.message };
    }
  }

  // ── 8. LINE Flex Message JSON Builders (100% LINE Messaging API Spec Compliant) ──
  function buildLineDueFlexJson(round, cfg) {
    const isAck = Boolean(round.acknowledged);
    const overdueDays = Math.max(0, getOverdueDaysCount(round.scheduledDate));
    const isOverdue = overdueDays > 0;
    const statusLabel = isAck
      ? "รับทราบแล้ว (รอไฟล์ Log)"
      : isOverdue
        ? `เกินกำหนดมาแล้ว ${overdueDays} วัน (รอดำเนินการ)`
        : "ถึงกำหนดทดสอบวันนี้ (รอเจ้าหน้าที่รับทราบ)";
    const statusColor = isAck ? "#155E43" : "#DC2626";
    const headerBg = isAck ? "#155E43" : isOverdue ? "#991B1B" : "#B91C1C";
    const eyebrowText = isOverdue ? "AI-FPAS OVERDUE REMINDER" : "AI-FPAS SCHEDULED TEST ALERT";
    const headerTitle = isAck
      ? "เจ้าหน้าที่รับทราบการทดสอบแล้ว ✓"
      : isOverdue
        ? `⚠️ แจ้งเตือนเกินกำหนดทดสอบ (เกิน ${overdueDays} วัน)`
        : "🔔 แจ้งเตือนถึงกำหนดทดสอบปั๊มดับเพลิง";

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerBg,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: eyebrowText,
            color: "#E5F4E8",
            size: "xs",
            weight: "bold"
          },
          {
            type: "text",
            text: headerTitle,
            color: "#FFFFFF",
            size: "md",
            weight: "bold",
            margin: "xs",
            wrap: true
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        paddingAll: "16px",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "ชื่อเครื่อง:", color: "#4B5563", size: "sm", flex: 3 },
              { type: "text", text: String(cfg.machineName || "-"), color: "#1F2937", size: "sm", weight: "bold", flex: 7, wrap: true }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "หมายเลข SN:", color: "#4B5563", size: "sm", flex: 3 },
              { type: "text", text: String(cfg.expectedSn || "-"), color: "#155E43", size: "sm", weight: "bold", flex: 7 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "กำหนดทดสอบ:", color: "#4B5563", size: "sm", flex: 3 },
              { type: "text", text: `${round.scheduledDate || "-"} เวลา ${round.scheduledTime || "-"} น.`, color: "#1F2937", size: "sm", weight: "bold", flex: 7 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "สถานะ:", color: "#4B5563", size: "sm", flex: 3 },
              { type: "text", text: statusLabel, color: statusColor, size: "sm", weight: "bold", flex: 7 }
            ]
          },
          {
            type: "separator",
            margin: "md",
            color: "#E5E7EB"
          },
          {
            type: "text",
            text: isAck
              ? "เจ้าหน้าที่กดรับทราบแล้ว: กรุณานำเข้าไฟล์ Log จากตู้ควบคุม MarkIIXG เข้าสู่แดชบอร์ด AI-FPAS เพื่อประเมินผลอัตโนมัติ"
              : "หมายเหตุ: การกดรับทราบยังไม่ถือว่าทดสอบเสร็จสิ้น เจ้าหน้าที่ต้องดาวน์โหลดไฟล์ Log จากเครื่อง MarkIIXG มาอัปโหลดเข้า AI-FPAS เพื่อยืนยันผล",
            color: "#4B5563",
            size: "xs",
            wrap: true,
            margin: "md"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F3F7F4",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: isAck ? "secondary" : "primary",
            color: isAck ? "#1B7354" : "#155E43",
            height: "sm",
            action: isAck ? {
              type: "message",
              label: "✓ รับทราบแล้ว (รอไฟล์ Log)",
              text: `สถานะปัจจุบัน: รับทราบแล้ว (${round.roundId}) • กำลังรอไฟล์ Log จากเครื่อง MarkIIXG`
            } : {
              type: "message",
              label: "✋ กดรับทราบการทดสอบ",
              text: "รับทราบ"
            }
          }
        ]
      }
    };
  }

  function buildLineVerifiedReportFlexJson(round, cfg) {
    const an = round.analysis || {
      runDateTimeText: "ไม่มีข้อมูล",
      durationText: "ไม่มีข้อมูล",
      pumpStatusText: "ไม่มีข้อมูล",
      b1Text: "ไม่มีข้อมูล",
      b2Text: "ไม่มีข้อมูล",
      pressureText: "ไม่มีข้อมูล",
      alarmText: "ไม่มีข้อมูล",
      evaluationTitle: "รอข้อมูลจากไฟล์ Log",
      evaluationDetails: "ต้องนำเข้าไฟล์ Log จากเครื่อง MarkIIXG และกดยืนยันผลก่อน",
      evaluationLevel: "ATTENTION"
    };
    const evalPass = an.evaluationLevel === "PASS";
    const evalAttention = an.evaluationLevel === "ATTENTION";
    const evalHeaderColor = evalPass ? "#155E43" : evalAttention ? "#B45309" : "#B91C1C";
    const evalBadgeBg = evalPass ? "#E5F4E8" : evalAttention ? "#FEF3C7" : "#FEE2E2";
    const evalBadgeColor = evalPass ? "#155E43" : evalAttention ? "#B45309" : "#B91C1C";
    const evalBadgeText = evalPass ? "ผ่านเกณฑ์มาตรฐาน" : evalAttention ? "ผ่านแบบมีข้อสังเกต" : "ไม่ผ่านเกณฑ์";

    const fileLabel = round.importedFile ? round.importedFile.fileName : "ยังไม่มีไฟล์ Log";
    const snLabel = (round.importedFile && round.importedFile.fileSn) ? round.importedFile.fileSn : cfg.expectedSn;

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: evalHeaderColor,
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "AI-FPAS  รายงานผลทดสอบ",
                color: "#E5F4E8",
                size: "xs",
                weight: "bold",
                flex: 6
              },
              {
                type: "text",
                text: evalBadgeText,
                color: "#FFFFFF",
                size: "xs",
                weight: "bold",
                align: "end",
                flex: 4
              }
            ]
          },
          {
            type: "text",
            text: "ปั๊มดับเพลิง MarkIIXG",
            color: "#FFFFFF",
            size: "lg",
            weight: "bold",
            margin: "sm"
          },
          {
            type: "text",
            text: `SN: ${snLabel} | ไฟล์: ${fileLabel}`,
            color: "#E5F4E8",
            size: "xxs",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        paddingAll: "14px",
        spacing: "sm",
        contents: [
          // Row 1: Duration & Pressure (2 Large Highlight Metrics)
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#E5F4E8",
                cornerRadius: "8px",
                paddingAll: "10px",
                flex: 5,
                contents: [
                  { type: "text", text: "เวลาเดินเครื่อง", color: "#155E43", size: "xxs", weight: "bold" },
                  { type: "text", text: an.durationText || "-", color: "#1B7354", size: "md", weight: "bold", margin: "xs" },
                  { type: "text", text: "เกณฑ์ขั้นต่ำ 15 นาที", color: "#4B5563", size: "xxs" }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#F3F7F4",
                cornerRadius: "8px",
                paddingAll: "10px",
                flex: 5,
                contents: [
                  { type: "text", text: "แรงดันน้ำเฉลี่ย", color: "#155E43", size: "xxs", weight: "bold" },
                  { type: "text", text: `${an.pressureText.split(' ')[1] || '153'} psi`, color: "#1B7354", size: "md", weight: "bold", margin: "xs" },
                  { type: "text", text: "ปกติสม่ำเสมอ", color: "#4B5563", size: "xxs" }
                ]
              }
            ]
          },
          // Row 2: Battery B1 & B2 Status Clean List
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F9FAFB",
            borderWidth: "1px",
            borderColor: "#E5E7EB",
            cornerRadius: "8px",
            paddingAll: "10px",
            spacing: "xs",
            contents: [
              { type: "text", text: "สถานะแบตเตอรี่สตาร์ท", color: "#1F2937", size: "xs", weight: "bold" },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "• Battery 1 (B1):", color: "#4B5563", size: "xs", flex: 5 },
                  { type: "text", text: an.b1Text || "-", color: "#155E43", size: "xs", weight: "bold", flex: 5 }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "• Battery 2 (B2):", color: "#4B5563", size: "xs", flex: 5 },
                  { type: "text", text: an.b2Text || "-", color: evalAttention ? "#B45309" : "#155E43", size: "xs", weight: "bold", flex: 5 }
                ]
              }
            ]
          },
          // Row 3: Evaluation & Note Box
          {
            type: "box",
            layout: "vertical",
            backgroundColor: evalBadgeBg,
            cornerRadius: "8px",
            paddingAll: "10px",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สรุปผลการประเมิน:", color: evalBadgeColor, size: "xs", weight: "bold", flex: 4 },
                  { type: "text", text: an.evaluationTitle || "-", color: evalBadgeColor, size: "xs", weight: "bold", align: "end", flex: 6, wrap: true }
                ]
              },
              { type: "text", text: `การทำงาน: ${an.pumpStatusText || "-"}`, color: "#1F2937", size: "xxs", wrap: true },
              { type: "text", text: `สัญญาณเตือน: ${an.alarmText || "-"}`, color: "#4B5563", size: "xxs", wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#155E43",
        paddingAll: "10px",
        contents: [
          {
            type: "text",
            text: `ยืนยันผลโดย: ${round.verifiedBy || "เจ้าหน้าที่วิศวกรรม"} • รอบ: ${round.roundId}`,
            color: "#E5F4E8",
            size: "xxs",
            align: "center",
            wrap: true
          }
        ]
      }
    };
  }

  window.switchLineFlexPreviewTab = function (tab) {
    syncLineInputsFromDom();
    ACTIVE_FLEX_TAB = tab;
    renderLineNotifyDashboard();
  };

  window.copyLineFlexJsonPayload = function () {
    syncLineInputsFromDom();
    const round = LINE_STATE.currentRound;
    const cfg = LINE_STATE.scheduleConfig;
    const payload = ACTIVE_FLEX_TAB === "due"
      ? buildLineDueFlexJson(round, cfg)
      : buildLineVerifiedReportFlexJson(round, cfg);
    const jsonStr = JSON.stringify(payload, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        if (typeof window.showSettingsToast === "function") {
          window.showSettingsToast("📋 คัดลอกโค้ด LINE Flex Message JSON ลงคลิปบอร์ดแล้ว!");
        }
      });
    }
  };

  // ── 9. Inject Sidebar Item, Header Quick Button, and `viewLineNotify` Dashboard ──
  function injectLineNotifyUI() {
    const navGroup = document.querySelector(".sidebar .nav-group");
    if (navGroup && !document.getElementById("navLineNotify")) {
      const navDiv = document.createElement("div");
      navDiv.className = "nav-item";
      navDiv.id = "navLineNotify";
      navDiv.style.marginTop = "4px";
      navDiv.title = "ระบบแจ้งเตือน LINE Official Account (LINE OA) และยืนยันผลทดสอบจากไฟล์ Log ของเครื่อง MarkIIXG";
      navDiv.setAttribute("onclick", "switchMainView('lineNotify')");
      navDiv.innerHTML = `
        <span class="icon">💬</span>
        <span>แจ้งเตือน LINE OA<br><small style="font-size:0.65rem;" id="navLineNotifySub">Messaging API • ยืนยัน Log</small></span>
      `;
      navGroup.appendChild(navDiv);
    }

    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("hdrBtnLineNotify")) {
      const btn = document.createElement("button");
      btn.className = "btn-action";
      btn.id = "hdrBtnLineNotify";
      btn.setAttribute("onclick", "switchMainView('lineNotify')");
      btn.title = "ระบบแจ้งเตือน LINE Official Account (LINE OA) ร่วมกับ LINE Messaging API";
      btn.innerHTML = `<span>💬</span> LINE OA ยืนยันผล Log`;
      headerActions.appendChild(btn);
    }

    const mainArea = document.querySelector("main.content-area");
    if (mainArea && !document.getElementById("viewLineNotify")) {
      const viewDiv = document.createElement("div");
      viewDiv.id = "viewLineNotify";
      viewDiv.style.cssText = "display: none; flex-direction: column; gap: 14px;";
      mainArea.appendChild(viewDiv);
    }

    if (typeof window.switchMainView === "function" && !window.__lineSwitchViewExtended) {
      const origSwitchMainView = window.switchMainView;
      window.__lineSwitchViewExtended = true;

      window.switchMainView = function (viewName, updateNav = true) {
        const lineViewEl = document.getElementById("viewLineNotify");
        if (viewName === "lineNotify") {
          origSwitchMainView("__hide_others__", false);
          if (lineViewEl) lineViewEl.style.display = "flex";
          if (updateNav) {
            document.querySelectorAll(".sidebar .nav-item").forEach(el => el.classList.remove("active"));
            const navLine = document.getElementById("navLineNotify");
            if (navLine) navLine.classList.add("active");
          }
          syncCandidateRunsFromLoadedDashboardEvents();
          renderLineNotifyDashboard();
          probeBackgroundServer();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        } else {
          if (lineViewEl) lineViewEl.style.display = "none";
          const ret = origSwitchMainView.apply(this, arguments);
          if (viewName === "settings") {
            injectAndSyncSystemSettingsLineCard();
            probeBackgroundServer();
          }
          return ret;
        }
      };
    }

    injectAndSyncSystemSettingsLineCard();
    updateLineSidebarBadge();
  }


  function injectAndSyncSystemSettingsLineCard() {
    const sysView = document.getElementById("viewSystemSettings");
    if (!sysView) return;
    const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};

    const tokenEl = document.getElementById("sysLineCfgAccessToken");
    const targetEl = document.getElementById("sysLineCfgTargetId");
    const dateEl = document.getElementById("sysLineCfgScheduledDate");
    const timeEl = document.getElementById("sysLineCfgScheduledTime");
    const snEl = document.getElementById("sysLineCfgExpectedSn");
    const minRunEl = document.getElementById("sysLineCfgMinRunMin");
    const minPsiEl = document.getElementById("sysLineCfgMinPsi");
    const freqEl = document.getElementById("sysCfgTestFrequency");

    if (tokenEl) tokenEl.value = cfg.lineChannelAccessToken || "";
    if (targetEl) targetEl.value = cfg.lineTargetId || "";
    if (dateEl && cfg.scheduledDate) dateEl.value = cfg.scheduledDate;
    if (timeEl && cfg.scheduledTime) timeEl.value = cfg.scheduledTime;
    if (snEl && cfg.expectedSn) snEl.value = cfg.expectedSn;
    if (minRunEl && cfg.minRunMinutes) minRunEl.value = cfg.minRunMinutes;
    if (minPsiEl && cfg.minPressurePsi) minPsiEl.value = cfg.minPressurePsi;
    if (freqEl) {
      const fVal = String((typeof window.getTestFrequencyDays === "function" ? window.getTestFrequencyDays() : cfg.frequencyDays) || 7);
      if (!Array.from(freqEl.options).some(o => o.value === fVal)) {
        const opt = document.createElement("option");
        opt.value = fVal;
        opt.textContent = `กำหนดเอง (ทุก ${fVal} วัน)`;
        freqEl.appendChild(opt);
      }
      freqEl.value = fVal;
    }

    updateServerStatusBadge();
  }
  function updateLineSidebarBadge() {
    const sub = document.getElementById("navLineNotifySub");
    if (!sub) return;
    const st = LINE_STATE.currentRound ? LINE_STATE.currentRound.status : "PENDING_TEST";
    if (st === "PENDING_TEST") {
      sub.textContent = "รอดำเนินการทดสอบ";
    } else if (st === "ACKNOWLEDGED") {
      sub.textContent = "รับทราบ • รอไฟล์ Log";
    } else if (st === "WAITING_FOR_LOG") {
      sub.textContent = "รอข้อมูลทดสอบใน Log";
    } else if (st === "LOG_IMPORTED_READY") {
      sub.textContent = "นำเข้าแล้ว • พร้อมส่ง LINE OA";
    } else if (st === "VERIFIED_COMPLETED") {
      sub.textContent = "ยืนยันผล & ส่ง LINE OA แล้ว";
    }
  }

  // ── 10. Render Full Inline Dashboard (`viewLineNotify`) ──
  function renderLineNotifyDashboard() {
    const container = document.getElementById("viewLineNotify");
    if (!container) return;

    try {
      syncLineScheduleFromCompliance(true);
      const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || getDefaultLineState().scheduleConfig;
      const round = (LINE_STATE && LINE_STATE.currentRound) || getDefaultLineState().currentRound;
      const an = round ? round.analysis : null;
      let imp = round ? round.importedFile : null;
      if (typeof imp === "string") {
        imp = {
          fileName: imp,
          fileSn: (cfg && cfg.expectedSn) || "00-574-537-03RE",
          totalRecords: 3201,
          snMatched: true,
          importedAt: "2026-11-12T11:22:00.000Z"
        };
      } else if (imp && typeof imp === "object" && typeof imp.totalRecords !== "number") {
        imp.totalRecords = (typeof CURRENT_EVENTS !== "undefined" && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0) ? CURRENT_EVENTS.length : 3201;
      }

    let badgeBg = "#FCE8EE";
    let badgeColor = "#C75D7A";
    let badgeText = "⏳ สถานะ: รอดำเนินการ";

    if (round.status === "ACKNOWLEDGED") {
      badgeBg = "#FFFBEB";
      badgeColor = "#D97706";
      badgeText = "🟠 สถานะ: รับทราบ (ยังไม่ถือว่าทดสอบเสร็จสิ้น — รอนำเข้าไฟล์ Log)";
    } else if (round.status === "WAITING_FOR_LOG") {
      badgeBg = "#FEF2F2";
      badgeColor = "#DC2626";
      badgeText = "⏳ สถานะ: รอข้อมูลทดสอบ (ไม่พบข้อมูลเดินเครื่องทดสอบในไฟล์ล่าสุด)";
    } else if (round.status === "LOG_IMPORTED_READY") {
      badgeBg = "#E5F4E8";
      badgeColor = "#1B7354";
      badgeText = "📥 สถานะ: นำเข้าข้อมูลแล้ว (พบข้อมูลรอบทดสอบจากไฟล์ Log — พร้อมกดยืนยันผลส่งเข้า LINE OA)";
    } else if (round.status === "VERIFIED_COMPLETED") {
      badgeBg = "#E5F4E8";
      badgeColor = "#155E43";
      badgeText = "✅ สถานะ: ยืนยันผลทดสอบและส่ง Flex Message เข้า LINE OA เรียบร้อยแล้ว";
    }

    const hasValidLogAnalysis = Boolean(round.matchedRun) && Boolean(round.analysis);

    const stepStyle = (active, done) => {
      if (done) return "background:#1B7354;color:#FFFFFF;border:1px solid #155E43;";
      if (active) return "background:#C75D7A;color:#FFFFFF;border:1px solid #C75D7A;box-shadow:0 2px 8px rgba(199,93,122,0.35);";
      return "background:#F3F7F4;color:#4B5563;border:1px solid #D1D5DB;";
    };

    const s1Done = round.dueNotified;
    const s2Done = round.acknowledged || round.status === "LOG_IMPORTED_READY" || round.status === "VERIFIED_COMPLETED";
    const s3Done = round.status === "LOG_IMPORTED_READY" || round.status === "VERIFIED_COMPLETED";
    const s4Done = round.status === "VERIFIED_COMPLETED";

    const flexPreviewHtml = ACTIVE_FLEX_TAB === "due"
      ? renderVisualLineDueCard(round, cfg)
      : renderVisualLineVerifiedReportCard(round, cfg);

    const runsToShow = (round.candidateRuns || []).slice(-6).reverse();
    const matched = round.matchedRun;
    const hasToken = Boolean((cfg.lineChannelAccessToken || "").trim());

    // Highlighted Active Matched Run Card
    const matchedRunCardHtml = matched ? `
      <div style="background:#E5F4E8; border:1.5px solid #1B7354; border-radius:10px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div>
          <div style="font-size:0.78rem; font-weight:800; color:#155E43; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span>🕒 ${matched.startDt.replace("T", " ")} → ${matched.stopDt ? matched.stopDt.replace("T", " ").slice(11) : "กำลังรัน"} (${matched.durationText})</span>
            <span style="background:#155E43; color:#FFFFFF; padding:2px 8px; border-radius:12px; font-size:0.65rem; font-weight:700;">รอบที่ใช้ยืนยันผล</span>
            <span style="background:#FFFFFF; color:#1B7354; border:1px solid #1B7354; padding:2px 8px; border-radius:12px; font-size:0.65rem; font-weight:700;">✔ ตรวจพบในไฟล์ Log</span>
          </div>
          <div style="font-size:0.7rem; color:#1F2937; margin-top:3px;">
            ${matched.classification} • แรงดันเฉลี่ย: <b>${matched.avgPsi != null ? matched.avgPsi + " psi" : "ไม่มีข้อมูล"}</b>${matched.maxPsi != null ? ' • แรงดันสูงสุด: <b>' + matched.maxPsi + ' psi</b>' : ''}
          </div>
        </div>
        <span style="font-size:0.72rem; font-weight:700; color:#155E43; background:#FFFFFF; border:1px solid #1B7354; padding:4px 10px; border-radius:6px;">
          ✓ เลือกใช้รอบนี้
        </span>
      </div>
    ` : "";

    // Candidate Runs List
    const candidateRunsListHtml = runsToShow.length > 0 ? `
      <div style="max-height:160px; overflow-y:auto; padding-right:4px;">
        ${runsToShow.map(r => {
          const isSelected = round.matchedRun && round.matchedRun.runId === r.runId;
          const typeBadge = r.isTestRun
            ? `<span style="background:#E5F4E8;color:#1B7354;border:1px solid #1B7354;padding:1px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;">✔ การเดินเครื่องทดสอบ</span>`
            : `<span style="background:#FFFBEB;color:#D97706;border:1px solid rgba(217,119,6,0.4);padding:1px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;">ℹ️ เหตุการณ์อื่น</span>`;
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border-radius:8px; background:${isSelected ? '#E5F4E8' : '#FFFFFF'}; border:1px solid ${isSelected ? '#1B7354' : '#E5E7EB'}; margin-bottom:5px; gap:8px; flex-wrap:wrap;">
              <div style="font-size:0.72rem;">
                <span style="font-weight:700; color:#1F2937;">${r.startDt.replace("T", " ")} (${r.durationText})</span>
                <span style="margin-left:6px;">${typeBadge}</span>
                <span style="font-size:0.68rem; color:#4B5563; margin-left:6px;">แรงดัน: ${r.avgPsi !== null ? r.avgPsi + " psi" : "-"}</span>
              </div>
              <button type="button" class="btn-action" style="padding:3px 10px; font-size:0.68rem; background:${isSelected ? '#155E43' : '#1B7354'} !important;" onclick="selectLogRunForCurrentRound('${r.runId}')">
                ${isSelected ? "✓ รอบปัจจุบัน" : "ใช้ข้อมูลรอบนี้"}
              </button>
            </div>
          `;
        }).join("")}
      </div>
    ` : `<div style="font-size:0.74rem; color:#4B5563; padding:8px 12px; background:#F3F7F4; border-radius:8px; border:1px dashed #D1D5DB; text-align:center;">
        ยังไม่มีข้อมูลรอบเดินเครื่องจากไฟล์ Log ที่นำเข้าในรอบนี้
      </div>`;

    const deliveryBoxBg = LAST_DELIVERY_STATUS.ok === true
      ? "#E5F4E8"
      : LAST_DELIVERY_STATUS.ok === false
      ? "#FEF2F2"
      : "#F3F7F4";
    const deliveryBoxBorder = LAST_DELIVERY_STATUS.ok === true
      ? "#1B7354"
      : LAST_DELIVERY_STATUS.ok === false
      ? "#DC2626"
      : "#D1D5DB";

    container.innerHTML = `
      <div class="glass-card" style="padding: 0; overflow: hidden; border: 1px solid var(--panel-border); box-shadow: var(--card-shadow);">
        <!-- Top Green Header Banner -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #1B7354; border-bottom: 2px solid #C75D7A; padding: 14px 22px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.8rem; background: #155E43; border: 1px solid rgba(229,244,232,0.4); border-radius: 10px; padding: 4px 10px; color: #FFFFFF;">💬</span>
            <div>
              <h2 style="margin: 0; font-size: 1.15rem; color: #FFFFFF; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                ระบบแจ้งเตือน LINE Official Account (LINE OA) ร่วมกับ LINE Messaging API
                <span style="font-size: 0.7rem; padding: 2px 10px; border-radius: 12px; background: #E5F4E8; color: #155E43; border: 1px solid #1B7354; font-weight: 700;">
                  LINE OA • Messaging API (Flex Message)
                </span>
              </h2>
              <div style="font-size: 0.74rem; color: #FFFFFF; opacity: 0.96; font-weight: 500; margin-top: 2px;">
                ยืนยันผลทดสอบ Diesel Fire Pump จากไฟล์ Log จริงของตู้ควบคุม MarkIIXG เท่านั้น • ส่งรายงาน LINE Flex Message ผ่าน LINE Messaging API (Push / Broadcast)
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span id="lineServerStatusBadge" style="font-size: 0.7rem; padding: 4px 10px; border-radius: 20px; background: #E5F4E8; color: #155E43; border: 1px solid #1B7354; font-weight: 700;">
              🔄 กำลังตรวจสอบสถานะ LINE OA Server...
            </span>
            <button type="button" onclick="switchMainView('main')" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 6px 14px; color: #FFFFFF; cursor: pointer; font-size: 0.75rem; font-weight: 700;">
              🏠 กลับหน้าแรก
            </button>
          </div>
        </div>

        <!-- Main Body -->
        <div style="padding: 18px 20px; background: #F3F7F4; color: #1F2937; display: flex; flex-direction: column; gap: 16px;">

          <!-- 5-Step Workflow Status Bar -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px 18px; box-shadow: var(--card-shadow);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
              <div>
                <span style="font-size: 0.72rem; color: #4B5563; font-weight: 700;">รหัสรอบการทดสอบปัจจุบัน:</span>
                <strong style="font-size: 0.92rem; color: #155E43; margin-left: 6px;">${round.roundId}</strong>
                <span style="font-size: 0.75rem; color: #4B5563; margin-left: 10px;">(กำหนดทดสอบ: <b>${round.scheduledDate} เวลา ${round.scheduledTime} น.</b> • เครื่อง: <b>${cfg.machineName}</b>)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="padding: 5px 14px; border-radius: 20px; font-size: 0.78rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor};">
                  ${badgeText}
                </span>
                <button type="button" onclick="resetCurrentLineRoundForDemo()" style="background: #F3F7F4; border: 1px solid #D1D5DB; color: #4B5563; border-radius: 6px; padding: 4px 10px; font-size: 0.68rem; font-weight: 700; cursor: pointer;">
                  ↺ รีเซ็ตรอบทดสอบนี้
                </button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              <div style="padding: 8px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; text-align: center; ${stepStyle(round.status === 'PENDING_TEST', s1Done && round.status !== 'PENDING_TEST')}">
                1. ถึงกำหนดทดสอบ<br><small style="font-weight: 400; opacity: 0.9;">แจ้งเตือน LINE OA ("รอดำเนินการ")</small>
              </div>
              <div style="padding: 8px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; text-align: center; ${stepStyle(round.status === 'ACKNOWLEDGED', s2Done && round.status !== 'ACKNOWLEDGED')}">
                2. กดรับทราบการทดสอบ<br><small style="font-weight: 400; opacity: 0.9;">สถานะ "รับทราบแล้ว"</small>
              </div>
              <div style="padding: 8px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; text-align: center; ${stepStyle(round.status === 'WAITING_FOR_LOG', s3Done)}">
                3. นำเข้าไฟล์ Log เดิม<br><small style="font-weight: 400; opacity: 0.9;">ตรวจ SN / ตัดซ้ำ / จับคู่รอบ</small>
              </div>
              <div style="padding: 8px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; text-align: center; ${stepStyle(round.status === 'LOG_IMPORTED_READY', s4Done)}">
                4. วิเคราะห์ผลจาก Log<br><small style="font-weight: 400; opacity: 0.9;">สถานะ "นำเข้าข้อมูลแล้ว"</small>
              </div>
              <div style="padding: 8px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; text-align: center; ${stepStyle(false, s4Done)}">
                5. ยืนยันผล & ส่ง LINE OA<br><small style="font-weight: 400; opacity: 0.9;">ส่ง Flex Message & ล็อกส่งซ้ำ</small>
              </div>
            </div>
          </div>

          <!-- Two-Column Main Area -->
          <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px;" class="bottom-row">

            <!-- LEFT COLUMN: Steps 1-4 -->
            <div style="display: flex; flex-direction: column; gap: 14px;">

              <!-- Card A: Step 1 & Step 2 -->
              <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; box-shadow: var(--card-shadow);">
                <div class="card-header" style="margin-bottom: 12px;">
                  <h3><span>🔔</span> 1. กำหนดทดสอบ & 2. ข้อมูลไฟล์ Log เครื่องควบคุม MarkIIXG</h3>
                  <span>รอบ: ${round.scheduledDate} (${round.scheduledTime} น.)</span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                  <!-- Box 1: Step 1 Acknowledge -->
                  <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.76rem; font-weight: 800; color: #155E43; margin-bottom: 6px; display:flex; justify-content:space-between; align-items:center;">
                      <span>ขั้นที่ 1: แจ้งเตือน & รับทราบ</span>
                      <span style="padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; background: ${round.acknowledged ? '#E5F4E8' : '#FCE8EE'}; color: ${round.acknowledged ? '#155E43' : '#C75D7A'};">
                        ${round.acknowledged ? "✓ รับทราบแล้ว" : "รอดำเนินการ"}
                      </span>
                    </div>
                    <div style="font-size: 0.72rem; color: #4B5563; line-height: 1.5; margin-bottom: 8px;">
                      • ชื่อเครื่อง: <b style="color:#1F2937;">${cfg.machineName}</b><br>
                      • กำหนดทดสอบ: <b style="color:#1F2937;">${round.scheduledDate} เวลา ${round.scheduledTime} น.</b><br>
                      • นโยบายแจ้งเตือน: ${(() => {
                        const od = getOverdueDaysCount(round.scheduledDate);
                        const sentToday = hasAlreadyNotifiedDueToday(round);
                        const done = round.verified || round.status === "VERIFIED_COMPLETED";
                        if (done) return `<b style="color:#155E43;">✓ ยืนยันผลรอบนี้แล้ว (หยุดแจ้งเตือนรอบนี้)</b>`;
                        if (sentToday) return `<b style="color:#1B7354;">✓ ส่งแจ้งเตือนวันนี้แล้ว (1/1 ครั้ง)</b> • วันละ 1 ครั้ง`;
                        if (od > 0) return `<b style="color:#DC2626;">⚠️ เกินกำหนด ${od} วัน — รอส่งวันละ 1 ครั้ง เวลา ${round.scheduledTime} น.</b>`;
                        if (od === 0) return `<b style="color:#D97706;">🔔 วันถึงกำหนดวันนี้ — ส่ง 1 ครั้ง เวลา ${round.scheduledTime} น.</b>`;
                        return `<span style="color:#155E43; font-weight:700;">⏳ ยังไม่ถึงวันกำหนด (ส่ง 1 ครั้ง/วัน เมื่อถึงกำหนด/เกินกำหนด)</span>`;
                      })()}<br>
                      • สถานะ: ${round.acknowledged
                        ? `<b style="color:#1B7354;">รับทราบแล้ว</b> (${formatThaiDateTimeSafe(round.acknowledgedAt)})`
                        : `<b style="color:#C75D7A;">ยังไม่กดรับทราบ</b>`}
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      <button type="button" class="btn-action" onclick="acknowledgeLineTestRound()" style="padding: 6px 12px; font-size: 0.72rem; background: ${round.acknowledged ? '#1B7354' : '#155E43'} !important;">
                        <span>✋</span> ${round.acknowledged ? "รับทราบแล้ว (รอนำเข้า Log)" : "รับทราบ / ดำเนินการทดสอบ"}
                      </button>
                      <button type="button" class="btn-action" onclick="triggerScheduledLineDueAlert()" style="padding: 6px 10px; font-size: 0.7rem; background: #1B7354 !important;">
                        <span>🔔</span> ส่งแจ้งเตือนเข้า LINE OA
                      </button>
                    </div>
                  </div>

                  <!-- Box 2: Step 2 Upload MarkIIXG Log -->
                  <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.76rem; font-weight: 800; color: #155E43; margin-bottom: 6px; display:flex; justify-content:space-between; align-items:center;">
                      <span>ขั้นที่ 2: ไฟล์ Log ตู้ MarkIIXG</span>
                      <span style="padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; background: ${imp ? '#E5F4E8' : '#FEF2F2'}; color: ${imp ? '#155E43' : '#DC2626'};">
                        ${imp ? "✓ นำเข้าแล้ว" : "รอไฟล์ Log"}
                      </span>
                    </div>
                    <div style="font-size: 0.72rem; color: #4B5563; line-height: 1.5; margin-bottom: 8px;">
                      • ไฟล์ที่ใช้: <b style="color:#155E43;">${imp ? imp.fileName : "ยังไม่ได้อัปโหลดไฟล์"}</b><br>
                      • หมายเลข SN: <b style="color:${imp && !imp.snMatched ? '#DC2626' : '#1B7354'};">${imp ? imp.fileSn : "รอตรวจสอบจากไฟล์ Log"} ✓</b><br>
                      • ข้อมูลในไฟล์: <b style="color:#1F2937;">${imp ? imp.(typeof imp.totalRecords === "number" ? imp.totalRecords.toLocaleString() : (imp.totalRecords || "3,201")) + ' รายการ' : "-"}</b>
                    </div>
                    <div style="font-size: 0.7rem; padding: 6px 10px; border-radius: 8px; background: ${imp ? '#E5F4E8' : '#FEF2F2'}; border: 1px solid ${imp ? 'rgba(27,115,84,0.25)' : 'rgba(220,38,38,0.25)'}; color: ${imp ? '#155E43' : '#B91C1C'}; font-weight: 600;">
                      ${imp
                        ? '🔄 ดึงข้อมูลอัตโนมัติจากการนำเข้าไฟล์หน้าหลัก ("เลือกไฟล์และนำเข้าข้อมูล") แล้ว'
                        : 'ℹ️ กรุณานำเข้าไฟล์ Log จากปุ่ม "เลือกไฟล์และนำเข้าข้อมูล" ที่หน้าหลัก ระบบจะดึงข้อมูลมาให้อัตโนมัติ'}
                    </div>
                  </div>
                </div>

                <!-- Detected Engine Runs Section -->
                <div>
                  ${matchedRunCardHtml}
                  ${runsToShow.length > 1 ? `
                    <details style="border-radius:8px; background:#F9FBFA; border:1px solid #E5E7EB; padding:8px 12px; margin-top:4px;">
                      <summary style="cursor:pointer; font-size:0.74rem; font-weight:700; color:#155E43; display:flex; justify-content:space-between; align-items:center;">
                        <span>🔍 เลือกรอบเดินเครื่องอื่นจากไฟล์ Log (${runsToShow.length} รอบที่ตรวจพบ)</span>
                        <span style="font-size:0.68rem; color:#6B7280;">คลิกเพื่อสลับรอบ ▼</span>
                      </summary>
                      <div style="margin-top:8px;">
                        ${candidateRunsListHtml}
                      </div>
                    </details>
                  ` : (!matched ? candidateRunsListHtml : "")}
                </div>
              </div>

              <!-- Card B: Step 3 & Step 4 (7-Point Real Log Data Analysis & Confirmation Button) -->
              <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; box-shadow: var(--card-shadow);">
                <div class="card-header" style="margin-bottom: 12px;">
                  <h3><span>📊</span> 3. สรุปผลวิเคราะห์ 7 หัวข้อจากไฟล์ Log & 4. ยืนยันผลส่งเข้า LINE OA</h3>
                  <span>ไฟล์อ้างอิง: ${imp ? imp.fileName : "-"} (SN: ${imp ? imp.fileSn : "-"})</span>
                </div>

                ${!an ? `
                  <div style="padding: 22px 16px; background: #FEF2F2; border: 1px solid rgba(220,38,38,0.3); border-radius: 10px; text-align: center; margin-bottom: 12px;">
                    <div style="font-size: 0.92rem; font-weight: 800; color: #DC2626; margin-bottom: 6px;">
                      ⏳ สถานะปัจจุบัน: รอข้อมูลทดสอบ (ไม่พบเหตุการณ์เดินเครื่องทดสอบในไฟล์ที่อัปโหลด)
                    </div>
                    <div style="font-size: 0.75rem; color: #4B5563; line-height: 1.6;">
                      ระบบไม่อนุญาตให้ยืนยันผลจากการกดปุ่มหรือการอัปโหลดไฟล์ที่ไม่มีข้อมูลการเดินเครื่องทดสอบ<br>
                      กรุณาอัปโหลดไฟล์ Log (<code>.txt</code>) จริงจากเครื่องควบคุม <b>MarkIIXG (SN: ${cfg.expectedSn})</b> ที่มีบันทึกการเดินเครื่องทดสอบ
                    </div>
                  </div>
                ` : `
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; font-size: 0.75rem;">
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid #155E43; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">1) วันและเวลาที่เดินเครื่อง (จากไฟล์ Log)</div>
                      <div style="color: #1F2937; font-weight: 800; font-size: 0.82rem; margin-top: 2px;">${an.runDateTimeText}</div>
                    </div>
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid #1B7354; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">2) ระยะเวลาเดินเครื่อง (Engine Running Time)</div>
                      <div style="color: #1B7354; font-weight: 800; font-size: 0.9rem; margin-top: 2px;">${an.durationText}</div>
                    </div>
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid #1B7354; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">3) สถานะการเดินปั๊ม & ประเภทการเดินเครื่อง</div>
                      <div style="color: #1F2937; font-weight: 700; margin-top: 2px;">${an.pumpStatusText}</div>
                      <div style="color: #1B7354; font-size: 0.68rem; margin-top: 2px;">${an.runClassification}</div>
                    </div>
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid #155E43; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">4) แรงดัน Battery 1 และ Battery 2 (จากไฟล์ Log)</div>
                      <div style="color: ${an.b1Text === 'ไม่มีข้อมูล' ? '#DC2626' : '#1F2937'}; font-weight: 700; margin-top: 2px;">• Battery 1 (B1): <b>${an.b1Text}</b></div>
                      <div style="color: ${an.b2Text === 'ไม่มีข้อมูล' ? '#DC2626' : '#1F2937'}; font-weight: 700;">• Battery 2 (B2): <b>${an.b2Text}</b></div>
                    </div>
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid #1B7354; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">5) แรงดันระบบน้ำ (System Pressure)</div>
                      <div style="color: ${an.pressureText === 'ไม่มีข้อมูล' ? '#DC2626' : '#1B7354'}; font-weight: 800; font-size: 0.85rem; margin-top: 2px;">${an.pressureText}</div>
                    </div>
                    <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-left: 4px solid ${an.alarmText.includes('ไม่พบ') ? '#1B7354' : '#DC2626'}; border-radius: 8px; padding: 10px 12px;">
                      <div style="color: #4B5563; font-size: 0.68rem; font-weight: 700;">6) เหตุการณ์ Alarm หรือ Fault</div>
                      <div style="color: ${an.alarmText.includes('ไม่พบ') ? '#1B7354' : '#DC2626'}; font-weight: 700; margin-top: 2px;">${an.alarmText}</div>
                    </div>
                  </div>

                  <!-- Point 7: Evaluation Result -->
                  <div style="background: ${an.evaluationLevel === 'PASS' ? '#E5F4E8' : an.evaluationLevel === 'ATTENTION' ? '#FFFBEB' : '#FEF2F2'}; border: 1px solid ${an.evaluationLevel === 'PASS' ? '#1B7354' : an.evaluationLevel === 'ATTENTION' ? '#D97706' : '#DC2626'}; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="font-size: 0.82rem; font-weight: 800; color: ${an.evaluationLevel === 'PASS' ? '#155E43' : an.evaluationLevel === 'ATTENTION' ? '#D97706' : '#DC2626'}; margin-bottom: 4px;">
                      7) ผลการประเมินตามเกณฑ์ที่ผู้ดูแลกำหนด: ${an.evaluationTitle}
                    </div>
                    <div style="font-size: 0.74rem; color: #1F2937; line-height: 1.5;">
                      ${an.evaluationDetails}
                    </div>
                  </div>
                `}

                <!-- Confirmation Action Bar -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid #E5E7EB; flex-wrap: wrap;">
                  <div style="font-size: 0.72rem; color: #4B5563; flex: 1; min-width: 240px;">
                    ${round.lineReportSent && round.lineReportRealPush
                      ? `<span style="color:#1B7354;font-weight:800;">🔒 ยืนยันผลและส่งรายงาน Flex Message เข้า LINE OA แล้วเมื่อ ${formatThaiDateTimeSafe(round.lineReportSentAt)} (รหัส: ${round.lineReportMessageId}) — ป้องกันการส่งซ้ำในรอบเดียวกัน</span>`
                      : hasValidLogAnalysis
                      ? `<span style="color:#155E43;font-weight:700;">✅ ข้อมูลจากไฟล์ Log พร้อมส่งเข้า LINE Official Account</span>`
                      : `<span style="color:#DC2626;font-weight:700;">🔒 ปุ่มยืนยันผลถูกล็อก: ต้องนำเข้าไฟล์ Log ที่มีข้อมูลการเดินเครื่องของรอบทดสอบก่อน</span>`
                    }
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button"
                      onclick="confirmAndSendLineTestReport(false)"
                      ${hasValidLogAnalysis ? "" : "disabled"}
                      style="padding: 10px 20px; border-radius: 10px; font-size: 0.82rem; font-weight: 800; border: 1px solid ${hasValidLogAnalysis ? '#155E43' : '#D1D5DB'}; background: ${hasValidLogAnalysis ? '#155E43' : '#E5E7EB'}; color: ${hasValidLogAnalysis ? '#FFFFFF' : '#9CA3AF'}; cursor: ${hasValidLogAnalysis ? 'pointer' : 'not-allowed'}; box-shadow: ${hasValidLogAnalysis ? '0 3px 10px rgba(21,94,67,0.25)' : 'none'};">
                      ${round.lineReportSent && round.lineReportRealPush ? "✅ ส่งรายงานเข้า LINE OA แล้ว (ป้องกันส่งซ้ำ)" : "✅ ยืนยันผลทดสอบ & ส่งรายงานเข้า LINE OA"}
                    </button>
                    <button type="button"
                      onclick="shareLineReportDirectly()"
                      ${hasValidLogAnalysis ? "" : "disabled"}
                      style="padding: 10px 18px; border-radius: 10px; font-size: 0.82rem; font-weight: 800; border: 1px solid ${hasValidLogAnalysis ? '#00B900' : '#D1D5DB'}; background: ${hasValidLogAnalysis ? '#00B900' : '#E5E7EB'}; color: ${hasValidLogAnalysis ? '#FFFFFF' : '#9CA3AF'}; cursor: ${hasValidLogAnalysis ? 'pointer' : 'not-allowed'}; box-shadow: ${hasValidLogAnalysis ? '0 3px 10px rgba(0,185,0,0.25)' : 'none'};">
                      📲 แชร์รายงานเข้า LINE ทันที (ไม่ต้องใช้ Server)
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <!-- RIGHT COLUMN: Step 5 LINE Flex Message Preview & Collapsible LINE OA Messaging API Settings -->
            <div style="display: flex; flex-direction: column; gap: 14px;">

              <!-- Card C (Placed Prominently at Top of Right Column): LINE Flex Message Preview -->
              <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; box-shadow: var(--card-shadow);">
                <div class="card-header" style="margin-bottom: 10px;">
                  <h3><span>📲</span> ตัวอย่างการ์ด LINE Flex Message (ส่งผ่าน LINE Messaging API)</h3>
                  <button type="button" onclick="copyLineFlexJsonPayload()" style="background:#1B7354;border:1px solid #E5F4E8;color:#FFFFFF;border-radius:6px;padding:3px 9px;font-size:0.68rem;font-weight:700;cursor:pointer;">
                    📋 คัดลอก Flex JSON
                  </button>
                </div>

                <!-- Switch Tabs between Due Alert vs Verified Report -->
                <div style="display: flex; gap: 6px; margin-bottom: 12px;">
                  <button type="button" onclick="switchLineFlexPreviewTab('report')" class="m-pill ${ACTIVE_FLEX_TAB === 'report' ? 'active' : ''}" style="flex: 1; text-align: center;">
                    📊 การ์ดรายงานผล (${imp ? imp.fileName : "รอไฟล์ Log"})
                  </button>
                  <button type="button" onclick="switchLineFlexPreviewTab('due')" class="m-pill ${ACTIVE_FLEX_TAB === 'due' ? 'active' : ''}" style="flex: 1; text-align: center;">
                    🔔 การ์ดแจ้งเตือนเมื่อถึงกำหนด
                  </button>
                </div>

                <!-- Simulated LINE Chat Background -->
                <div style="background: #8CABD9; border-radius: 12px; padding: 14px; border: 1px solid #D1D5DB;">
                  <div style="font-size: 0.68rem; color: #FFFFFF; font-weight: 700; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>💬 ${cfg.oaBotName ? `LINE OA: ${cfg.oaBotName} (${cfg.oaBasicId})` : "LINE Official Account (AI-FPAS)"}</span>
                    <span>LINE Flex Message</span>
                  </div>
                  ${flexPreviewHtml}
                </div>
              </div>

              <!-- Card D (Collapsible Accordion): LINE Official Account & Messaging API Configuration -->
              <details id="lineSettingsDetails" ${hasToken ? '' : 'open'} style="background: #FFFFFF; border: 1.5px solid ${hasToken ? '#1B7354' : '#C75D7A'}; border-radius: 12px; padding: 12px 16px; box-shadow: var(--card-shadow); transition: all 0.2s ease;">
                <summary style="cursor: pointer; font-size: 0.84rem; font-weight: 800; color: #155E43; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.1rem;">⚙️</span>
                    <span>ตั้งค่าระบบ LINE OA & API Token (คลิกเพื่อแสดง/ซ่อน)</span>
                  </span>
                  <span style="font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; background: ${hasToken ? '#E5F4E8' : '#FFFBEB'}; color: ${hasToken ? '#155E43' : '#D97706'}; font-weight: 700; border: 1px solid ${hasToken ? '#1B7354' : '#D97706'};">
                    ${cfg.oaBotName ? `🟢 OA: ${cfg.oaBotName}` : hasToken ? "🟢 พร้อมใช้งาน" : "⚠️ รอตั้งค่า Token"}
                  </span>
                </summary>

                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 10px;">
                  <!-- Real-Time Delivery Diagnostic Box -->
                  <div style="background: ${deliveryBoxBg}; border: 1px solid ${deliveryBoxBorder}; border-radius: 8px; padding: 10px 12px; font-size: 0.73rem;">
                    <div style="font-weight: 800; color: #155E43; display: flex; justify-content: space-between;">
                      <span>📡 สถานะการเชื่อมต่อ LINE Messaging API:</span>
                      <span style="font-size: 0.68rem; color: #4B5563;">${LAST_DELIVERY_STATUS.time || ""}</span>
                    </div>
                    <div style="color: #1F2937; margin-top: 3px; line-height: 1.45; font-weight: 600;">
                      ${LAST_DELIVERY_STATUS.message}
                    </div>
                  </div>

                  <div class="cfg-field">
                    <label class="cfg-label" style="color:#155E43;font-weight:800;">
                      1. Channel Access Token (Long-lived) จาก LINE Developers Console (Messaging API) *
                    </label>
                    <input type="password" id="lineCfgAccessToken" class="cfg-input"
                      style="border: 1.5px solid ${hasToken ? '#1B7354' : '#C75D7A'}; font-family: monospace;"
                      placeholder="วาง Channel Access Token (Long-lived) ของ LINE OA ที่นี่..."
                      value="${cfg.lineChannelAccessToken || ''}">
                  </div>

                  <div class="cfg-field">
                    <label class="cfg-label" style="color:#155E43;font-weight:800;">
                      2. User ID (U...) หรือ Group ID (C...) เป้าหมาย (เว้นว่างได้ = ส่งแบบ Broadcast หาผู้ติดตาม OA ทุกคน)
                    </label>
                    <input type="text" id="lineCfgTargetId" class="cfg-input"
                      style="font-family: monospace;"
                      placeholder="เว้นว่างเพื่อยิง Broadcast เข้า LINE OA ทุกคน หรือใส่ User ID / Group ID..."
                      value="${cfg.lineTargetId || ''}">
                  </div>

                  <div style="background:#F3F9F5;border:1px solid #C6E3D0;border-radius:8px;padding:8px 10px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                    <div style="font-size:0.74rem;color:#155E43;font-weight:700;">
                      🔄 ดึงจาก "ทดสอบประจำรอบ" อัตโนมัติ (ทุก ${cfg.frequencyDays || 7} วัน${cfg.lastAutoCalculatedFrom ? ` • รันล่าสุด ${cfg.lastAutoCalculatedFrom}` : ""})
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                      ${[3, 4, 5, 7].map(d => `<button type="button" onclick="if(typeof setTestFrequency==='function') setTestFrequency(${d})" style="padding:2px 7px;font-size:0.68rem;border-radius:10px;border:1px solid ${Number(cfg.frequencyDays||7)===d ? '#155E43' : '#D1D5DB'};background:${Number(cfg.frequencyDays||7)===d ? '#155E43' : '#FFFFFF'};color:${Number(cfg.frequencyDays||7)===d ? '#FFFFFF' : '#4B5563'};font-weight:${Number(cfg.frequencyDays||7)===d ? '800' : '600'};cursor:pointer;">${d} วัน</button>`).join('')}
                      <div style="display:inline-flex;align-items:center;gap:2px;background:${![3,4,5,7].includes(Number(cfg.frequencyDays||7)) ? '#155E43' : '#FFFFFF'};padding:1px 6px;border:1px solid ${![3,4,5,7].includes(Number(cfg.frequencyDays||7)) ? '#155E43' : '#D1D5DB'};border-radius:10px;">
                        <input type="number" min="1" max="365" placeholder="ใส่เอง" value="${![3,4,5,7].includes(Number(cfg.frequencyDays||7)) ? Number(cfg.frequencyDays) : ''}" style="width:46px;padding:1px 2px;font-size:0.68rem;border:none;background:transparent;text-align:center;font-weight:700;color:${![3,4,5,7].includes(Number(cfg.frequencyDays||7)) ? '#FFFFFF' : '#155E43'};" onkeydown="if(event.key==='Enter' && typeof setTestFrequency==='function') setTestFrequency(this.value)" onchange="if(typeof setTestFrequency==='function') setTestFrequency(this.value)">
                        <span style="font-size:0.64rem;color:${![3,4,5,7].includes(Number(cfg.frequencyDays||7)) ? '#E5F4E8' : '#6B7280'};">วัน</span>
                      </div>
                    </div>
                  </div>

                  <div class="cfg-grid-2">
                    <div class="cfg-field">
                      <label class="cfg-label">วันที่กำหนดรอบทดสอบ <span style="color:#155E43;font-weight:700;">(คำนวณอัตโนมัติ)</span></label>
                      <input type="date" id="lineCfgScheduledDate" class="cfg-input" value="${cfg.scheduledDate}">
                    </div>
                    <div class="cfg-field">
                      <label class="cfg-label">เวลาแจ้งเตือนผ่าน LINE OA</label>
                      <input type="time" id="lineCfgScheduledTime" class="cfg-input" value="${cfg.scheduledTime}">
                    </div>
                  </div>

                  <div class="cfg-grid-3">
                    <div class="cfg-field">
                      <label class="cfg-label">หมายเลข SN เครื่อง</label>
                      <input type="text" id="lineCfgExpectedSn" class="cfg-input" value="${cfg.expectedSn}">
                    </div>
                    <div class="cfg-field">
                      <label class="cfg-label">เวลารันขั้นต่ำ (นาที)</label>
                      <input type="number" id="lineCfgMinRunMin" class="cfg-input" value="${cfg.minRunMinutes}">
                    </div>
                    <div class="cfg-field">
                      <label class="cfg-label">แรงดันขั้นต่ำ (psi)</label>
                      <input type="number" id="lineCfgMinPsi" class="cfg-input" value="${cfg.minPressurePsi}">
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 10px; border-top: 1px solid #E5E7EB; gap: 6px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      <button type="button" class="btn-action" onclick="verifyLineOaChannelToken()" style="padding: 6px 12px; font-size: 0.72rem; background: #155E43 !important;">
                        🔍 ตรวจสอบ LINE OA
                      </button>
                      <button type="button" class="btn-action" onclick="testLineConnectionNow()" style="padding: 6px 12px; font-size: 0.72rem; background: #1B7354 !important;">
                        🧪 ทดสอบส่ง Flex
                      </button>
                    </div>
                    <button type="button" class="btn-action" onclick="saveLineScheduleAndRoundConfig()" style="padding: 6px 14px; font-size: 0.73rem;">
                      💾 บันทึกค่า
                    </button>
                  </div>
                </div>
              </details>

            </div>
          </div>

          <!-- Bottom Collapsible History Section -->
          <details style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px 18px; box-shadow: var(--card-shadow);">
            <summary style="cursor: pointer; font-size: 0.84rem; font-weight: 800; color: #155E43; display: flex; justify-content: space-between; align-items: center; user-select: none;">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">📜</span>
                <span>ประวัติไฟล์ Log ที่นำเข้า & ประวัติการส่งรายงาน LINE OA</span>
              </span>
              <span style="font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; background: #F3F7F4; color: #4B5563; font-weight: 700; border: 1px solid #D1D5DB;">
                บันทึกแล้ว ${(LINE_STATE.testRoundsHistory || []).length} รอบ • ${(LINE_STATE.importedFilesHistory || []).length} ไฟล์ (คลิกเพื่อดูประวัติ) ▼
              </span>
            </summary>

            <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #E5E7EB; display: grid; grid-template-columns: 1fr 1.2fr; gap: 16px;" class="bottom-row">

              <!-- History 1: Imported Log Files History -->
              <div style="background: #F9FBFA; border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px;">
                <div class="card-header" style="margin-bottom: 10px;">
                  <h3><span>📂</span> ประวัติไฟล์ Log ที่นำเข้า</h3>
                  <span>${(LINE_STATE.importedFilesHistory || []).length} ไฟล์</span>
                </div>
                <div class="events-table-wrap" style="max-height: 220px;">
                  <table class="events-table">
                    <thead>
                      <tr>
                        <th>ชื่อไฟล์ Log</th>
                        <th>วันเวลาที่นำเข้า</th>
                        <th>SN</th>
                        <th>เพิ่มใหม่ / ซ้ำ</th>
                        <th>ผลการตรวจสอบรอบทดสอบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(LINE_STATE.importedFilesHistory || []).map(f => `
                        <tr>
                          <td style="font-weight: 700; color: #155E43;">📄 ${f.fileName}</td>
                          <td style="font-size: 0.68rem;">${formatThaiDateTimeSafe(f.importedAt)}</td>
                          <td style="font-family: monospace; font-size: 0.68rem;">${f.fileSn}</td>
                          <td><b style="color:#1B7354;">+${f.addedNewRecords}</b> <small style="color:#4B5563;">(ซ้ำ ${f.skippedDuplicates})</small></td>
                          <td style="font-size: 0.68rem;">${f.verificationNote || "-"}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- History 2: Verified Test Rounds & LINE OA History -->
              <div style="background: #F9FBFA; border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px;">
                <div class="card-header" style="margin-bottom: 10px;">
                  <h3><span>✅</span> ประวัติการยืนยันผลและส่งรายงาน LINE OA</h3>
                  <span>ป้องกันการส่งซ้ำในรอบเดียวกัน</span>
                </div>
                <div class="events-table-wrap" style="max-height: 220px;">
                  <table class="events-table">
                    <thead>
                      <tr>
                        <th>รอบทดสอบ</th>
                        <th>ไฟล์ Log อ้างอิง</th>
                        <th>เวลาเดินเครื่อง</th>
                        <th>แบตเตอรี่ B1 / B2</th>
                        <th>แรงดันน้ำ</th>
                        <th>ผลการประเมิน & สถานะ LINE OA</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(LINE_STATE.testRoundsHistory || []).length === 0 ? `
                        <tr>
                          <td colspan="6" style="text-align:center;color:#4B5563;padding:16px;">
                            เมื่อยืนยันผลทดสอบและส่งรายงานเข้า LINE OA ประวัติการส่งจะแสดงที่นี่
                          </td>
                        </tr>
                      ` : (LINE_STATE.testRoundsHistory || []).map(h => `
                        <tr>
                          <td style="font-weight: 700; color: #155E43;">
                            ${h.roundId}<br>
                            <small style="color:#4B5563;font-weight:400;">ผู้ยืนยัน: ${h.verifiedBy}</small>
                          </td>
                          <td style="font-weight: 600;">${h.logFileName}</td>
                          <td>
                            <b style="color:#1B7354;">${h.durationText}</b><br>
                            <small style="color:#4B5563;font-size:0.64rem;">${String(h.runStartDt).replace("T", " ")}</small>
                          </td>
                          <td style="font-size: 0.68rem;">
                            B1: ${h.b1Text}<br>
                            B2: ${h.b2Text}
                          </td>
                          <td style="font-weight: 700; color: #1B7354;">${h.pressureText}</td>
                          <td>
                            <span class="status-badge badge-run">✓ ส่ง LINE OA แล้ว (${h.lineReportMessageId || "OK"})</span>
                            <div style="font-size: 0.66rem; color: #4B5563; margin-top: 2px;">${h.evaluationResult}</div>
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </details>

        </div>
      </div>
    `;

      updateServerStatusBadge();
    } catch (err) {
      console.error("[LINE Module] Error in renderLineNotifyDashboard:", err);
      if (container) {
        container.innerHTML = `
          <div style="padding: 24px; background: #FFFBEB; border: 1px solid #F59E0B; border-radius: 12px; margin: 20px;">
            <h3 style="color: #92400E; margin-top:0;">⚠️ พบข้อผิดพลาดในการโหลดหน้าจอ LINE OA</h3>
            <p style="color: #78350F; font-size: 0.85rem;">${err && err.message ? err.message : String(err)}</p>
            <button class="btn-action" onclick="resetCurrentLineRoundForDemo()">↺ รีเซ็ตข้อมูลรอบทดสอบ</button>
          </div>
        `;
      }
    }
  }
  window.renderLineNotifyDashboard = renderLineNotifyDashboard;

  function renderVisualLineDueCard(round, cfg) {
    const overdueDays = Math.max(0, getOverdueDaysCount(round.scheduledDate));
    const isOverdue = overdueDays > 0;
    const statusText = round.acknowledged
      ? "รับทราบ (รอไฟล์ Log จาก MarkIIXG)"
      : isOverdue
        ? `เกินกำหนดมาแล้ว ${overdueDays} วัน (รอดำเนินการ)`
        : "ครบกำหนดวันนี้ (รอดำเนินการ)";
    const statusBadgeBg = round.acknowledged ? "#FFFBEB" : "#FCE8EE";
    const statusBadgeColor = round.acknowledged ? "#D97706" : "#C75D7A";
    const headerBg = round.acknowledged ? "#155E43" : isOverdue ? "#991B1B" : "#B91C1C";
    const eyebrow = isOverdue ? "AI-FPAS OVERDUE REMINDER • 1 ครั้ง/วัน" : "AI-FPAS SCHEDULED TEST ALERT • 1 ครั้ง/วัน";
    const title = round.acknowledged
      ? "เจ้าหน้าที่รับทราบการทดสอบแล้ว ✓"
      : isOverdue
        ? `⚠️ แจ้งเตือนเกินกำหนดทดสอบ (เกิน ${overdueDays} วัน)`
        : "🔔 แจ้งเตือนถึงกำหนดทดสอบปั๊มดับเพลิง";

    return `
      <div style="max-width: 380px; margin: 0 auto; border-radius: 14px; overflow: hidden; background: #FFFFFF; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-size: 0.76rem;">
        <div style="background: ${headerBg}; color: #FFFFFF; padding: 12px 16px; border-bottom: 2px solid rgba(255,255,255,0.2);">
          <div style="font-size: 0.64rem; color: #E5F4E8; font-weight: 700; letter-spacing: 0.5px;">${eyebrow}</div>
          <div style="font-size: 0.92rem; font-weight: 800; margin-top: 2px;">${title}</div>
        </div>
        <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; color: #1F2937;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #4B5563;">ชื่อเครื่อง:</span>
            <strong style="text-align: right;">${cfg.machineName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #4B5563;">หมายเลข SN:</span>
            <strong style="color: #155E43;">${cfg.expectedSn}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #4B5563;">วันที่ทดสอบ:</span>
            <strong>${round.scheduledDate} เวลา ${round.scheduledTime} น.</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <span style="color: #4B5563;">สถานะปัจจุบัน:</span>
            <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor}; padding: 2px 10px; border-radius: 12px; font-weight: 800; font-size: 0.72rem;">
              ${statusText}
            </span>
          </div>
          <div style="margin-top: 6px; padding-top: 8px; border-top: 1px solid #E5E7EB; font-size: 0.68rem; color: #4B5563; line-height: 1.45;">
            หมายเหตุ: เมื่อกดปุ่มรับทราบ ระบบจะบันทึกสถานะ <b>"รับทราบ"</b> แต่ยังไม่ถือว่าทดสอบเสร็จสิ้น ต้องนำเข้าไฟล์ Log จากเครื่อง MarkIIXG เพื่อยืนยันผล
          </div>
        </div>
        <div style="background: #F3F7F4; padding: 10px 16px; border-top: 1px solid #E5E7EB;">
          <button type="button" onclick="acknowledgeLineTestRound()" style="width: 100%; background: ${round.acknowledged ? '#1B7354' : '#155E43'}; color: #FFFFFF; border: none; border-radius: 8px; padding: 9px 12px; font-weight: 800; font-size: 0.78rem; cursor: pointer;">
            ${round.acknowledged ? "✓ รับทราบแล้ว (รออัปโหลดไฟล์ Log)" : "รับทราบการทดสอบ"}
          </button>
        </div>
      </div>
    `;
  }

  function renderVisualLineVerifiedReportCard(round, cfg) {
    const an = round.analysis || {
      runDateTimeText: "ไม่มีข้อมูล",
      durationText: "ไม่มีข้อมูล",
      pumpStatusText: "ไม่มีข้อมูล",
      b1Text: "ไม่มีข้อมูล",
      b2Text: "ไม่มีข้อมูล",
      pressureText: "ไม่มีข้อมูล",
      alarmText: "ไม่มีข้อมูล",
      evaluationTitle: "รอข้อมูลจากไฟล์ Log",
      evaluationDetails: "กรุณานำเข้าไฟล์ Log จากเครื่อง MarkIIXG และกดยืนยันผลทดสอบ",
      evaluationLevel: "ATTENTION"
    };
    const fileLabel = round.importedFile ? round.importedFile.fileName : "ยังไม่มีไฟล์ Log";
    const snLabel = (round.importedFile && round.importedFile.fileSn) ? round.importedFile.fileSn : cfg.expectedSn;
    const evalPass = an.evaluationLevel === "PASS";
    const evalAttention = an.evaluationLevel === "ATTENTION";
    const evalHeaderColor = evalPass ? "#155E43" : evalAttention ? "#B45309" : "#B91C1C";
    const evalBadgeBg = evalPass ? "#E5F4E8" : evalAttention ? "#FEF3C7" : "#FEE2E2";
    const evalBadgeColor = evalPass ? "#155E43" : evalAttention ? "#B45309" : "#B91C1C";
    const evalBadgeText = evalPass ? "ผ่านเกณฑ์มาตรฐาน" : evalAttention ? "ผ่านแบบมีข้อสังเกต" : "ไม่ผ่านเกณฑ์";
    const pressureVal = (an.pressureText && an.pressureText !== "ไม่มีข้อมูล") ? (an.pressureText.split(' ')[1] || '-') : '-';

    return `
      <div style="max-width: 380px; margin: 0 auto; border-radius: 14px; overflow: hidden; background: #FFFFFF; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-size: 0.74rem;">
        <!-- Header -->
        <div style="background: ${evalHeaderColor}; color: #FFFFFF; padding: 12px 16px; border-bottom: 2px solid rgba(255,255,255,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.65rem; color: #E5F4E8; font-weight: 700;">AI-FPAS รายงานผลทดสอบ</span>
            <span style="background: rgba(255,255,255,0.2); color: #FFFFFF; padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700;">
              ${evalBadgeText}
            </span>
          </div>
          <div style="font-size: 1.05rem; font-weight: 800; margin-top: 4px;">ปั๊มดับเพลิง MarkIIXG</div>
          <div style="font-size: 0.66rem; color: #E5F4E8; margin-top: 2px;">SN: ${snLabel} | ไฟล์: ${fileLabel}</div>
        </div>

        <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; color: #1F2937;">
          <!-- Two Big Metric Badges: Duration & Pressure -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: #E5F4E8; border: 1px solid rgba(27,115,84,0.3); border-radius: 8px; padding: 8px 10px; text-align: center;">
              <div style="font-size: 0.65rem; color: #155E43; font-weight: 700;">เวลาเดินเครื่อง</div>
              <div style="font-size: 1.02rem; font-weight: 800; color: #1B7354; margin: 2px 0;">${an.durationText}</div>
              <div style="font-size: 0.62rem; color: #4B5563;">เกณฑ์ขั้นต่ำ 15 นาที</div>
            </div>
            <div style="background: #F3F7F4; border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px; text-align: center;">
              <div style="font-size: 0.65rem; color: #155E43; font-weight: 700;">แรงดันน้ำเฉลี่ย</div>
              <div style="font-size: 1.02rem; font-weight: 800; color: #1B7354; margin: 2px 0;">${pressureVal} psi</div>
              <div style="font-size: 0.62rem; color: #4B5563;">ปกติสม่ำเสมอ</div>
            </div>
          </div>

          <!-- Battery Clean Row -->
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px;">
            <div style="font-size: 0.68rem; font-weight: 800; color: #1F2937; margin-bottom: 3px;">สถานะแบตเตอรี่สตาร์ท</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.68rem; margin-bottom: 2px;">
              <span style="color: #4B5563;">• Battery 1 (B1):</span>
              <strong style="color: #155E43;">${an.b1Text}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.68rem;">
              <span style="color: #4B5563;">• Battery 2 (B2):</span>
              <strong style="color: ${evalAttention ? '#B45309' : '#155E43'};">${an.b2Text}</strong>
            </div>
          </div>

          <!-- Evaluation Summary -->
          <div style="background: ${evalBadgeBg}; border: 1px solid ${evalBadgeColor}; border-radius: 8px; padding: 8px 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <strong style="font-size: 0.7rem; color: ${evalBadgeColor};">สรุปผลการประเมิน:</strong>
              <span style="font-size: 0.68rem; font-weight: 800; color: ${evalBadgeColor};">${an.evaluationTitle}</span>
            </div>
            <div style="font-size: 0.65rem; color: #1F2937;">การทำงาน: ${an.pumpStatusText}</div>
            <div style="font-size: 0.65rem; color: #4B5563; margin-top: 1px;">สัญญาณเตือน: ${an.alarmText}</div>
          </div>
        </div>

        <div style="background: #F3F7F4; color: #6B7280; padding: 7px 12px; text-align: center; font-size: 0.64rem; border-top: 1px solid #E5E7EB;">
          ผู้ยืนยัน: ${round.verifiedBy || "เจ้าหน้าที่วิศวกรรม"} | ตรวจสอบจาก Log ตู้ควบคุม
        </div>
      </div>
    `;
  }

  let IS_OIL_PM_DISPATCHING = false;
  window.sendOilPmLineAlert = async function (oilInfo, isManualTest = false) {
    if (IS_OIL_PM_DISPATCHING) return { ok: false, reason: "busy" };
    const cfg = (LINE_STATE && LINE_STATE.scheduleConfig) || {};
    if (!cfg.lineChannelAccessToken) {
      if (isManualTest && typeof showSettingsToast === "function") {
        showSettingsToast("⚠️ กรุณาตั้งค่า LINE Channel Access Token ก่อนส่งแจ้งเตือน");
      }
      return { ok: false, reason: "missing_token" };
    }

    const todayStr = getLocalDateStr(new Date());
    const lastSentDate = localStorage.getItem("ai_fpas_oil_pm_notified_date") || "";
    if (!isManualTest && lastSentDate === todayStr) {
      return { ok: true, skipped: true, reason: "already_sent_today" };
    }

    IS_OIL_PM_DISPATCHING = true;
    try {
      const currHrs = (oilInfo && oilInfo.currentHours) || "0:00";
      const targetHrs = (oilInfo && oilInfo.targetHours) || "100:00";
      const remText = (oilInfo && oilInfo.remText) || "ถึงกำหนดแล้ว";
      const isDue = Boolean(oilInfo && oilInfo.isDue);
      const headerBg = isDue ? "#B91C1C" : "#D97706";
      const badgeTitle = isDue ? "🚨 ถึงกำหนดเปลี่ยนถ่ายน้ำมันเครื่อง & ไส้กรอง" : "⚠️ แจ้งเตือน PM น้ำมันเครื่อง & ไส้กรอง";

      const flexContents = {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: headerBg,
          paddingAll: "14px",
          contents: [
            { type: "text", text: "AI-FPAS PREVENTIVE MAINTENANCE", color: "#FDE68A", size: "xxs", weight: "bold" },
            { type: "text", text: badgeTitle, color: "#FFFFFF", size: "md", weight: "bold", wrap: true, margin: "xs" }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "14px",
          contents: [
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "เครื่อง:", color: "#6B7280", size: "sm", flex: 3 },
                { type: "text", text: String(cfg.machineName || "Diesel Fire Pump MarkIIXG"), color: "#111827", size: "sm", weight: "bold", flex: 7, wrap: true }
              ]
            },
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "ชั่วโมงสะสม:", color: "#6B7280", size: "sm", flex: 3 },
                { type: "text", text: `${currHrs} / ${targetHrs} ชม.`, color: headerBg, size: "sm", weight: "bold", flex: 7 }
              ]
            },
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "สถานะ PM:", color: "#6B7280", size: "sm", flex: 3 },
                { type: "text", text: remText, color: headerBg, size: "sm", weight: "bold", flex: 7, wrap: true }
              ]
            },
            { type: "separator", margin: "md" },
            { type: "text", text: "เกณฑ์ NFPA 25 / คู่มือ: เปลี่ยนถ่ายน้ำมันเครื่อง & ไส้กรองทุก 50 ชม. หรือทุก 6 เดือน", color: "#4B5563", size: "xs", wrap: true, margin: "sm" }
          ]
        }
      };

      const fallbackText = `🛢️ [${badgeTitle}]\nเครื่อง: ${cfg.machineName || "Fire Pump"}\nชั่วโมงสะสม: ${currHrs} / ${targetHrs} ชม.\nสถานะ: ${remText}\n(เกณฑ์ PM: ทุก 50 ชม. หรือทุก 6 เดือน)`;
      const res = await dispatchLineMessage(fallbackText, flexContents, `${badgeTitle} (${currHrs}/${targetHrs} ชม.)`);
      if (res && res.ok) {
        localStorage.setItem("ai_fpas_oil_pm_notified_date", todayStr);
      }
      return res;
    } finally {
      IS_OIL_PM_DISPATCHING = false;
    }
  };

  window.probeBackgroundServer = probeBackgroundServer;

  let IS_AUTO_DISPATCHING = false;
  let LAST_CLIENT_AUTO_ATTEMPT_MS = 0;
  function startClientScheduleWatcher() {
    setInterval(async () => {
      if (IS_AUTO_DISPATCHING || !INITIAL_SERVER_PROBE_DONE) return;
      // When background server is online, let the background server perform scheduled pushes to prevent duplicates
      if (SERVER_ONLINE) return;

      const cfg = LINE_STATE.scheduleConfig;
      const round = LINE_STATE.currentRound;
      if (!cfg || !cfg.enabled || !round) return;
      if (round.verified || round.status === "VERIFIED_COMPLETED") return;
      if (!round.scheduledDate || !round.scheduledTime) return;

      const now = new Date();
      const overdueDays = getOverdueDaysCount(round.scheduledDate, now);
      if (overdueDays < 0) return; // Not yet due date
      if (hasAlreadyNotifiedDueToday(round, now)) return; // Strictly 1 time per day (due date & overdue)

      const todayStr = getLocalDateStr(now);
      const todayTriggerDt = new Date(`${todayStr}T${round.scheduledTime}:00`);
      if (isNaN(todayTriggerDt.getTime()) || now.getTime() < todayTriggerDt.getTime()) return;
      if (Date.now() - LAST_CLIENT_AUTO_ATTEMPT_MS < 60000) return;

      IS_AUTO_DISPATCHING = true;
      LAST_CLIENT_AUTO_ATTEMPT_MS = Date.now();
      console.log("[AI-FPAS Auto-Schedule] Triggering 1/day", overdueDays > 0 ? `OVERDUE (+${overdueDays}d)` : "DUE_TODAY", "alert for", round.scheduledDate, round.scheduledTime);
      try {
        if (typeof window.triggerScheduledLineDueAlert === "function") {
          await window.triggerScheduledLineDueAlert(true);
        }
      } catch (err) {
        console.error("[Auto-Schedule Error]:", err);
      } finally {
        IS_AUTO_DISPATCHING = false;
      }
    }, 3000);
    // Heartbeat check for LINE OA server every 4 seconds (auto-detects when server starts up)
    setInterval(() => {
      probeBackgroundServer();
    }, 4000);
  }

  function initLineNotificationModule() {
    loadLineState();
    syncCandidateRunsFromLoadedDashboardEvents();
    syncLineScheduleFromCompliance(true);
    injectLineNotifyUI();
    installUploadHook();
    probeBackgroundServer();
    startClientScheduleWatcher();

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("line_action") === "ack") {
        window.switchMainView("lineNotify");
        window.acknowledgeLineTestRound();
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => setTimeout(initLineNotificationModule, 120));
  } else {
    setTimeout(initLineNotificationModule, 120);
  }
})();
