/**
 * Controladores de endpoints de reportes PDF.
 */

import type { Context } from 'hono';
import { runWeeklyReportJob, generateReportOnDemand, type ReportType } from './service';
import type { Env, User } from '../types';

const R2_PREFIX = 'reports/weekly';
const FILENAMES: Record<ReportType, string> = {
  positives: 'reporte-consenso.pdf',
  negatives: 'reporte-rechazo.pdf',
  volume: 'reporte-conflicto.pdf',
};

type AppBindings = { Bindings: Env; Variables: { user: User } };

export async function handleGetReport(
  c: Context<AppBindings>,
  type: ReportType
): Promise<Response> {
  try {
    const key = `${R2_PREFIX}/${type}.pdf`;
    const obj = await c.env.R2_BUCKET.get(key);

    if (obj) {
      const body = await obj.arrayBuffer();
      return new Response(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${FILENAMES[type]}"`,
        },
      });
    }

    const pdfBytes = await generateReportOnDemand(c.env.DB, type);
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${FILENAMES[type]}"`,
      },
    });
  } catch (err) {
    console.error(`GET report ${type}:`, err);
    return c.json({ error: 'Error al generar el reporte.' }, 500);
  }
}

export async function handleCronReports(env: { DB: D1Database; R2_BUCKET: R2Bucket }): Promise<void> {
  const result = await runWeeklyReportJob(env);
  console.log('Weekly reports generated:', result);
}
