/**
 * Helpers para usuarios Premium y tickets de pago.
 */

export async function isUserPremium(db: D1Database, userId: string): Promise<boolean> {
  try {
    const row = await db
      .prepare('SELECT is_premium FROM profiles WHERE user_id = ?')
      .bind(userId)
      .first<{ is_premium: number }>();
    return Number(row?.is_premium ?? 0) === 1;
  } catch {
    return false;
  }
}

export async function createPaymentTicket(
  db: D1Database,
  userId: string,
  data: { reference: string; paymentDate: string; amount: number }
): Promise<{ id: string } | { error: string }> {
  try {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO payment_tickets (id, user_id, reference, payment_date, amount, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .bind(id, userId, data.reference, data.paymentDate, data.amount)
      .run();
    return { id };
  } catch (err) {
    console.error('[Premium] createPaymentTicket:', err);
    return { error: 'No se pudo registrar el ticket.' };
  }
}

export async function getTicketsByUser(
  db: D1Database,
  userId: string
): Promise<Array<{ id: string; reference: string; payment_date: string; amount: number; status: string; created_at: string }>> {
  try {
    const result = await db
      .prepare(
        `SELECT id, reference, payment_date, amount, status, created_at
         FROM payment_tickets WHERE user_id = ? ORDER BY created_at DESC`
      )
      .bind(userId)
      .all();
    return (result.results ?? []) as Array<{ id: string; reference: string; payment_date: string; amount: number; status: string; created_at: string }>;
  } catch {
    return [];
  }
}
