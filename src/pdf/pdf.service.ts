import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { PDFDocument } from 'pdf-lib';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

@Injectable()
export class PdfService {
  constructor() {
    console.log('✅ PDF Service initialized');
  }

  /**
   * Validate PDF file
   * @param filePath Path to PDF file
   * @returns true if valid, false otherwise
   */
  async validatePdf(filePath: string): Promise<boolean> {
    try {
      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const pageCount = pdfDoc.getPageCount();
      return pageCount > 0;
    } catch (error) {
      console.error(`PDF validation failed: ${error.message}`);
      return false;
    }
  }

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

  // /**
  //  * Merge multiple PDF files into one
  //  * @param filePaths Array of file paths to merge
  //  * @param outputPath Path where merged PDF will be saved
  //  */
  // async mergePdfs(filePaths: string[], outputPath: string): Promise<void> {
  //   try {
  //     console.log(`📚 Starting merge of ${filePaths.length} PDFs...`);
  //     const startTime = Date.now();

  //     // Create a new PDF document
  //     const mergedPdf = await PDFDocument.create();

  //     // Loop through each file and add its pages
  //     for (let i = 0; i < filePaths.length; i++) {
  //       const filePath = filePaths[i];
  //       console.log(
  //         `  Processing file ${i + 1}/${filePaths.length}: ${filePath}`,
  //       );

  //       // Read the PDF file
  //       const pdfBytes = await fs.readFile(filePath);

  //       // Load the PDF
  //       const pdf = await PDFDocument.load(pdfBytes);

  //       // Get all page indices
  //       const pageIndices = pdf.getPageIndices();
  //       console.log(`    Pages: ${pageIndices.length}`);

  //       // Copy pages from this PDF to merged PDF
  //       const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

  //       // Add each copied page to the merged document
  //       copiedPages.forEach((page) => {
  //         mergedPdf.addPage(page);
  //       });
  //     }

  //     // Save the merged PDF
  //     const mergedPdfBytes = await mergedPdf.save();
  //     await fs.writeFile(outputPath, mergedPdfBytes);

  //     const endTime = Date.now();
  //     const processingTime = endTime - startTime;

