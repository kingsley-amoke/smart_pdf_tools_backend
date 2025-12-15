import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export enum ImageFormat {
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
}

export class ConvertPdfToImagesDto {
  @IsEnum(ImageFormat)
  format: ImageFormat;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  quality?: number;
}

export class ConvertImagesToPdfDto {
  // No specific fields needed for now
}
