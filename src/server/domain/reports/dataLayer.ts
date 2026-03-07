/**
 * Capa de acceso a datos para reportes semanales.
 * Usa Window Functions de SQLite para agregar por tema sin N+1 queries.
 */

export type ProposalRow = {
  id: string;
  topic_id: string;
  title: string;
  description: string;
  author: string;
  upvotes: number;
  downvotes: number;
  net_score: number;
  volume: number;
  topic_text: string;
  category: string;
  subcategory: string | null;
  top_note_id: string | null;
  top_note_text: string | null;
  top_note_net_score: number | null;
};

export type ReportCard = {
  topicName: string;
  category: string;
  subcategory: string | null;
  proposalTitle: string;
  proposalDescription: string;
  author: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  volume: number;
  topCommunityNote: string | null;
  topNoteScore: number | null;
};

/** Top Net Positives: propuesta con mayor (upvotes - downvotes) por tema, donde net > 0 */
export async function fetchTopNetPositives(db: D1Database): Promise<ReportCard[]> {
  const rows = await db
    .prepare(
      `WITH ranked AS (
        SELECT 
          p.id, p.topic_id, p.title, p.description, p.author, p.upvotes, p.downvotes,
          (p.upvotes - p.downvotes) AS net_score,
          (p.upvotes + p.downvotes) AS volume,
          t.topic_text, t.category, t.subcategory,
          ROW_NUMBER() OVER (PARTITION BY p.topic_id ORDER BY (p.upvotes - p.downvotes) DESC) AS rn
        FROM proposals p
        JOIN topics t ON t.id = p.topic_id
        WHERE (p.upvotes - p.downvotes) > 0
      ),
      top_notes AS (
        SELECT proposal_id, id AS note_id, text, net_score,
          ROW_NUMBER() OVER (PARTITION BY proposal_id ORDER BY net_score DESC) AS rn
        FROM proposal_notes
        WHERE net_score > 0
      )
      SELECT r.*, tn.note_id AS top_note_id, tn.text AS top_note_text, tn.net_score AS top_note_net_score
      FROM ranked r
      LEFT JOIN top_notes tn ON tn.proposal_id = r.id AND tn.rn = 1
      WHERE r.rn = 1
      ORDER BY r.net_score DESC`
    )
    .all<ProposalRow & { rn?: number; note_id?: string }>();

  return mapToReportCards(rows.results || []);
}

/** Top Net Negatives: propuesta con mayor (downvotes - upvotes) por tema, donde net < 0 */
export async function fetchTopNetNegatives(db: D1Database): Promise<ReportCard[]> {
  const rows = await db
    .prepare(
      `WITH ranked AS (
        SELECT 
          p.id, p.topic_id, p.title, p.description, p.author, p.upvotes, p.downvotes,
          (p.upvotes - p.downvotes) AS net_score,
          (p.upvotes + p.downvotes) AS volume,
          t.topic_text, t.category, t.subcategory,
          ROW_NUMBER() OVER (PARTITION BY p.topic_id ORDER BY (p.upvotes - p.downvotes) ASC) AS rn
        FROM proposals p
        JOIN topics t ON t.id = p.topic_id
        WHERE (p.upvotes - p.downvotes) < 0
      ),
      top_notes AS (
        SELECT proposal_id, id AS note_id, text, net_score,
          ROW_NUMBER() OVER (PARTITION BY proposal_id ORDER BY net_score DESC) AS rn
        FROM proposal_notes
      )
      SELECT r.*, tn.note_id AS top_note_id, tn.text AS top_note_text, tn.net_score AS top_note_net_score
      FROM ranked r
      LEFT JOIN top_notes tn ON tn.proposal_id = r.id AND tn.rn = 1
      WHERE r.rn = 1
      ORDER BY r.net_score ASC`
    )
    .all<ProposalRow & { rn?: number; note_id?: string }>();

  return mapToReportCards(rows.results || []);
}

/** Top Volume: propuesta con mayor (upvotes + downvotes) por tema */
export async function fetchTopVolume(db: D1Database): Promise<ReportCard[]> {
  const rows = await db
    .prepare(
      `WITH ranked AS (
        SELECT 
          p.id, p.topic_id, p.title, p.description, p.author, p.upvotes, p.downvotes,
          (p.upvotes - p.downvotes) AS net_score,
          (p.upvotes + p.downvotes) AS volume,
          t.topic_text, t.category, t.subcategory,
          ROW_NUMBER() OVER (PARTITION BY p.topic_id ORDER BY (p.upvotes + p.downvotes) DESC) AS rn
        FROM proposals p
        JOIN topics t ON t.id = p.topic_id
        WHERE (p.upvotes + p.downvotes) > 0
      ),
      top_notes AS (
        SELECT proposal_id, id AS note_id, text, net_score,
          ROW_NUMBER() OVER (PARTITION BY proposal_id ORDER BY net_score DESC) AS rn
        FROM proposal_notes
      )
      SELECT r.*, tn.note_id AS top_note_id, tn.text AS top_note_text, tn.net_score AS top_note_net_score
      FROM ranked r
      LEFT JOIN top_notes tn ON tn.proposal_id = r.id AND tn.rn = 1
      WHERE r.rn = 1
      ORDER BY r.volume DESC`
    )
    .all<ProposalRow & { rn?: number; note_id?: string }>();

  return mapToReportCards(rows.results || []);
}

function mapToReportCards(
  rows: Array<
    Partial<ProposalRow> & { top_note_text?: string | null; top_note_net_score?: number | null }
  >
): ReportCard[] {
  return rows.map((r) => ({
    topicName: String(r.topic_text ?? ''),
    category: String(r.category ?? ''),
    subcategory: r.subcategory ?? null,
    proposalTitle: String(r.title ?? ''),
    proposalDescription: String(r.description ?? ''),
    author: String(r.author ?? ''),
    upvotes: Number(r.upvotes ?? 0),
    downvotes: Number(r.downvotes ?? 0),
    netScore: Number(r.net_score ?? 0),
    volume: Number(r.volume ?? 0),
    topCommunityNote: r.top_note_text ?? null,
    topNoteScore: r.top_note_net_score ?? null,
  }));
}
