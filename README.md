# UTC Timetable Exporter

## Extension Chrome/Edge — cách dùng khuyên dùng

Extension chạy ngay trên tab QLĐT mà bạn đã đăng nhập. Người dùng thông thường không cần cài Node.js, không cần mở PowerShell và không cần cung cấp mật khẩu cho extension.

### Cài bản đóng gói

1. Tải file `utc-calendar-extension-v0.2.0.zip` từ trang Releases của dự án rồi giải nén.
2. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
3. Bật **Chế độ dành cho nhà phát triển**.
4. Chọn **Tải tiện ích đã giải nén** và chọn thư mục vừa giải nén.
5. Ghim **UTC Calendar Exporter** lên thanh công cụ.

Trong giai đoạn thử nghiệm, extension được cài theo cách trên. Sau khi kiểm chứng với nhiều tài khoản QLĐT, dự án có thể phát hành qua Chrome Web Store và Microsoft Edge Add-ons để cài bằng một nút.

### Xuất lịch bằng extension

1. Đăng nhập tại `https://qldt.utc.edu.vn` bằng tab Chrome/Edge bình thường.
2. Mở **Tra cứu lịch → Lịch học**.
3. Bấm biểu tượng **UTC Calendar Exporter**.
4. Chọn CSV, ICS hoặc JSON rồi bấm **Quét toàn bộ học kỳ**.
5. Có thể đóng popup trong lúc quét. Mở lại popup để xem tiến trình.
6. Khi hoàn thành, file nằm trong `Tải xuống/UTC-Calendar`.

Extension tự quét toàn bộ trang Lịch học trước, chuyển tuần và chuyển tháng, giữ các lớp thực tập không có giờ chi tiết trong JSON, sau đó đối chiếu thêm trang Lịch thi. Phòng học được ghi vào cả trường Location và phần mô tả sự kiện.

Extension chỉ yêu cầu quyền trên `https://qldt.utc.edu.vn/*`, quyền lưu trạng thái tiến trình và quyền tải file. Dữ liệu lịch được xử lý trong trình duyệt; mật khẩu và cookie không được đọc, sao chép hoặc gửi tới máy chủ của dự án.

### Build extension từ source

```powershell
npm install
npm run build:extension
```

Kết quả:

```text
dist/extension/
dist/utc-calendar-extension-v0.2.0.zip
```

Kiểm tra nhanh popup và việc content script được nạp:

```powershell
npm run smoke:extension
```

Phần CLI/Playwright cũ vẫn được giữ bên dưới làm công cụ discovery, chẩn đoán khi website thay đổi và phương án dự phòng.

Công cụ mở cổng QLĐT Trường Đại học Giao thông Vận tải trong Chromium, để bạn tự đăng nhập, sau đó đọc lịch học và lịch thi rồi xuất sang Google Calendar. Mật khẩu không đi qua terminal hay source code. Phiên đăng nhập được giữ trong một browser profile riêng tại `.data/browser-profile/`.

## Tính năng hiện có

- Giữ phiên đăng nhập bằng Playwright persistent context.
- Discovery request XHR/fetch và DOM mà không lưu header cookie/authorization.
- Ưu tiên JSON từ network; fallback sang card đang hiển thị trên giao diện.
- Tự chuyển tuần, chờ tuần đổi và DOM ổn định; không dùng `networkidle`.
- Mặc định quét toàn học kỳ: dùng ngày kết thúc xa nhất làm mốc, dự phòng thêm 8 tuần và chỉ dừng sau 4 tuần trống hợp lệ. Nếu không tìm được mốc đáng tin cậy, tool quét tối thiểu 24 tuần. Không áp trần số tuần cố định; vòng lặp được ngăn bằng phát hiện tuần bị lặp.
- Đọc và phân loại card trong trang Lịch học thành `study`, `exam`, `other`, `unknown`. Lịch thi xuất hiện ngay trên trang Lịch học không bị bỏ qua.
- Kiểm tra thêm menu Lịch thi nếu hệ thống cung cấp.
- Gộp lịch thi trùng giữa hai trang bằng exact matching và fuzzy matching có kiểm soát.
- Xuất CSV Google Calendar, ICS timezone `Asia/Ho_Chi_Minh`, normalized/raw JSON.
- Lưu snapshot và báo lịch mới, đổi, không còn xuất hiện hoặc chưa thể kết luận do tuần tải lỗi.

