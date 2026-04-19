import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = neon(databaseUrl);
  const { action } = req.query;

  // ─── CREATE ─────────────────────────────────────────────
  if (action === 'create' && req.method === 'POST') {
    const code = crypto.randomUUID();
    try {
      await sql`
        INSERT INTO exam_tips (share_code, status, expires_at)
        VALUES (${code}, 'pending', NOW() + INTERVAL '5 seconds')
      `;
      return res.status(200).json({ code });
    } catch (error) {
      console.error('Create exam tip error:', error);
      return res.status(500).json({ error: 'Failed to create share code' });
    }
  }

  // ─── STATUS ─────────────────────────────────────────────
  if (action === 'status' && req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
      const result = await sql`
        SELECT status FROM exam_tips WHERE share_code = ${code}
      `;
      if (result.length === 0) return res.status(404).json({ error: 'Code not found' });
      return res.status(200).json({ status: result[0].status });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get status' });
    }
  }

  // ─── CLAIM ──────────────────────────────────────────────
  if (action === 'claim' && req.method === 'POST') {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
      const result = await sql`
        UPDATE exam_tips
        SET status = 'claimed'
        WHERE share_code = ${code}
          AND status = 'pending'
          AND expires_at > NOW()
        RETURNING share_code
      `;
      if (result.length === 0) {
        return res.status(409).json({ error: 'Code already used or expired' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to claim tips' });
    }
  }

  // ─── DEFAULT ────────────────────────────────────────────
  return res.status(400).json({ error: 'Invalid action or method' });
}