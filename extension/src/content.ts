import {
  deduplicateEvents,
  extractDomCourses,
  extractDomEvents,
  extractExamTableEvents,
  extractStateCourses,
  extractStateEvents,
  isoAddWeeks,
  parseVietnameseDate,
  toGoogleCsv,
  toIcs,
  weekDistance,
} from "./core.js";
import { STORAGE_KEY, type CalendarEvent, type CourseWithoutDetail, type PageStateSnapshot, type ScanOptions, type ScanStatus } from "./types.js";

const REQUEST_SOURCE = "UTC_CALENDAR_EXTENSION_REQUEST";
const RESPONSE_SOURCE = "UTC_CALENDAR_EXTENSION_RESPONSE";
const MINIMUM_WEEKS = 24;
const GRACE_WEEKS = 8;
const EMPTY_WEEKS_TO_STOP = 4;
const BETWEEN_WEEKS_MS = 700;
let scanning = false;
let stopRequested = false;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

async function setStatus(partial: Partial<ScanStatus>): Promise<void> {
  const current = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as ScanStatus | undefined;
  const next: ScanStatus = {
    phase: current?.phase ?? "idle",
    title: current?.title ?? "Sẵn sàng quét",
    message: current?.message ?? "Mở trang Lịch học sau khi đăng nhập QLĐT.",
    scannedWeeks: current?.scannedWeeks ?? 0,
    eventCount: current?.eventCount ?? 0,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

function readPageState(): Promise<PageStateSnapshot> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve({ events: [], courses: [] });
    }, 2_000);
    const listener = (event: MessageEvent): void => {
      if (event.source !== window || event.data?.source !== RESPONSE_SOURCE || event.data?.type !== "PAGE_STATE" || event.data?.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", listener);
      resolve(event.data.snapshot as PageStateSnapshot);
    };
    window.addEventListener("message", listener);
    window.postMessage({ source: REQUEST_SOURCE, type: "READ_PAGE_STATE", requestId }, "*");
  });
}

function activeWeek(): { label: string; start?: string; end?: string } {
  const active = document.querySelector(".my-calendar [batdau][ketthuc].active, [batdau][ketthuc].active");
  const startRaw = active?.getAttribute("batdau") ?? undefined;
  const endRaw = active?.getAttribute("ketthuc") ?? undefined;
  return {
    start: parseVietnameseDate(startRaw),
    end: parseVietnameseDate(endRaw),
    label: startRaw && endRaw ? `${startRaw} - ${endRaw}` : "Tuần đang hiển thị",
  };
}

function scheduleSignature(): string {
  const active = activeWeek();
  const text = document.querySelector("#datebody")?.textContent ?? "";
  return `${active.label}|${text.replace(/\s+/g, " ").trim()}`;
}

async function waitForSchedule(previousLabel?: string): Promise<void> {
  const started = Date.now();
  let last = "";
  let stableSince = Date.now();
  while (Date.now() - started < 20_000) {
    const signature = scheduleSignature();
    if (signature !== last) {
      last = signature;
      stableSince = Date.now();
    }
    const changed = !previousLabel || activeWeek().label !== previousLabel;
    if (document.querySelector("#datebody") && changed && Date.now() - stableSince >= 700) return;
    await sleep(180);
  }
  throw new Error("Tuần mới không tải xong sau 20 giây. Hãy kiểm tra kết nối rồi thử lại.");
}

function formatDmy(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

async function moveWeek(direction: "next" | "previous"): Promise<void> {
  const previous = activeWeek();
  if (!previous.start) throw new Error("Không xác định được tuần đang chọn trên lịch tháng.");
  const target = formatDmy(isoAddWeeks(previous.start, direction === "next" ? 1 : -1));
  let targetDay = document.querySelector<HTMLElement>(`[batdau="${target}"]`);
  for (let attempt = 0; !targetDay && attempt < 2; attempt += 1) {
    const monthButton = document.querySelector<HTMLElement>(direction === "next" ? ".my-calendar .month .next" : ".my-calendar .month .prev");
    if (!monthButton) break;
    monthButton.click();
    await sleep(350);
    targetDay = document.querySelector<HTMLElement>(`[batdau="${target}"]`);
  }
  if (!targetDay) throw new Error(`Không tìm thấy tuần ${target} trên lịch tháng.`);
  targetDay.click();
  await waitForSchedule(previous.label);
  await sleep(BETWEEN_WEEKS_MS);
}

async function ensureStudyPage(): Promise<void> {
  if (location.hash !== "#lichhoc") {
    const link = document.querySelector<HTMLElement>('a[href="#lichhoc"]');
    if (!link) throw new Error("Chưa đăng nhập QLĐT. Hãy đăng nhập rồi mở lại extension.");
    link.click();
  }
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (document.querySelector("#datebody") && document.querySelector("[batdau][ketthuc].active")) {
      await waitForSchedule();
      return;
    }
    await sleep(200);
  }
  throw new Error("Không tìm thấy trang Lịch học. Hãy mở Tra cứu lịch → Lịch học rồi thử lại.");
}

