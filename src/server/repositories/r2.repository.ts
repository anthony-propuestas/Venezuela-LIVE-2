import { DependencyError } from '../errors';

export async function putProfilePhotoObject(
  r2: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView,
  contentType: string
): Promise<void> {
  try {
    await r2.put(key, body, {
      httpMetadata: { contentType },
    });
  } catch (err) {
    throw new DependencyError('CONFIG_ERROR', `No se pudo guardar la foto de perfil en R2 (${key}).`);
  }
}

export async function getProfilePhotoObject(r2: R2Bucket, key: string): Promise<R2Object | null> {
  try {
    const obj = await r2.get(key);
    return obj;
  } catch (err) {
    throw new DependencyError('CONFIG_ERROR', `No se pudo leer la foto de perfil desde R2 (${key}).`);
  }
}

export async function deleteProfilePhotoObject(r2: R2Bucket, key: string): Promise<void> {
  try {
    await r2.delete(key);
  } catch (err) {
    throw new DependencyError('CONFIG_ERROR', `No se pudo eliminar la foto de perfil en R2 (${key}).`);
  }
}

const REPORTS_PREFIX = 'reports/weekly';

export function getWeeklyReportKey(type: 'positives' | 'negatives' | 'volume'): string {
  return `${REPORTS_PREFIX}/${type}.pdf`;
}

// Actualmente los reportes semanales son gestionados directamente en controllers/service.
// Esta función queda preparada por si se decide centralizar también esa lógica.
export async function getWeeklyReportObject(r2: R2Bucket, type: 'positives' | 'negatives' | 'volume'): Promise<R2Object | null> {
  const key = getWeeklyReportKey(type);
  try {
    const obj = await r2.get(key);
    return obj;
  } catch (err) {
    throw new DependencyError('CONFIG_ERROR', `No se pudo leer el reporte semanal desde R2 (${key}).`);
  }
}
