import { STORAGE_KEY, type ScanOptions, type ScanStatus } from "./types.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const statusCard = document.querySelector(".status-card") as HTMLElement;
const startButton = $<HTMLButtonElement>("startButton");
const stopButton = $<HTMLButtonElement>("stopButton");

function render(status?: ScanStatus): void {
  const state = status ?? { phase: "idle", title: "Sẵn sàng quét", message: "Mở trang Lịch học sau khi đăng nhập QLĐT.", scannedWeeks: 0, eventCount: 0, updatedAt: new Date().toISOString() };
  statusCard.dataset.phase = state.phase;
  $("statusTitle").textContent = state.title;
  $("statusMessage").textContent = state.message;
  const running = state.phase === "running";
  $("progressWrap").hidden = !running;
  $("summary").hidden = state.phase !== "done";
  startButton.disabled = running;
  startButton.querySelector("span")!.textContent = running ? "Đang quét trong tab QLĐT…" : "Quét toàn bộ học kỳ";
  stopButton.hidden = !running;
  if (running) {
    $("progressBar").style.width = `${state.percent ?? 5}%`;
    $("weekLabel").textContent = state.weekLabel ?? "Đang chuẩn bị…";
    $("eventCount").textContent = `${state.eventCount} sự kiện`;
  }
  if (state.phase === "done") {
    $("summaryWeeks").textContent = String(state.scannedWeeks);
    $("summaryStudy").textContent = String(state.studyCount ?? 0);
    $("summaryExam").textContent = String(state.examCount ?? 0);
  }
}

async function activeQldtTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://qldt.utc.edu.vn/")) throw new Error("Hãy mở tab QLĐT UTC đã đăng nhập rồi bấm lại extension.");
  return tab.id;
}

startButton.addEventListener("click", () => { void (async () => {
  try {
    const options: ScanOptions = {
      outputCsv: $<HTMLInputElement>("outputCsv").checked,
      outputIcs: $<HTMLInputElement>("outputIcs").checked,
      outputJson: $<HTMLInputElement>("outputJson").checked,
      privateEvents: $<HTMLInputElement>("privateEvents").checked,
      includeUnknown: $<HTMLInputElement>("includeUnknown").checked,
    };
    if (!options.outputCsv && !options.outputIcs && !options.outputJson) throw new Error("Hãy chọn ít nhất một định dạng file.");
    const tabId = await activeQldtTabId();
    const response: { ok: boolean; error?: string } = await chrome.tabs.sendMessage(tabId, { type: "START_SCAN", options });
    if (!response?.ok) throw new Error(response?.error ?? "Không thể bắt đầu quét.");
    window.close();
  } catch (error) {
    render({ phase: "error", title: "Chưa thể bắt đầu", message: error instanceof Error ? error.message : String(error), scannedWeeks: 0, eventCount: 0, updatedAt: new Date().toISOString() });
  }
  })();
});

stopButton.addEventListener("click", () => { void (async () => {
  try {
    const tabId = await activeQldtTabId();
    await chrome.tabs.sendMessage(tabId, { type: "STOP_SCAN" });
    stopButton.disabled = true;
    stopButton.textContent = "Đang dừng…";
  } catch {
    stopButton.disabled = false;
  }
  })();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) render(changes[STORAGE_KEY].newValue as ScanStatus);
});

void chrome.storage.local.get(STORAGE_KEY).then((result) => render(result[STORAGE_KEY] as ScanStatus | undefined));
