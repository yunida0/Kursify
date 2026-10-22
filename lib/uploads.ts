import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const BASE_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export async function saveUploadedFile(file: File, folder = "umum"): Promise<string> {
  if (!file || file.size === 0) throw new Error("File kosong.");
  if (file.size > MAX_SIZE) throw new Error("Ukuran file maksimal 8 MB.");
  const ext = ALLOWED.get(file.type.toLowerCase());
  if (!ext) throw new Error("Format file harus JPG, PNG, WEBP, atau PDF.");

  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "") || "umum";
  const dir = path.join(BASE_DIR, safeFolder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `${safeFolder}/${filename}`;
}

export function resolveUploadPath(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(BASE_DIR, cleaned);
  if (!resolved.startsWith(`${BASE_DIR}${path.sep}`)) {
    throw new Error("Path file tidak valid.");
  }
  return resolved;
}

export async function readUploadedFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveUploadPath(relativePath));
}

export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[ext] ?? "application/octet-stream"
  );
}
