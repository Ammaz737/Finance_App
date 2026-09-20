import type { FileStorage, StoredFile } from "./file-storage";

export class LocalStorageAdapter implements FileStorage {
  async upload(_file: Buffer, _meta: { name: string; mimeType: string }): Promise<StoredFile> {
    throw new Error("LocalStorageAdapter.upload is not implemented");
  }
  async get(_id: string): Promise<Buffer> {
    throw new Error("LocalStorageAdapter.get is not implemented");
  }
  async delete(_id: string): Promise<void> {
    throw new Error("LocalStorageAdapter.delete is not implemented");
  }
}
