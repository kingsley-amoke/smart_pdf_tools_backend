import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export enum SplitMethod {
  RANGES = 'ranges',
  INDIVIDUAL = 'individual',
  EVERY_N = 'every_n',
}

export class SplitPdfDto {
  @IsEnum(SplitMethod)
  @IsNotEmpty()
  method: SplitMethod;

  @IsOptional()
  @IsString()
  ranges?: string; // Comma-separated ranges like "1-3,5,7-10"

  @IsOptional()
  @IsNumber()
  @Min(1)
  pagesPerSplit?: number; // For every_n method
}