async function scanCurrentWeek(): Promise<{ events: CalendarEvent[]; courses: CourseWithoutDetail[]; start?: string; end?: string; label: string }> {
  const week = activeWeek();
  const state = await readPageState();
  const stateEvents = extractStateEvents(state, week.label);
  const events = deduplicateEvents(stateEvents.length > 0 ? [...stateEvents, ...extractDomEvents(document, week.label)] : extractDomEvents(document, week.label));
  const stateCourses = extractStateCourses(state);
  const courses = stateCourses.length > 0 ? stateCourses : extractDomCourses(document);
  return { events, courses, ...week };
}

function latestDate(events: CalendarEvent[], courses: CourseWithoutDetail[]): string | undefined {
  return [...events.map((event) => event.date), ...courses.flatMap((course) => [course.startDate, course.endDate].filter((date): date is string => Boolean(date)))].sort().at(-1);
}

function earliestDate(events: CalendarEvent[], courses: CourseWithoutDetail[]): string | undefined {
  return [...events.map((event) => event.date), ...courses.flatMap((course) => [course.startDate, course.endDate].filter((date): date is string => Boolean(date)))].sort()[0];
}

async function scanExamPage(): Promise<CalendarEvent[]> {
  const link = document.querySelector<HTMLElement>('a[href="#lichthi"]');
  if (!link) return [];
  link.click();
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (document.querySelector(".aps-lichthi, #tblLichThiCaNhan, #tblLichThiChung")) {
      await sleep(900);
      return extractExamTableEvents(document);
    }
    await sleep(200);
  }
  return [];
}

