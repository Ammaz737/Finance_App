import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../../config/env";

export type StoredFile = {
  storedName: string;
  storagePath: string;
  checksum: string;
  size: number;
};

export interface FileStorage {
  upload(file: Buffer, meta: { name: string; mimeType: string }): Promise<StoredFile>;
  get(storagePath: string): Promise<Buffer>;
}

export class LocalStorageAdapter implements FileStorage {
  async upload(file: Buffer, meta: { name: string }): Promise<StoredFile> {
    const checksum = crypto.createHash("sha256").update(file).digest("hex");
    const storedName = `${Date.now()}-${checksum.slice(0, 12)}-${meta.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dir = path.join(env.storagePath, "attachments");
    await fs.mkdir(dir, { recursive: true });
    const storagePath = path.join("attachments", storedName);
    await fs.writeFile(path.join(env.storagePath, storagePath), file);
    return { storedName, storagePath, checksum, size: file.length };
  }

  async get(storagePath: string): Promise<Buffer> {
    return fs.readFile(path.join(env.storagePath, storagePath));
  }
}

export const fileStorage: FileStorage = new LocalStorageAdapter();
