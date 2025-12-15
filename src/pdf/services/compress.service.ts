import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execSync } from 'child_process';
import { CompressionQuality } from '../dto/compress-pdf.dto';
import { getFileSize } from '../helpers/check-file-size.helper';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

@Injectable()
export class CompressService {
  async compressPdf(
    inputPath: string,
    outputPath: string,
    quality: CompressionQuality = CompressionQuality.MEDIUM,
    options: {
      compressImages?: boolean;
      removeMetadata?: boolean;
    } = {},
  ): Promise<void> {
    try {
      console.log(`🗜️  Starting compression with quality: ${quality}`);
      const startTime = Date.now();

      // Get original file size
      const originalSize = await getFileSize(inputPath);
      console.log(
        `📄 Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`,
      );

      // Determine ghostscript settings based on quality
      const gsSettings = this.getGhostscriptSettings(quality);

      // Build ghostscript command
      const gsCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        gsSettings.pdfSettings,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        options.compressImages !== false ? '-dCompressFonts=true' : '',
        options.compressImages !== false ? gsSettings.imageSettings : '',
        options.removeMetadata ? '-dPrinted=false' : '',
        `-sOutputFile="${outputPath}"`,
        `"${inputPath}"`,
      ]
        .filter(Boolean)
        .join(' ');

      console.log('⚙️  Running compression...');

      try {
        // Execute ghostscript command
        execSync(gsCommand, {
          stdio: 'pipe',
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        });
      } catch (error) {
        // If ghostscript fails, try pdf-lib compression
        console.warn('⚠️  Ghostscript compression failed, using pdf-lib...');
        await this.compressPdfWithPdfLib(inputPath, outputPath, options);
      }

      // Get compressed file size
      const compressedSize = await getFileSize(outputPath);
      const reduction = (
        ((originalSize - compressedSize) / originalSize) *
        100
      ).toFixed(2);

      const endTime = Date.now();
      console.log(`✅ Compression complete in ${endTime - startTime}ms`);
      console.log(
        `📄 Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(`📉 Size reduction: ${reduction}%`);
    } catch (error) {
      console.error('❌ Compression failed:', error);
      throw new InternalServerErrorException(
        `Failed to compress PDF: ${error.message}`,
      );
    }
  }

  private getGhostscriptSettings(quality: CompressionQuality): {
    pdfSettings: string;
    imageSettings: string;
  } {
    switch (quality) {
      case CompressionQuality.LOW:
        return {
          pdfSettings: '-dPDFSETTINGS=/screen',
          imageSettings:
            '-dColorImageResolution=72 -dGrayImageResolution=72 -dMonoImageResolution=72',
        };
      case CompressionQuality.MEDIUM:
        return {
          pdfSettings: '-dPDFSETTINGS=/ebook',
          imageSettings:
            '-dColorImageResolution=150 -dGrayImageResolution=150 -dMonoImageResolution=150',
        };
      case CompressionQuality.HIGH:
        return {
          pdfSettings: '-dPDFSETTINGS=/printer',
          imageSettings:
            '-dColorImageResolution=300 -dGrayImageResolution=300 -dMonoImageResolution=300',
        };
      default:
        return {
          pdfSettings: '-dPDFSETTINGS=/ebook',
          imageSettings: '-dColorImageResolution=150 -dGrayImageResolution=150',
        };
    }
  }

  private async compressPdfWithPdfLib(
    inputPath: string,
    outputPath: string,
    options: { compressImages?: boolean; removeMetadata?: boolean },
  ): Promise<void> {
    try {
      console.log('📚 Using pdf-lib compression...');

      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });

      // Remove metadata if requested
      if (options.removeMetadata) {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
      }

      // Save with compression
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true, // Enable object streams for better compression
        addDefaultPage: false,
      });

      await fs.writeFile(outputPath, compressedBytes);
      console.log('✅ pdf-lib compression complete');
    } catch (error) {
      console.error('❌ pdf-lib compression failed:', error);
      throw error;
    }
  }
}
