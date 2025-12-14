import * as fs from 'fs/promises';
import { fileExists } from './check-file-exist.helper';

export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (fileExists(filePath)) {
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to delete ${filePath}:`, error.message);
  }
}

export async function deleteFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    await deleteFile(filePath);
  }
}
