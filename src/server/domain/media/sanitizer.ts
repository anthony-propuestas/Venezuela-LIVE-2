import { remove as removeExif } from '@mary/exif-rm';
import { InternalError } from '../../errors';

const SUPPORTED_IMAGE_TYPES = new Set<string>(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export type SanitizedImage = {
  buffer: Uint8Array;
  mimeType: string;
};

export async function sanitizeImage(input: Uint8Array, mimeType: string): Promise<SanitizedImage> {
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new InternalError('Tipo de imagen no soportado para saneamiento.');
  }

  try {
    const cleaned = removeExif(input);
    return { buffer: cleaned, mimeType };
  } catch (err) {
    throw new InternalError('Error al sanear metadatos EXIF de la imagen.');
  }
}

