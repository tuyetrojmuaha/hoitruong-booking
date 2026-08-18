import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import {
  HALLS, UNITS, buildSlots, minToLabel, labelToMin,
  todayISO, toISO, addDays, isoToVNDow, isoToVN, nowMinutesIfToday,
  genLookupCode, statusLabel
} from "./shared.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const requestsCol = collection(db, "requests");

const SLOTS = buildSlots();
const MIN_DATE = addDays(todayISO(), -90);
const MAX_DATE = addDays(todayISO(), 90);
const WINDOW_DAYS = 10; // số ngày hiển thị cùng lúc trên bảng lịch — chỉnh ở đây nếu muốn 7 ngày

// ---------------- state ----------------
let windowStart = todayISO();
let allRequests = []; // toàn bộ yêu cầu trong khoảng ±90 ngày, đồng bộ theo thời gian thực
let activePick = null; // { hallId, date } đang mở ở bước chọn giờ

// ---------------- DOM refs ----------------
const calHeadRow = document.getElementById("calHeadRow");
const calBody = document.getElementById("calBody");
const jumpDate = document.getElementById("jumpDate");
const rangeLabel = document.getElementById("rangeLabel");
const reqList = document.getElementById("reqList");
const searchBox = document.getElementById("searchBox");
const toastEl = document.getElementById("toast");

const sheetOverlay = document.getElementById("sheetOverlay");
const sheetPickView = document.getElementById("sheetPickView");
const sheetFormView = document.getElementById("sheetFormView");
const sheetSuccessView = document.getElementById("sheetSuccessView");
const pickSub = document.getElementById("pickSub");
const pickStrip = document.getElementById("pickStrip");
const pickError = document.getElementById("pickError");
const sheetSub = document.getElementById("sheetSub");
const startSelect = document.getElementById("startSelect");
const endSelect = document.getElementById("endSelect");
const nameInput = document.getElementById("nameInput");
const unitSelect = document.getElementById("unitSelect");
const unitOtherField = document.getElementById("unitOtherField");
const unitOtherInput = document.getElementById("unitOtherInput");
const purposeInput = document.getElementById("purposeInput");
const formError = document.getElementById("formError");
const lookupCodeOut = document.getElementById("lookupCodeOut");

// ---------------- init static UI ----------------
jumpDate.min = MIN_DATE;
jumpDate.max = MAX_DATE;
jumpDate.value = windowStart;

UNITS.forEach(u => {
  const opt = document.createElement("option");
  opt.value = u; opt.textContent = u;
  unitSelect.appendChild(opt);
});
const otherOpt = document.createElement("option");
otherOpt.value = "__other__"; otherOpt.textContent = "Khác…";
unitSelect.appendChild(otherOpt);

unitSelect.addEventListener("change", () => {
  unitOtherField.style.display = unitSelect.value === "__other__" ? "block" : "none";
});

// ---------------- Firestore live sync ----------------
const q = query(
  requestsCol,
  where("date", ">=", MIN_DATE),
  where("date", "<=", MAX_DATE),
  orderBy("date", "desc")
);

onSnapshot(q, snap => {
  allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrid();
  renderRequestList();
  if (activePick) renderPickStrip(); // cập nhật ngay nếu đang mở modal chọn giờ
}, err => {
  showToast("Lỗi kết nối Firestore — kiểm tra firebase-config.js");
  console.error(err);
});

// ---------------- helpers ----------------
function requestsForHallDate(hallId, date) {
  return allRequests.filter(r => r.hallId === hallId && r.date === date && r.status !== "rejected");
}

function slotStatus(hallId, date, slot, nowMin) {
  if (nowMin !== null && slot.end <= nowMin) return "past";
  const reqs = requestsForHallDate(hallId, date);
  for (const r of reqs) {
    const rs = labelToMin(r.startTime), re = labelToMin(r.endTime);
    if (slot.start < re && slot.end > rs) {
      return r.status === "approved" ? "approved" : "pending";
    }
  }
  return "free";
}

function dayWindowDates() {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
}

function computeDayInfo(hallId, date) {
  const nowMin = nowMinutesIfToday(date);
  let approved = 0, pending = 0, hasFree = false;
  const seen = new Set();
  const reqs = requestsForHallDate(hallId, date);
  reqs.forEach(r => {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      if (r.status === "approved") approved++; else pending++;
    }
  });
  for (const s of SLOTS) {
    if (slotStatus(hallId, date, s, nowMin) === "free") { hasFree = true; break; }
  }
  return { approved, pending, hasFree, isPastDay: date < todayISO() };
}

// ---------------- grid rendering ----------------
function renderGridHeader() {
  calHeadRow.innerHTML = `<th class="corner-cell">Hội trường</th>`;
  const today = todayISO();
  dayWindowDates().forEach(date => {
    const th = document.createElement("th");
    if (date === today) th.classList.add("is-today");
    th.innerHTML = `<span class="dcol-dow">${shortDow(date)}</span><span class="dcol-date">${isoToVN(date).slice(0, 5)}</span>`;
    calHeadRow.appendChild(th);
  });
}

