import { Module } from '@nestjs/common';
import { PdfModule } from './pdf/pdf.module';
import { PdfService } from './pdf/pdf.service';
import { PdfController } from './pdf/pdf.controller';

@Module({
  imports: [PdfModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
