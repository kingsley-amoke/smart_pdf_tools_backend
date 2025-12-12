import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfService {
  constructor() {
    console.log('✅ PDF Service initialized');
  }
}
