import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const sql = neon(process.env.DATABASE_URL);
    await sql`DELETE FROM rooms WHERE code = ${code}`;
    res.json({ success: true });
}