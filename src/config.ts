import path from "node:path";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, ".data");
export const PROFILE_DIR = path.join(DATA_DIR, "browser-profile");
export const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
export const OUTPUT_DIR = path.join(ROOT_DIR, "output");
export const DISCOVERY_DIR = path.join(ROOT_DIR, "artifacts", "discovery");
export const FAILURE_DIR = path.join(ROOT_DIR, "artifacts", "failures");

export const UTC_LOGIN_URL = "https://qldt.utc.edu.vn/congthongtin/login.aspx#dashboard";
export const UTC_STUDY_URL = "https://qldt.utc.edu.vn/congthongtin/Index.aspx#lichhoc";
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export const scanDefaults = {
  minimumForwardWeeks: 24,
  gracePeriodWeeks: 8,
  consecutiveEmptyWeeksToStop: 4,
  betweenWeeksDelayMs: 750,
  scheduleTimeoutMs: 20_000,
  stableForMs: 750,
  retryCount: 2,
} as const;

export type ScanMode = "auto-semester" | "fixed-weeks" | "until-date";

export type ScanOptions = {
  mode: ScanMode;
  fixedWeeks?: number;
  untilDate?: string;
  includeUnknown: boolean;
  privateEvents: boolean;
  saveRawJson: boolean;
  scanExamPage: boolean;
};
