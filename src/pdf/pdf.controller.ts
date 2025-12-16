import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { PdfService } from './pdf.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import type { Response } from 'express';
// import * as fs from 'fs';
import { SplitMethod, SplitPdfDto } from './dto/split-pdf.dto';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { deleteFile, deleteFiles } from './helpers/delete.helper';
import { createZip } from './helpers/create-zip.helper';
import { getPageCount } from './helpers/get-page-count.helper';
import { getFileSize } from './helpers/check-file-size.helper';
import { CompressPdfDto } from './dto/compress-pdf.dto';
import { getCompressionStats } from './helpers/get-compression-stat.helper';
import {
  ConvertDocxToPdfDto,
  ConvertPdfToDocxDto,
  ConvertPdfToImagesDto,
} from './dto/convert-pdf.dto';
import { extractMetadata } from './helpers/extract-metadata.helper';
import { cleanup } from './helpers/cleanup.helper';

@Controller('api/v1/pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Get()
  getHello(): string {
    return 'Hello from PDF Controller!';
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('📄 File uploaded:', file.filename);
    console.log('📦 Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    return {
      message: 'File uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: file.path,
    };
  }

  // Upload multiple files (for merge)
  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    console.log('📚 Multiple files uploaded:', files.length);

    return {
      message: `${files.length} files uploaded successfully`,
      files: files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
      })),
    };
  }

  //MERGE PDF

  @Post('merge')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async mergePdfs(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    // Validate input
    if (!files || files.length < 2) {
      throw new BadRequestException('At least 2 PDF files are required');
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔄 MERGE REQUEST - ${files.length} files`);
    console.log(`${'='.repeat(50)}`);

    const inputPaths: string[] = [];
    const jobId = uuidv4();
    const outputPath = `./temp/${jobId}-merged.pdf`;

    try {
      // Store input file paths
      files.forEach((file, index) => {
        inputPaths.push(file.path);
        console.log(
          `${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`,
        );
      });

      // Merge PDFs
      await this.pdfService.mergePdfs(inputPaths, outputPath);

      // Get merged file size
      const outputSize = await getFileSize(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="merged-${Date.now()}.pdf"`,
      );
      res.setHeader('Content-Length', outputSize);

      // Stream the file
      const fileStream = fsSync.createReadStream(outputPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await cleanup(inputPaths, outputPath);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ File streamed successfully');
        // Cleanup after a short delay to ensure stream completes
        setTimeout(async () => {
          await cleanup(inputPaths, outputPath);
        }, 1000);
      });

      // Pipe the file to response
      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Merge operation failed:', error);
      await cleanup(inputPaths, outputPath);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to merge PDFs',
          error: error.message,
        });
      }
    }
  }

  //SPLIT PDF

  @Post('split')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async splitPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() splitDto: SplitPdfDto,
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✂️  SPLIT REQUEST - Method: ${splitDto.method}`);
    console.log(`${'='.repeat(50)}`);

    const jobId = uuidv4();
    const inputPath = file.path;
    const outputDir = `./temp/${jobId}-splits`;
    const zipPath = `./temp/${jobId}-splits.zip`;
    const filesToCleanup: string[] = [inputPath, zipPath];

    try {
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });
      filesToCleanup.push(outputDir);

      // Get page count
      const pageCount = await getPageCount(inputPath);
      console.log(`📄 PDF has ${pageCount} pages`);

      let splitFiles: string[] = [];

      // Execute split based on method
      switch (splitDto.method) {
        case SplitMethod.RANGES:
          if (!splitDto.ranges) {
            throw new BadRequestException(
              'Ranges are required for ranges method',
            );
          }
          const ranges = splitDto.ranges.split(',').map((r) => r.trim());
          console.log(`📋 Ranges: ${ranges.join(', ')}`);
          splitFiles = await this.pdfService.splitByRanges(
            inputPath,
            ranges,
            outputDir,
          );
          break;

        case SplitMethod.INDIVIDUAL:
          console.log(`📋 Splitting into individual pages`);
          splitFiles = await this.pdfService.splitIntoPages(
            inputPath,
            outputDir,
          );
          break;

        case SplitMethod.EVERY_N:
          if (!splitDto.pagesPerSplit || splitDto.pagesPerSplit < 1) {
            throw new BadRequestException(
              'pagesPerSplit must be at least 1 for every_n method',
            );
          }
          console.log(`📋 Splitting every ${splitDto.pagesPerSplit} pages`);
          splitFiles = await this.pdfService.splitEveryNPages(
            inputPath,
            splitDto.pagesPerSplit,
            outputDir,
          );
          break;

        default:
          throw new BadRequestException('Invalid split method');
      }

      if (splitFiles.length === 0) {
        throw new InternalServerErrorException('No files were created');
      }

      console.log(`✅ Created ${splitFiles.length} split file(s)`);

      // Create ZIP file
      await createZip(splitFiles, zipPath);

      // Get ZIP file size
      const zipSize = await getFileSize(zipPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="split-${Date.now()}.zip"`,
      );
      res.setHeader('Content-Length', zipSize);

      // Stream the ZIP file
      const fileStream = fsSync.createReadStream(zipPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await this.cleanupSplitFiles(filesToCleanup, outputDir, splitFiles);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ ZIP streamed successfully');
        setTimeout(async () => {
          await this.cleanupSplitFiles(filesToCleanup, outputDir, splitFiles);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Split operation failed:', error);
      await this.cleanupSplitFiles(filesToCleanup, outputDir, []);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to split PDF',
          error: error.message,
        });
      }
    }
  }

  /**
   * Cleanup helper for split operation
   */
  private async cleanupSplitFiles(
    filesToCleanup: string[],
    outputDir: string,
    splitFiles: string[],
  ) {
    console.log('\n🧹 Cleaning up split files...');

    // Delete split files
    await deleteFiles(splitFiles);

    // Delete output directory
    try {
      if (fsSync.existsSync(outputDir)) {
        await fs.rm(outputDir, { recursive: true, force: true });
        console.log(`🗑️  Deleted directory: ${outputDir}`);
      }
    } catch (error) {
      console.error(`Failed to delete directory ${outputDir}:`, error.message);
    }

    // Delete other files (input, zip)
    for (const file of filesToCleanup) {
      if (file !== outputDir) {
        await deleteFile(file);
      }
    }

    console.log('✅ Cleanup complete\n');
  }

  //GET PAGE COUNT

  @Post('page-count')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async getPageCount(@UploadedFile() file: Express.Multer.File) {
    try {
      const pageCount = await getPageCount(file.path);

      // Cleanup
      await deleteFile(file.path);

      return {
        pageCount,
        filename: file.originalname,
      };
    } catch (error) {
      await deleteFile(file.path);
      throw error;
    }
  }

  //COMPRESS PDF
  @Post('compress')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB for compression
      },
    }),
  )
  async compressPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() compressDto: CompressPdfDto,
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🗜️  COMPRESS REQUEST - Quality: ${compressDto.quality}`);
    console.log(`${'='.repeat(50)}`);

    const jobId = uuidv4();
    const inputPath = file.path;
    const outputPath = `./temp/${jobId}-compressed.pdf`;
    const filesToCleanup: string[] = [inputPath, outputPath];

    try {
      console.log(`📄 Original file: ${file.originalname}`);
      console.log(`📦 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`⚙️  Options:`);
      console.log(
        `   - Compress images: ${compressDto.compressImages !== false}`,
      );
      console.log(
        `   - Remove metadata: ${compressDto.removeMetadata || false}`,
      );

      // Compress PDF
      await this.pdfService.compressPdf(
        inputPath,
        outputPath,
        compressDto.quality as any,
        {
          compressImages: compressDto.compressImages !== false,
          removeMetadata: compressDto.removeMetadata || false,
        },
      );

      // Get compression statistics
      const stats = await getCompressionStats(inputPath, outputPath);

      // Get compressed file size
      const outputSize = await getFileSize(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="compressed-${Date.now()}.pdf"`,
      );
      res.setHeader('Content-Length', outputSize);
      res.setHeader('X-Original-Size', stats.originalSize.toString());
      res.setHeader('X-Compressed-Size', stats.compressedSize.toString());
      res.setHeader('X-Reduction-Percentage', stats.reductionPercentage);

      // Stream the file
      const fileStream = fsSync.createReadStream(outputPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await cleanup(filesToCleanup);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ File streamed successfully');
        setTimeout(async () => {
          await cleanup(filesToCleanup);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Compress operation failed:', error);
      await cleanup(filesToCleanup);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to compress PDF',
          error: error.message,
        });
      }
    }
  }

  //Convert PDF to Images
  @Post('convert/to-images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async convertPdfToImages(
    @UploadedFile() file: Express.Multer.File,
    @Body() convertDto: ConvertPdfToImagesDto,
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🖼️  CONVERT TO IMAGES - Format: ${convertDto.format}`);
    console.log(`${'='.repeat(50)}`);

    const jobId = uuidv4();
    const inputPath = file.path;
    const outputDir = `./temp/${jobId}-images`;
    const zipPath = `./temp/${jobId}-images.zip`;
    const filesToCleanup: string[] = [inputPath, zipPath];

    try {
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });
      filesToCleanup.push(outputDir);

      console.log(`📄 File: ${file.originalname}`);
      console.log(`📦 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      // Convert PDF to images
      const imageFiles = await this.pdfService.convertPdfToImages(
        inputPath,
        outputDir,
        convertDto.format as any,
        convertDto.quality || 90,
      );

      if (imageFiles.length === 0) {
        throw new InternalServerErrorException('No images were created');
      }

      console.log(`✅ Created ${imageFiles.length} image(s)`);

      // Create ZIP file
      await createZip(imageFiles, zipPath);

      // Get ZIP file size
      const zipSize = await getFileSize(zipPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pdf-images-${Date.now()}.zip"`,
      );
      res.setHeader('Content-Length', zipSize);

      // Stream the ZIP file
      const fileStream = fsSync.createReadStream(zipPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await this.cleanupSplitFiles(filesToCleanup, outputDir, imageFiles);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ ZIP streamed successfully');
        setTimeout(async () => {
          await this.cleanupSplitFiles(filesToCleanup, outputDir, imageFiles);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Convert to images failed:', error);
      await this.cleanupSplitFiles(filesToCleanup, outputDir, []);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to convert PDF to images',
          error: error.message,
        });
      }
    }
  }

  //Convert Images to PDF

  @Post('convert/images-to-pdf')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only PNG and JPG images are allowed'),
            false,
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per image
      },
    }),
  )
  async convertImagesToPdf(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📄 IMAGES TO PDF - ${files.length} images`);
    console.log(`${'='.repeat(50)}`);

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const jobId = uuidv4();
    const outputPath = `./temp/${jobId}-from-images.pdf`;
    const inputPaths: string[] = files.map((f) => f.path);
    const filesToCleanup: string[] = [...inputPaths, outputPath];

    try {
      files.forEach((file, index) => {
        console.log(
          `${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`,
        );
      });

      // Convert images to PDF
      await this.pdfService.convertImagesToPdf(inputPaths, outputPath);

      // Get PDF file size
      const pdfSize = await getFileSize(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="from-images-${Date.now()}.pdf"`,
      );
      res.setHeader('Content-Length', pdfSize);

      // Stream the file
      const fileStream = fsSync.createReadStream(outputPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await cleanup(filesToCleanup);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ File streamed successfully');
        setTimeout(async () => {
          await cleanup(filesToCleanup);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Images to PDF conversion failed:', error);
      await cleanup(filesToCleanup);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to convert images to PDF',
          error: error.message,
        });
      }
    }
  }

  //Extract Metadata

  @Post('extract/metadata')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async extractMetadata(@UploadedFile() file: Express.Multer.File) {
    try {
      const metadata = await extractMetadata(file.path);

      // Cleanup
      await deleteFile(file.path);

      return {
        filename: file.originalname,
        metadata,
      };
    } catch (error) {
      await deleteFile(file.path);
      throw error;
    }
  }

  //Convert PDF to DOCX

  @Post('convert/to-docx')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async convertPdfToDocx(
    @UploadedFile() file: Express.Multer.File,
    @Body() convertDto: ConvertPdfToDocxDto,
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📄 CONVERT PDF TO DOCX`);
    console.log(`${'='.repeat(50)}`);

    const jobId = uuidv4();
    const inputPath = file.path;
    const outputPath = `./temp/${jobId}-converted.docx`;
    const filesToCleanup: string[] = [inputPath, outputPath];

    try {
      console.log(`📄 File: ${file.originalname}`);
      console.log(`📦 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      // Convert PDF to DOCX
      await this.pdfService.convertPdfToDocx(inputPath, outputPath);

      // Get output file size
      const outputSize = await getFileSize(outputPath);

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="converted-${Date.now()}.docx"`,
      );
      res.setHeader('Content-Length', outputSize);

      // Stream the file
      const fileStream = fsSync.createReadStream(outputPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await cleanup(filesToCleanup);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ File streamed successfully');
        setTimeout(async () => {
          await cleanup(filesToCleanup);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Convert to DOCX failed:', error);
      await cleanup(filesToCleanup);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to convert PDF to DOCX',
          error: error.message,
        });
      }
    }
  }

  //Convert DOCX to PDF

  @Post('convert/docx-to-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/msword', // .doc
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only DOC/DOCX files are allowed'),
            false,
          );
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async convertDocxToPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() convertDto: ConvertDocxToPdfDto,
    @Res() res: Response,
  ) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📄 CONVERT DOCX TO PDF`);
    console.log(`${'='.repeat(50)}`);

    const jobId = uuidv4();
    const inputPath = file.path;
    const outputPath = `./temp/${jobId}-converted.pdf`;
    const filesToCleanup: string[] = [inputPath, outputPath];

    try {
      console.log(`📄 File: ${file.originalname}`);
      console.log(`📦 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      // Convert DOCX to PDF
      await this.pdfService.convertDocxToPdf(inputPath, outputPath);

      // Get output file size
      const outputSize = await getFileSize(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="converted-${Date.now()}.pdf"`,
      );
      res.setHeader('Content-Length', outputSize);

      // Stream the file
      const fileStream = fsSync.createReadStream(outputPath);

      fileStream.on('error', async (error) => {
        console.error('❌ Stream error:', error);
        await cleanup(filesToCleanup);
        if (!res.headersSent) {
          res.status(500).json({
            message: 'Error streaming file',
            error: error.message,
          });
        }
      });

      fileStream.on('end', async () => {
        console.log('✅ File streamed successfully');
        setTimeout(async () => {
          await cleanup(filesToCleanup);
        }, 1000);
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Convert to PDF failed:', error);
      await cleanup(filesToCleanup);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to convert DOCX to PDF',
          error: error.message,
        });
      }
    }
  }
}
