/**
 * Rate limiting para usuarios gratuitos (Freemium).
 * Usa Cloudflare KV con clave rl:YYYY-MM-DD:userId:action.
 * Reset a medianoche UTC.
 */

const LIMITS = {
  likes: 50,
  comments: 20,
  proposals: 2,
} as const;

export type RateLimitAction = keyof typeof LIMITS;

function getTodayUTC(): string {
  const now = new Date();
  return now.getUTCFullYear() + '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(now.getUTCDate()).padStart(2, '0');
}

function kvKey(userId: string, action: RateLimitAction): string {
  return `rl:${getTodayUTC()}:${userId}:${action}`;
}

export async function checkAndIncrement(
  kv: KVNamespace,
  userId: string,
  action: RateLimitAction
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const key = kvKey(userId, action);
  const limit = LIMITS[action];
  try {
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= limit) {
      return { allowed: false, reason: `Límite diario alcanzado (${limit} ${action}/día)` };
    }
    await kv.put(key, String(count + 1), { expirationTtl: 86400 * 2 }); // 2 días TTL por si acaso
    return { allowed: true };
  } catch (err) {
    console.error('[RateLimit] KV error:', err);
    return { allowed: false, reason: 'Error temporal. Intenta más tarde.' };
  }
}

export function getLimitForAction(action: RateLimitAction): number {
  return LIMITS[action];
}
