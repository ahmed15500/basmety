"use strict";
/* ============================================================
   بصمتي — نسخة الويب
   نفس منطق تطبيق الأندرويد: تأخير بعد 10:30 بس، 8 ساعات من الدخول،
   بنك أذونات 2/شهر × 120 دقيقة، أوفر تايم، تصنيف أيام بلا بصمة.
   ============================================================ */

const ERP_BASE = "https://erp.hu.edu.eg";
const HOLIDAY_URL = "https://www.presidency.eg/ar/%D9%85%D8%B5%D8%B1/%D8%A7%D9%84%D8%B9%D8%B7%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%B1%D8%B3%D9%85%D9%8A%D8%A9/";
const PERMS_PER_MONTH = 2;
const PERM_MAX_MIN = 120;

/* ---------- الإجازات المدمجة (نفس ملف الأندرويد egypt_holidays.json) ---------- */
const BUNDLED_HOLIDAYS = [{"date":"2026-01-07","name":"عيد الميلاد المجيد","note":""},{"date":"2026-01-29","name":"ثورة 25 يناير وعيد الشرطة (مُرحّلة)","note":"التاريخ الأصلي 25 يناير، والإجازة المُرحّلة 29 يناير"},{"date":"2026-03-19","name":"عيد الفطر المبارك","note":""},{"date":"2026-03-20","name":"عيد الفطر المبارك","note":""},{"date":"2026-03-21","name":"عيد الفطر المبارك","note":""},{"date":"2026-03-22","name":"عيد الفطر المبارك","note":""},{"date":"2026-03-23","name":"عيد الفطر المبارك","note":""},{"date":"2026-04-13","name":"شم النسيم","note":""},{"date":"2026-04-25","name":"عيد تحرير سيناء","note":""},{"date":"2026-05-07","name":"عيد العمال (مُرحّلة)","note":"التاريخ الأصلي 1 مايو"},{"date":"2026-05-26","name":"وقفة عرفات","note":""},{"date":"2026-05-27","name":"عيد الأضحى المبارك","note":""},{"date":"2026-05-28","name":"عيد الأضحى المبارك","note":""},{"date":"2026-05-29","name":"عيد الأضحى المبارك","note":""},{"date":"2026-05-30","name":"عيد الأضحى المبارك","note":""},{"date":"2026-05-31","name":"عيد الأضحى المبارك","note":""},{"date":"2026-06-17","name":"رأس السنة الهجرية","note":""},{"date":"2026-07-02","name":"ثورة 30 يونيو (مُرحّلة)","note":"التاريخ الأصلي 30 يونيو"},{"date":"2026-07-23","name":"ثورة 23 يوليو","note":""},{"date":"2026-08-27","name":"المولد النبوي الشريف (مُرحّلة)","note":"التاريخ الأصلي 26 أغسطس"},{"date":"2026-10-08","name":"عيد القوات المسلحة (مُرحّلة)","note":"التاريخ الأصلي 6 أكتوبر"},{"date":"2027-01-07","name":"عيد الميلاد المجيد","note":"تاريخ ثابت 2027"},{"date":"2027-01-25","name":"ثورة 25 يناير وعيد الشرطة","note":"تاريخ ثابت 2027"},{"date":"2027-04-25","name":"عيد تحرير سيناء","note":"تاريخ ثابت 2027"},{"date":"2027-05-01","name":"عيد العمال","note":"تاريخ ثابت 2027"},{"date":"2027-06-30","name":"ثورة 30 يونيو","note":"تاريخ ثابت 2027"},{"date":"2027-07-23","name":"ثورة 23 يوليو","note":"تاريخ ثابت 2027"},{"date":"2027-10-06","name":"عيد القوات المسلحة","note":"تاريخ ثابت 2027"}];

