# UTC Timetable Exporter

## Kiến trúc

- `src/browser`: tạo Chromium persistent và xác thực thủ công.
- `src/discovery`: ghi network/DOM an toàn và xếp hạng endpoint lịch.
- `src/adapters/utc`: đọc lưới lịch bằng network hoặc DOM, selector tập trung một chỗ.
- `src/classification`: phân loại lịch học, lịch thi, học vụ và chưa rõ.
- `src/scanner`: tự quét toàn học kỳ, có khoảng dự phòng và giới hạn an toàn.
- `src/exporters`: CSV Google Calendar, ICS và JSON.
- `src/snapshots`: so sánh lần quét mới với lần trước.

## Nguyên tắc bắt buộc

1. Không nhận, in hoặc lưu mật khẩu người dùng.
2. Không commit browser profile, cookie, token, request header nhạy cảm hay artifacts có dữ liệu cá nhân.
3. Chỉ đọc dữ liệu; không gọi request sửa dữ liệu QLĐT.
4. Không dùng `networkidle` vì trang có thể duy trì long-polling/socket.
5. Không bỏ thẻ lịch chưa nhận diện; lưu dưới dạng `unknown` để người dùng kiểm tra.
6. Không suy đoán selector/API cố định khi chưa có artifacts thật; discovery là nguồn xác minh.
7. Không coi một tuần lỗi là tuần trống và không suy luận sự kiện đã bị hủy từ tuần lỗi.
