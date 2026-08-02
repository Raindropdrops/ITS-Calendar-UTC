import type { PageStateSnapshot } from "./types.js";

const REQUEST_SOURCE = "UTC_CALENDAR_EXTENSION_REQUEST";
const RESPONSE_SOURCE = "UTC_CALENDAR_EXTENSION_RESPONSE";

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.data?.source !== REQUEST_SOURCE || event.data?.type !== "READ_PAGE_STATE") return;
  const state = (window as unknown as { main_doc?: { LichGiang?: Record<string, unknown> } }).main_doc?.LichGiang;
  const snapshot: PageStateSnapshot = {
    events: Array.isArray(state?.dtLichHoc) ? structuredClone(state.dtLichHoc) as Record<string, unknown>[] : [],
    courses: Array.isArray(state?.dtTKBKhongLichChiTiet) ? structuredClone(state.dtTKBKhongLichChiTiet) as Record<string, unknown>[] : [],
  };
  window.postMessage({ source: RESPONSE_SOURCE, type: "PAGE_STATE", requestId: event.data.requestId, snapshot }, "*");
});
