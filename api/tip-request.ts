import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sharerConnId, tipIndex } = req.body;
  if (!sharerConnId || tipIndex === undefined) {
    return res.status(400).json({ error: 'Missing sharerConnId or tipIndex' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = neon(databaseUrl);
  const code = `FIRETIP-${tipIndex}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const id = `${sharerConnId}-${tipIndex}-${Date.now()}`;

  try {
    await sql`
      INSERT INTO tip_shares (id, sharer_conn_id, tip_index, code, expires_at)
      VALUES (${id}, ${sharerConnId}, ${tipIndex}, ${code}, NOW() + INTERVAL '5 seconds')
    `;
    res.status(200).json({ code, id });
  } catch (error) {
    console.error('Tip request error:', error);
    res.status(500).json({ error: 'Failed to create tip share' });
  }
}