function shortDow(iso) {
  const map = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const d = new Date(iso + "T00:00:00");
  return map[d.getDay()];
}

function renderGrid() {
  renderGridHeader();
  rangeLabel.textContent = `${isoToVN(windowStart)} – ${isoToVN(addDays(windowStart, WINDOW_DAYS - 1))}`;

  calBody.innerHTML = "";
  const dates = dayWindowDates();

  HALLS.forEach(hallId => {
    const tr = document.createElement("tr");
    const hallTh = document.createElement("th");
    hallTh.className = "hall-cell";
    hallTh.textContent = hallId;
    tr.appendChild(hallTh);

    dates.forEach(date => {
      const td = document.createElement("td");
      td.className = "cal-cell";

      const info = computeDayInfo(hallId, date);
      const cell = document.createElement("div");
      cell.className = "cal-cell-inner";

      if (info.isPastDay) {
        cell.classList.add("past");
        cell.innerHTML = `<span class="cc-main">—</span>`;
      } else if (!info.hasFree) {
        cell.classList.add("full");
        cell.innerHTML = `<span class="cc-main">Kín lịch</span>`;
      } else if (info.approved + info.pending > 0) {
        cell.classList.add("mix");
        const bits = [];
        if (info.approved) bits.push(`${info.approved} đã duyệt`);
        if (info.pending) bits.push(`${info.pending} chờ`);
        cell.innerHTML = `<span class="cc-main">Còn trống</span><span class="cc-sub">${bits.join(" · ")}</span>`;
        cell.addEventListener("click", () => openDaySheet(hallId, date));
      } else {
        cell.innerHTML = `<span class="cc-main">Trống</span>`;
        cell.addEventListener("click", () => openDaySheet(hallId, date));
      }

      td.appendChild(cell);
      tr.appendChild(td);
    });

    calBody.appendChild(tr);
  });
}

// ---------------- sheet: bước 1 — chọn giờ ----------------
function openDaySheet(hallId, date) {
  activePick = { hallId, date };
  pickSub.textContent = `${hallId} · ${isoToVNDow(date)}, ${isoToVN(date)}`;
  pickError.classList.remove("show");
  renderPickStrip();

  sheetPickView.style.display = "block";
  sheetFormView.style.display = "none";
  sheetSuccessView.style.display = "none";
  sheetOverlay.classList.add("open");
}

function renderPickStrip() {
  if (!activePick) return;
  const { hallId, date } = activePick;
  const nowMin = nowMinutesIfToday(date);
  pickStrip.innerHTML = "";

  SLOTS.forEach(slot => {
    const status = slotStatus(hallId, date, slot, nowMin);
    const btn = document.createElement("div");
    btn.className = `slot ${status}`;
    btn.textContent = minToLabel(slot.start);
    if (status === "free") {
      btn.addEventListener("click", () => showFormForSlot(hallId, date, slot.start));
    }
    pickStrip.appendChild(btn);
  });
}

document.getElementById("pickCloseBtn").addEventListener("click", closeSheet);

// ---------------- sheet: bước 2 — điền form ----------------
let pendingSlotCtx = null;

function findFreeBlock(hallId, date, tappedStart, nowMin) {
  const idx = SLOTS.findIndex(s => s.start === tappedStart);
  let lo = idx, hi = idx;
  while (lo - 1 >= 0 && slotStatus(hallId, date, SLOTS[lo - 1], nowMin) === "free") lo--;
  while (hi + 1 < SLOTS.length && slotStatus(hallId, date, SLOTS[hi + 1], nowMin) === "free") hi++;
  return { blockStart: SLOTS[lo].start, blockEnd: SLOTS[hi].end };
}

function showFormForSlot(hallId, date, tappedStart) {
  const nowMin = nowMinutesIfToday(date);
  const { blockStart, blockEnd } = findFreeBlock(hallId, date, tappedStart, nowMin);
  pendingSlotCtx = { hallId, date, blockStart, blockEnd };

  sheetSub.textContent = `${hallId} · ${isoToVNDow(date)}, ${isoToVN(date)}`;

  startSelect.innerHTML = "";
  for (let t = blockStart; t < blockEnd; t += 30) {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = minToLabel(t);
    if (t === tappedStart) opt.selected = true;
    startSelect.appendChild(opt);
  }
  populateEndOptions();

  nameInput.value = "";
  unitSelect.value = UNITS[0];
  unitOtherField.style.display = "none";
  unitOtherInput.value = "";
  purposeInput.value = "";
  formError.classList.remove("show");

  sheetPickView.style.display = "none";
  sheetFormView.style.display = "block";
}

