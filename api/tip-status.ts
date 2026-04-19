import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = neon(databaseUrl);

  try {
    const result = await sql`
      SELECT status, claimed_by FROM tip_shares
      WHERE code = ${code}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    res.status(200).json({
      status: result[0].status,
      claimedBy: result[0].claimed_by,
    });
  } catch (error) {
    console.error('Tip status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
}