/* ---------- التخزين ---------- */
const LS = {
  get(k, dflt){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; }catch(e){ return dflt; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let settings = Object.assign(
  { windowStart:"07:30", lateThreshold:"10:30", requiredHours:8 },
  LS.get("basmety_settings", {})
);
let days = LS.get("basmety_days", {});           // { "YYYY-MM-DD": {date,in,out,classification,permInUsed,permOutUsed} }
let holidaysCache = LS.get("basmety_holidays_cache", null); // {updated, source, holidays:[...]}
let syncLog = LS.get("basmety_sync_log", []);
let viewMonth = (()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
let classifyTarget = null;

function saveDays(){ LS.set("basmety_days", days); }
function saveSettings(){ LS.set("basmety_settings", settings); }
function saveLog(){ LS.set("basmety_sync_log", syncLog.slice(-40)); }

/* ---------- الثيمات (٥ معتمدة — نفس باليتات موك-أب الهاتف) ---------- */
const THEMES = [
  { id:"purple", name:"البنفسجي الملكي", dots:["#6D28D9","#22D3EE","#FDE68A"] },
  { id:"green",  name:"الأخضر الحيوي",  dots:["#22C55E","#16A34A","#BBF7D0"] },
  { id:"night",  name:"الليلي",         dots:["#0F172A","#22D3EE","#A78BFA"] },
  { id:"gold",   name:"المؤسسي الذهبي", dots:["#0B2A4A","#C9A227","#E8EDF3"] },
  { id:"copper", name:"الدافئ النحاسي", dots:["#B45309","#CE8B5F","#F5DEB8"] }
];
function savedTheme(){
  let t = null;
  try{ t = localStorage.getItem("basmety_theme"); }catch(e){}
  return THEMES.some(x => x.id === t) ? t : "purple";
}
function applyTheme(id, save){
  if(!THEMES.some(x => x.id === id)) id = "purple";
  document.documentElement.setAttribute("data-theme", id);
  if(save !== false){ try{ localStorage.setItem("basmety_theme", id); }catch(e){} }
  renderThemePicker();
}
function renderThemePicker(){
  const grid = document.getElementById("themeGrid");
  if(!grid) return;
  const cur = document.documentElement.getAttribute("data-theme") || "purple";
  grid.innerHTML = THEMES.map(t =>
    '<button type="button" class="theme-card'+(t.id === cur ? " active" : "")+'" data-theme-pick="'+t.id+'">' +
    '<span class="t-name">'+t.name+(t.id === cur ? ' <span class="t-check">✓ شغال دلوقتي</span>' : "")+'</span>' +
    '<span class="t-dots">'+t.dots.map(c => '<i style="background:'+c+'"></i>').join("")+'</span>' +
    '</button>'
  ).join("");
  grid.querySelectorAll("[data-theme-pick]").forEach(b =>
    b.addEventListener("click", () => applyTheme(b.getAttribute("data-theme-pick"))));
}

/* ---------- أدوات وقت ---------- */
const pad = n => String(n).padStart(2,"0");
function dateKey(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayKey(){ return dateKey(new Date()); }
function monthKeyOf(key){ return key.slice(0,7); }
function timeToMin(t){ if(!t) return null; const p=t.split(":"); return (+p[0])*60 + (+p[1]); }
function minToTime(m){ m=((m%1440)+1440)%1440; return pad(Math.floor(m/60))+":"+pad(m%60); }
function fmtDur(min){ // 125 -> "2 س 05 د"
  min = Math.max(0, Math.round(min));
  return Math.floor(min/60)+":"+pad(min%60);
}
function fmtDurWords(min){
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min/60), m = min%60;
  if(h && m) return h+" ساعة و "+m+" دقيقة";
  if(h) return h+" ساعة";
  return m+" دقيقة";
}
function fmtHMS(sec){
  sec = Math.max(0, Math.floor(sec));
  return pad(Math.floor(sec/3600))+":"+pad(Math.floor(sec%3600/60))+":"+pad(sec%60);
}
const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function prettyDate(key){
  const d = new Date(key+"T00:00:00");
  return AR_DAYS[d.getDay()]+" "+d.getDate()+" "+AR_MONTHS[d.getMonth()]+" "+d.getFullYear();
}
function isWeekend(key){
  const g = new Date(key+"T00:00:00").getDay();
  return g === 5 || g === 6; // جمعة + سبت
}

/* ---------- الإجازات ---------- */
function holidayList(){ return holidaysCache && holidaysCache.holidays && holidaysCache.holidays.length ? holidaysCache.holidays : BUNDLED_HOLIDAYS; }
function holidayMap(){ const m = {}; holidayList().forEach(h => m[h.date] = h); return m; }
function isHoliday(key){ return !!holidayMap()[key]; }

/* ---------- حسابات اليوم (نفس قواعد الأندرويد) ---------- */
function requiredMin(){ return Math.round((+settings.requiredHours || 8) * 60); }
function computeDay(rec){
  const req = requiredMin();
  const lateT = timeToMin(settings.lateThreshold);
  const inM = rec && rec.in ? timeToMin(rec.in) : null;
  const outM = rec && rec.out ? timeToMin(rec.out) : null;
  const c = { inM, outM, worked:null, late:0, early:0, deficit:0, overtime:0, targetOut:null };
  if(inM === null) return c;
  c.late = Math.max(0, inM - lateT);              // التأخير بعد 10:30 بس
  c.targetOut = inM + req;                        // مرواحك = دخولك + 8 ساعات
  if(outM !== null && outM >= inM){
    c.worked = outM - inM;
    c.early = Math.max(0, c.targetOut - outM);    // مشيت قبل ما تكمّل الـ8 ساعات بتوعك
    c.overtime = Math.max(0, c.worked - req);
  }
  c.deficit = c.late + c.early;
  return c;
}
function monthKeys(monthDate){
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const n = new Date(y, m+1, 0).getDate(), out = [];
  for(let d=1; d<=n; d++) out.push(dateKey(new Date(y, m, d)));
  return out;
}
function monthStats(monthDate){
  const keys = monthKeys(monthDate);
  const s = { workedDays:0, workedMin:0, deficitMin:0, overtimeMin:0, permsUsed:0,
              missingUnclassified:0, deficitDays:[], overtimeDays:[], classified:[] };
  const tk = todayKey();
  keys.forEach(k => {
    const rec = days[k];
    if(isWeekend(k) || isHoliday(k)) return;
    if(rec && rec.classification){ s.classified.push({key, rec}); return; }
    if(rec && rec.in){
      const c = computeDay(rec);
      if(c.worked !== null){
        s.workedDays++; s.workedMin += c.worked;
        s.overtimeMin += c.overtime;
        if(c.overtime > 0) s.overtimeDays.push({key, rec, c});
      }
      if(c.deficit > 0) s.deficitDays.push({key, rec, c});
    } else if(k < tk){
      s.missingUnclassified++;
    }
    if(rec){
      if(rec.permInUsed) s.permsUsed++;
      if(rec.permOutUsed) s.permsUsed++;
    }
  });
  s.deficitDays.forEach(d => s.deficitMin += d.c.deficit);
  return s;
}
function missingDays(monthDate){
  const tk = todayKey(), out = [];
  monthKeys(monthDate).forEach(k => {
    if(k >= tk) return;
    if(isWeekend(k) || isHoliday(k)) return;
    const rec = days[k];
    if(rec && (rec.in || rec.classification)) return;
    out.push(k);
  });
  return out;
}
function currentMonthMissingCount(){
  const now = new Date();
  return missingDays(new Date(now.getFullYear(), now.getMonth(), 1)).length;
}

/* ---------- العدّاد الحي ---------- */
const RING_C = 2 * Math.PI * 86;
function stagePhrase(pct, remainMin){
  if(remainMin !== null && remainMin <= 30 && remainMin > 0) return "آخر نص ساعة، شد حيلك ⏳";
  if(pct < 12.5) return "لسه بنسخّن ☕";
  if(pct < 25) return "بدأنا المشوار 🚶";
  if(pct < 37.5) return "ربع المشوار خلص 💪";
  if(pct < 50) return "قرّبنا من النص 🔥";
  if(pct < 62.5) return "نص الطريق يا بطل 🚀";
  if(pct < 75) return "عدّينا النص، كمّل 🎯";
  if(pct < 87.5) return "تلات تربع خلصوا 🏁";
  return "فاضل حتة صغيرة 🧩";
}
function tickCountdown(){
  const ring = document.getElementById("ringFg");
  const pctEl = document.getElementById("ringPct"), timeEl = document.getElementById("ringTime"),
        labelEl = document.getElementById("ringLabel"), stageEl = document.getElementById("stagePhrase");
  const sIn = document.getElementById("statIn"), sT = document.getElementById("statTarget"),
        sE = document.getElementById("statElapsed"), sR = document.getElementById("statRemain");
  ring.style.strokeDasharray = RING_C;
  const tk = todayKey(), rec = days[tk];
  const req = requiredMin();
  if(isWeekend(tk) || isHoliday(tk)){
    ring.style.strokeDashoffset = RING_C; ring.classList.remove("overtime");
    pctEl.textContent = "🎉"; timeEl.textContent = "--:--:--";
    labelEl.textContent = isHoliday(tk) ? "النهاردة إجازة رسمية: "+holidayMap()[tk].name : "النهاردة ويك إند";
    stageEl.textContent = "مفيش شغل النهاردة — ارتاح 😎";
    sIn.textContent = sT.textContent = sE.textContent = sR.textContent = "—";
    return;
  }
  if(!rec || !rec.in){
    ring.style.strokeDashoffset = RING_C; ring.classList.remove("overtime");
    pctEl.textContent = "0%"; timeEl.textContent = "--:--:--";
    labelEl.textContent = "لسه مفيش بصمة دخول النهاردة";
    stageEl.textContent = "ابصم دخول من الـERP وارجع شوف العدّاد وهو بيجري 🏃";
    sIn.textContent = sT.textContent = sE.textContent = sR.textContent = "—";
    return;
  }
  const inM = timeToMin(rec.in);
  const inDate = new Date(); inDate.setHours(Math.floor(inM/60), inM%60, 0, 0);
  const targetDate = new Date(inDate.getTime() + req*60000);
  sIn.textContent = rec.in;
  sT.textContent = minToTime(inM + req) + (inM + req >= 1440 ? " (تاني يوم)" : "");
  if(rec.out){
    const c = computeDay(rec);
    const pct = Math.min(100, Math.round(c.worked / req * 100));
    ring.style.strokeDashoffset = RING_C * (1 - pct/100);
    ring.classList.toggle("overtime", c.overtime > 0);
    pctEl.textContent = pct + "%";
    timeEl.textContent = fmtHMS(c.worked * 60);
    labelEl.textContent = "اليوم خلص — خرجت "+rec.out;
    stageEl.textContent = c.overtime > 0 ? "عملت أوفر تايم "+fmtDurWords(c.overtime)+" ⏫ عاش!" :
      (c.deficit > 0 ? "اليوم ناقص "+fmtDurWords(c.deficit)+" — شوف «أيام ناقصة» 🧾" : "يوم كامل سليم 🎉");
    sE.textContent = fmtDur(c.worked);
    sR.textContent = c.early > 0 ? fmtDur(c.early)+" ناقص" : "0:00";
    return;
  }
  const now = new Date();
  const elapsedSec = Math.max(0, (now - inDate) / 1000);
  const elapsedMin = elapsedSec / 60;
  if(elapsedMin < req){
    const pct = Math.floor(elapsedMin / req * 100);
    const remainSec = req*60 - elapsedSec;
    ring.style.strokeDashoffset = RING_C * (1 - elapsedMin/req);
    ring.classList.remove("overtime");
    pctEl.textContent = pct + "%";
    timeEl.textContent = fmtHMS(remainSec);
    labelEl.textContent = "فاضل على مرواحك ("+minToTime(inM+req)+")";
    stageEl.textContent = stagePhrase(pct, remainSec/60);
    sE.textContent = fmtDur(elapsedMin);
    sR.textContent = fmtDur(remainSec/60);
  } else {
    const otSec = elapsedSec - req*60;
    ring.style.strokeDashoffset = 0;
    ring.classList.add("overtime");
    pctEl.textContent = "100%";
    timeEl.textContent = "+" + fmtHMS(otSec);
    labelEl.textContent = "خلّصت الـ"+(settings.requiredHours)+" ساعات 🎉 — انت دلوقتي في الأوفر تايم";
    stageEl.textContent = "كل دقيقة زيادة بتتكتب لك أوفر تايم ⏫";
    sE.textContent = fmtDur(elapsedMin);
    sR.textContent = "أوفر تايم +" + fmtDur(otSec/60);
  }
}

/* ---------- العرض ---------- */
const $ = id => document.getElementById(id);
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch])); }

