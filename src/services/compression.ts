import { deflate, inflate } from 'pako';

export const COMPRESSIBLE_EXTENSIONS = [
  '.txt',
  '.json',
  '.md',
  '.csv',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.yaml',
  '.yml',
  '.log',
  '.rtf'
];

/**
 * Check if a file is a text-based format eligible for pako compression (.txt, .json, .md, etc.)
 */
export function isCompressibleTextFile(filename: string, mimeType?: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  if (COMPRESSIBLE_EXTENSIONS.some(ext => lower.endsWith(ext))) {
    return true;
  }
  if (mimeType) {
    const mt = mimeType.toLowerCase();
    if (
      mt.startsWith('text/') || 
      mt.includes('json') || 
      mt.includes('xml') || 
      mt.includes('javascript') || 
      mt.includes('markdown')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Compress raw binary data using Deflate (via pako)
 */
export function compressData(data: Uint8Array): Uint8Array {
  return deflate(data, { level: 6 });
}

/**
 * Decompress Deflate raw binary data (via pako)
 */
export function decompressData(compressedData: Uint8Array): Uint8Array {
  return inflate(compressedData);
}

/**
 * Calculate saved percentage from compression
 */
export function calculateSavedPercentage(originalSize: number, compressedSize: number): number {
  if (originalSize <= 0 || compressedSize >= originalSize) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
