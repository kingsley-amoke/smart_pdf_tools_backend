import { PDFDocument } from 'pdf-lib';
import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';

export async function extractMetadata(inputPath: string): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
}> {
  try {
    console.log(`ℹ️  Extracting metadata from PDF`);

    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const metadata = {
      title: pdfDoc.getTitle() || undefined,
      author: pdfDoc.getAuthor() || undefined,
      subject: pdfDoc.getSubject() || undefined,
      creator: pdfDoc.getCreator() || undefined,
      producer: pdfDoc.getProducer() || undefined,
      creationDate: pdfDoc.getCreationDate()?.toISOString() || undefined,
      modificationDate:
        pdfDoc.getModificationDate()?.toISOString() || undefined,
      pageCount: pdfDoc.getPageCount(),
    };

    console.log(`✅ Metadata extracted`);
    return metadata;
  } catch (error) {
    console.error('❌ Metadata extraction failed:', error);
    throw new InternalServerErrorException(
      `Failed to extract metadata: ${error.message}`,
    );
  }
}
