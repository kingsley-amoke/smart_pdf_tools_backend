import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class PdfService {
  constructor() {
    console.log('✅ PDF Service initialized');
  }

  /**
   * Merge multiple PDF files into one
   * @param filePaths Array of file paths to merge
   * @param outputPath Path where merged PDF will be saved
   */
  async mergePdfs(filePaths: string[], outputPath: string): Promise<void> {
    try {
      console.log(`📚 Starting merge of ${filePaths.length} PDFs...`);
      const startTime = Date.now();

      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // Loop through each file and add its pages
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        console.log(
          `  Processing file ${i + 1}/${filePaths.length}: ${filePath}`,
        );

        // Read the PDF file
        const pdfBytes = await fs.readFile(filePath);

        // Load the PDF
        const pdf = await PDFDocument.load(pdfBytes);

        // Get all page indices
        const pageIndices = pdf.getPageIndices();
        console.log(`    Pages: ${pageIndices.length}`);

        // Copy pages from this PDF to merged PDF
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        // Add each copied page to the merged document
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      await fs.writeFile(outputPath, mergedPdfBytes);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`✅ Merge complete in ${processingTime}ms`);
      console.log(`📄 Output: ${outputPath}`);
      console.log(
        `📦 Size: ${(mergedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`,
      );
    } catch (error) {
      console.error('❌ Merge failed:', error);
      throw new InternalServerErrorException(
        `Failed to merge PDFs: ${error.message}`,
      );
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Check if file exists
   */
  fileExists(filePath: string): boolean {
    return fsSync.existsSync(filePath);
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (this.fileExists(filePath)) {
        await fs.unlink(filePath);
        console.log(`🗑️  Deleted: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error.message);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.deleteFile(filePath);
    }
  }
}
