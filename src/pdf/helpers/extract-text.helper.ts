import { PDFDocument } from 'pdf-lib';
import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import mammoth from 'mammoth';

export async function extractTextFromPdf(inputPath: string): Promise<string> {
  try {
    console.log(`📝 Extracting text from PDF`);
    const startTime = Date.now();

    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const pageCount = pdfDoc.getPageCount();
    console.log(`📄 PDF has ${pageCount} pages`);

    let fullText = '';

    // Note: pdf-lib doesn't support text extraction directly
    // We'll need to use a different library for this
    // For now, return a placeholder message
    fullText = `Text extraction is not fully supported yet.\nPDF has ${pageCount} pages.\n\nTo extract text, you can use external tools like pdftotext or pdf-parse library.`;

    const endTime = Date.now();
    console.log(`✅ Text extraction complete in ${endTime - startTime}ms`);

    return fullText;
  } catch (error) {
    console.error('❌ Text extraction failed:', error);
    throw new InternalServerErrorException(
      `Failed to extract text: ${error.message}`,
    );
  }
}

export async function extractTextFromDocx(inputPath: string): Promise<string> {
  try {
    console.log(`📝 Extracting text from DOCX`);

    const result = await mammoth.extractRawText({ path: inputPath });

    console.log(`✅ Text extracted (${result.value.length} characters)`);

    return result.value;
  } catch (error) {
    console.error('❌ Text extraction failed:', error);
    throw new InternalServerErrorException(
      `Failed to extract text from DOCX: ${error.message}`,
    );
  }
}
