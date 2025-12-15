import { getFileSize } from './check-file-size.helper';

export async function getCompressionStats(
  originalPath: string,
  compressedPath: string,
): Promise<{
  originalSize: number;
  compressedSize: number;
  reduction: number;
  reductionPercentage: string;
}> {
  const originalSize = await getFileSize(originalPath);
  const compressedSize = await getFileSize(compressedPath);
  const reduction = originalSize - compressedSize;
  const reductionPercentage = ((reduction / originalSize) * 100).toFixed(2);

  return {
    originalSize,
    compressedSize,
    reduction,
    reductionPercentage,
  };
}
