import { Injectable } from '@nestjs/common';
import { SplitService } from './services/split.service';
import { MergeService } from './services/merge.service';
import { CompressionQuality } from './dto/compress-pdf.dto';
import { CompressService } from './services/compress.service';
import { ImageFormat } from './dto/convert-pdf.dto';
import { ConvertService } from './services/convert.service';

@Injectable()
export class PdfService {
  constructor(
    private readonly splitService: SplitService,
    private readonly mergeService: MergeService,
    private readonly compressService: CompressService,
    private readonly convertService: ConvertService,
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
    return this.convertService.convertPdfToImages(
      inputPath,
      outputDir,
      format,
      quality,
    );
  }

  async convertImagesToPdf(
    imagePaths: string[],
    outputPath: string,
    pageSize: { width: number; height: number } = { width: 595, height: 842 }, // A4 size in points
  ): Promise<void> {
    return this.convertService.convertImagesToPdf(
      imagePaths,
      outputPath,
      pageSize,
    );
  }

  async convertDocxToPdf(inputPath: string, outputPath: string): Promise<void> {
    return this.convertService.convertDocxToPdf(inputPath, outputPath);
  }

  async convertPdfToDocx(inputPath: string, outputPath: string): Promise<void> {
    return this.convertService.convertPdfToDocx(inputPath, outputPath);
  }
}
