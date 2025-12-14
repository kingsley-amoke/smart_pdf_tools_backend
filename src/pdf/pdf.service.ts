import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { PDFDocument } from 'pdf-lib';
import { SplitService } from './services/split.service';
import { MergeService } from './services/merge.service';

@Injectable()
export class PdfService {
  constructor(
    private readonly splitService: SplitService,
    private readonly mergeService: MergeService,
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
}
