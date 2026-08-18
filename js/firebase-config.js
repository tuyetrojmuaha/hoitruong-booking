// ============================================================
// FIREBASE CONFIG — dán thông tin project Firebase của bạn vào đây
// Lấy tại: Firebase Console > Project settings > General > Your apps > SDK setup
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBmEzHPO3SH0visfbTg6WaVdX4QYJYt1hk",
  authDomain: "ht108-83c5f.firebaseapp.com",
  projectId: "ht108-83c5f",
  storageBucket: "ht108-83c5f.firebasestorage.app",
  messagingSenderId: "434694057901",
  appId: "1:434694057901:web:1bb016a8d1e7eb1eda7b24"
};

// Mật khẩu admin đơn giản cho bản thử nghiệm.
// LƯU Ý BẢO MẬT: đây chỉ là khoá kiểm tra phía trình duyệt, không phải xác thực thật.
// Bất kỳ ai xem mã nguồn cũng có thể thấy mật khẩu này. Chỉ dùng cho bản thử nội bộ.
// Khi triển khai thật, nên chuyển sang Firebase Authentication.
export const ADMIN_PASSWORD = "doimatkhau123";