function renderHeader(){
  const now = new Date();
  $("todayChip").textContent = "📅 " + AR_DAYS[now.getDay()] + " " + now.getDate() + " " + AR_MONTHS[now.getMonth()] + " " + now.getFullYear();
  const mc = currentMonthMissingCount();
  const banner = $("missingAlert");
  banner.hidden = mc === 0;
  $("missingAlertCount").textContent = mc;
}

function dayChips(k, rec){
  const chips = [];
  if(isHoliday(k)) chips.push('<span class="chip off">🎉 '+esc(holidayMap()[k].name)+'</span>');
  if(isWeekend(k)) chips.push('<span class="chip off">ويك إند</span>');
  if(rec && rec.classification){
    const cl = rec.classification;
    let t = "متصنّف";
    if(cl.kind === "leave") t = "إجازة " + (cl.leaveType || "");
    if(cl.kind === "mission") t = "مأمورية: " + (cl.destination || "");
    if(cl.kind === "absent") t = "غياب";
    if(cl.kind === "forgot") t = "نسيت أبصم";
    if(cl.kind === "other") t = "أخرى: " + (cl.note || "");
    chips.push('<span class="chip cls">'+esc(t)+'</span>');
    return chips;
  }
  if(rec && rec.in){
    const c = computeDay(rec);
    if(c.worked !== null && c.deficit === 0 && c.overtime === 0) chips.push('<span class="chip ok">يوم كامل ✓</span>');
    if(c.late > 0) chips.push('<span class="chip late">تأخير '+fmtDur(c.late)+'</span>');
    if(c.early > 0) chips.push('<span class="chip late">ناقص '+fmtDur(c.early)+'</span>');
    if(c.overtime > 0) chips.push('<span class="chip ot">أوفر تايم '+fmtDur(c.overtime)+'</span>');
    if(c.worked === null) chips.push('<span class="chip miss">دخول من غير خروج لسه</span>');
  } else if(k < todayKey() && !isWeekend(k) && !isHoliday(k)){
    chips.push('<span class="chip miss">من غير بصمة ⚠️</span>');
  }
  return chips;
}