function populateEndOptions() {
  const start = Number(startSelect.value);
  const { blockEnd } = pendingSlotCtx;
  endSelect.innerHTML = "";
  for (let t = start + 30; t <= blockEnd; t += 30) {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = minToLabel(t);
    endSelect.appendChild(opt);
  }
}
startSelect.addEventListener("change", populateEndOptions);

document.getElementById("backBtn").addEventListener("click", () => {
  sheetFormView.style.display = "none";
  sheetPickView.style.display = "block";
  renderPickStrip();
});

function closeSheet() {
  sheetOverlay.classList.remove("open");
  activePick = null;
  pendingSlotCtx = null;
}
document.getElementById("doneBtn").addEventListener("click", closeSheet);
sheetOverlay.addEventListener("click", e => { if (e.target === sheetOverlay) closeSheet(); });

document.getElementById("submitBtn").addEventListener("click", async () => {
  formError.classList.remove("show");
  const { hallId, date } = pendingSlotCtx;
  const name = nameInput.value.trim();
  const unit = unitSelect.value === "__other__" ? unitOtherInput.value.trim() : unitSelect.value;
  const start = Number(startSelect.value);
  const end = Number(endSelect.value);

  if (!name) return showFormError("Vui lòng nhập họ và tên.");
  if (!unit) return showFormError("Vui lòng nhập tên đơn vị.");
  if (!(end > start)) return showFormError("Giờ kết thúc phải sau giờ bắt đầu.");

  const nowMin = nowMinutesIfToday(date);
  const conflict = SLOTS
    .filter(s => s.start >= start && s.end <= end)
    .some(s => slotStatus(hallId, date, s, nowMin) !== "free");
  if (conflict) return showFormError("Khung giờ này vừa có người đăng ký trước. Vui lòng chọn giờ khác.");

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true; submitBtn.textContent = "Đang gửi…";

  const lookupCode = genLookupCode();
  try {
    await addDoc(requestsCol, {
      hallId, date,
      startTime: minToLabel(start),
      endTime: minToLabel(end),
      requesterName: name,
      unit,
      purpose: purposeInput.value.trim(),
      status: "pending",
      rejectReason: "",
      lookupCode,
      createdAt: serverTimestamp(),
    });
    lookupCodeOut.textContent = lookupCode;
    sheetFormView.style.display = "none";
    sheetSuccessView.style.display = "block";
    activePick = null;
  } catch (e) {
    console.error(e);
    showFormError("Không gửi được yêu cầu. Kiểm tra kết nối mạng hoặc cấu hình Firebase.");
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = "Gửi đăng ký";
  }
});

function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.add("show");
}

// ---------------- window navigation ----------------
function setWindowStart(iso) {
  if (iso < MIN_DATE) iso = MIN_DATE;
  if (iso > MAX_DATE) iso = MAX_DATE;
  windowStart = iso;
  jumpDate.value = iso;
  renderGrid();
}
jumpDate.addEventListener("change", () => setWindowStart(jumpDate.value));
document.getElementById("prevWindow").addEventListener("click", () => setWindowStart(addDays(windowStart, -WINDOW_DAYS)));
document.getElementById("nextWindow").addEventListener("click", () => setWindowStart(addDays(windowStart, WINDOW_DAYS)));
document.getElementById("todayBtn").addEventListener("click", () => setWindowStart(todayISO()));

// ---------------- recent requests / lookup ----------------
function renderRequestList() {
  const term = searchBox.value.trim().toLowerCase();
  let list = allRequests;
  if (term) {
    list = list.filter(r =>
      (r.requesterName || "").toLowerCase().includes(term) ||
      (r.lookupCode || "").toLowerCase() === term
    );
  } else {
    list = list.slice(0, 20);
  }

  reqList.innerHTML = "";
  if (!list.length) {
    reqList.innerHTML = `<p class="empty-state">${term ? "Không tìm thấy yêu cầu phù hợp." : "Chưa có yêu cầu nào."}</p>`;
    return;
  }

  list.forEach(r => {
    const card = document.createElement("div");
    card.className = "req-card";
    card.innerHTML = `
      <div class="req-main">
        <div><b>${escapeHtml(r.hallId)}</b> · ${escapeHtml(isoToVN(r.date))} · ${escapeHtml(r.startTime)}–${escapeHtml(r.endTime)}</div>
        <div class="req-meta">${escapeHtml(r.requesterName)} — ${escapeHtml(r.unit || "")} · mã ${escapeHtml(r.lookupCode || "—")}</div>
        ${r.status === "rejected" && r.rejectReason ? `<div class="req-reason">Lý do từ chối: ${escapeHtml(r.rejectReason)}</div>` : ""}
      </div>
      <span class="badge ${r.status}">${statusLabel(r.status)}</span>
    `;
    reqList.appendChild(card);
  });
}
searchBox.addEventListener("input", renderRequestList);

// ---------------- utils ----------------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}
