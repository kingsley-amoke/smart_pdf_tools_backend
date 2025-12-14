import { InternalServerErrorException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

export async function getPageCount(filePath: string): Promise<number> {
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