function renderDays(){
  const title = AR_MONTHS[viewMonth.getMonth()] + " " + viewMonth.getFullYear();
  $("monthTitle").textContent = title;
  const keys = monthKeys(viewMonth).slice().reverse();
  const html = keys.map(k => {
    const rec = days[k];
    let info = "—";
    if(rec && rec.in){
      const c = computeDay(rec);
      info = "دخول " + rec.in + (rec.out ? " • خروج " + rec.out : " • لسه جوه") +
             (c.worked !== null ? " • اشتغلت " + fmtDur(c.worked) : "") +
             " • مرواح مستهدف " + minToTime(c.targetOut);
    }
    const canClassify = k < todayKey() && !isWeekend(k) && !isHoliday(k) && !(rec && rec.in) && !(rec && rec.classification);
    return '<div class="day-row">' +
      '<span class="d-date">'+esc(prettyDate(k))+'</span>' +
      '<span class="d-info">'+esc(info)+'</span>' +
      dayChips(k, rec).join(" ") +
      (canClassify ? '<button class="btn small" data-classify="'+k+'">صنّف اليوم</button>' : "") +
      (rec ? '<button class="icon-btn del" data-del="'+k+'" title="مسح اليوم">🗑️</button>' : "") +
      '</div>';
  }).join("");
  $("daysList").innerHTML = html || '<div class="empty">مفيش أيام</div>';
  // تصنيف الأيام الناقصة
  const miss = missingDays(viewMonth);
  $("classifyCard").hidden = miss.length === 0;
  $("missingList").innerHTML = miss.map(k =>
    '<div class="day-row"><span class="d-date">'+esc(prettyDate(k))+'</span>' +
    '<span class="d-info">يوم شغل من غير أي بصمة</span>' +
    '<button class="btn small primary" data-classify="'+k+'">صنّف اليوم ده</button></div>'
  ).join("");
  bindDayButtons();
}

