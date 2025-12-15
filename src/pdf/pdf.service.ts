import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { SplitService } from './services/split.service';
import { MergeService } from './services/merge.service';
import { CompressionQuality } from './dto/compress-pdf.dto';
import * as fsSync from 'fs';
import { CompressService } from './services/compress.service';
import { ImageFormat } from './dto/convert-pdf.dto';

@Injectable()
export class PdfService {
  constructor(
    private readonly splitService: SplitService,
    private readonly mergeService: MergeService,
    private readonly compressService: CompressService,
  ) {}

  //MERGE PDFS
  async mergePdfs(filePaths: string[], outputPath: string): Promise<void> {
    return this.mergeService.mergePdfs(filePaths, outputPath);
  }

  //SPLIT PDF FILES

  async splitByRanges(
    inputPath: string,
    ranges: string[],
    outputDir: string,
  ): Promise<string[]> {
    return this.splitService.splitByRanges(inputPath, ranges, outputDir);
  }

  async splitIntoPages(
    inputPath: string,
    outputDir: string,
  ): Promise<string[]> {
    return this.splitService.splitIntoPages(inputPath, outputDir);
  }

  async splitEveryNPages(
    inputPath: string,
    pagesPerSplit: number,
    outputDir: string,
  ): Promise<string[]> {
    return this.splitService.splitEveryNPages(
      inputPath,
      pagesPerSplit,
      outputDir,
    );
  }

  //COMPRESS PDF
  async compressPdf(
    inputPath: string,
    outputPath: string,
    quality: CompressionQuality = CompressionQuality.MEDIUM,
    options: {
      compressImages?: boolean;
      removeMetadata?: boolean;
    } = {},
  ): Promise<void> {
    return this.compressService.compressPdf(
      inputPath,
      outputPath,
      quality,
      options,
    );
  }

  //PDF CONVERSION

  async convertPdfToImages(
    inputPath: string,
    outputDir: string,
    format: ImageFormat = ImageFormat.PNG,
    quality: number = 90,
  ): Promise<string[]> {
    try {
      console.log(
        `🖼️  Converting PDF to ${format.toUpperCase()} images using Ghostscript`,
      );
      console.log(`📊 Quality: ${quality}`);
      const startTime = Date.now();

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Get page count
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const pageCount = pdfDoc.getPageCount();
      console.log(`📄 PDF has ${pageCount} pages`);

      const outputPaths: string[] = [];

      // Convert each page using Ghostscript
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        console.log(`  Converting page ${pageNum}/${pageCount}...`);

        const outputPath = `${outputDir}/page_${pageNum}.${format}`;

        try {
          // Build Ghostscript command
          const device = format === ImageFormat.PNG ? 'png16m' : 'jpeg';
          const resolution = Math.floor(quality * 3); // Convert quality to DPI (90 -> 270 DPI)

          const gsCommand = [
            'gs',
            '-dSAFER',
            '-dBATCH',
            '-dNOPAUSE',
            '-dQUIET',
            `-sDEVICE=${device}`,
            `-r${resolution}`,
            `-dFirstPage=${pageNum}`,
            `-dLastPage=${pageNum}`,
            format === ImageFormat.JPG || format === ImageFormat.JPEG
              ? `-dJPEGQ=${quality}`
              : '',
            `-sOutputFile="${outputPath}"`,
            `"${inputPath}"`,
          ]
            .filter(Boolean)
            .join(' ');

          // Execute command
          execSync(gsCommand, {
            stdio: 'pipe',
            maxBuffer: 50 * 1024 * 1024,
          });

          if (fsSync.existsSync(outputPath)) {
            outputPaths.push(outputPath);
            console.log(`  ✅ Saved: ${outputPath}`);
          }
        } catch (pageError) {
          console.error(
            `  ❌ Failed to convert page ${pageNum}:`,
            pageError.message,
          );
          // Continue with other pages
        }
      }

      if (outputPaths.length === 0) {
        throw new InternalServerErrorException('No images were created');
      }

      const endTime = Date.now();
      console.log(`✅ Conversion complete in ${endTime - startTime}ms`);
      console.log(`📊 Created ${outputPaths.length}/${pageCount} images`);

      return outputPaths;
    } catch (error) {
      console.error('❌ PDF to images conversion failed:', error);
      throw new InternalServerErrorException(
        `Failed to convert PDF to images: ${error.message}`,
      );
    }
  }
  /**
   * Convert images to PDF
   * @param imagePaths Array of image file paths
   * @param outputPath Path where PDF will be saved
   * @param pageSize Page size (A4, Letter, etc.)
   */
  async convertImagesToPdf(
    imagePaths: string[],
    outputPath: string,
    pageSize: { width: number; height: number } = { width: 595, height: 842 }, // A4 size in points
  ): Promise<void> {
    try {
      console.log(`📄 Converting ${imagePaths.length} images to PDF`);
      const startTime = Date.now();

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Process each image
      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        console.log(
          `  Processing image ${i + 1}/${imagePaths.length}: ${imagePath}`,
        );

        try {
          // Read image file
          const imageBytes = await fs.readFile(imagePath);

          // Determine image type and embed
          let image;
          const ext = imagePath.toLowerCase();

          if (ext.endsWith('.png')) {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
            image = await pdfDoc.embedJpg(imageBytes);
          } else {
            console.warn(`  ⚠️  Unsupported image format: ${ext}, skipping`);
            continue;
          }

          // Get image dimensions
          const { width: imgWidth, height: imgHeight } = image.scale(1);

          // Calculate scaling to fit page while maintaining aspect ratio
          const scale = Math.min(
            pageSize.width / imgWidth,
            pageSize.height / imgHeight,
          );

          const scaledWidth = imgWidth * scale;
          const scaledHeight = imgHeight * scale;

          // Center image on page
          const x = (pageSize.width - scaledWidth) / 2;
          const y = (pageSize.height - scaledHeight) / 2;

          // Add page and draw image
          const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });

          console.log(`  ✅ Added page ${i + 1}`);
        } catch (imageError) {
          console.error(
            `  ❌ Failed to process image ${i + 1}:`,
            imageError.message,
          );
          // Continue with other images
        }
      }

      if (pdfDoc.getPageCount() === 0) {
        throw new InternalServerErrorException('No valid images to create PDF');
      }

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      const endTime = Date.now();
      console.log(`✅ PDF creation complete in ${endTime - startTime}ms`);
      console.log(`📄 Created PDF with ${pdfDoc.getPageCount()} pages`);
      console.log(`📦 Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      console.error('❌ Images to PDF conversion failed:', error);
      throw new InternalServerErrorException(
        `Failed to convert images to PDF: ${error.message}`,
      );
    }
  }

  /**
   * Extract text from PDF
   * @param inputPath Path to PDF file
   * @returns Extracted text content
   */
  async extractTextFromPdf(inputPath: string): Promise<string> {
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

  /**
   * Get PDF metadata
   */
  async extractMetadata(inputPath: string): Promise<{
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
}
