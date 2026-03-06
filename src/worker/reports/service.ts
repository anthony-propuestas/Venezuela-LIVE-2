/**
 * Servicio CRON: agrega datos, genera PDFs y los almacena en R2.
 * Ejecutado por trigger 59 23 * * 0 (Domingos 23:59).
 */

import { fetchTopNetPositives, fetchTopNetNegatives, fetchTopVolume } from './dataLayer';
import { generateReportPDF } from './pdfEngine';
import type { ReportCard } from './dataLayer';

const R2_PREFIX = 'reports/weekly';

export type ReportType = 'positives' | 'negatives' | 'volume';

export async function runWeeklyReportJob(env: {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}): Promise<{ positives: boolean; negatives: boolean; volume: boolean }> {
  const result = { positives: false, negatives: false, volume: false };

  try {
    result.positives = await generateAndStore(env, 'positives', 'Reporte Consenso (Top Net Positivos)', fetchTopNetPositives);
  } catch (err) {
    console.error('Report positives:', err);
  }

  try {
    result.negatives = await generateAndStore(env, 'negatives', 'Reporte Rechazo (Top Net Negativos)', fetchTopNetNegatives);
  } catch (err) {
    console.error('Report negatives:', err);
  }

  try {
    result.volume = await generateAndStore(env, 'volume', 'Reporte Conflicto (Top Volumen)', fetchTopVolume);
  } catch (err) {
    console.error('Report volume:', err);
  }

  return result;
}

async function generateAndStore(
  env: { DB: D1Database; R2_BUCKET: R2Bucket },
  type: ReportType,
  _title: string,
  fetcher: (db: D1Database) => Promise<ReportCard[]>
): Promise<boolean> {
  const cards = await fetcher(env.DB);
  const pdfBytes = await generateReportPDF(cards, _title);
  const key = `${R2_PREFIX}/${type}.pdf`;
  await env.R2_BUCKET.put(key, pdfBytes, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  return true;
}

/** Genera PDF on-demand (para dev o si R2 está vacío). */
export async function generateReportOnDemand(
  db: D1Database,
  type: ReportType
): Promise<Uint8Array> {
  const titles = {
    positives: 'Reporte Consenso (Top Net Positivos)',
    negatives: 'Reporte Rechazo (Top Net Negativos)',
    volume: 'Reporte Conflicto (Top Volumen)',
  };
  const fetchers = {
    positives: fetchTopNetPositives,
    negatives: fetchTopNetNegatives,
    volume: fetchTopVolume,
  };
  const cards = await fetchers[type](db);
  return generateReportPDF(cards, titles[type]);
}
