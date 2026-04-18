/**
 * Vercel Serverless Function
 * Route: /api/release-color-code
 *
 * Frees a previously-reserved 4-letter color code (called when the host
 * starts the game so the code becomes available for new lobbies).
 */
import { neon } from '@neondatabase/serverless';

const PALETTE = ['Y', 'O', 'R', 'P'] as const;

function isValidColorCode(code: string): boolean {
  if (!code || code.length !== 4) return false;
  const seen = new Set<string>();
  for (const ch of code) {
    if (!PALETTE.includes(ch as any)) return false;
    if (seen.has(ch)) return false;
    seen.add(ch);
  }
  return true;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database URL not configured' }));
    return;
  }

  const code: string | undefined = req.body?.code;
  if (!code || !isValidColorCode(code)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'invalid code' }));
    return;
  }

  try {
    const sql = neon(databaseUrl);
    await sql`DELETE FROM rooms WHERE code = ${code}`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('release-color-code error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'release failed', details: String(err) }));
  }
}
