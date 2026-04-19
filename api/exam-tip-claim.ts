import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const sql = neon(process.env.DATABASE_URL);

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

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim tips' });
  }
}