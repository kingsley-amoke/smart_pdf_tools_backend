import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export enum CompressionQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CompressPdfDto {
  @IsEnum(CompressionQuality)
  quality: CompressionQuality;

  @IsOptional()
  @IsBoolean()
  compressImages?: boolean;

  @IsOptional()
  @IsBoolean()
  removeMetadata?: boolean;
}
