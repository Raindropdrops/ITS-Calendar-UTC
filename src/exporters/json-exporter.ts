import path from "node:path";
import { writeJson } from "../utils/filesystem.js";

export async function writeNormalizedJson(filePath: string, value: unknown): Promise<void> {
  await writeJson(filePath, value);
}

export function outputPath(outputDirectory: string, filename: string): string {
  return path.join(outputDirectory, filename);
}