function bindDayButtons(){
  document.querySelectorAll("[data-classify]").forEach(b =>
    b.addEventListener("click", () => openClassify(b.getAttribute("data-classify"))));
  document.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-del");
      if(confirm("مسح بيانات يوم " + prettyDate(k) + "؟")){
        delete days[k]; saveDays(); renderAll();
      }
    }));
}

function renderDeficit(){
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = monthStats(cur);
  $("bankMonth").textContent = AR_MONTHS[cur.getMonth()] + " " + cur.getFullYear();
  const left = Math.max(0, PERMS_PER_MONTH - s.permsUsed);
  $("bankSlots").innerHTML = Array.from({length: PERMS_PER_MONTH}, (_, i) =>
    '<div class="bank-slot'+(i < s.permsUsed ? " used" : "")+'">إذن '+(i+1)+(i < s.permsUsed ? " — اتستخدم" : " — متاح (لحد "+PERM_MAX_MIN+" د)")+'</div>'
  ).join("");
  $("bankUsed").textContent = s.permsUsed + " / " + PERMS_PER_MONTH;
  $("bankLeft").textContent = left;
  $("bankDeficitTotal").textContent = s.deficitMin ? fmtDurWords(s.deficitMin) : "مفيش نقص 🎉";
  $("deficitBadge").hidden = s.deficitDays.length === 0;
  $("deficitBadge").textContent = s.deficitDays.length;

  if(!s.deficitDays.length){
    $("deficitList").innerHTML = '<div class="empty">مفيش أيام ناقصة الشهر ده 🎉</div>';
    return;
  }
  $("deficitList").innerHTML = s.deficitDays.map(d => {
    const rows = [];
    if(d.c.late > 0){
      rows.push(suggestionRow(d, "in", "إذن دخول", d.c.late,
        "دخلت "+d.rec.in+" — التأخير بعد "+settings.lateThreshold+" = "+fmtDur(d.c.late), d.rec.permInUsed));
    }
    if(d.c.early > 0){
      rows.push(suggestionRow(d, "out", "إذن خروج", d.c.early,
        "خرجت "+(d.rec.out || "—")+" قبل ما تكمّل الـ"+settings.requiredHours+" ساعات (مرواحك كان "+minToTime(d.c.targetOut)+") — ناقص "+fmtDur(d.c.early), d.rec.permOutUsed));
    }
    return rows.join("");
  }).join("");
  document.querySelectorAll("[data-perm]").forEach(b =>
    b.addEventListener("click", () => {
      const [k, kind] = b.getAttribute("data-perm").split("|");
      const rec = days[k]; if(!rec) return;
      if(kind === "in") rec.permInUsed = true; else rec.permOutUsed = true;
      saveDays(); renderAll();
    }));
}
function suggestionRow(d, kind, label, minutes, why, used){
  const s = monthStats(new Date(d.key.slice(0,7) + "-01T00:00:00"));
  const bankLeft = PERMS_PER_MONTH - s.permsUsed;
  let warn = "";
  if(minutes > PERM_MAX_MIN) warn = '<div class="warn-text">⚠️ النقص ده '+fmtDur(minutes)+' والإذن بيغطي '+PERM_MAX_MIN+' دقيقة بس — هيتبقى '+fmtDur(minutes - PERM_MAX_MIN)+' مش متغطية.</div>';
  let btn;
  if(used) btn = '<span class="chip ok">اتعمل بإذن ✓</span>';
  else if(bankLeft <= 0) btn = '<span class="warn-text">بنك الأذونات خلص الشهر ده ⚠️</span>';
  else btn = '<button class="btn small primary" data-perm="'+d.key+'|'+kind+'">استخدمت إذن</button>';
  return '<div class="day-row"><span class="d-date">'+esc(prettyDate(d.key))+'</span>' +
    '<span class="d-info"><b>'+label+'</b> — '+esc(why)+warn+'</span>' + btn + '</div>';
}

function renderOvertime(){
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = monthStats(cur);
  $("otMonth").textContent = AR_MONTHS[cur.getMonth()] + " " + cur.getFullYear();
  $("otTotal").textContent = fmtDurWords(s.overtimeMin);
  $("overtimeList").innerHTML = s.overtimeDays.length ? s.overtimeDays.map(d =>
    '<div class="day-row"><span class="d-date">'+esc(prettyDate(d.key))+'</span>' +
    '<span class="d-info">دخول '+d.rec.in+' • خروج '+d.rec.out+' • اشتغلت '+fmtDur(d.c.worked)+'</span>' +
    '<span class="chip ot">+ '+fmtDur(d.c.overtime)+'</span></div>'
  ).join("") : '<div class="empty">مفيش أوفر تايم الشهر ده لسه</div>';
}

