import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { fileExists } from '../helpers/check-file-exist.helper';
import { getFileSize } from '../helpers/check-file-size.helper';
import { ImageFormat } from '../dto/convert-pdf.dto';
import { PDFDocument } from 'pdf-lib';
import libre from 'libreoffice-convert';
import { promisify } from 'util';
import * as path from 'path';

@Injectable()
export class ConvertService {
  // CONVERT PDF TO IMAGES
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

  // CONVERT IMAGES TO PDF
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

  // CONVERT PDF TO DOCX

  async convertPdfToDocx(inputPath: string, outputPath: string): Promise<void> {
    try {
      console.log(`📄 Converting PDF to DOCX`);
      const startTime = Date.now();

      // Get absolute paths
      const absoluteInputPath = path.resolve(inputPath);
      const absoluteOutputDir = path.resolve(path.dirname(outputPath));

      console.log(`📂 Input: ${absoluteInputPath}`);
      console.log(`📂 Output dir: ${absoluteOutputDir}`);

      // Verify input file exists
      if (!fileExists(absoluteInputPath)) {
        throw new InternalServerErrorException(
          `Input file not found: ${absoluteInputPath}`,
        );
      }

      // Check if PDF has text content
      try {
        const pdfBytes = await fs.readFile(absoluteInputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, {
          ignoreEncryption: true,
        });
        const pageCount = pdfDoc.getPageCount();
        console.log(`📄 PDF has ${pageCount} pages`);

        if (pageCount === 0) {
          throw new InternalServerErrorException('PDF has no pages');
        }
      } catch (pdfError) {
        console.error('⚠️  Could not analyze PDF:', pdfError.message);
      }

      try {
        execSync('pkill -9 soffice.bin 2>/dev/null || true', { stdio: 'pipe' });
        execSync('pkill -9 soffice 2>/dev/null || true', { stdio: 'pipe' });
        // Wait a moment for processes to die
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        // Ignore errors if no processes found
      }

      // Check LibreOffice installation
      let libreOfficeCmd = 'soffice';
      try {
        execSync('which soffice', { stdio: 'pipe' });
        console.log('✅ Found soffice');
      } catch (e1) {
        try {
          execSync('which libreoffice', { stdio: 'pipe' });
          libreOfficeCmd = 'libreoffice';
          console.log('✅ Found libreoffice');
        } catch (e2) {
          throw new InternalServerErrorException(
            'LibreOffice is not installed. Please install it: sudo apt-get install libreoffice',
          );
        }
      }

      // Build conversion command with better error handling
      const command = `${libreOfficeCmd} --headless --infilter="writer_pdf_import" --invisible --nologo --nofirststartwizard --convert-to docx:"MS Word 2007 XML" --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;

      console.log(`⚙️  Running LibreOffice...`);

      let conversionOutput = '';
      let conversionError = '';

      try {
        conversionOutput = execSync(command, {
          stdio: 'pipe',
          timeout: 90000, // 90 seconds
          encoding: 'utf-8',
        });
        console.log(
          `📋 LibreOffice output:`,
          conversionOutput || '(no output)',
        );
      } catch (execError: any) {
        conversionError = execError.stderr || execError.message;
        console.error(`❌ LibreOffice error:`, conversionError);

        // Check if error indicates conversion failure
        if (
          conversionError.includes('Error') ||
          conversionError.includes('failed')
        ) {
          throw new InternalServerErrorException(
            'PDF conversion failed. This PDF might not be convertible (scanned image, encrypted, or corrupted).',
          );
        }
      }

      // Wait for file to be created
      console.log('⏳ Waiting for file creation...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Find the generated DOCX file
      const inputBaseName = path.basename(
        absoluteInputPath,
        path.extname(absoluteInputPath),
      );
      const generatedPath = path.join(
        absoluteOutputDir,
        `${inputBaseName}.docx`,
      );

      console.log(`🔍 Looking for: ${generatedPath}`);

      // List all files in directory for debugging
      const filesInDir = await fs.readdir(absoluteOutputDir);
      console.log(`📁 Files in directory:`, filesInDir);

      // Check if file exists
      if (!fileExists(generatedPath)) {
        // Try to find any .docx file that was just created
        const recentDocxFiles = filesInDir.filter(
          (f) => f.endsWith('.docx') && f.includes(inputBaseName),
        );

        if (recentDocxFiles.length > 0) {
          const foundPath = path.join(absoluteOutputDir, recentDocxFiles[0]);
          console.log(`✅ Found alternative file: ${foundPath}`);

          // Rename to expected output
          const absoluteOutputPath = path.resolve(outputPath);
          await fs.rename(foundPath, absoluteOutputPath);

          const outputSize = await getFileSize(absoluteOutputPath);
          const endTime = Date.now();

          console.log(`✅ Conversion complete in ${endTime - startTime}ms`);
          console.log(
            `📦 Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`,
          );
          return;
        }

        // If still not found, provide detailed error
        throw new InternalServerErrorException(
          `Conversion failed. LibreOffice did not create the DOCX file. ` +
            `This could mean:\n` +
            `1. The PDF is a scanned image (no text to extract)\n` +
            `2. The PDF is encrypted or corrupted\n` +
            `3. LibreOffice encountered an error\n` +
            `Files found: ${filesInDir.join(', ')}`,
        );
      }

      // Rename to desired output path
      const absoluteOutputPath = path.resolve(outputPath);
      if (generatedPath !== absoluteOutputPath) {
        console.log(`📝 Renaming: ${generatedPath} -> ${absoluteOutputPath}`);
        await fs.rename(generatedPath, absoluteOutputPath);
      }

      // Final verification
      if (!fileExists(absoluteOutputPath)) {
        throw new InternalServerErrorException('Output file was not created');
      }

      const endTime = Date.now();
      const outputSize = await getFileSize(absoluteOutputPath);

      console.log(`✅ Conversion complete in ${endTime - startTime}ms`);
      console.log(
        `📦 Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`,
      );
    } catch (error) {
      console.error('❌ PDF to DOCX conversion failed:', error);
      throw new InternalServerErrorException(
        `Failed to convert PDF to DOCX: ${error.message}`,
      );
    }
  }

  // CONVERT DOCX TO PDF

  async convertDocxToPdf(inputPath: string, outputPath: string): Promise<void> {
    try {
      console.log(`📄 Converting DOCX to PDF`);
      const startTime = Date.now();

      console.log(`📂 Input: ${inputPath}`);
      console.log(`📂 Output: ${outputPath}`);

      // Verify input file exists
      const inputStats = await fs.stat(inputPath);
      console.log(
        `📦 Input size: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`,
      );

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      console.log(`⚙️  Running LibreOffice conversion...`);

      // Read the DOCX file as buffer
      const docxBuffer = await fs.readFile(inputPath);

      // Convert to PDF with timeout
      const pdfBuffer = await Promise.race([
        new Promise<Buffer>((resolve, reject) => {
          libre.convert(docxBuffer, '.pdf', undefined, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Conversion timed out after 60 seconds')),
            60000,
          ),
        ),
      ]);

      // Write the PDF buffer to file
      await fs.writeFile(outputPath, pdfBuffer);

      const endTime = Date.now();
      const outputStats = await fs.stat(outputPath);

      console.log(`✅ Conversion complete in ${endTime - startTime}ms`);
      console.log(
        `📦 Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(`📄 Final output: ${outputPath}`);
    } catch (error) {
      console.error('❌ DOCX to PDF conversion failed:', error);

      // Clean up partial output file if it exists
      try {
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      // Provide helpful error messages
      if (
        error.message?.includes('LibreOffice') ||
        error.message?.includes('soffice')
      ) {
        throw new InternalServerErrorException(
          'LibreOffice is not installed. Install it with: sudo apt-get install libreoffice',
        );
      }

      if (error.message?.includes('timed out')) {
        throw new InternalServerErrorException(
          'Conversion timed out. The document may be too large or complex.',
        );
      }

      throw new InternalServerErrorException(
        `Failed to convert DOCX to PDF: ${error.message}`,
      );
    }
  }
}
