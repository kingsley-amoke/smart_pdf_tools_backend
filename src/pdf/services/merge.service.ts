import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

@Injectable()
export class MergeService {
  /**
   * Merge multiple PDF files into one (IMPROVED VERSION)
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

        try {
          // Read the PDF file
          const pdfBytes = await fs.readFile(filePath);

          // Load the PDF
          const pdf = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: true,
          });

          // Get all page indices
          const pageIndices = pdf.getPageIndices();
          console.log(`    Pages: ${pageIndices.length}`);

          // Copy pages from this PDF to merged PDF
          const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

          // Add each copied page to the merged document
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
        } catch (fileError) {
          console.error(
            `  ❌ Failed to process file ${i + 1}:`,
            fileError.message,
          );
          console.error(
            `  ⚠️  Skipping this file and continuing with others...`,
          );
          // Continue with other files
        }
      }

      // Check if we have any pages
      if (mergedPdf.getPageCount() === 0) {
        throw new InternalServerErrorException('No valid pages to merge');
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
      console.log(`📄 Total pages: ${mergedPdf.getPageCount()}`);
    } catch (error) {
      console.error('❌ Merge failed:', error);
      throw new InternalServerErrorException(
        `Failed to merge PDFs: ${error.message}`,
      );
    }
  }
}
