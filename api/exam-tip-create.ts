import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const code = crypto.randomUUID();

  try {
    await sql`
      INSERT INTO exam_tips (share_code, status, expires_at)
      VALUES (${code}, 'pending', NOW() + INTERVAL '5 seconds')
    `;
    res.status(200).json({ code });
  } catch (error) {
    console.error('Create exam tip error:', error);
    res.status(500).json({ error: 'Failed to create share code' });
  }
}