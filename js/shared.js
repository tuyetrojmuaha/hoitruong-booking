// ============================================================
// Cấu hình dùng chung: danh sách hội trường, đơn vị, khung giờ
// ============================================================

export const HALLS = Array.from({ length: 14 }, (_, i) => `HT${i + 1}`);

// Danh sách đơn vị — chỉnh sửa danh sách này khi cần.
// Thêm/xoá dòng trong mảng bên dưới. "Khác" luôn hiển thị cuối cùng trong dropdown.
export const UNITS = [
  "Phòng Kế hoạch",
  "Phòng Chính trị",
  "Phòng Hậu cần",
  "Phòng Kỹ thuật",
  "Ban Chỉ huy",
  "Phòng Đào tạo",
  "Khoa Nội",
  "Khoa Ngoại",
  "Khoa Dược",
];

// Giờ hoạt động của hội trường: 06:00 - 22:00, mỗi ô 30 phút
export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 22 * 60;
export const SLOT_MINUTES = 30;

function pad2(n) { return String(n).padStart(2, "0"); }
export function minToLabel(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}
export function labelToMin(label) {
  const [h, m] = label.split(":").map(Number);
  return h * 60 + m;
}

export function buildSlots() {
  const slots = [];
  for (let t = DAY_START_MIN; t < DAY_END_MIN; t += SLOT_MINUTES) {
    slots.push({ start: t, end: t + SLOT_MINUTES });
  }
  return slots;
}

export function todayISO() {
  const d = new Date();
  return toISO(d);
}
export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function addDays(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toISO(d);
}
export function isoToVNDow(iso) {
  const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const d = new Date(iso + "T00:00:00");
  return days[d.getDay()];
}
export function isoToVN(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function nowMinutesIfToday(iso) {
  if (iso !== todayISO()) return null;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Sinh mã tra cứu ngắn cho mỗi yêu cầu đăng ký
export function genLookupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function statusLabel(status) {
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  return "Chờ duyệt";
}
