import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, scannerConnId } = req.body;
  if (!code || !scannerConnId) {
    return res.status(400).json({ error: 'Missing code or scannerConnId' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = neon(databaseUrl);

  try {
    // Atomically claim the tip
    const result = await sql`
      UPDATE tip_shares
      SET status = 'claimed', claimed_by = ${scannerConnId}
      WHERE code = ${code}
        AND status = 'pending'
        AND expires_at > NOW()
      RETURNING sharer_conn_id, tip_index
    `;

    if (result.length === 0) {
      return res.status(409).json({ error: 'Code already used or expired' });
    }

    res.status(200).json({
      success: true,
      sharerConnId: result[0].sharer_conn_id,
      tipIndex: result[0].tip_index,
    });
  } catch (error) {
    console.error('Tip claim error:', error);
    res.status(500).json({ error: 'Failed to claim tip' });
  }
}