## Yêu cầu

- Windows 11.
- Node.js 22 trở lên (khuyên dùng bản LTS hoặc mới hơn).
- Kết nối tới `https://qldt.utc.edu.vn`.

## Cài đặt

Trong PowerShell tại thư mục dự án:

```powershell
npm install
npx playwright install chromium
```

Kiểm tra dự án:

```powershell
npm run check
```

## Bước 1 — Discovery lần đầu

Chạy:

```powershell
npm run discover
```

1. Chromium mở bằng profile riêng.
2. Nếu chưa có phiên, tự đăng nhập tài khoản trường trong cửa sổ đó. Không nhập mật khẩu vào terminal.
3. Tool mở trang Lịch học.
4. Chọn một tuần chắc chắn có lịch và thử chuyển tuần một lần để tạo request thật.
5. Quay lại PowerShell, nhấn Enter một lần.
6. Nếu tìm được menu Lịch thi, tool cũng ghi discovery cho trang này.

Kết quả nằm trong:

```text
artifacts/discovery/study/
artifacts/discovery/exams/
```

Mỗi thư mục có `report.md`, `requests.json`, `page.html`, `schedule-region.html`, `screenshot.png` và danh sách biến JavaScript an toàn. Request/response headers không được lưu; token/cookie/password trong body được che. Dù vậy HTML và ảnh có thể chứa dữ liệu cá nhân, vì thế toàn bộ artifacts đã nằm trong `.gitignore`.

Nếu website thay đổi hoặc export báo không tìm thấy nút/card, chạy discovery lại.

## Bước 2 — Xuất lịch

```powershell
npm run export
```

Chọn một trong ba phạm vi:

1. Tự động lấy toàn bộ học kỳ và lịch thi — mặc định.
2. Lấy số tuần cụ thể.
3. Lấy đến ngày cụ thể.

Tool tự chuyển tuần. Bạn không cần nhấn Enter cho từng tuần. Với chế độ tự động, một tuần chỉ được coi là trống khi không có cả lịch học, lịch thi, học vụ khác lẫn card chưa phân loại, và tuần đó phải tải thành công.

Tool quét xong phạm vi của trang **Lịch học trước** — bao gồm cả card thi xuất hiện trong lưới này và tự chuyển tháng khi tuần kế tiếp nằm ngoài lịch tháng hiện tại. Chỉ sau đó tool mới mở trang **Lịch thi** để đối chiếu/bổ sung.

Các lớp như thực tập có ngày bắt đầu/kết thúc nhưng không có card giờ học vẫn được tính là dữ liệu học vụ của tuần và được dùng để xác định phạm vi học kỳ. Chúng được lưu trong `courses_without_detail.csv/json`, nhưng không bị biến thành buổi học có giờ giả trong Calendar.

Khoảng dự phòng 8 tuần và điều kiện 4 tuần trống được đánh giá song song: tool không cộng thêm 4 tuần sau khi đã đi hết 8 tuần dự phòng. Nhờ vậy nó vẫn kiểm tra vùng có khả năng xuất hiện lịch thi nhưng không quét xa hơn cần thiết.

Các file chính:

```text
output/utc_full_academic_calendar_google.csv
output/utc_full_academic_calendar.ics
output/utc_full_academic_calendar.normalized.json
output/utc_study_calendar_google.csv
output/utc_study_calendar.ics
output/utc_exam_calendar_google.csv
output/utc_exam_calendar.ics
output/utc_unknown_events.json
output/courses_without_detail.csv
output/courses_without_detail.json
output/changes.md
output/changes.json
```

