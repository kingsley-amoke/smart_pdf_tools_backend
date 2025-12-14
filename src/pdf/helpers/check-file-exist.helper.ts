import * as fsSync from 'fs';

export function fileExists(filePath: string): boolean {
  return fsSync.existsSync(filePath);
}
