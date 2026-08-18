import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";
import { HALLS, isoToVN, isoToVNDow, statusLabel, todayISO, addDays } from "./shared.js";

// Khởi tạo Firebase & Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const requestsCol = collection(db, "requests");

const MIN_DATE = addDays(todayISO(), -90);
const MAX_DATE = addDays(todayISO(), 90);

// ---------------- DOM Element References ----------------
const loginWrap = document.getElementById("loginWrap");
const adminApp = document.getElementById("adminApp");
const emailInput = document.getElementById("emailInput");
const pwInput = document.getElementById("pwInput");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

let unsubscribeSnapshot = null; // Biến lưu hàm hủy lắng nghe khi logout
let allRequests = [];

// ---------------- Theo dõi trạng thái đăng nhập ----------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginWrap.style.display = "none";
    adminApp.style.display = "block";
    startListening();
  } else {
    loginWrap.style.display = "flex";
    adminApp.style.display = "none";
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});

// ---------------- Xử lý Đăng nhập / Đăng xuất ----------------
loginBtn.addEventListener("click", tryLogin);
pwInput.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
if (emailInput) {
  emailInput.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
}

async function tryLogin() {
  const email = emailInput ? emailInput.value.trim() : "";
  const password = pwInput.value;

  if (!email || !password) {
    loginError.textContent = "Vui lòng nhập đầy đủ email và mật khẩu.";
    loginError.classList.add("show");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Đang xác thực...";
  loginError.classList.remove("show");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    loginError.textContent = "Email hoặc mật khẩu không chính xác.";
    loginError.classList.add("show");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Đăng nhập";
  }
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Lỗi đăng xuất:", e);
  }
});

// ---------------- Tabs Control ----------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("pendingTab").style.display = tab === "pending" ? "block" : "none";
    document.getElementById("historyTab").style.display = tab === "history" ? "block" : "none";
  });
});

// ---------------- Filters Control ----------------
const filterHall = document.getElementById("filterHall");
HALLS.forEach(h => {
  const opt = document.createElement("option");
  opt.value = h; 
  opt.textContent = h;
  filterHall.appendChild(opt);
});
const filterStatus = document.getElementById("filterStatus");
filterHall.addEventListener("change", renderHistory);
filterStatus.addEventListener("change", renderHistory);

// ---------------- Realtime Data Sync ----------------
function startListening() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  const q = query(
    requestsCol,
    where("date", ">=", MIN_DATE),
    where("date", "<=", MAX_DATE),
    orderBy("date", "desc")
  );

  unsubscribeSnapshot = onSnapshot(q, snap => {
    allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPending();
    renderHistory();
  }, err => {
    showToast("Lỗi kết nối Firestore — Kiểm tra quyền truy cập hoặc firebase-config.js");
    console.error("Firestore Listen Error:", err);
  });
}

// ---------------- Danh sách Chờ duyệt ----------------
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
        <div><dt>SĐT</dt><dd><a href="tel:${esc(r.phone)}" style="color:var(--accent-amber);">${esc(r.phone || "—")}</a></dd></div>
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
    showToast("Không thể cập nhật. Vui lòng thử lại.");
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
    showToast("Không thể cập nhật. Vui lòng thử lại.");
  }
}

// ---------------- Danh sách Lịch sử ----------------
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
        <div><dt>Người ĐK</dt><dd>${esc(r.requesterName)} (${esc(r.phone || "N/A")}) — ${esc(r.unit || "")}</dd></div>
        ${r.status === "rejected" && r.rejectReason ? `<div><dt>Lý do</dt><dd>${esc(r.rejectReason)}</dd></div>` : ""}
      </dl>
    `;
    el.appendChild(card);
  });
}

// ---------------- Dọn dẹp dữ liệu cũ ----------------
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

// ---------------- Tiện ích (Utils) ----------------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ 
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" 
  }[c]));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}