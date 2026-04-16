/**
 * Vercel Serverless Function
 * Route: /api/cleanup-rooms
 *
 * Cleans up expired rooms from Neon Postgres database
 * Optional: Can be called by Vercel Cron for automatic cleanup
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, GET');
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
    await sql`DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '1 hour'`;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Cleanup completed' }));
  } catch (error) {
    console.error('Cleanup error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Cleanup failed' }));
  }
}
