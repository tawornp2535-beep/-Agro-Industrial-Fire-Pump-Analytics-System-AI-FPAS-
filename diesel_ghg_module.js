// ══════════════════════════════════════════════════════════════════
//  Diesel Fuel & GHG Analytics Module (Green Office Compliance)
//  Agro-Industrial Fire Pump Analytics System (AI-FPAS)
// ══════════════════════════════════════════════════════════════════

const DIESEL_GHG_CONFIG = {
  defaultRate: 20.0, // Default fuel consumption rate (Liters/hour)
  defaultPumpTotal: "0:00", // Total cumulative pump run time from MarkIIXG controller
  fuelTypes: {
    diesel_b7: {
      name: "น้ำมันดีเซลหมุนเร็วทั่วไป / ดีเซล B7",
      ef: 2.7087,
      ref: "TGO บัญชีก๊าซเรือนกระจกประเภทการเผาไหม้แบบอยู่กับที่ (Stationary Combustion)"
    },
    diesel_b10: {
      name: "น้ำมันดีเซล B10",
      ef: 2.5410,
      ref: "TGO บัญชีก๊าซเรือนกระจกประเภทการเผาไหม้แบบอยู่กับที่ (Stationary Combustion)"
    },
    diesel_b20: {
      name: "น้ำมันดีเซล B20",
      ef: 2.2030,
      ref: "TGO บัญชีก๊าซเรือนกระจกประเภทการเผาไหม้แบบอยู่กับที่ (Stationary Combustion)"
    },
    custom: {
      name: "กำหนดค่า Emission Factor เอง (Custom EF)",
      ef: 2.7087,
      ref: "ผู้ใช้งานกำหนดเองตามผลวิเคราะห์ห้องปฏิบัติการ"
    }
  }
};

// Helper: Parse "HH:MM" into decimal hours
function parseHoursMinutesToDecimal(hmStr) {
  if (!hmStr) return 0;
  const str = String(hmStr).trim();
  const parts = str.split(":");
  if (parts.length >= 2) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    return h + (m / 60.0);
  }
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

