import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { SplitService } from './services/split.service';
import { MergeService } from './services/merge.service';
import { CompressionQuality } from './dto/compress-pdf.dto';
import { getFileSize } from './helpers/check-file-size.helper';
import { CompressService } from './services/compress.service';

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
}
