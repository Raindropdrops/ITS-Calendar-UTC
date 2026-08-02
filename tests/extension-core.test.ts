import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { deduplicateEvents, extractDomCourses, extractDomEvents, extractStateEvents, parseVietnameseDate, toGoogleCsv } from "../extension/src/core.js";

describe("extension core", () => {
  it("đọc card QLĐT và giữ phòng học trong Location lẫn ghi chú CSV", () => {
    const dom = new JSDOM(`
      <div id="datebody"><div class="day-of-week" id="row17082026">
        <div class="task btnLichHoc">
          <div class="title">Tiếng Anh chuyên ngành</div>
          <div class="task-date">13:00 - 15:25 (Tiết 7-9)</div>
          <div class="task-description">Tiếng Anh chuyên ngành-1-1-26(N17)<br><br><br>302-A2<div class="eval">x</div></div>
        </div>
      </div></div>`);
    const events = extractDomEvents(dom.window.document, "17/08/2026 - 23/08/2026");
    expect(events[0]).toMatchObject({ subject: "Tiếng Anh chuyên ngành", date: "2026-08-17", startTime: "13:00", endTime: "15:25", room: "302-A2" });
    const csv = toGoogleCsv(events, true);
    expect(csv).toContain("Phòng học: 302-A2");
    expect(csv).toContain(",302-A2,True");
  });

  it("đọc lớp thực tập không có lịch chi tiết mà không tạo sự kiện giả", () => {
    const dom = new JSDOM(`<table id="tblTKBKhongLichChiTiet"><tbody><tr><td>EE0.006.2-1-1-26(N03)</td><td>Thực tập điện tử</td><td>Thực tập</td><td>07/09/2026</td><td>20/09/2026</td><td></td></tr></tbody></table>`);
    const courses = extractDomCourses(dom.window.document);
    expect(courses[0]).toMatchObject({ subject: "Thực tập điện tử", startDate: "2026-09-07", endDate: "2026-09-20" });
    expect(extractDomEvents(dom.window.document, "")).toHaveLength(0);
  });

  it("đọc page state và loại trùng DOM/network", () => {
    const event = extractStateEvents({ events: [{ TENHOCPHAN: "PLC", NGAYHOC: "18/08/2026", GIOBATDAU: 9, PHUTBATDAU: 35, GIOKETTHUC: 12, PHUTKETTHUC: 0, TENPHONGHOC: "402-A2", MALOP: "PLC-N01" }], courses: [] }, "")[0]!;
    expect(deduplicateEvents([event, { ...event, sourceExtractor: "dom" }])).toHaveLength(1);
  });

  it("không nhận ngày không hợp lệ", () => {
    expect(parseVietnameseDate("31/02/2026")).toBeUndefined();
  });
});
