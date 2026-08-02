import type { Page, Request, Response } from "playwright";
import { redactText } from "./redaction.js";

export type NetworkRecord = {
  timestamp: string;
  method: string;
  url: string;
  resourceType: string;
  requestPostData?: string;
  status?: number;
  contentType?: string;
  responseSize?: number;
  responseBody?: string;
  bodyTruncated?: boolean;
  error?: string;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
export class NetworkRecorder {
  readonly records: NetworkRecord[] = [];
  private requestTimes = new WeakMap<Request, string>();
  private origin = "";

  attach(page: Page): void {
    this.origin = new URL(page.url() === "about:blank" ? "https://qldt.utc.edu.vn" : page.url()).origin;
    page.on("request", (request) => {
      if (!["xhr", "fetch"].includes(request.resourceType())) return;
      this.requestTimes.set(request, new Date().toISOString());
    });
    page.on("response", (response) => void this.capture(response));
    page.on("requestfailed", (request) => {
      if (!["xhr", "fetch"].includes(request.resourceType())) return;
      this.records.push({
        timestamp: this.requestTimes.get(request) ?? new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        requestPostData: request.postData() ? redactText(request.postData()!) : undefined,
        error: request.failure()?.errorText ?? "Request failed",
      });
    });
  }

  private async capture(response: Response): Promise<void> {
    const request = response.request();
    if (!["xhr", "fetch"].includes(request.resourceType())) return;
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (url.origin !== this.origin) return;

    const contentType = response.headers()["content-type"] ?? "";
    const base: NetworkRecord = {
      timestamp: this.requestTimes.get(request) ?? new Date().toISOString(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      requestPostData: request.postData() ? redactText(request.postData()!) : undefined,
      status: response.status(),
      contentType,
    };

    try {
      const body = await response.body();
      const text = body.subarray(0, MAX_BODY_BYTES).toString("utf8");
      this.records.push({
        ...base,
        responseSize: body.length,
        responseBody: redactText(text),
        bodyTruncated: body.length > MAX_BODY_BYTES,
      });
    } catch (error) {
      this.records.push({ ...base, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
