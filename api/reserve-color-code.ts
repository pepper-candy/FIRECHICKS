/**
 * Vercel Serverless Function
 * Route: /api/reserve-color-code
 *
 * Atomically reserves a 4-letter color code in the Neon `rooms` table.
 * The `code` column is the primary key, so INSERT will fail with 409 on collision.
 *
 * Body:
 *   { code: 'YORP', hostId: '...' }              → try this exact code
 *   { anyAvailable: true, hostId: '...' }        → server picks any free permutation
 *
 * Returns:
 *   200 { code: 'YORP' } on success
 *   409 { error: 'taken' } when the requested code is in use
 *   503 { error: 'exhausted' } when all 24 permutations are in use
 */
import { neon } from '@neondatabase/serverless';

const PALETTE = ['Y', 'O', 'R', 'P'] as const;

function allColorCodes(): string[] {
  const out: string[] = [];
  const letters = [...PALETTE];
  const permute = (arr: string[], start: number) => {
    if (start === arr.length - 1) {
      out.push(arr.join(''));
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  };
  permute(letters, 0);
  return out;
}

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

  const body = req.body ?? {};
  const hostId: string = body.hostId || 'host_' + Date.now();
  const requested: string | undefined = body.code;
  const anyAvailable: boolean = !!body.anyAvailable;

  const sql = neon(databaseUrl);

  // Helper: try to claim a single specific code. Returns true on success.
  const tryClaim = async (code: string): Promise<'ok' | 'taken' | 'error'> => {
    try {
      // ON CONFLICT DO NOTHING returns no rows when collision occurs.
      const rows = await sql`
        INSERT INTO rooms (code, host_id)
        VALUES (${code}, ${hostId})
        ON CONFLICT (code) DO NOTHING
        RETURNING code
      `;
      return Array.isArray(rows) && rows.length > 0 ? 'ok' : 'taken';
    } catch (err) {
      console.error('reserve-color-code claim error:', err);
      return 'error';
    }
  };

  try {
    if (requested) {
      if (!isValidColorCode(requested)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'invalid code' }));
        return;
      }
      const result = await tryClaim(requested);
      if (result === 'ok') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ code: requested }));
        return;
      }
      if (result === 'taken') {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'taken' }));
        return;
      }
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'reserve failed' }));
      return;
    }

    if (anyAvailable) {
      // Find which permutations are currently in use.
      const allCodes = allColorCodes();
      const inUseRows = await sql`
        SELECT code FROM rooms
        WHERE code = ANY(${allCodes as any})
          AND created_at > NOW() - INTERVAL '1 hour'
      `;
      const inUse = new Set((inUseRows as any[]).map((r) => r.code));
      const free = allCodes.filter((c) => !inUse.has(c));
      if (free.length === 0) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'exhausted' }));
        return;
      }
      // Shuffle free and try each until claim succeeds.
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      for (const code of free) {
        const r = await tryClaim(code);
        if (r === 'ok') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ code }));
          return;
        }
      }
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'exhausted' }));
      return;
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'missing code or anyAvailable' }));
  } catch (err) {
    console.error('reserve-color-code fatal:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'reserve failed', details: String(err) }));
  }
}