function renderSummary(){
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = monthStats(cur);
  $("summaryMonth").textContent = AR_MONTHS[cur.getMonth()] + " " + cur.getFullYear();
  $("sumWorked").textContent = s.workedDays;
  $("sumWorkedTime").textContent = fmtDurWords(s.workedMin);
  $("sumDeficit").textContent = s.deficitMin ? fmtDurWords(s.deficitMin) : "0";
  $("sumOvertime").textContent = fmtDurWords(s.overtimeMin);
  $("sumPerms").textContent = s.permsUsed + " / " + PERMS_PER_MONTH;
  $("sumMissing").textContent = s.missingUnclassified;
  $("classifiedList").innerHTML = s.classified.length ? s.classified.map(x => {
    const cl = x.rec.classification;
    let what = "";
    if(cl.kind === "leave") what = "إجازة — " + (cl.leaveType === "أخرى" ? (cl.note || "أخرى") : cl.leaveType);
    else if(cl.kind === "mission") what = "مأمورية — روحت: " + (cl.destination || "—");
    else if(cl.kind === "absent") what = "غياب";
    else if(cl.kind === "forgot") what = "اشتغلت ونسيت أبصم";
    else what = "أخرى — " + (cl.note || "");
    return '<div class="day-row"><span class="d-date">'+esc(prettyDate(x.key))+'</span>' +
      '<span class="d-info">'+esc(what)+'</span>' +
      '<button class="icon-btn" data-unclassify="'+x.key+'" title="إلغاء التصنيف">↩️</button></div>';
  }).join("") : '<div class="empty">مفيش أيام متصنّفة الشهر ده</div>';
  document.querySelectorAll("[data-unclassify]").forEach(b =>
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-unclassify");
      if(days[k]){ delete days[k].classification; saveDays(); renderAll(); }
    }));
}

function renderHolidays(){
  const list = holidayList().slice().sort((a,b) => a.date < b.date ? -1 : 1);
  const tk = todayKey();
  $("holidaySource").textContent = holidaysCache ? holidaysCache.source : "القائمة المدمجة في التطبيق (من موقع رئاسة الجمهورية)";
  $("holidayUpdated").textContent = holidaysCache ? holidaysCache.updated : "مدمجة مع النسخة دي";
  $("holidaysList").innerHTML = list.map(h =>
    '<div class="holiday-row'+(h.date < tk ? " past" : "")+'"><b>'+esc(h.date)+'</b><span>'+esc(h.name)+
    (h.note ? ' <small>('+esc(h.note)+')</small>' : "")+'</span></div>'
  ).join("");
}

function renderSyncLog(){
  $("syncLog").innerHTML = syncLog.length ? syncLog.map(l =>
    '<div><span class="t">'+esc(l.t)+'</span> — '+esc(l.msg)+'</div>'
  ).join("") : "لسه مفيش محاولات مزامنة.";
  const el = $("syncLog"); el.scrollTop = el.scrollHeight;
}
function logSync(msg){
  const now = new Date();
  syncLog.push({ t: pad(now.getHours())+":"+pad(now.getMinutes())+":"+pad(now.getSeconds())+" "+dateKey(now), msg });
  saveLog(); renderSyncLog();
}

function renderAll(){
  renderHeader(); renderDays(); renderDeficit(); renderOvertime(); renderSummary(); renderHolidays(); renderSyncLog(); tickCountdown();
}

/* ---------- تصنيف يوم بلا بصمة ---------- */
function openClassify(k){
  classifyTarget = k;
  $("classifyDateLabel").textContent = prettyDate(k);
  $("classifyModal").hidden = false;
  updateClassifyFields();
}
function closeClassify(){ $("classifyModal").hidden = true; classifyTarget = null; }
function updateClassifyFields(){
  const kind = $("classifyKind").value;
  $("leaveTypeRow").hidden = kind !== "leave";
  $("leaveOtherRow").hidden = !(kind === "leave" && $("classifyLeaveType").value === "أخرى");
  $("missionRow").hidden = kind !== "mission";
  $("noteRow").hidden = !(kind === "other" || (kind === "leave" && $("classifyLeaveType").value === "أخرى"));
  $("classifyDestination").required = kind === "mission";
}
$("classifyKind").addEventListener("change", updateClassifyFields);
$("classifyLeaveType").addEventListener("change", updateClassifyFields);
$("classifyCancel").addEventListener("click", closeClassify);
$("classifyForm").addEventListener("submit", e => {
  e.preventDefault();
  if(!classifyTarget) return;
  const kind = $("classifyKind").value;
  const cl = { kind };
  if(kind === "leave"){
    cl.leaveType = $("classifyLeaveType").value;
    if(cl.leaveType === "أخرى") cl.note = $("classifyLeaveOther").value.trim();
  }
  if(kind === "mission"){
    cl.destination = $("classifyDestination").value.trim();
    if(!cl.destination){ alert("لازم تكتب روحت فين في المأمورية"); return; }
  }
  if(kind === "other") cl.note = $("classifyNote").value.trim();
  const rec = days[classifyTarget] || { date: classifyTarget };
  rec.classification = cl;
  days[classifyTarget] = rec;
  saveDays(); closeClassify(); renderAll();
});