  //     console.log(`✅ Merge complete in ${processingTime}ms`);
  //     console.log(`📄 Output: ${outputPath}`);
  //     console.log(
  //       `📦 Size: ${(mergedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`,
  //     );
  //   } catch (error) {
  //     console.error('❌ Merge failed:', error);
  //     throw new InternalServerErrorException(
  //       `Failed to merge PDFs: ${error.message}`,
  //     );
  //   }
  // }

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
  /**
   * Split PDF by page ranges (IMPROVED VERSION)
   * @param inputPath Path to PDF file
   * @param ranges Array of page ranges like ["1-3", "5", "7-10"]
   * @param outputDir Directory to save split PDFs
   * @returns Array of output file paths
   */
  async splitByRanges(
    inputPath: string,
    ranges: string[],
    outputDir: string,
  ): Promise<string[]> {
    try {
      console.log(`✂️  Splitting PDF by ranges: ${ranges.join(', ')}`);
      const startTime = Date.now();

      // Read the PDF
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const totalPages = pdfDoc.getPageCount();

      console.log(`📄 Total pages: ${totalPages}`);

      const outputPaths: string[] = [];

      // Process each range
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        console.log(`  Processing range ${i + 1}: ${range}`);

        // Parse range (e.g., "1-3" or "5")
        const pageIndices = this.parseRange(range, totalPages);

        if (pageIndices.length === 0) {
          console.warn(`  ⚠️  Skipping invalid range: ${range}`);
          continue;
        }

        try {
          // Create new PDF for this range
          const newPdf = await PDFDocument.create();

          // Copy pages one by one with error handling
          for (const pageIndex of pageIndices) {
            try {
              const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
              newPdf.addPage(copiedPage);
            } catch (pageError) {
              console.error(
                `  ⚠️  Failed to copy page ${pageIndex + 1}, skipping:`,
                pageError.message,
              );
            }
          }

          // Only save if we have pages
          if (newPdf.getPageCount() > 0) {
            // Save the split PDF
            const outputPath = `${outputDir}/split_${i + 1}_pages_${range.replace('/', '-')}.pdf`;
            const splitPdfBytes = await newPdf.save();
            await fs.writeFile(outputPath, splitPdfBytes);

            outputPaths.push(outputPath);
            console.log(
              `  ✅ Created: ${outputPath} (${newPdf.getPageCount()} pages)`,
            );
          } else {
            console.warn(`  ⚠️  Range ${range} has no valid pages, skipping`);
          }
        } catch (rangeError) {
          console.error(
            `  ❌ Failed to process range ${range}:`,
            rangeError.message,
          );
          // Continue with next range
        }
      }

      if (outputPaths.length === 0) {
        throw new InternalServerErrorException('No valid pages could be split');
      }

      const endTime = Date.now();
      console.log(`✅ Split complete in ${endTime - startTime}ms`);

      return outputPaths;
    } catch (error) {
      console.error('❌ Split by ranges failed:', error);
      throw new InternalServerErrorException(
        `Failed to split PDF: ${error.message}`,
      );
    }
  }

  /**
   * Split PDF into individual pages (IMPROVED VERSION)
   * @param inputPath Path to PDF file
   * @param outputDir Directory to save pages
   * @returns Array of output file paths
   */
  async splitIntoPages(
    inputPath: string,
    outputDir: string,
  ): Promise<string[]> {
    try {
      console.log(`✂️  Splitting PDF into individual pages`);
      const startTime = Date.now();

      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const totalPages = pdfDoc.getPageCount();

      console.log(`📄 Total pages: ${totalPages}`);

      const outputPaths: string[] = [];

      // Create a separate PDF for each page
      for (let i = 0; i < totalPages; i++) {
        try {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
          newPdf.addPage(copiedPage);

          const outputPath = `${outputDir}/page_${i + 1}.pdf`;
          const pagePdfBytes = await newPdf.save();
          await fs.writeFile(outputPath, pagePdfBytes);

          outputPaths.push(outputPath);

          if ((i + 1) % 10 === 0) {
            console.log(`  Progress: ${i + 1}/${totalPages} pages`);
          }
        } catch (pageError) {
          console.error(
            `  ⚠️  Failed to extract page ${i + 1}, skipping:`,
            pageError.message,
          );
          // Continue with other pages
        }
      }

      if (outputPaths.length === 0) {
        throw new InternalServerErrorException(
          'No valid pages could be extracted',
        );
      }

      const endTime = Date.now();
      console.log(
        `✅ Split complete in ${endTime - startTime}ms (${outputPaths.length}/${totalPages} pages)`,
      );

      return outputPaths;
    } catch (error) {
      console.error('❌ Split into pages failed:', error);
      throw new InternalServerErrorException(
        `Failed to split PDF: ${error.message}`,
      );
    }
  }

  /**
   * Split PDF every N pages (FIXED VERSION)
   * @param inputPath Path to PDF file
   * @param pagesPerSplit Number of pages per split
   * @param outputDir Directory to save splits
   * @returns Array of output file paths
   */
  async splitEveryNPages(
    inputPath: string,
    pagesPerSplit: number,
    outputDir: string,
  ): Promise<string[]> {
    try {
      console.log(`✂️  Splitting PDF every ${pagesPerSplit} pages`);
      const startTime = Date.now();

      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true, // Handle encrypted PDFs
      });
      const totalPages = pdfDoc.getPageCount();

      console.log(`📄 Total pages: ${totalPages}`);

      const outputPaths: string[] = [];
      let splitNumber = 1;

      // Split into chunks
      for (let i = 0; i < totalPages; i += pagesPerSplit) {
        const endPage = Math.min(i + pagesPerSplit, totalPages);
        const pageIndices: number[] = [];

        for (let j = i; j < endPage; j++) {
          pageIndices.push(j);
        }

        console.log(
          `  Creating split ${splitNumber}: pages ${i + 1}-${endPage}`,
        );

        try {
          const newPdf = await PDFDocument.create();

          // Copy pages one by one with error handling
          for (const pageIndex of pageIndices) {
            try {
              const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
              newPdf.addPage(copiedPage);
            } catch (pageError) {
              console.error(
                `  ⚠️  Failed to copy page ${pageIndex + 1}, skipping:`,
                pageError.message,
              );
              // Continue with other pages
            }
          }

          // Only save if we have pages
          if (newPdf.getPageCount() > 0) {
            const outputPath = `${outputDir}/split_${splitNumber}_pages_${i + 1}-${endPage}.pdf`;
            const splitPdfBytes = await newPdf.save();
            await fs.writeFile(outputPath, splitPdfBytes);

            outputPaths.push(outputPath);
            console.log(
              `  ✅ Created: ${outputPath} (${newPdf.getPageCount()} pages)`,
            );
          } else {
            console.warn(
              `  ⚠️  Split ${splitNumber} has no valid pages, skipping`,
            );
          }

          splitNumber++;
        } catch (splitError) {
          console.error(
            `  ❌ Failed to create split ${splitNumber}:`,
            splitError.message,
          );
          // Continue with next split
          splitNumber++;
        }
      }

      if (outputPaths.length === 0) {
        throw new InternalServerErrorException('No valid pages could be split');
      }

      const endTime = Date.now();
      console.log(`✅ Split complete in ${endTime - startTime}ms`);

      return outputPaths;
    } catch (error) {
      console.error('❌ Split every N pages failed:', error);
      throw new InternalServerErrorException(
        `Failed to split PDF: ${error.message}`,
      );
    }
  }

  /**
   * Create ZIP file from multiple files
   * @param filePaths Array of file paths to include
   * @param outputPath Path where ZIP will be saved
   */
  async createZip(filePaths: string[], outputPath: string): Promise<void> {
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

  /**
   * Parse page range string into array of page indices
   * @param range String like "1-3" or "5" or "10-15"
   * @param totalPages Total number of pages in document
   * @returns Array of 0-indexed page numbers
   */
  private parseRange(range: string, totalPages: number): number[] {
    const indices: number[] = [];

    if (range.includes('-')) {
      // Range like "1-3"
      const [start, end] = range.split('-').map((n) => parseInt(n.trim()));

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 1 ||
        end > totalPages ||
        start > end
      ) {
        return [];
      }

      for (let i = start; i <= end; i++) {
        indices.push(i - 1); // Convert to 0-indexed
      }
    } else {
      // Single page like "5"
      const page = parseInt(range.trim());

      if (isNaN(page) || page < 1 || page > totalPages) {
        return [];
      }

      indices.push(page - 1); // Convert to 0-indexed
    }

    return indices;
  }

  /**
   * Get page count from PDF
   */
  async getPageCount(filePath: string): Promise<number> {
    try {
      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      return pdfDoc.getPageCount();
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to read PDF: ${error.message}`,
      );
    }
  }
}
