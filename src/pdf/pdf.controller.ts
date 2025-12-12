import {
  BadRequestException,
  Controller,
  Get,
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
import * as fs from 'fs';

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
      const outputSize = await this.pdfService.getFileSize(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="merged-${Date.now()}.pdf"`,
      );
      res.setHeader('Content-Length', outputSize);

      // Stream the file
      const fileStream = fs.createReadStream(outputPath);

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
    await this.pdfService.deleteFiles(inputPaths);

    // Delete output file
    await this.pdfService.deleteFile(outputPath);

    console.log('✅ Cleanup complete\n');
  }
}