Card `unknown` luôn được giữ trong JSON nhưng mặc định không đưa vào lịch chính. Có thể chạy:

```powershell
npm run cli -- export --include-unknown
```

để đưa chúng vào CSV/ICS sau khi đã kiểm tra.

## Import vào Google Calendar

### CSV

1. Mở Google Calendar trên máy tính.
2. Vào **Cài đặt → Nhập và xuất → Nhập**.
3. Chọn `output/utc_full_academic_calendar_google.csv`.
4. Nên chọn một calendar riêng, ví dụ `UTC - Lịch học`.

CSV dùng đúng header tiếng Anh, dấu phẩy, UTF-8 BOM, ngày `MM/DD/YYYY` và giờ AM/PM.

### ICS

Thực hiện cùng màn hình **Nhập và xuất**, chọn `output/utc_full_academic_calendar.ics`. ICS là lựa chọn ưu tiên vì giữ timezone, UID, địa điểm và mô tả tốt hơn.

Mỗi buổi là một event riêng, không dùng recurrence, để phản ánh tuần nghỉ, đổi phòng và lịch thực hành/thi không đều.

## CSV, ICS và JSON khác nhau thế nào?

- **ICS:** file dùng chính để import lịch; có timezone và UID ổn định.
- **CSV:** dễ mở bằng Excel và là phương án dự phòng để import Google Calendar.
- **Normalized JSON:** dữ liệu đã validate, phân loại và loại trùng để đối chiếu.
- **Raw JSON:** dữ liệu parser thu được trước bước gộp cuối; không chứa cookie/header đăng nhập.

Sự kiện thiếu giờ bắt đầu hoặc kết thúc không được biến thành giờ giả. Chúng vẫn nằm trong JSON nhưng được bỏ qua khi tạo CSV/ICS, và số lượng sẽ được báo sau khi chạy.

## Phiên đăng nhập hết hạn và đăng xuất

Nếu session hết hạn, tool mở lại trang đăng nhập và chờ bạn đăng nhập thủ công.

Để tách phiên hiện tại và buộc đăng nhập lại:

```powershell
npm run logout
```

Profile cũ được đổi tên trong `.data/` để có thể khôi phục thủ công, và vẫn bị `.gitignore` loại trừ.

## Kiểm tra chất lượng

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Hoặc chạy tất cả:

```powershell
npm run check
```

Test bao phủ parse ngày/giờ, tuần chuyển năm, tiếng Việt, phân loại thi, chống trùng, CSV escaping, ICS escaping/folding và nguyên tắc không đánh dấu hủy khi tuần tải lỗi.

## Bảo mật và giới hạn

- Chỉ dùng với tài khoản của chính bạn và tuân thủ quy định của nhà trường.
- Tool chỉ đọc dữ liệu, không bypass captcha, không gửi request chỉnh sửa dữ liệu.
- Không dùng profile Chrome mặc định.
- Không commit `.data/`, `artifacts/discovery/`, `output/`, `credentials.json` hay `token.json`.
- Website không có API công khai đã xác minh. Adapter chỉ có thể được tinh chỉnh chính xác sau khi discovery thu được HTML/XHR thật từ phiên đăng nhập.
- Nếu lịch thi chưa được trường công bố thì lần chạy hiện tại không thể lấy trước dữ liệu. Chạy lại export sau đó sẽ tạo báo cáo thay đổi.

## Google Calendar API — giai đoạn 2

Đồng bộ OAuth trực tiếp chưa được bật ở phiên bản đầu. Chỉ nên triển khai `sync-google` sau khi discovery và việc xuất CSV/ICS đã được kiểm chứng với dữ liệu thật, để tránh tự động cập nhật sai lịch cá nhân.