// 1. Core Analytics Calculation Engine
function computeDieselAndGHGAnalytics(eventsList) {
  // Retrieve settings from localStorage or defaults
  const fuelRate = parseFloat(localStorage.getItem('aifpas_ghg_fuel_rate')) || DIESEL_GHG_CONFIG.defaultRate;
  const fuelTypeKey = localStorage.getItem('aifpas_ghg_fuel_type') || 'diesel_b7';
  let ef = parseFloat(localStorage.getItem('aifpas_ghg_ef'));
  if (isNaN(ef) || ef <= 0) {
    ef = DIESEL_GHG_CONFIG.fuelTypes[fuelTypeKey]?.ef || 2.7087;
  }
  const refText = DIESEL_GHG_CONFIG.fuelTypes[fuelTypeKey]?.ref || "TGO (Stationary Combustion)";

  // Calculation Mode: 'cumulative' (ชั่วโมงรวมทั้งหมด), 'monthly' (รายเดือน), 'per_cycle' (รายครั้ง)
  const calcMode = localStorage.getItem('aifpas_ghg_calc_mode') || 'cumulative';

  // Total Cumulative Pump Run Time (prefer non-zero stored/summary value; never let stale "0:00" mask real Pump Total)
  const hasRealEvents = (typeof CURRENT_EVENTS !== 'undefined' && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0);
  let storedPumpTotal = (localStorage.getItem('aifpas_ghg_pump_total') || "").trim();
  if (!hasRealEvents && storedPumpTotal === "89:50" && typeof DEFAULT_LOG_SUMMARY !== 'undefined' && DEFAULT_LOG_SUMMARY.pump_total === "0:00") {
    localStorage.removeItem('aifpas_ghg_pump_total');
    storedPumpTotal = "";
  }
  const summaryPumpTotal = (typeof DEFAULT_LOG_SUMMARY !== 'undefined' && DEFAULT_LOG_SUMMARY && DEFAULT_LOG_SUMMARY.pump_total && DEFAULT_LOG_SUMMARY.pump_total !== "-")
    ? String(DEFAULT_LOG_SUMMARY.pump_total).trim()
    : "";

  let pumpTotalStr = storedPumpTotal;
  if (parseHoursMinutesToDecimal(pumpTotalStr) <= 0) {
    if (parseHoursMinutesToDecimal(summaryPumpTotal) > 0) {
      pumpTotalStr = summaryPumpTotal;
      if (storedPumpTotal === "0:00") {
        localStorage.setItem('aifpas_ghg_pump_total', pumpTotalStr);
      }
    } else if (!pumpTotalStr) {
      pumpTotalStr = summaryPumpTotal || DIESEL_GHG_CONFIG.defaultPumpTotal;
    }
  }

  // Always use CURRENT_EVENTS when no explicit eventsList is passed (works for logs of any length)
  let targetEvents = eventsList;
  if (!Array.isArray(targetEvents) || targetEvents.length === 0) {
    if (typeof CURRENT_EVENTS !== 'undefined' && Array.isArray(CURRENT_EVENTS) && CURRENT_EVENTS.length > 0) {
      targetEvents = CURRENT_EVENTS;
    } else if (typeof RAW_EVENTS !== 'undefined' && Array.isArray(RAW_EVENTS) && RAW_EVENTS.length > 0) {
      targetEvents = RAW_EVENTS;
    }
  }
  if (!Array.isArray(targetEvents)) targetEvents = [];

  const deduped = typeof deduplicateEvents === 'function' ? deduplicateEvents(targetEvents) : targetEvents;
  const sorted = [...deduped].sort((a, b) => new Date(a.dt) - new Date(b.dt));
  let logDateRangeText = "ยังไม่มีข้อมูล Log";
  if (sorted.length > 0) {
    const firstDtStr = (sorted[0].dt || "").slice(0, 10);
    const lastDtStr = (sorted[sorted.length - 1].dt || "").slice(0, 10);
    logDateRangeText = (firstDtStr && lastDtStr)
      ? (firstDtStr === lastDtStr ? firstDtStr : `${firstDtStr} ถึง ${lastDtStr}`)
      : "ข้อมูลใน Log File";
  }

  // Process Run Cycles from Log (ON = Manual Crank 1/2 Clear, OFF = Main Switch Off / Engine Stopped)
  const cycles = [];
  let runningItem = null;
  let lastSeenCrank = null;
  let lastCrankClearEvent = null;

  for (let i = 0; i < sorted.length; i++) {
    const ev = (sorted[i].event || "").trim();
    if (ev.includes("Manual Crank 1")) {
      lastSeenCrank = "Crank 1";
      if (ev.includes("Clear")) lastCrankClearEvent = sorted[i];
    } else if (ev.includes("Manual Crank 2")) {
      lastSeenCrank = "Crank 2";
      if (ev.includes("Clear")) lastCrankClearEvent = sorted[i];
    }

    if (ev === "Engine Running") {
      if (runningItem) {
        // Previous run had no stop -> Mark Incomplete Cycle (Requirement 8)
        cycles.push({
          idx: cycles.length + 1,
          crank: runningItem.crank || "Auto",
          startDt: runningItem.dt,
          startRaw: runningItem.rawDate || runningItem.dt.replace('T', ' '),
          stopDt: null,
          stopRaw: "-",
          durationSec: null,
          durationHours: 0,
          durationStr: "ข้อมูลไม่เพียงพอ",
          durationShort: "ไม่ระบุ",
          fuelLiters: 0,
          fuelStr: "ข้อมูลไม่เพียงพอ",
          ghgKg: 0,
          ghgStr: "ข้อมูลไม่เพียงพอ",
          psi: runningItem.psi,
          status: "incomplete",
          note: "ไม่พบข้อมูลเวลาดับเครื่อง (Engine Stopped)"
        });
      }
      const startEv = lastCrankClearEvent || sorted[i];
      runningItem = {
        dt: startEv.dt,
        rawDate: startEv.rawDate,
        psi: sorted[i].psi,
        crank: lastSeenCrank || "Auto"
      };
      lastSeenCrank = null;
      lastCrankClearEvent = null;
    } else if ((ev === "Engine Stopped" || ev === "Main Switch Off") && runningItem) {
      const stopDt = sorted[i].dt;
      const stopRaw = sorted[i].rawDate || stopDt.replace('T', ' ');
      const diffMs = new Date(stopDt) - new Date(runningItem.dt);
      const sec = Math.round(diffMs / 1000);

      if (sec > 0) {
        const hrs = sec / 3600.0;
        const fuel = hrs * fuelRate;
        const ghg = fuel * ef;
        const m = Math.floor(sec / 60);
        const s = sec % 60;

        cycles.push({
          idx: cycles.length + 1,
          crank: runningItem.crank,
          startDt: runningItem.dt,
          startRaw: runningItem.rawDate || runningItem.dt.replace('T', ' '),
          stopDt: stopDt,
          stopRaw: stopRaw,
          durationSec: sec,
          durationHours: hrs,
          durationStr: `${m} นาที ${s} วินาที`,
          durationShort: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} นาที`,
          fuelLiters: fuel,
          fuelStr: fuel.toFixed(2) + " ลิตร",
          ghgKg: ghg,
          ghgStr: ghg.toFixed(2) + " kgCO₂e",
          psi: runningItem.psi,
          status: "complete",
          note: "ข้อมูลสมบูรณ์"
        });
      } else {
        cycles.push({
          idx: cycles.length + 1,
          crank: runningItem.crank,
          startDt: runningItem.dt,
          startRaw: runningItem.rawDate || runningItem.dt.replace('T', ' '),
          stopDt: stopDt,
          stopRaw: stopRaw,
          durationSec: null,
          durationHours: 0,
          durationStr: "ข้อมูลไม่เพียงพอ",
          durationShort: "ไม่ระบุ",
          fuelLiters: 0,
          fuelStr: "ข้อมูลไม่เพียงพอ",
          ghgKg: 0,
          ghgStr: "ข้อมูลไม่เพียงพอ",
          psi: runningItem.psi,
          status: "incomplete",
          note: "เวลาหยุดเครื่องไม่สอดคล้องกับเวลาเริ่ม"
        });
      }
      runningItem = null;
    } else if ((ev === "Main Switch Off" || ev === "Engine Stopped") && !runningItem) {
      lastSeenCrank = null;
      lastCrankClearEvent = null;
    }
  }

  // Trailing running event without stop
  if (runningItem) {
    cycles.push({
      idx: cycles.length + 1,
      crank: runningItem.crank,
      startDt: runningItem.dt,
      startRaw: runningItem.rawDate || runningItem.dt.replace('T', ' '),
      stopDt: null,
      stopRaw: "-",
      durationSec: null,
      durationHours: 0,
      durationStr: "ข้อมูลไม่เพียงพอ",
      durationShort: "ไม่ระบุ",
      fuelLiters: 0,
      fuelStr: "ข้อมูลไม่เพียงพอ",
      ghgKg: 0,
      ghgStr: "ข้อมูลไม่เพียงพอ",
      psi: runningItem.psi,
      status: "incomplete",
      note: "เครื่องยนต์ยังไม่หยุดทำงาน หรือไม่มีบันทึกเวลาหยุด"
    });
  }

  // Complete vs Incomplete
  const completeCycles = cycles.filter(c => c.status === "complete");
  const incompleteCycles = cycles.filter(c => c.status === "incomplete");

  // Sum Log Period totals
  const logTotalSec = completeCycles.reduce((sum, c) => sum + c.durationSec, 0);
  const logTotalHours = logTotalSec / 3600.0;
  const logTotalFuel = completeCycles.reduce((sum, c) => sum + c.fuelLiters, 0);
  const logTotalGhg = completeCycles.reduce((sum, c) => sum + c.ghgKg, 0);
  const logTotalTons = logTotalGhg / 1000.0;

  // Fallback: if Pump Total header is "0:00" or missing while real engine run cycles exist in Log, compute HH:MM from logTotalSec
  if (parseHoursMinutesToDecimal(pumpTotalStr) <= 0 && logTotalSec > 0) {
    const totalMins = Math.round(logTotalSec / 60);
    pumpTotalStr = `${Math.floor(totalMins / 60)}:${String(totalMins % 60).padStart(2, '0')}`;
  }
  const cumulativeHoursDec = parseHoursMinutesToDecimal(pumpTotalStr);
  const cumulativeFuel = cumulativeHoursDec * fuelRate;
  const cumulativeGhg = cumulativeFuel * ef;
  const cumulativeTons = cumulativeGhg / 1000.0;

  // Format log duration
  const logHoursInt = Math.floor(logTotalSec / 3600);
  const logMinutesInt = Math.floor((logTotalSec % 3600) / 60);
  const logSecondsInt = logTotalSec % 60;
  let logRuntimeStr = "";
  if (logHoursInt > 0) logRuntimeStr += `${logHoursInt} ชม. `;
  logRuntimeStr += `${logMinutesInt} นาที ${logSecondsInt} วินาที`;

  // Monthly Grouping
  const monthlyMap = {};
  completeCycles.forEach(c => {
    const ym = c.startDt.substring(0, 7); // YYYY-MM
    if (!monthlyMap[ym]) {
      monthlyMap[ym] = {
        ym: ym,
        cycles: 0,
        sec: 0,
        fuel: 0,
        ghg: 0
      };
    }
    monthlyMap[ym].cycles++;
    monthlyMap[ym].sec += c.durationSec;
    monthlyMap[ym].fuel += c.fuelLiters;
    monthlyMap[ym].ghg += c.ghgKg;
  });

  const monthlyData = Object.keys(monthlyMap).sort().map(k => monthlyMap[k]);

  // Actual Refill Log from localStorage
  let refillLog = [];
  try {
    const saved = localStorage.getItem('aifpas_diesel_refill_log');
    if (saved) refillLog = JSON.parse(saved);
  } catch (e) {
    refillLog = [];
  }

  // Active Scope Numbers based on calcMode
  let activeHoursStr = "";
  let activeHoursDec = 0;
  let activeFuel = 0;
  let activeGhg = 0;
  let activeTons = 0;
  let activeSubText = "";

  if (calcMode === 'cumulative') {
    activeHoursStr = `${pumpTotalStr} ชม.`;
    activeHoursDec = cumulativeHoursDec;
    activeFuel = cumulativeFuel;
    activeGhg = cumulativeGhg;
    activeTons = cumulativeTons;
    activeSubText = `ชั่วโมงรวมสะสมทั้งหมดของตู้ MarkIIXG (${cumulativeHoursDec.toFixed(2)} ชม.)`;
  } else if (calcMode === 'monthly') {
    activeHoursStr = logRuntimeStr;
    activeHoursDec = logTotalHours;
    activeFuel = logTotalFuel;
    activeGhg = logTotalGhg;
    activeTons = logTotalTons;
    activeSubText = `สรุป ${monthlyData.length} เดือนใน Log File (เฉลี่ย ${(logTotalFuel / (monthlyData.length || 1)).toFixed(1)} L/เดือน)`;
  } else {
    // per_cycle
    activeHoursStr = logRuntimeStr;
    activeHoursDec = logTotalHours;
    activeFuel = logTotalFuel;
    activeGhg = logTotalGhg;
    activeTons = logTotalTons;
    activeSubText = `เจาะลึก ${completeCycles.length} รอบการเดินเครื่องจริง (เฉลี่ย ${(logTotalFuel / (completeCycles.length || 1)).toFixed(2)} L/รอบ)`;
  }

  return {
    calcMode,
    fuelRate,
    fuelTypeKey,
    ef,
    refText,
    pumpTotalStr,
    logDateRangeText,
    cumulativeHoursDec,
    cumulativeFuel,
    cumulativeGhg,
    cumulativeTons,
    // Log totals
    logTotalSec,
    logTotalHours,
    logTotalFuel,
    logTotalGhg,
    logTotalTons,
    logRuntimeStr,
    // Active selection
    activeHoursStr,
    activeHoursDec,
    activeFuel,
    activeGhg,
    activeTons,
    activeSubText,
    // Collections
    cycles,
    completeCycles,
    incompleteCycles,
    monthlyData,
    refillLog
  };
}

// 2. Mode Switcher Handler
function setGhgCalcMode(mode) {
  localStorage.setItem('aifpas_ghg_calc_mode', mode);
  updateDieselGHGAnalytics();
}

// 3. Update Sidebar Badge & Global Status
function updateDieselGHGPanel(events) {
  const stats = computeDieselAndGHGAnalytics(events);

  // Update Sidebar Menu Sub-label
  const navSub = document.getElementById("navDieselGHGSub");
  if (navSub) {
    if (stats.calcMode === 'cumulative') {
      navSub.textContent = `${stats.pumpTotalStr} ชม. • ${stats.cumulativeFuel.toFixed(1)} L`;
      navSub.title = `ชั่วโมงรวมสะสม: ${stats.pumpTotalStr} ชม. | น้ำมัน: ${stats.cumulativeFuel.toFixed(1)} ลิตร | GHG: ${stats.cumulativeGhg.toFixed(1)} kgCO₂e`;
    } else if (stats.calcMode === 'monthly') {
      navSub.textContent = `${stats.monthlyData.length} เดือน • ${stats.logTotalFuel.toFixed(1)} L`;
      navSub.title = `สรุปรายเดือน: ${stats.monthlyData.length} เดือน | น้ำมัน: ${stats.logTotalFuel.toFixed(1)} ลิตร | GHG: ${stats.logTotalGhg.toFixed(1)} kgCO₂e`;
    } else {
      navSub.textContent = `${stats.completeCycles.length} รอบ • ${stats.logTotalFuel.toFixed(1)} L`;
      navSub.title = `เจาะลึกรายครั้ง: ${stats.completeCycles.length} รอบ | น้ำมัน: ${stats.logTotalFuel.toFixed(1)} ลิตร | GHG: ${stats.logTotalGhg.toFixed(1)} kgCO₂e`;
    }
  }
}

// 4. Modal Open & Render
function openDieselGHGModal() {
  if (typeof switchMainView === "function") {
    switchMainView("dieselGHG");
  } else {
    openModal('modalDieselGHG');
    renderDieselGHGModal();
  }
}

function updateDieselGHGAnalytics(fromPumpInput = false) {
  const rateInput = document.getElementById("ghgFuelRateInput");
  if (rateInput) {
    const val = parseFloat(rateInput.value);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem('aifpas_ghg_fuel_rate', val);
    }
  }

  const efInput = document.getElementById("ghgEmissionFactorInput");
  const typeSelect = document.getElementById("ghgFuelTypeSelect");
  if (efInput && typeSelect && typeSelect.value === 'custom') {
    const efVal = parseFloat(efInput.value);
    if (!isNaN(efVal) && efVal > 0) {
      localStorage.setItem('aifpas_ghg_ef', efVal);
    }
  }

  const pumpTotalInput = document.getElementById("ghgPumpTotalInput");
  if (pumpTotalInput && pumpTotalInput.value) {
    const trimmedPump = pumpTotalInput.value.trim();
    const curStored = (localStorage.getItem('aifpas_ghg_pump_total') || "").trim();
    const sumVal = (typeof DEFAULT_LOG_SUMMARY !== 'undefined' && DEFAULT_LOG_SUMMARY && DEFAULT_LOG_SUMMARY.pump_total) ? String(DEFAULT_LOG_SUMMARY.pump_total).trim() : "";
    const isStaleZero = (trimmedPump === "0:00" && (parseHoursMinutesToDecimal(curStored) > 0 || parseHoursMinutesToDecimal(sumVal) > 0));
    if (fromPumpInput === true || !isStaleZero) {
      if (trimmedPump !== "0:00" || fromPumpInput === true) {
        localStorage.setItem('aifpas_ghg_pump_total', trimmedPump);
      }
    }
  }

  renderDieselGHGModal();
  updateDieselGHGPanel();
}

function onGhgFuelTypeChange() {
  const typeSelect = document.getElementById("ghgFuelTypeSelect");
  if (!typeSelect) return;

  const key = typeSelect.value;
  localStorage.setItem('aifpas_ghg_fuel_type', key);

  const efInput = document.getElementById("ghgEmissionFactorInput");
  const refDisplay = document.getElementById("ghgReferenceText");

  if (key === 'custom') {
    if (efInput) efInput.readOnly = false;
    if (refDisplay) refDisplay.textContent = DIESEL_GHG_CONFIG.fuelTypes.custom.ref;
  } else {
    const item = DIESEL_GHG_CONFIG.fuelTypes[key];
    if (efInput) {
      efInput.value = item.ef.toFixed(4);
      efInput.readOnly = true;
      localStorage.setItem('aifpas_ghg_ef', item.ef);
    }
    if (refDisplay) refDisplay.textContent = item.ref;
  }

  updateDieselGHGAnalytics();
}

// 5. Main Modal Rendering
function renderDieselGHGModal() {
  const container = document.getElementById("dieselGHGModalContent");
  if (!container) return;

  const stats = computeDieselAndGHGAnalytics();

  // Mode Switcher Buttons UI
  const modeBtns = ["cumulative", "monthly", "per_cycle"];
  modeBtns.forEach(m => {
    const btn = document.getElementById(`modeBtn_${m}`);
    if (btn) {
      if (stats.calcMode === m) {
        btn.style.background = "var(--bg-highlight)";
        btn.style.borderColor = "var(--accent-pink)";
        btn.style.color = "var(--text-primary)";
        btn.style.fontWeight = "800";
      } else {
        btn.style.background = "#FFFFFF";
        btn.style.borderColor = "var(--panel-border)";
        btn.style.color = "var(--text-secondary)";
        btn.style.fontWeight = "500";
      }
    }
  });

  // Update dynamic mode button subtitles
  const cumSub = document.getElementById("ghgModeBtnCumSub");
  if (cumSub) cumSub.textContent = `Pump Total: ${stats.pumpTotalStr} ชม. (~${stats.cumulativeFuel.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L)`;
  const monSub = document.getElementById("ghgModeBtnMonthlySub");
  if (monSub) monSub.textContent = stats.monthlyData.length ? `แยกข้อมูลจริง (${stats.monthlyData.length} เดือน)` : `ยังไม่มีข้อมูลรายเดือน (0 เดือน)`;
  const cycSub = document.getElementById("ghgModeBtnCycleSub");
  if (cycSub) cycSub.textContent = `${stats.cycles.length} รอบเดินเครื่องจริงจาก Log File`;

  // Update Config Inputs if existing
  const rateInput = document.getElementById("ghgFuelRateInput");
  if (rateInput && document.activeElement !== rateInput) rateInput.value = stats.fuelRate.toFixed(1);
  const typeSelect = document.getElementById("ghgFuelTypeSelect");
  if (typeSelect) typeSelect.value = stats.fuelTypeKey;
  const efInput = document.getElementById("ghgEmissionFactorInput");
  if (efInput && document.activeElement !== efInput) {
    efInput.value = stats.ef.toFixed(4);
    efInput.readOnly = (stats.fuelTypeKey !== 'custom');
  }
  const refDisplay = document.getElementById("ghgReferenceText");
  if (refDisplay) refDisplay.textContent = stats.refText;
  const pumpTotalInput = document.getElementById("ghgPumpTotalInput");
  if (pumpTotalInput && document.activeElement !== pumpTotalInput) pumpTotalInput.value = stats.pumpTotalStr;

  // Stat Highlights in Modal according to active calculation mode
  const mHours = document.getElementById("ghgModalTotalHours");
  if (mHours) {
    mHours.innerHTML = `${stats.activeHoursStr} <small style="font-size:0.65rem;color:var(--text-secondary)">(${stats.activeHoursDec.toFixed(2)} ชม.)</small>`;
  }

  const mFuel = document.getElementById("ghgModalTotalFuel");
  if (mFuel) {
    mFuel.innerHTML = `${stats.activeFuel.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">ลิตร</span>`;
  }

  const mGhg = document.getElementById("ghgModalTotalGhg");
  if (mGhg) {
    mGhg.innerHTML = `${stats.activeGhg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">kgCO₂e</span>`;
  }

  const mGhgTons = document.getElementById("ghgModalTotalTons");
  if (mGhgTons) {
    mGhgTons.textContent = `${stats.activeTons.toFixed(4)} tCO₂e`;
  }

  const mCycles = document.getElementById("ghgModalCyclesCount");
  if (mCycles) {
    if (stats.calcMode === 'cumulative') {
      mCycles.innerHTML = `<span style="color:var(--accent-cyan)">รวมชั่วโมงสะสมทั้งหมด</span>`;
    } else if (stats.calcMode === 'monthly') {
      mCycles.innerHTML = `<span style="color:var(--accent-orange)">${stats.monthlyData.length} เดือนใน Log File</span>`;
    } else {
      if (stats.incompleteCycles.length > 0) {
        mCycles.innerHTML = `<span style="color:var(--accent-green)">${stats.completeCycles.length} สมบูรณ์</span> | <span style="color:var(--accent-red)">⚠️ ${stats.incompleteCycles.length} ไม่เพียงพอ</span>`;
      } else {
        mCycles.innerHTML = `<span style="color:var(--accent-green)">${stats.completeCycles.length} รอบ (สมบูรณ์ 100%)</span>`;
      }
    }
  }

  // Mascot Insight Text dynamically adapting to the selected mode
  const mascotTxt = document.getElementById("ghgMascotInsightText");
  if (mascotTxt) {
    let modeExplanation = "";
    if (stats.cycles.length === 0 && stats.cumulativeHoursDec <= 0) {
      modeExplanation = `ยังไม่มีข้อมูลการเดินเครื่องยนต์และชั่วโมงสะสมในระบบ กรุณานำเข้าไฟล์ Log (<code>.txt</code>) จริงจากตู้ควบคุม MarkIIXG หรือกรอกค่า Pump Total Hours ด้านบนเพื่อเริ่มคำนวณ`;
    } else if (stats.calcMode === 'cumulative') {
      modeExplanation = `คำนวณจาก <b>ชั่วโมงเดินเครื่องรวมสะสมของตู้ MarkIIXG (${stats.pumpTotalStr} ชม.)</b> ส่งผลให้เกิดการใช้น้ำมันสะสมทั้งหมด <b>${stats.cumulativeFuel.toFixed(2)} ลิตร</b> คิดเป็นการปล่อยก๊าซเรือนกระจกสะสม <b>${stats.cumulativeGhg.toFixed(2)} kgCO₂e (${stats.cumulativeTons.toFixed(4)} tCO₂e)</b> เหมาะสำหรับการรายงานภาพรวมประจำปีของโรงงาน`;
    } else if (stats.calcMode === 'monthly') {
      modeExplanation = `คำนวณจาก <b>สรุปรายเดือนใน Log File (${stats.monthlyData.length} เดือน)</b> รวมเดินเครื่อง <b>${stats.logRuntimeStr}</b> ใช้น้ำมันรวม <b>${stats.logTotalFuel.toFixed(2)} ลิตร</b> ปล่อยก๊าซเรือนกระจก <b>${stats.logTotalGhg.toFixed(2)} kgCO₂e</b> มีอัตราการใช้น้ำมันเฉลี่ย ${(stats.logTotalFuel / (stats.monthlyData.length || 1)).toFixed(2)} ลิตร/เดือน เหมาะสำหรับการทำแนวโน้ม Carbon Footprint ประจำไตรมาส`;
    } else {
      const intactText = stats.incompleteCycles.length > 0
        ? `พบข้อมูลสมบูรณ์ ${stats.completeCycles.length} รอบ และข้อมูลไม่เพียงพอ ${stats.incompleteCycles.length} รอบ`
        : `ตรวจสอบแล้วข้อมูลสมบูรณ์ 100% ไม่มีข้อมูลสูญหาย`;
      modeExplanation = `คำนวณแบบ <b>เจาะลึกรายครั้ง (${stats.completeCycles.length} รอบเดินเครื่องจริง)</b> จากคู่เหตุการณ์ Engine Running ↔ Engine Stopped ใน Log File รวมระยะเวลารัน <b>${stats.logRuntimeStr}</b> ใช้น้ำมัน <b>${stats.logTotalFuel.toFixed(2)} ลิตร</b> ปล่อยก๊าซเรือนกระจก <b>${stats.logTotalGhg.toFixed(2)} kgCO₂e</b> ${intactText}`;
    }

    mascotTxt.innerHTML = `
      <strong>💡 ข้อเสนอแนะเชิงวิศวกรรมและการรับรองสำนักงานสีเขียว (Green Office หมวด 4.3):</strong><br>
      • <em>โหมดการคำนวณปัจจุบัน:</em> ${modeExplanation}<br>
      • <em>ค่าสัมประสิทธิ์ที่ใช้:</em> อ้างอิงเกณฑ์ TGO สัมประสิทธิ์ <b>${stats.ef} kgCO₂e/ลิตร</b> (อัตราสิ้นเปลือง ${stats.fuelRate.toFixed(1)} ลิตร/ชม.)<br>
      • <em>การกระทบยอดหน้างาน:</em> สามารถสลับไปที่แท็บ <b>Actual Refill Log</b> เพื่อบันทึกน้ำมันที่เติมจริงและเปรียบเทียบส่วนต่าง (Variance) ตามเกณฑ์สำนักงานสีเขียว
    `;
  }

  // Toggle mode views in Calculated Tab
  const viewCumulative = document.getElementById("ghgViewCumulative");
  const viewMonthly = document.getElementById("ghgViewMonthly");
  const viewPerCycle = document.getElementById("ghgViewPerCycle");

  if (viewCumulative) viewCumulative.style.display = (stats.calcMode === 'cumulative') ? 'block' : 'none';
  if (viewMonthly) viewMonthly.style.display = (stats.calcMode === 'monthly') ? 'block' : 'none';
  if (viewPerCycle) viewPerCycle.style.display = (stats.calcMode === 'per_cycle') ? 'block' : 'none';

  // Render Cumulative Sub-Dashboard if in cumulative mode
  renderCumulativeDashboard(stats);

  // Render Monthly Table & Chart
  renderMonthlyGhgTable(stats.monthlyData);

  // Render Detailed Cycles Table
  renderDetailedCyclesTable(stats.cycles);

  // Render Refill Log Table & Variance
  const totalRefLiters = stats.calcMode === 'cumulative' ? stats.cumulativeFuel : stats.logTotalFuel;
  renderRefillLogTable(stats.refillLog, stats.ef, totalRefLiters);

  // Draw Canvas Chart
  setTimeout(() => {
    drawGhgMonthlyChart(stats.monthlyData);
  }, 100);
}

// 6. Cumulative Overview Sub-Dashboard
function renderCumulativeDashboard(stats) {
  const container = document.getElementById("ghgCumulativeContent");
  if (!container) return;

  const logRatio = stats.cumulativeHoursDec > 0 ? ((stats.logTotalHours / stats.cumulativeHoursDec) * 100).toFixed(1) : "0.0";
  const barrelCount = (stats.cumulativeFuel / 158.987).toFixed(2); // 1 barrel = 158.987 liters

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;margin-bottom:12px;">
      
      <!-- Card 1: Ratio of Log vs Total -->
      <div style="background:#FFFFFF;border:1px solid var(--panel-border);box-shadow:var(--card-shadow);border-radius:10px;padding:12px;">
        <div style="font-size:0.75rem;color:var(--color-dark-green);font-weight:700;margin-bottom:6px;">
          ⏱️ สัดส่วนชั่วโมงเดินเครื่องในระบบ
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:4px;">
          <span>ชั่วโมงรวมสะสมทั้งหมด (MarkIIXG):</span>
          <b style="color:var(--text-primary);">${stats.pumpTotalStr} ชม.</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:6px;">
          <span>ช่วงเวลาใน Log File (${stats.logDateRangeText || '-'}):</span>
          <b style="color:var(--accent-orange);">${stats.logRuntimeStr} (${logRatio}%)</b>
        </div>
        <div style="width:100%;height:8px;background:rgba(21, 94, 67,0.1);border-radius:4px;overflow:hidden;">
          <div style="width:${Math.min(100, parseFloat(logRatio))}%;height:100%;background:linear-gradient(90deg,var(--accent-pink),var(--color-dark-green));"></div>
        </div>
        <div style="font-size:0.65rem;color:var(--text-secondary);margin-top:6px;">
          * ปั๊มสะสมเดินเครื่องก่อนหน้าช่วงไฟล์ Log นี้ประมาณ ${Math.max(0, stats.cumulativeHoursDec - stats.logTotalHours).toFixed(2)} ชม.
        </div>
      </div>

      <!-- Card 2: Fuel Volume & Equivalent -->
      <div style="background:#FFFFFF;border:1px solid rgba(27, 115, 84,0.35);box-shadow:var(--card-shadow);border-radius:10px;padding:12px;">
        <div style="font-size:0.75rem;color:var(--accent-pink);font-weight:700;margin-bottom:6px;">
          🛢️ ปริมาณน้ำมันและค่าเทียบเท่า
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:4px;">
          <span>น้ำมันดีเซลรวมสะสม:</span>
          <b style="color:var(--accent-pink);font-size:0.9rem;">${stats.cumulativeFuel.toFixed(2)} ลิตร</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:4px;">
          <span>เทียบเท่าถังบาร์เรล (BBL):</span>
          <b style="color:var(--text-primary);">${barrelCount} บาร์เรล</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;">
          <span>อัตราใช้น้ำมันเฉลี่ย:</span>
          <b style="color:var(--accent-green);">${stats.fuelRate.toFixed(1)} ลิตร/ชม.</b>
        </div>
      </div>

      <!-- Card 3: GHG Footprint Scope 1 -->
      <div style="background:#FFFFFF;border:1px solid rgba(46,125,50,0.35);box-shadow:var(--card-shadow);border-radius:10px;padding:12px;">
        <div style="font-size:0.75rem;color:var(--accent-green);font-weight:700;margin-bottom:6px;">
          🌱 การปล่อยคาร์บอนรวม (Scope 1)
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:4px;">
          <span>ก๊าซเรือนกระจกสะสม:</span>
          <b style="color:var(--accent-green);font-size:0.9rem;">${stats.cumulativeGhg.toFixed(2)} kgCO₂e</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:4px;">
          <span>เทียบเท่าตันคาร์บอน:</span>
          <b style="color:var(--color-dark-green);">${stats.cumulativeTons.toFixed(4)} tCO₂e</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;">
          <span>สัมประสิทธิ์ TGO ที่ใช้:</span>
          <b style="color:var(--text-primary);">${stats.ef.toFixed(4)} kgCO₂e/L</b>
        </div>
      </div>

    </div>
  `;
}

// 7. Monthly Breakdown Table
function renderMonthlyGhgTable(monthlyData) {
  const tbody = document.getElementById("ghgMonthlyTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const monthNames = {
    "01": "มกราคม", "02": "กุมภาพันธ์", "03": "มีนาคม", "04": "เมษายน",
    "05": "พฤษภาคม", "06": "มิถุนายน", "07": "กรกฎาคม", "08": "สิงหาคม",
    "09": "กันยายน", "10": "ตุลาคม", "11": "พฤศจิกายน", "12": "ธันวาคม"
  };

  if (!monthlyData || monthlyData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:14px;">ไม่พบข้อมูลรายเดือนใน Log File</td></tr>`;
    return;
  }

  monthlyData.forEach(d => {
    const parts = d.ym.split("-");
    const ym = d.ym;
    const yearBE = parseInt(parts[0]) + 543;
    const monthThai = `${monthNames[parts[1]] || parts[1]} ${yearBE}`;
    const hrs = d.sec / 3600.0;
    const m = Math.floor(d.sec / 60);
    const s = d.sec % 60;
    const durStr = `${m} นาที ${s} วินาที`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700;color:var(--text-primary);">${monthThai} <small style="color:var(--text-secondary)">(${ym})</small></td>
      <td style="text-align:center;"><span class="status-badge" style="background:rgba(0,119,255,0.15);color:var(--accent-cyan);padding:2px 8px;">${d.cycles} รอบ</span></td>
      <td style="color:var(--accent-cyan);font-family:monospace;">${durStr} (${hrs.toFixed(2)} ชม.)</td>
      <td style="color:var(--accent-orange);font-weight:700;">${d.fuel.toFixed(2)} ลิตร</td>
      <td style="color:var(--accent-green);font-weight:700;">${d.ghg.toFixed(2)} kgCO₂e</td>
      <td style="color:var(--text-secondary);">${(d.ghg / 1000.0).toFixed(4)} tCO₂e</td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. Detailed Run Sessions Table
function renderDetailedCyclesTable(cycles, filterQuery) {
  const tbody = document.getElementById("ghgDetailedCyclesTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const query = (filterQuery || "").toLowerCase().trim();
  const filtered = cycles.filter(c => {
    if (!query) return true;
    return c.startRaw.toLowerCase().includes(query) ||
           c.stopRaw.toLowerCase().includes(query) ||
           c.crank.toLowerCase().includes(query) ||
           c.status.toLowerCase().includes(query) ||
           c.note.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-secondary);padding:14px;">ไม่พบข้อมูลรอบการรันที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  filtered.forEach(c => {
    const isComplete = c.status === "complete";
    const statusBadge = isComplete
      ? `<span class="status-badge" style="background:rgba(0,230,118,0.15);color:var(--accent-green);border:1px solid rgba(0,230,118,0.4);font-size:0.65rem;padding:2px 8px;">🟢 ข้อมูลสมบูรณ์</span>`
      : `<span class="status-badge" style="background:rgba(255,61,113,0.15);color:var(--accent-red);border:1px solid rgba(255,61,113,0.4);font-size:0.65rem;padding:2px 8px;" title="${c.note}">⚠️ ข้อมูลไม่เพียงพอ</span>`;

    let crankBadge = "";
    if (c.crank === "Crank 1") {
      crankBadge = `<span class="status-badge" style="background:var(--bg-highlight);color:var(--accent-pink);padding:2px 6px;font-size:0.65rem;">⚡ Crank 1 (B1)</span>`;
    } else if (c.crank === "Crank 2") {
      crankBadge = `<span class="status-badge" style="background:rgba(255,145,0,0.15);color:var(--accent-orange);padding:2px 6px;font-size:0.65rem;">⚡ Crank 2 (B2)</span>`;
    } else {
      crankBadge = `<span class="status-badge" style="background:rgba(0,230,118,0.15);color:var(--accent-green);padding:2px 6px;font-size:0.65rem;">⚙️ Auto</span>`;
    }

    const tr = document.createElement("tr");
    if (!isComplete) tr.style.background = "rgba(255, 61, 113, 0.05)";

    tr.innerHTML = `
      <td style="color:var(--text-secondary);font-weight:700;text-align:center;">${c.idx}</td>
      <td>${crankBadge}</td>
      <td style="color:var(--accent-green);font-family:monospace;font-size:0.75rem;">${c.startRaw}</td>
      <td style="color:${isComplete ? 'var(--accent-red)' : 'var(--text-secondary)'};font-family:monospace;font-size:0.75rem;">${c.stopRaw}</td>
      <td style="font-weight:700;color:${isComplete ? 'var(--accent-cyan)' : 'var(--accent-red)'};">${c.durationStr}</td>
      <td style="color:${isComplete ? 'var(--text-primary)' : 'var(--text-secondary)'};">${isComplete ? c.durationHours.toFixed(4) + ' ชม.' : '-'}</td>
      <td style="color:${isComplete ? 'var(--accent-orange)' : 'var(--text-secondary)'};font-weight:700;">${c.fuelStr}</td>
      <td style="color:${isComplete ? 'var(--accent-green)' : 'var(--text-secondary)'};font-weight:700;">${c.ghgStr}</td>
      <td style="text-align:center;">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterDieselSessionsTable(val) {
  const stats = computeDieselAndGHGAnalytics();
  renderDetailedCyclesTable(stats.cycles, val);
}

// 9. Refill Log & Variance Analysis (Requirement 9)
function renderRefillLogTable(refillLog, ef, totalCalcLiters) {
  const tbody = document.getElementById("ghgRefillTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const totalActual = refillLog.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);
  const totalActualGhg = totalActual * ef;
  const varianceL = totalActual > 0 ? (totalActual - totalCalcLiters) : 0;
  const variancePct = totalCalcLiters > 0 && totalActual > 0 ? ((varianceL / totalCalcLiters) * 100) : 0;

  // Update Variance Summary Boxes
  const actLitersEl = document.getElementById("ghgActualTotalLiters");
  if (actLitersEl) actLitersEl.innerHTML = `${totalActual.toFixed(2)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">ลิตร</span>`;

  const actGhgEl = document.getElementById("ghgActualTotalGhg");
  if (actGhgEl) actGhgEl.innerHTML = `${totalActualGhg.toFixed(2)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">kgCO₂e</span>`;

  const varLitersEl = document.getElementById("ghgVarianceLiters");
  if (varLitersEl) {
    const sign = varianceL > 0 ? "+" : "";
    const color = Math.abs(variancePct) <= 10 ? "var(--accent-green)" : (varianceL > 0 ? "var(--accent-orange)" : "var(--accent-red)");
    varLitersEl.innerHTML = `<span style="color:${color}">${sign}${varianceL.toFixed(2)} ลิตร (${sign}${variancePct.toFixed(1)}%)</span>`;
  }

  if (refillLog.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:14px;">ยังไม่มีประวัติการบันทึกการเติมน้ำมันจริงหน้างาน (สามารถกดเพิ่มบันทึกด้านบน)</td></tr>`;
    return;
  }

  refillLog.forEach((r, idx) => {
    const l = parseFloat(r.liters) || 0;
    const ghg = l * ef;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:var(--text-secondary);text-align:center;">${idx + 1}</td>
      <td style="font-family:monospace;color:var(--accent-cyan);">${r.date}</td>
      <td style="color:var(--accent-green);font-weight:700;">${l.toFixed(2)} ลิตร</td>
      <td style="color:var(--accent-orange);">${ghg.toFixed(2)} kgCO₂e</td>
      <td style="color:var(--text-secondary);">${r.meter || '-'}</td>
      <td style="color:var(--text-primary);">${r.officer || '-'} <small style="color:var(--text-secondary);">(${r.note || '-'})</small></td>
      <td style="text-align:center;">
        <button onclick="deleteActualRefillRecord(${idx})" style="background:rgba(255,61,113,0.15);border:1px solid rgba(255,61,113,0.3);color:var(--accent-red);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.7rem;">ลบ</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addActualRefillRecord() {
  const dateInput = document.getElementById("refillDateInput");
  const literInput = document.getElementById("refillLiterInput");
  const meterInput = document.getElementById("refillMeterInput");
  const officerInput = document.getElementById("refillOfficerInput");
  const noteInput = document.getElementById("refillNoteInput");

  const liters = parseFloat(literInput?.value);
  if (isNaN(liters) || liters <= 0) {
    alert("กรุณากรอกปริมาณน้ำมันที่เติมให้ถูกต้อง (ตัวเลขมากกว่า 0)");
    return;
  }

  const newRecord = {
    date: dateInput?.value || new Date().toISOString().substring(0, 10),
    liters: liters,
    meter: meterInput?.value?.trim() || "-",
    officer: officerInput?.value?.trim() || "ผู้ดูแลระบบ",
    note: noteInput?.value?.trim() || "-"
  };

  let refillLog = [];
  try {
    const saved = localStorage.getItem('aifpas_diesel_refill_log');
    if (saved) refillLog = JSON.parse(saved);
  } catch(e) {}

  refillLog.push(newRecord);
  localStorage.setItem('aifpas_diesel_refill_log', JSON.stringify(refillLog));

  // Reset inputs
  if (literInput) literInput.value = "";
  if (meterInput) meterInput.value = "";
  if (noteInput) noteInput.value = "";

  renderDieselGHGModal();
}

function deleteActualRefillRecord(index) {
  if (!confirm("คุณต้องการลบบันทึกการเติมน้ำมันรายการนี้ใช่หรือไม่?")) return;
  let refillLog = [];
  try {
    const saved = localStorage.getItem('aifpas_diesel_refill_log');
    if (saved) refillLog = JSON.parse(saved);
  } catch(e) {}

  refillLog.splice(index, 1);
  localStorage.setItem('aifpas_diesel_refill_log', JSON.stringify(refillLog));
  renderDieselGHGModal();
}

// 10. Tab Switcher inside Modal
function switchGhgTab(tabId) {
  document.querySelectorAll(".ghg-tab-btn").forEach(b => {
    b.classList.remove("active");
    b.style.borderBottomColor = "transparent";
    b.style.color = "var(--text-secondary)";
  });
  document.querySelectorAll(".ghg-tab-content").forEach(c => c.style.display = "none");

  const targetBtn = document.getElementById(`tabBtn_${tabId}`);
  const targetContent = document.getElementById(`tabContent_${tabId}`);
  if (targetBtn) {
    targetBtn.classList.add("active");
    targetBtn.style.borderBottomColor = "var(--accent-cyan)";
    targetBtn.style.color = "var(--accent-cyan)";
  }
  if (targetContent) targetContent.style.display = "block";
}

// 11. HTML5 Canvas Monthly Trend Chart
function drawGhgMonthlyChart(monthlyData) {
  const canvas = document.getElementById("ghgMonthlyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Handle High-DPI screens
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width > 0 ? rect.width : 780;
  const h = 210;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  if (!monthlyData || monthlyData.length === 0) {
    ctx.fillStyle = "#888";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ไม่พบข้อมูลสถิติรายเดือนสำหรับการแสดงกราฟ", w / 2, h / 2);
    return;
  }

  // Padding
  const padLeft = 45;
  const padRight = 45;
  const padTop = 25;
  const padBottom = 35;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Max values
  const maxFuel = Math.max(...monthlyData.map(d => d.fuel), 10);
  const maxGhg = Math.max(...monthlyData.map(d => d.ghg), 25);

  const monthNames = {
    "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
    "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
    "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค."
  };

  // Draw Grid lines
  ctx.strokeStyle = "rgba(21, 94, 67, 0.12)";
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padTop + (chartH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    // Fuel Y-axis label (left)
    const fuelVal = ((gridSteps - i) / gridSteps) * maxFuel;
    ctx.fillStyle = "#1B7354";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fuelVal.toFixed(1) + " L", padLeft - 6, y + 3);

    // GHG Y-axis label (right)
    const ghgVal = ((gridSteps - i) / gridSteps) * maxGhg;
    ctx.fillStyle = "#155E43";
    ctx.textAlign = "left";
    ctx.fillText(ghgVal.toFixed(1) + " kg", w - padRight + 6, y + 3);
  }

  // Draw Bars & Line
  const groupWidth = chartW / monthlyData.length;
  const barWidth = Math.min(26, groupWidth * 0.35);

  // Line points for GHG
  const ghgPoints = [];

  monthlyData.forEach((d, idx) => {
    const centerX = padLeft + (idx + 0.5) * groupWidth;

    // Fuel Bar
    const fuelBarH = (d.fuel / maxFuel) * chartH;
    const barX = centerX - barWidth / 2;
    const barY = padTop + chartH - fuelBarH;

    const grad = ctx.createLinearGradient(0, barY, 0, padTop + chartH);
    grad.addColorStop(0, "#1B7354");
    grad.addColorStop(1, "rgba(27, 115, 84, 0.25)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, fuelBarH, [4, 4, 0, 0]);
    ctx.fill();

    // Value on top of Fuel bar
    ctx.fillStyle = "#1B7354";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.fuel.toFixed(1) + "L", centerX, barY - 4);

    // GHG Point
    const ghgY = padTop + chartH - (d.ghg / maxGhg) * chartH;
    ghgPoints.push({ x: centerX, y: ghgY, val: d.ghg });

    // X-axis Month Label
    const parts = d.ym.split("-");
    const label = (monthNames[parts[1]] || parts[1]) + " " + (parseInt(parts[0]) + 543).toString().substring(2);
    ctx.fillStyle = "#4B5563";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, centerX, h - 12);
  });

  // Connect GHG Line
  if (ghgPoints.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "#155E43";
    ctx.lineWidth = 2.5;
    ghgPoints.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Draw GHG Dots
    ghgPoints.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = "#155E43";
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dot label
      ctx.fillStyle = "#1F2937";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.val.toFixed(1), p.x, p.y - 7);
    });
  }
}

// 12. Export to Excel (CSV UTF-8 BOM)
function exportDieselGHGExcel() {
  const stats = computeDieselAndGHGAnalytics();

  let csv = "\uFEFF"; // UTF-8 BOM for Microsoft Excel Thai support
  csv += `รายงานการวิเคราะห์การใช้น้ำมันดีเซลและการปล่อยก๊าซเรือนกระจก (Diesel Fuel & GHG Analytics)\n`;
  csv += `ระบบ AI-FPAS • เครื่องสูบน้ำดับเพลิง MarkIIXG (FTA 1100-J)\n`;
  csv += `วันที่พิมพ์รายงาน,${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH')}\n`;
  csv += `เกณฑ์รับรอง,สำนักงานสีเขียว (Green Office) หมวด 4 ข้อ 4.3\n`;
  csv += `แหล่งอ้างอิงสัมประสิทธิ์,${stats.refText}\n`;
  csv += `\n`;

  // Summary Metrics Table
  csv += `--- สรุปข้อมูลภาพรวมการใช้น้ำมันและการปล่อยก๊าซเรือนกระจก ---\n`;
  csv += `หัวข้อ,ค่าที่บันทึก/คำนวณ,หน่วย\n`;
  csv += `โหมดการคำนวณที่เลือก,${stats.calcMode === 'cumulative' ? 'ชั่วโมงรวมสะสมทั้งหมด' : (stats.calcMode === 'monthly' ? 'สรุปรายเดือน' : 'แจกแจงรายครั้ง')},-\n`;
  csv += `ชั่วโมงเดินเครื่องสะสมรวม (MarkIIXG Pump Total),${stats.pumpTotalStr},ชม. (${stats.cumulativeHoursDec.toFixed(2)} ชม.)\n`;
  csv += `ชั่วโมงเดินเครื่องในรอบ Log File (${stats.logDateRangeText || '-'}),${stats.logRuntimeStr},ชม. (${stats.logTotalHours.toFixed(2)} ชม.)\n`;
  csv += `อัตราสิ้นเปลืองน้ำมันที่กำหนด,${stats.fuelRate.toFixed(2)},ลิตร/ชั่วโมง\n`;
  csv += `ประเภทน้ำมันเชื้อเพลิง,${DIESEL_GHG_CONFIG.fuelTypes[stats.fuelTypeKey]?.name || stats.fuelTypeKey},-\n`;
  csv += `Emission Factor (TGO),${stats.ef.toFixed(4)},kgCO2e/ลิตร\n`;
  csv += `ปริมาณน้ำมันดีเซลรวมสะสม (คำนวณจากชั่วโมงรวม),${stats.cumulativeFuel.toFixed(2)},ลิตร\n`;
  csv += `การปล่อยก๊าซเรือนกระจกสะสม (kgCO2e),${stats.cumulativeGhg.toFixed(2)},kgCO2e\n`;
  csv += `การปล่อยก๊าซเรือนกระจกสะสม (tCO2e),${stats.cumulativeTons.toFixed(4)},ตันคาร์บอน (tCO2e)\n`;
  csv += `ปริมาณน้ำมันในช่วงไฟล์ Log (${stats.completeCycles.length} รอบ),${stats.logTotalFuel.toFixed(2)},ลิตร\n`;
  csv += `การปล่อย GHG ในช่วงไฟล์ Log (${stats.completeCycles.length} รอบ),${stats.logTotalGhg.toFixed(2)},kgCO2e (${stats.logTotalTons.toFixed(4)} tCO2e)\n`;
  csv += `\n`;

  // Monthly Table
  csv += `--- สรุปการใช้น้ำมันและการปล่อยก๊าซเรือนกระจกรายเดือน ---\n`;
  csv += `เดือน/ปี,จำนวนรอบรัน,ชั่วโมงเดินเครื่องจริง,น้ำมันที่ใช้ (ลิตร),GHG (kgCO2e),เทียบเท่าตัน (tCO2e)\n`;
  stats.monthlyData.forEach(d => {
    const hrs = (d.sec / 3600.0).toFixed(2);
    csv += `"${d.ym}",${d.cycles},"${hrs} ชม.",${d.fuel.toFixed(2)},${d.ghg.toFixed(2)},${(d.ghg / 1000.0).toFixed(4)}\n`;
  });
  csv += `\n`;

  // Detailed Cycles Table
  csv += `--- รายละเอียดรอบการเดินเครื่องทั้งหมดจาก Log File (Engine Running - Stopped) ---\n`;
  csv += `รอบที่,การสตาร์ท,เวลาเริ่ม (Engine Running),เวลาหยุด (Engine Stopped),ระยะเวลารัน,ชั่วโมงคำนวณ (ชม.),น้ำมันที่ใช้ (ลิตร),การปล่อย GHG (kgCO2e),แรงดัน (psi),สถานะข้อมูล,หมายเหตุ\n`;
  stats.cycles.forEach(c => {
    const hrsStr = c.status === "complete" ? c.durationHours.toFixed(4) : "-";
    const fuelStr = c.status === "complete" ? c.fuelLiters.toFixed(2) : "-";
    const ghgStr = c.status === "complete" ? c.ghgKg.toFixed(2) : "-";
    csv += `${c.idx},"${c.crank}","${c.startRaw}","${c.stopRaw}","${c.durationStr}",${hrsStr},${fuelStr},${ghgStr},${c.psi},"${c.status === 'complete' ? 'ข้อมูลสมบูรณ์' : 'ข้อมูลไม่เพียงพอ'}","${c.note}"\n`;
  });
  csv += `\n`;

  // Actual Refill Log
  csv += `--- บันทึกประวัติการเติมน้ำมันจริงหน้างาน (Actual Refill Log) ---\n`;
  csv += `ลำดับ,วันที่เติม,ปริมาณที่เติม (ลิตร),GHG เกิดขึ้น (kgCO2e),เลขมิเตอร์/ถัง,ผู้บันทึก,หมายเหตุ\n`;
  stats.refillLog.forEach((r, i) => {
    const l = parseFloat(r.liters) || 0;
    csv += `${i + 1},"${r.date}",${l.toFixed(2)},${(l * stats.ef).toFixed(2)},"${r.meter}","${r.officer}","${r.note}"\n`;
  });

  // Download Trigger
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Diesel_Fuel_GHG_Report_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 13. Export to Green Office PDF / Print Window
function exportDieselGHGPDF() {
  const stats = computeDieselAndGHGAnalytics();

  let inspector = "นายสมศักดิ์ รักความปลอดภัย";
  let inspectorTitle = "จป.วิชาชีพ / วิศวกรซ่อมบำรุง";
  let approver = "นายวิชัย มั่นคงดี";
  let approverTitle = "ผู้จัดการโรงงาน / ผู้จัดการส่วนวิศวกรรม";
  let company = "โรงงานแปรรูปเกษตรอุตสาหกรรม (Agro-Industrial Plant)";

  if (typeof APP_SETTINGS !== 'undefined') {
    inspector = APP_SETTINGS.inspectorName || inspector;
    inspectorTitle = APP_SETTINGS.inspectorTitle || inspectorTitle;
    approver = APP_SETTINGS.approverName || approver;
    approverTitle = APP_SETTINGS.approverTitle || approverTitle;
    company = APP_SETTINGS.companyName || company;
  }

  let monthlyRows = "";
  stats.monthlyData.forEach(d => {
    const hrs = (d.sec / 3600.0).toFixed(2);
    monthlyRows += `
      <tr>
        <td>${d.ym}</td>
        <td style="text-align:center;">${d.cycles} รอบ</td>
        <td>${hrs} ชม.</td>
        <td style="text-align:right;">${d.fuel.toFixed(2)}</td>
        <td style="text-align:right;">${d.ghg.toFixed(2)}</td>
        <td style="text-align:right;">${(d.ghg / 1000.0).toFixed(4)}</td>
      </tr>
    `;
  });

  let cycleRows = "";
  stats.cycles.forEach(c => {
    const isComplete = c.status === "complete";
    cycleRows += `
      <tr>
        <td style="text-align:center;">${c.idx}</td>
        <td>${c.crank}</td>
        <td>${c.startRaw}</td>
        <td>${c.stopRaw}</td>
        <td>${c.durationStr}</td>
        <td style="text-align:right;">${c.fuelStr}</td>
        <td style="text-align:right;">${c.ghgStr}</td>
        <td style="text-align:center;">${isComplete ? 'สมบูรณ์' : 'ข้อมูลไม่เพียงพอ'}</td>
      </tr>
    `;
  });

  const reportHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงานการวิเคราะห์การใช้น้ำมันดีเซลและก๊าซเรือนกระจก (Green Office หมวด 4.3)</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print { .no-print { display: none !important; } }
  body { font-family: "Sarabun", "TH Sarabun New", sans-serif; font-size: 12px; color: #1e293b; margin: 0; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #155E43; padding-bottom: 10px; margin-bottom: 15px; }
  .title { font-size: 16px; font-weight: bold; color: #155E43; }
  .subtitle { font-size: 12px; color: #475569; }
  .badge { background: #E5F4E8; color: #155E43; border: 1px solid #1B7354; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; background: #F3F7F4; border: 1px solid rgba(21, 94, 67, 0.18); border-radius: 6px; padding: 8px 12px; margin-bottom: 15px; }
  .meta-item b { color: #334155; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
  .kpi-card { border: 1px solid rgba(21, 94, 67, 0.2); border-radius: 6px; padding: 8px; text-align: center; background: #fff; }
  .kpi-label { font-size: 10px; color: #64748b; margin-bottom: 3px; }
  .kpi-val { font-size: 16px; font-weight: bold; color: #1B7354; }
  .kpi-sub { font-size: 10px; color: #10b981; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
  th, td { border: 1px solid rgba(21, 94, 67, 0.2); padding: 5px 8px; }
  th { background: #F3F7F4; font-weight: bold; text-align: left; }
  .sign-area { display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
  .sign-box { width: 45%; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 11px; }
</style>
</head>
<body>

<div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #155E43; color: #FFFFFF; padding: 10px 20px; margin: 0 0 16px 0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.18);">
  <div style="display:flex; align-items:center; gap:10px;">
    <span style="font-size:1.4rem;">🌱</span>
    <div>
      <div style="font-size:13px; font-weight:800;">รายงานการใช้น้ำมันดีเซล &amp; ก๊าซเรือนกระจก (Green Office หมวด 4.3)</div>
      <div style="font-size:11px; opacity:0.9;">คำแนะนำ: ในหน้าต่างพิมพ์ ให้เลือกปลายทาง (Destination) เป็น <b>"Save as PDF" (บันทึกเป็น PDF)</b></div>
    </div>
  </div>
  <div style="display: flex; gap: 8px; align-items:center;">
    <button type="button" onclick="window.print()" style="background: #FFFFFF; color: #155E43; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
      🖨️ สั่งพิมพ์ / บันทึก PDF ตอนนี้ (Ctrl + P)
    </button>
    <button type="button" onclick="window.close()" style="background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.35); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px;">
      ✕ ปิดหน้านี้
    </button>
  </div>
</div>

<div class="header">
  <div>
    <div class="title">รายงานการประเมินการใช้น้ำมันเชื้อเพลิงและก๊าซเรือนกระจก (Diesel Fuel & GHG Report)</div>
    <div class="subtitle">ระบบตรวจเช็กเครื่องสูบน้ำดับเพลิงอัจฉริยะ (AI-FPAS) • รองรับการประเมินสำนักงานสีเขียว (Green Office)</div>
  </div>
  <div style="text-align: right;">
    <span class="badge">Green Office หมวด 4 ข้อ 4.3</span>
    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</div>
  </div>
</div>

<div class="meta-grid">
  <div><b>หน่วยงาน/สถานประกอบการ:</b> ${company}</div>
  <div><b>ตำแหน่งติดตั้ง:</b> อาคารอุตสาหกรรมเกษตร 5 (อค.5) - Tag: FP-01</div>
  <div><b>รุ่นตู้ควบคุม:</b> Firetrol FTA1100-J (MarkIIXG)</div>
  <div><b>ประเภทเชื้อเพลิง:</b> ${DIESEL_GHG_CONFIG.fuelTypes[stats.fuelTypeKey]?.name || 'ดีเซล B7'}</div>
  <div><b>อัตราสิ้นเปลืองที่คำนวณ:</b> ${stats.fuelRate.toFixed(1)} ลิตร/ชั่วโมง</div>
  <div><b>Emission Factor (TGO):</b> ${stats.ef.toFixed(4)} kgCO₂e/ลิตร</div>
</div>

<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-label">ชั่วโมงรวมสะสมปั๊ม</div>
    <div class="kpi-val">${stats.pumpTotalStr} ชม.</div>
    <div class="kpi-sub">${stats.cumulativeHoursDec.toFixed(2)} ชั่วโมงทศนิยม</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">น้ำมันดีเซลสะสม (คำนวณ)</div>
    <div class="kpi-val" style="color:#d97706;">${stats.cumulativeFuel.toFixed(2)} L</div>
    <div class="kpi-sub">สะสมตลอดอายุการใช้งาน</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">การปล่อยก๊าซเรือนกระจก</div>
    <div class="kpi-val" style="color:#16a34a;">${stats.cumulativeGhg.toFixed(2)}</div>
    <div class="kpi-sub">kgCO₂e (${stats.cumulativeTons.toFixed(4)} tCO₂e)</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">รอบการเดินเครื่องใน Log</div>
    <div class="kpi-val" style="color:#7c3aed;">${stats.completeCycles.length} รอบ</div>
    <div class="kpi-sub">สมบูรณ์ 100% (${stats.logRuntimeStr})</div>
  </div>
</div>

<h4 style="margin: 10px 0 6px 0; color: #0284c7;">1. สรุปการใช้น้ำมันและการปล่อยก๊าซเรือนกระจกรายเดือน (Monthly Breakdown)</h4>
<table>
  <thead>
    <tr>
      <th>เดือน/ปี</th>
      <th style="text-align:center;">จำนวนรอบรัน</th>
      <th>ระยะเวลาเดินเครื่องรวม</th>
      <th style="text-align:right;">ปริมาณน้ำมัน (ลิตร)</th>
      <th style="text-align:right;">GHG (kgCO₂e)</th>
      <th style="text-align:right;">เทียบเท่าตัน (tCO₂e)</th>
    </tr>
  </thead>
  <tbody>
    ${monthlyRows}
  </tbody>
</table>

<h4 style="margin: 10px 0 6px 0; color: #0284c7;">2. รายละเอียดรอบการทดสอบเดินเครื่องยนต์จริง (Engine Run Log Sessions)</h4>
<table>
  <thead>
    <tr>
      <th style="width:25px;text-align:center;">#</th>
      <th>สตาร์ท</th>
      <th>เวลาเริ่ม (Running)</th>
      <th>เวลาหยุด (Stopped)</th>
      <th>ระยะเวลา</th>
      <th style="text-align:right;">น้ำมัน (L)</th>
      <th style="text-align:right;">GHG (kg)</th>
      <th style="text-align:center;">สถานะ</th>
    </tr>
  </thead>
  <tbody>
    ${cycleRows}
  </tbody>
</table>

<div class="sign-area">
  <div class="sign-box">
    (ลงชื่อ) ................................................................<br>
    ( <b>${inspector}</b> )<br>
    ตำแหน่ง: ${inspectorTitle}<br>
    ผู้ตรวจสอบข้อมูลและคำนวณการปล่อยก๊าซเรือนกระจก
  </div>
  <div class="sign-box">
    (ลงชื่อ) ................................................................<br>
    ( <b>${approver}</b> )<br>
    ตำแหน่ง: ${approverTitle}<br>
    ผู้อนุมัติรายงานการประเมิน Green Office
  </div>
</div>

</body>
</html>
  `;

  try {
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8;" });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank");
    if (!printWindow) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Firetrol_Diesel_GHG_Report_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error("Export report error:", err);
  }
}

// 14. Auto-initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => updateDieselGHGPanel(), 300);
    });
  } else {
    setTimeout(() => updateDieselGHGPanel(), 300);
  }
}
