# Bảng đăng ký hội trường (HT1–HT14)

Web app thuần frontend (HTML/CSS/JS, không cần build) để đăng ký và phê duyệt lịch sử dụng
14 hội trường. Dữ liệu dùng chung được lưu trên Firebase Firestore (miễn phí), nên nhiều
người có thể đăng ký từ điện thoại/máy tính khác nhau và admin duyệt theo thời gian thực.

- `index.html` — bảng lịch công khai, ai cũng vào đăng ký được, tối ưu cho điện thoại.
- `admin.html` — trang quản trị (có mật khẩu) để duyệt / từ chối / xem lịch sử.
- Không cần Node.js, không cần server riêng — deploy thẳng lên GitHub Pages.

---

## 1. Tạo project Firebase (5 phút, miễn phí)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên bất kỳ (vd `hoitruong-108`) → tạo xong.
2. Trong project, vào **Build → Firestore Database** → **Create database** → chọn **Start in production mode** → chọn khu vực gần Việt Nam (vd `asia-southeast1`) → **Enable**.
3. Vào **Project settings** (biểu tượng bánh răng) → mục **Your apps** → bấm biểu tượng **</>** (Web) → đặt tên app → **Register app**.
4. Firebase sẽ hiện đoạn `firebaseConfig = {...}`. Copy toàn bộ object này.

## 2. Cấu hình project

1. Mở file `js/firebase-config.js`.
2. Dán các giá trị `apiKey`, `authDomain`, `projectId`, ... từ bước trên vào.
3. Đổi `ADMIN_PASSWORD` thành mật khẩu quản trị bạn muốn dùng.
   > ⚠️ Đây chỉ là khoá kiểm tra phía trình duyệt (không phải tài khoản thật), ai xem
   > được mã nguồn cũng thấy mật khẩu. Phù hợp cho bản thử nội bộ; xem mục Bảo mật bên dưới
   > nếu muốn nâng cấp sau này.

## 3. Áp dụng quy tắc bảo mật Firestore

1. Trong Firebase Console → **Firestore Database → Rules**.
2. Mở file `firestore.rules` trong repo này, copy toàn bộ nội dung, dán đè vào ô Rules trên Console.
3. Bấm **Publish**.

## 4. Chạy thử trên máy (tuỳ chọn)

Vì trang dùng ES module (`type="module"`), cần mở qua một server local nhỏ thay vì mở file trực tiếp:

```bash
# Python có sẵn trên hầu hết máy:
python3 -m http.server 8080
# rồi mở http://localhost:8080
```

Hoặc dùng extension **Live Server** của VS Code.

## 5. Đẩy lên GitHub và bật GitHub Pages

```bash
cd hoitruong-booking
git init
git add .
git commit -m "Bảng đăng ký hội trường"
git branch -M main
git remote add origin https://github.com/<tài-khoản-của-bạn>/<tên-repo>.git
git push -u origin main
```

Sau đó: vào repo trên GitHub → **Settings → Pages** → **Source: Deploy from a branch** →
chọn branch `main`, thư mục `/ (root)` → **Save**. Sau 1–2 phút, app sẽ chạy tại:
`https://<tài-khoản-của-bạn>.github.io/<tên-repo>/`

---

## Tuỳ chỉnh

- **Danh sách đơn vị**: sửa mảng `UNITS` trong `js/shared.js`.
- **Khung giờ hoạt động / độ dài mỗi ô**: sửa `DAY_START_MIN`, `DAY_END_MIN`, `SLOT_MINUTES` trong `js/shared.js` (mặc định 06:00–22:00, mỗi ô 30 phút).
- **Số hội trường**: sửa `HALLS` trong `js/shared.js` (mặc định tự sinh HT1–HT14).
- **Số ngày hiển thị trên bảng lịch**: sửa `WINDOW_DAYS` trong `js/app.js` (mặc định 10 ngày, có thể đổi thành 7).
- **Thời gian lưu lịch sử**: mặc định app chỉ tải/hiển thị dữ liệu trong khoảng 90 ngày
  trước và sau ngày hiện tại (biến `MIN_DATE` / `MAX_DATE` trong `js/app.js` và `js/admin.js`).
  Trang admin có nút **"Dọn dẹp lịch sử cũ"** để xoá hẳn các bản ghi quá 90 ngày khỏi Firestore.

## Cách hoạt động

- Mở trang là thấy ngay **bảng lịch dạng lưới**: hàng là 14 hội trường, cột là 10 ngày sắp tới
  (chỉnh số ngày bằng `WINDOW_DAYS` trong `js/app.js`). Vuốt ngang để xem thêm ngày, dùng nút
  `‹ ›` hoặc ô chọn ngày để nhảy sang tuần khác/xem lại lịch sử.
- Mỗi ô hiển thị nhanh: **Trống**, **Còn trống** (kèm số lịch đã duyệt/chờ duyệt trong ngày đó),
  hoặc **Kín lịch** (hết giờ trống, không bấm được). Bấm vào ô còn trống sẽ mở bảng chọn giờ
  cụ thể trong ngày đó (từng ô 30 phút) — chọn giờ trống rồi điền thông tin đăng ký.
- Khi đăng ký, chọn giờ bắt đầu/kết thúc (chỉ trong đoạn thời gian còn trống liên tục),
  nhập họ tên, đơn vị, mục đích → yêu cầu được lưu với trạng thái **Chờ duyệt** và một
  **mã tra cứu** 6 ký tự.
- Vì không có tài khoản đăng nhập, người đăng ký dùng mục **"Tra cứu đăng ký"** ở cuối
  trang chính (tìm theo tên hoặc mã tra cứu) để xem yêu cầu đã được duyệt hay từ chối —
  nếu từ chối sẽ hiện rõ lý do admin đã nhập.
- Trang `admin.html` (có mật khẩu) hiển thị danh sách chờ duyệt, cho phép **Duyệt** hoặc
  **Từ chối kèm lý do**; tab **Lịch sử** cho xem/lọc toàn bộ theo hội trường và trạng thái.

## Lưu ý bảo mật (đọc trước khi dùng thật)

Bản này ưu tiên đơn giản để bạn "chạy thử" nhanh:

- Mật khẩu admin chỉ được kiểm tra ở trình duyệt, **không phải xác thực server thật**.
  Firestore rules hiện cho phép bất kỳ ai (kể cả không qua trang admin) gọi API để
  sửa/xoá dữ liệu nếu họ cố tình. Với công cụ dùng nội bộ, rủi ro thấp, nhưng nếu triển
  khai chính thức / công khai rộng rãi, nên:
  1. Bật **Firebase Authentication** (email/password hoặc Google) cho tài khoản admin.
  2. Gán custom claim `admin: true` cho tài khoản đó (qua Cloud Function hoặc Admin SDK).
  3. Sửa `firestore.rules`, đổi dòng `allow update, delete: if true;` thành kiểm tra
     `request.auth.token.admin == true` (đã có sẵn gợi ý trong comment của file rules).
