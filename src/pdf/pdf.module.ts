import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { SplitService } from './services/split.service';
import { MergeService } from './services/merge.service';
import { CompressService } from './services/compress.service';
import { ConvertService } from './services/convert.service';

@Module({
  controllers: [PdfController],
  providers: [
    PdfService,
    SplitService,
    MergeService,
    CompressService,
    ConvertService,
  ],
})
export class PdfModule {}
