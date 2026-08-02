import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("extension package metadata", () => {
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "extension", "manifest.json"), "utf8")) as {
    name: string;
    version: string;
    permissions: string[];
    host_permissions: string[];
    icons: Record<string, string>;
  };
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };

  it("giữ phiên bản và thương hiệu đồng nhất", () => {
    expect(manifest.name).toContain("ITS Calendar");
    expect(manifest.version).toBe(packageJson.version);
  });

  it("chỉ yêu cầu host QLĐT và các quyền cần thiết", () => {
    expect(manifest.host_permissions).toEqual(["https://qldt.utc.edu.vn/*"]);
    expect(manifest.permissions.sort()).toEqual(["activeTab", "downloads", "storage"].sort());
  });

  it("có đủ icon bắt buộc cho Chrome Web Store", () => {
    for (const size of ["16", "32", "48", "128"]) {
      expect(fs.existsSync(path.join(root, "extension", manifest.icons[size]!))).toBe(true);
    }
  });
});
