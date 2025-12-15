import * as fs from 'fs/promises';
import { fileExists } from './check-file-exist.helper';

export async function deleteFile(filePath?: string): Promise<void> {
  if (!filePath) return;
  try {
    if (fileExists(filePath)) {
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to delete ${filePath}:`, error.message);
  }
}

export async function deleteFiles(filePaths?: string[]): Promise<void> {
  if (!filePaths || filePaths.length === 0) return;
  for (const filePath of filePaths) {
    await deleteFile(filePath);
  }
}
