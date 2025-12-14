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

@Controller('pdf')
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
        await this.cleanup(inputPaths, outputPath);
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
          await this.cleanup(inputPaths, outputPath);
        }, 1000);
      });

      // Pipe the file to response
      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Merge operation failed:', error);
      await this.cleanup(inputPaths, outputPath);

      if (!res.headersSent) {
        res.status(500).json({
          message: 'Failed to merge PDFs',
          error: error.message,
        });
      }
    }
  }

  /**
   * Cleanup helper - delete temporary files
   */
  private async cleanup(inputPaths: string[], outputPath: string) {
    console.log('\n🧹 Cleaning up temporary files...');

    // Delete input files
    await deleteFiles(inputPaths);

    // Delete output file
    await deleteFile(outputPath);

    console.log('✅ Cleanup complete\n');
  }

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
}