/* ---------- تحديث الإجازات من الموقع الرسمي ---------- */
const AR_MONTH_NUM = {"يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"سبتمبر":9,"أكتوبر":10,"نوفمبر":11,"ديسمبر":12};
$("btnHolidayUpdate").addEventListener("click", async () => {
  const msg = $("holidayMsg");
  msg.textContent = "جاري الاتصال بموقع رئاسة الجمهورية…";
  try{
    const r = await fetch(HOLIDAY_URL);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const html = await r.text();
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ");
    const re = /(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)(?:\s+(\d{4}))?/g;
    const found = {}, year = new Date().getFullYear();
    let m;
    while((m = re.exec(text)) !== null){
      const d = +m[1], mo = AR_MONTH_NUM[m[2]], y = m[3] ? +m[3] : year;
      if(d < 1 || d > 31) continue;
      const key = y + "-" + pad(mo) + "-" + pad(d);
      const before = text.slice(Math.max(0, m.index - 70), m.index).trim();
      found[key] = { date: key, name: before ? before.split(/[.\n•|]/).pop().trim().slice(-50) || "إجازة رسمية" : "إجازة رسمية", note: "من الموقع الرسمي مباشرة" };
    }
    const list = Object.values(found);
    if(list.length >= 5){
      holidaysCache = { updated: dateKey(new Date()), source: "presidency.eg (تحديث مباشر)", holidays: list };
      LS.set("basmety_holidays_cache", holidaysCache);
      msg.textContent = "✅ اتحدثت الإجازات من الموقع الرسمي (" + list.length + " يوم).";
    } else {
      msg.textContent = "⚠️ الموقع ردّ بس مقدرناش نطلع منه قائمة مفهومة (" + list.length + " تاريخ بس) — فضلنا شغالين بالقائمة المدمجة الموثقة.";
    }
  }catch(err){
    msg.textContent = "⚠️ مقدرناش نوصل للموقع الرسمي من المتصفح دلوقتي (" + err.message + ") — القائمة المدمجة الموثقة شغالة زي ما هي.";
  }
  renderHolidays(); renderAll();
});

/* ---------- مزامنة ERP (محاولة مباشرة — CORS بيمنعها غالبًا، وده موثّق) ---------- */
function erpImportRow(date, inT, outT){
  if(!date) return 0;
  const rec = days[date] || { date };
  if(inT) rec.in = inT.slice(0,5);
  if(outT) rec.out = outT.slice(0,5);
  days[date] = rec;
  return 1;
}
$("erpForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("erpEmail").value.trim(), pwd = $("erpPassword").value;
  if(!email || !pwd){ alert("دخل إيميل وباسورد الـERP الأول"); return; }
  localStorage.setItem("basmety_erp_email", email);
  try{ sessionStorage.setItem("basmety_erp_pwd", pwd); }catch(err){}
  const btn = $("btnSync"); btn.disabled = true; btn.textContent = "⏳ جاري المحاولة…";
  logSync("بدأت محاولة مزامنة مباشرة مع erp.hu.edu.eg لحساب " + email);
  try{
    const body = new URLSearchParams({ usr: email, pwd });
    const r = await fetch(ERP_BASE + "/api/method/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body, credentials: "include"
    });
    const data = await r.json().catch(() => ({}));
    if(!r.ok || data.message !== "Logged In") throw new Error("رد الـERP: " + (data.message || r.status));
    logSync("✅ تسجيل الدخول نجح — جاري سحب الحضور…");
    let imported = 0;
    // استراتيجية أ: Attendance
    try{
      const fields = encodeURIComponent(JSON.stringify(["attendance_date","in_time","out_time"]));
      const url = ERP_BASE + "/api/resource/Attendance?fields=" + fields + "&order_by=attendance_date%20asc&limit_page_length=200";
      const ra = await fetch(url, { credentials: "include" });
      const ja = await ra.json();
      (ja.data || []).forEach(row => {
        const it = row.in_time ? String(row.in_time).slice(11,16) : null;
        const ot = row.out_time ? String(row.out_time).slice(11,16) : null;
        imported += erpImportRow(row.attendance_date, it, ot);
      });
    }catch(errA){ logSync("استراتيجية Attendance فشلت: " + errA.message); }
    // استراتيجية ب: Employee Checkin لو الأولى مجابتش حاجة
    if(!imported){
      const fields = encodeURIComponent(JSON.stringify(["time","log_type"]));
      const url = ERP_BASE + "/api/resource/Employee%20Checkin?fields=" + fields + "&order_by=time%20asc&limit_page_length=500";
      const rc = await fetch(url, { credentials: "include" });
      const jc = await rc.json();
      const byDay = {};
      (jc.data || []).forEach(row => {
        const d = String(row.time).slice(0,10), t = String(row.time).slice(11,16);
        byDay[d] = byDay[d] || {};
        if(row.log_type === "IN" && !byDay[d].in) byDay[d].in = t;
        if(row.log_type === "OUT") byDay[d].out = t;
      });
      Object.keys(byDay).forEach(d => imported += erpImportRow(d, byDay[d].in, byDay[d].out));
    }
    saveDays();
    logSync(imported ? "✅ المزامنة خلصت: " + imported + " يوم اتحدث." : "الدخول نجح بس مفيش بيانات حضور راجعة.");
    renderAll();
  }catch(err){
    logSync("❌ المزامنة المباشرة فشلت: " + err.message);
    logSync("السبب المتوقع: الـERP (erp.hu.edu.eg) مش بيبعت ترويسات CORS، فالمتصفح حجب القراءة. ده سلوك متوقع من إعدادات الـERP نفسه — الحل الشغال: التسجيل اليدوي هنا، أو تطبيق الأندرويد «بصمتي» (مش مقيد بـCORS).");
  } finally {
    btn.disabled = false; btn.textContent = "🔄 مزامنة من ERP";
  }
});
$("btnClearLog").addEventListener("click", () => { syncLog = []; saveLog(); renderSyncLog(); });

