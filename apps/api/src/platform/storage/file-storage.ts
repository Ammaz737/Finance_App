export interface StoredFile {
  id: string;
  storagePath: string;
}

export interface FileStorage {
  upload(file: Buffer, meta: { name: string; mimeType: string }): Promise<StoredFile>;
  get(id: string): Promise<Buffer>;
  delete(id: string): Promise<void>;
}
