import archiver from 'archiver';
import { createWriteStream } from 'fs';

/**
 * Create ZIP file from multiple files
 * @param filePaths Array of file paths to include
 * @param outputPath Path where ZIP will be saved
 */
export async function createZip(
  filePaths: string[],
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📦 Creating ZIP with ${filePaths.length} files...`);

    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ ZIP created: ${sizeMB} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ ZIP creation failed:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add each file to the archive
    filePaths.forEach((filePath) => {
      const fileName = filePath.split('/').pop();
      archive.file(filePath, { name: fileName! });
    });

    archive.finalize();
  });
}
