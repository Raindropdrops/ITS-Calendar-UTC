/* eslint-disable @typescript-eslint/no-unsafe-call */
import { build } from "esbuild";
import { ZipArchive } from "archiver";
import { createWriteStream } from "node:fs";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const output = path.join(root, "dist", "extension");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await build({
  entryPoints: {
    background: path.join(root, "extension", "src", "background.ts"),
    content: path.join(root, "extension", "src", "content.ts"),
    popup: path.join(root, "extension", "src", "popup.ts"),
    "page-bridge": path.join(root, "extension", "src", "page-bridge.ts"),
  },
  outdir: output,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome111", "edge111"],
  minify: true,
  sourcemap: false,
});

for (const file of ["manifest.json", "popup.html", "popup.css"]) {
  await cp(path.join(root, "extension", file), path.join(output, file));
}
await cp(path.join(root, "extension", "assets"), path.join(output, "assets"), { recursive: true });

const manifest = JSON.parse(await readFile(path.join(root, "extension", "manifest.json"), "utf8"));
const zipPath = path.join(root, "dist", `its-calendar-v${manifest.version}.zip`);
await rm(zipPath, { force: true });
await new Promise((resolve, reject) => {
  const stream = createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  stream.on("close", resolve);
  stream.on("error", reject);
  archive.on("error", reject);
  archive.pipe(stream);
  archive.directory(output, false);
  void archive.finalize();
});

process.stdout.write(`Extension đã được tạo tại ${output}\nGói cài đặt: ${zipPath}\n`);
