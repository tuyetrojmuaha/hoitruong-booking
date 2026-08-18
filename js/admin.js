import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig, ADMIN_PASSWORD } from "./firebase-config.js";
import { HALLS, isoToVN, isoToVNDow, statusLabel, todayISO, addDays } from "./shared.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const requestsCol = collection(db, "requests");

const MIN_DATE = addDays(todayISO(), -90);
const MAX_DATE = addDays(todayISO(), 90);

// ---------------- auth gate ----------------
const loginWrap = document.getElementById("loginWrap");
const adminApp = document.getElementById("adminApp");
const pwInput = document.getElementById("pwInput");
const loginError = document.getElementById("loginError");

function showApp() {
  loginWrap.style.display = "none";
  adminApp.style.display = "block";
  startListening();
}

if (sessionStorage.getItem("ht_admin_ok") === "1") {
  showApp();
}

document.getElementById("loginBtn").addEventListener("click", tryLogin);
pwInput.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });

function tryLogin() {
  if (pwInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem("ht_admin_ok", "1");
    loginError.classList.remove("show");
    showApp();
  } else {
    loginError.classList.add("show");
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("ht_admin_ok");
  location.reload();
});

// ---------------- tabs ----------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("pendingTab").style.display = tab === "pending" ? "block" : "none";
    document.getElementById("historyTab").style.display = tab === "history" ? "block" : "none";
  });
});

// ---------------- filters ----------------
const filterHall = document.getElementById("filterHall");
HALLS.forEach(h => {
  const opt = document.createElement("option");
  opt.value = h; opt.textContent = h;
  filterHall.appendChild(opt);
});
const filterStatus = document.getElementById("filterStatus");
filterHall.addEventListener("change", renderHistory);
filterStatus.addEventListener("change", renderHistory);

// ---------------- live data ----------------
let allRequests = [];

function startListening() {
  const q = query(
    requestsCol,
    where("date", ">=", MIN_DATE),
    where("date", "<=", MAX_DATE),
    orderBy("date", "desc")
  );
  onSnapshot(q, snap => {
    allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPending();
    renderHistory();
  }, err => {
    showToast("Lỗi kết nối Firestore — kiểm tra firebase-config.js");
    console.error(err);
  });
}

// ---------------- pending list ----------------
function renderPending() {
  const list = allRequests
    .filter(r => r.status === "pending")
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const el = document.getElementById("pendingList");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = `<p class="empty-state">Không có yêu cầu nào đang chờ duyệt.</p>`;
    return;
  }

  list.forEach(r => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="top-row">
        <span class="hall-tag">${esc(r.hallId)}</span>
        <span class="badge pending">${statusLabel(r.status)}</span>
      </div>
      <dl>
        <div><dt>Ngày</dt><dd>${esc(isoToVNDow(r.date))}, ${esc(isoToVN(r.date))}</dd></div>
        <div><dt>Giờ</dt><dd>${esc(r.startTime)} – ${esc(r.endTime)}</dd></div>
        <div><dt>Người ĐK</dt><dd>${esc(r.requesterName)}</dd></div>
        <div><dt>Đơn vị</dt><dd>${esc(r.unit || "—")}</dd></div>
        ${r.purpose ? `<div><dt>Mục đích</dt><dd>${esc(r.purpose)}</dd></div>` : ""}
        <div><dt>Mã tra cứu</dt><dd>${esc(r.lookupCode || "—")}</dd></div>
      </dl>
      <div class="admin-actions">
        <button class="btn btn-approve btn-sm" data-act="approve" data-id="${r.id}">Duyệt</button>
        <button class="btn btn-reject btn-sm" data-act="reject" data-id="${r.id}">Từ chối</button>
      </div>
    `;
    el.appendChild(card);
  });

  el.querySelectorAll("[data-act='approve']").forEach(b =>
    b.addEventListener("click", () => approveRequest(b.dataset.id)));
  el.querySelectorAll("[data-act='reject']").forEach(b =>
    b.addEventListener("click", () => rejectRequest(b.dataset.id)));
}

async function approveRequest(id) {
  try {
    await updateDoc(doc(db, "requests", id), { status: "approved", rejectReason: "" });
    showToast("Đã duyệt yêu cầu.");
  } catch (e) {
    console.error(e);
    showToast("Không thể cập nhật. Thử lại.");
  }
}

async function rejectRequest(id) {
  const reason = prompt("Lý do từ chối (người đăng ký sẽ nhìn thấy):");
  if (reason === null) return;
  if (!reason.trim()) { alert("Vui lòng nhập lý do từ chối."); return; }
  try {
    await updateDoc(doc(db, "requests", id), { status: "rejected", rejectReason: reason.trim() });
    showToast("Đã từ chối yêu cầu.");
  } catch (e) {
    console.error(e);
    showToast("Không thể cập nhật. Thử lại.");
  }
}

// ---------------- history list ----------------
function renderHistory() {
  let list = allRequests.slice().sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  if (filterHall.value) list = list.filter(r => r.hallId === filterHall.value);
  if (filterStatus.value) list = list.filter(r => r.status === filterStatus.value);

  const el = document.getElementById("historyList");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = `<p class="empty-state">Không có dữ liệu phù hợp.</p>`;
    return;
  }

  list.slice(0, 200).forEach(r => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="top-row">
        <span class="hall-tag">${esc(r.hallId)}</span>
        <span class="badge ${r.status}">${statusLabel(r.status)}</span>
      </div>
      <dl>
        <div><dt>Ngày</dt><dd>${esc(isoToVNDow(r.date))}, ${esc(isoToVN(r.date))}</dd></div>
        <div><dt>Giờ</dt><dd>${esc(r.startTime)} – ${esc(r.endTime)}</dd></div>
        <div><dt>Người ĐK</dt><dd>${esc(r.requesterName)} — ${esc(r.unit || "")}</dd></div>
        ${r.status === "rejected" && r.rejectReason ? `<div><dt>Lý do</dt><dd>${esc(r.rejectReason)}</dd></div>` : ""}
      </dl>
    `;
    el.appendChild(card);
  });
}

// ---------------- cleanup ----------------
document.getElementById("cleanupBtn").addEventListener("click", async () => {
  const cutoff = addDays(todayISO(), -90);
  const old = allRequests.filter(r => r.date < cutoff);
  if (!old.length) { showToast("Không có dữ liệu cũ hơn 90 ngày."); return; }
  if (!confirm(`Xoá vĩnh viễn ${old.length} yêu cầu có ngày trước ${isoToVN(cutoff)}?`)) return;
  try {
    await Promise.all(old.map(r => deleteDoc(doc(db, "requests", r.id))));
    showToast(`Đã xoá ${old.length} bản ghi cũ.`);
  } catch (e) {
    console.error(e);
    showToast("Có lỗi khi xoá dữ liệu cũ.");
  }
});

// ---------------- utils ----------------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}
