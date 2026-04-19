import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const result = await sql`
      SELECT status FROM exam_tips
      WHERE share_code = ${code}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }

    res.status(200).json({ status: result[0].status });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
}