/* ---------- نماذج وأزرار ---------- */
$("entryForm").addEventListener("submit", e => {
  e.preventDefault();
  const d = $("entryDate").value, i = $("entryIn").value, o = $("entryOut").value;
  if(!d){ alert("اختار التاريخ"); return; }
  if(!i && !o){ alert("دخل وقت الدخول أو الخروج على الأقل"); return; }
  const rec = days[d] || { date: d };
  if(i) rec.in = i; if(o) rec.out = o;
  if(!i) delete rec.in; if(!o) delete rec.out;
  days[d] = rec; saveDays(); renderAll();
});
function quickStamp(kind){
  const now = new Date(), tk = todayKey();
  const rec = days[tk] || { date: tk };
  rec[kind] = pad(now.getHours()) + ":" + pad(now.getMinutes());
  days[tk] = rec; saveDays(); renderAll();
}
$("btnCheckinNow").addEventListener("click", () => quickStamp("in"));
$("btnCheckoutNow").addEventListener("click", () => quickStamp("out"));
$("prevMonth").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()-1, 1); renderDays(); });
$("nextMonth").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 1); renderDays(); });
$("missingAlertBtn").addEventListener("click", () => {
  document.getElementById("classifyCard").scrollIntoView({ behavior: "smooth" });
});
$("settingsForm").addEventListener("submit", e => {
  e.preventDefault();
  settings.windowStart = $("setWindowStart").value || "07:30";
  settings.lateThreshold = $("setLateThreshold").value || "10:30";
  settings.requiredHours = Math.min(16, Math.max(1, +$("setRequiredHours").value || 8));
  saveSettings(); renderAll();
  alert("✅ اتحفظت الإعدادات");
});
$("btnWipe").addEventListener("click", () => {
  if(confirm("مسح كل بيانات «بصمتي» من المتصفح ده؟ (الأيام، التصنيفات، الإعدادات، سجل المزامنة)")){
    ["basmety_days","basmety_settings","basmety_holidays_cache","basmety_sync_log","basmety_erp_email","basmety_theme"]
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  }
});

/* بيانات تجريبية: أسبوع شغل واقعي حوالين النهاردة */
$("btnDemo").addEventListener("click", () => {
  if(!confirm("إضافة بيانات تجريبية لأيام حوالين النهاردة؟ (هتتكتب فوق أي بيانات بنفس التواريخ)")) return;
  const past = [];
  const d = new Date(); d.setDate(d.getDate() - 1);
  while(past.length < 6){
    const k = dateKey(d);
    if(!isWeekend(k) && !isHoliday(k)) past.push(k);
    d.setDate(d.getDate() - 1);
  }
  const now = new Date();
  const todayIn = new Date(now.getTime() - (2*60 + 15) * 60000);
  days[todayKey()] = { date: todayKey(), in: pad(todayIn.getHours()) + ":" + pad(todayIn.getMinutes()) };
  days[past[0]] = { date: past[0], in: "08:05", out: "16:05" };                       // يوم كامل
  days[past[1]] = { date: past[1], in: "11:00", out: "19:00" };                       // تأخير 30 د (بعد 10:30)
  days[past[2]] = { date: past[2], in: "08:00", out: "14:30" };                       // خروج بدري — ناقص 90 د
  days[past[3]] = { date: past[3], in: "08:10", out: "17:40" };                       // أوفر تايم 90 د
  days[past[4]] = { date: past[4], classification: { kind: "mission", destination: "سيكم — بلبيس" } }; // مأمورية
  // past[5] بيتنسي من غير بصمة ولا تصنيف عشان تشوف تنبيه الأيام الناقصة
  delete days[past[5]];
  saveDays(); renderAll();
  alert("✅ البيانات التجريبية جاهزة — بص على العدّاد، و«أيام ناقصة»، والأوفر تايم.");
});

/* ---------- التبويبات ---------- */
document.querySelectorAll("#tabs button").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("active", x === b));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + b.getAttribute("data-view")));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

/* ---------- بداية ---------- */
(function init(){
  applyTheme(savedTheme(), false);
  $("setWindowStart").value = settings.windowStart;
  $("setLateThreshold").value = settings.lateThreshold;
  $("setRequiredHours").value = settings.requiredHours;
  $("erpEmail").value = localStorage.getItem("basmety_erp_email") || "";
  $("entryDate").value = todayKey();
  renderAll();
  setInterval(tickCountdown, 1000);
})();
