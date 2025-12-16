import { deleteFile, deleteFiles } from './delete.helper';

export async function cleanup(inputPaths: string[], outputPath?: string) {
  console.log('\n🧹 Cleaning up temporary files...');

  // Delete input files
  await deleteFiles(inputPaths);

  // Delete output file
  await deleteFile(outputPath);

  console.log('✅ Cleanup complete\n');
}
