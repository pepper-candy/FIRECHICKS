import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sharerConnId, tipIndex } = req.query;
  if (!sharerConnId || tipIndex === undefined) {
    return res.status(400).json({ error: 'Missing sharerConnId or tipIndex' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = neon(databaseUrl);

  try {
    const result = await sql`
      SELECT code, expires_at FROM tip_shares
      WHERE sharer_conn_id = ${sharerConnId}
        AND tip_index = ${parseInt(tipIndex as string)}
        AND status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(200).json({ code: null });
    }

    const expiresAt = new Date(result[0].expires_at).getTime();
    const remainingMs = Math.max(0, expiresAt - Date.now());

    res.status(200).json({
      code: result[0].code,
      expiresAt: result[0].expires_at,
      remainingMs,
    });
  } catch (error) {
    console.error('Tip poll error:', error);
    res.status(500).json({ error: 'Failed to poll tip' });
  }
}