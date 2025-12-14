import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import { parseRange } from '../helpers/parse-range.helper';

@Injectable()
export class SplitService {
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
        const pageIndices = parseRange(range, totalPages);

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
}
