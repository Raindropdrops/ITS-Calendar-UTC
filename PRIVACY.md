# Chính sách quyền riêng tư — ITS Calendar

ITS Calendar xử lý dữ liệu lịch học ngay trong trình duyệt của người dùng.

## Dữ liệu được truy cập

- Nội dung lịch học và lịch thi đang hiển thị trên `qldt.utc.edu.vn`.
- Thông tin cần thiết để tạo sự kiện: tên môn, ngày, giờ, phòng học, mã lớp và ghi chú.
- Trạng thái tiến trình quét, được lưu cục bộ trong trình duyệt.

## Dữ liệu không được thu thập

- Extension không đọc, ghi hoặc lưu mật khẩu QLĐT.
- Extension không sao chép cookie hoặc token đăng nhập.
- Extension không gửi dữ liệu lịch tới máy chủ của tác giả hoặc bên thứ ba.
- Extension không theo dõi lịch sử duyệt web ngoài phạm vi `qldt.utc.edu.vn`.

Các file CSV, ICS và JSON chỉ được tạo trong thư mục tải xuống của người dùng. Người dùng tự quyết định việc nhập các file này vào Google Calendar hoặc dịch vụ khác.

## Quyền extension

- `activeTab`: xác định tab QLĐT mà người dùng chủ động mở extension.
- `downloads`: tạo các file lịch trong thư mục tải xuống.
- `storage`: lưu trạng thái tiến trình và thống kê lần quét gần nhất.
- `https://qldt.utc.edu.vn/*`: đọc lịch từ cổng QLĐT UTC.

## Liên hệ

Tác giả: **Đức Anh — Intelligent Transport Systems K65**  
GitHub: <https://github.com/Raindropdrops/ITS-Calendar-UTC>

ITS Calendar là dự án cộng đồng và không phải sản phẩm chính thức của Trường Đại học Giao thông Vận tải.