async function downloadOutputs(events: CalendarEvent[], courses: CourseWithoutDetail[], options: ScanOptions): Promise<void> {
  const included = options.includeUnknown ? events : events.filter((event) => event.eventType !== "unknown");
  const files: Array<{ filename: string; mimeType: string; content: string }> = [];
  if (options.outputCsv) files.push({ filename: "ITS-Calendar/utc_full_academic_calendar_google.csv", mimeType: "text/csv", content: toGoogleCsv(included, options.privateEvents) });
  if (options.outputIcs) files.push({ filename: "ITS-Calendar/utc_full_academic_calendar.ics", mimeType: "text/calendar", content: await toIcs(included, options.privateEvents) });
  if (options.outputJson) files.push({ filename: "ITS-Calendar/utc_full_academic_calendar.normalized.json", mimeType: "application/json", content: JSON.stringify({ product: "ITS Calendar", createdBy: "Đức Anh — Intelligent Transport Systems K65", exportedAt: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh", events, coursesWithoutDetail: courses }, null, 2) });
  if (files.length === 0) throw new Error("Hãy chọn ít nhất một định dạng file.");
  const response: { ok: boolean; error?: string } = await chrome.runtime.sendMessage({ type: "DOWNLOAD_FILES", files });
  if (!response?.ok) throw new Error(response?.error ?? "Trình duyệt không thể tải file.");
}

async function runScan(options: ScanOptions): Promise<void> {
  if (scanning) return;
  scanning = true;
  stopRequested = false;
  const allEvents: CalendarEvent[] = [];
  const allCourses: CourseWithoutDetail[] = [];
  const visited = new Set<string>();
  let scannedWeeks = 0;
  let latestKnown: string | undefined;
  let consecutiveEmpty = 0;
  try {
    await setStatus({ phase: "running", title: "Đang chuẩn bị lịch", message: "Kiểm tra trang Lịch học và phạm vi học kỳ…", scannedWeeks: 0, eventCount: 0, percent: 3 });
    await ensureStudyPage();
    const initial = await scanCurrentWeek();
    const earliest = earliestDate(initial.events, initial.courses);
    if (earliest && initial.start && earliest < initial.start) {
      const rewind = weekDistance(earliest, initial.start);
      await setStatus({ message: `Đang lùi ${rewind} tuần tới đầu học kỳ…`, percent: 5 });
      for (let index = 0; index < rewind; index += 1) await moveWeek("previous");
    }

    while (!stopRequested) {
      const result = await scanCurrentWeek();
      if (visited.has(result.label)) throw new Error(`Tuần ${result.label} bị lặp. Đã dừng để tránh quét vô hạn.`);
      visited.add(result.label);
      scannedWeeks += 1;
      allEvents.push(...result.events);
      allCourses.push(...result.courses);
      const newest = latestDate(result.events, result.courses);
      if (newest && (!latestKnown || newest > latestKnown)) {
        latestKnown = newest;
        consecutiveEmpty = 0;
      }
      const academicallyEmpty = result.events.length === 0 && result.courses.length === 0;
      const beyondKnown = Boolean(latestKnown && result.start && result.start > latestKnown);
      if (beyondKnown && academicallyEmpty) consecutiveEmpty += 1;
      else if (!academicallyEmpty) consecutiveEmpty = 0;
      const uniqueCount = deduplicateEvents(allEvents).length;
      const horizon = latestKnown ? isoAddWeeks(latestKnown, GRACE_WEEKS) : undefined;
      const canStop = latestKnown
        ? Boolean(result.end && horizon && result.end >= horizon && consecutiveEmpty >= EMPTY_WEEKS_TO_STOP)
        : scannedWeeks >= MINIMUM_WEEKS && consecutiveEmpty >= EMPTY_WEEKS_TO_STOP;
      const estimated = Math.max(MINIMUM_WEEKS, scannedWeeks + Math.max(0, EMPTY_WEEKS_TO_STOP - consecutiveEmpty));
      await setStatus({
        phase: "running",
        title: "Đang quét toàn bộ học kỳ",
        message: latestKnown ? `Mốc lịch xa nhất: ${formatDmy(latestKnown)} · trống ${consecutiveEmpty}/${EMPTY_WEEKS_TO_STOP} tuần` : "Chưa tìm thấy mốc kết thúc; tiếp tục kiểm tra.",
        scannedWeeks,
        weekLabel: result.label,
        eventCount: uniqueCount,
        percent: Math.min(92, Math.max(8, Math.round(scannedWeeks / estimated * 85))),
      });
      if (canStop) break;
      await moveWeek("next");
    }

    if (stopRequested) {
      await setStatus({ phase: "stopped", title: "Đã dừng quét", message: "Không có file nào được tạo. Bạn có thể quét lại khi sẵn sàng.", scannedWeeks, eventCount: deduplicateEvents(allEvents).length });
      return;
    }

    await setStatus({ phase: "running", title: "Đang đối chiếu lịch thi", message: "Kiểm tra thêm trang Lịch thi trước khi tạo file…", scannedWeeks, eventCount: deduplicateEvents(allEvents).length, percent: 95 });
    const examEvents = await scanExamPage();
    const events = deduplicateEvents([...allEvents, ...examEvents]);
    const courses = [...new Map(allCourses.map((course) => [`${course.classCode ?? ""}|${course.subject}|${course.startDate ?? ""}`, course])).values()];
    await downloadOutputs(events, courses, options);
    const studyCount = events.filter((event) => event.eventType === "study").length;
    const examCount = events.filter((event) => event.eventType === "exam").length;
    await setStatus({ phase: "done", title: "Đã tạo lịch", message: "Hãy chỉ nhập file .ics vào Calendar; CSV là bản dự phòng, không nhập thêm.", scannedWeeks, eventCount: events.length, studyCount, examCount, percent: 100 });
  } catch (error) {
    await setStatus({ phase: "error", title: "Chưa thể hoàn tất", message: error instanceof Error ? error.message : String(error), scannedWeeks, eventCount: deduplicateEvents(allEvents).length });
  } finally {
    scanning = false;
    stopRequested = false;
  }
}

chrome.runtime.onMessage.addListener((message: { type: string; options?: ScanOptions }, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true, page: location.hash, hasSchedule: Boolean(document.querySelector("#datebody")) });
    return;
  }
  if (message.type === "START_SCAN" && message.options) {
    if (scanning) sendResponse({ ok: false, error: "Đang có một lượt quét chạy." });
    else {
      void runScan(message.options);
      sendResponse({ ok: true });
    }
    return;
  }
  if (message.type === "STOP_SCAN") {
    stopRequested = true;
    sendResponse({ ok: true });
  }
});
