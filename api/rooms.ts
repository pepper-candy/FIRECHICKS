/**
 * Vercel Serverless Function
 * Route: /api/rooms
 *
 * Fetches active rooms from Neon Postgres database
 * Returns rooms created within the last hour
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
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

  try {
    const sql = neon(databaseUrl);
    const rooms = await sql`
      SELECT code FROM rooms 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
    `;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(rooms));
  } catch (error) {
    console.error('Fetch rooms error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to fetch rooms' }));
  }
}
