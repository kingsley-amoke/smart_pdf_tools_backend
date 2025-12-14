import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

/**
 * Validate PDF file
 * @param filePath Path to PDF file
 * @returns true if valid, false otherwise
 */
export async function validatePdf(filePath: string): Promise<boolean> {
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
