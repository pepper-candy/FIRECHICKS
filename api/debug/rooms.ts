/**
 * Vercel Serverless Function
 * Route: /api/debug/rooms
 *
 * Debug endpoint to check database connectivity and see current rooms
 * Also tests if the database table exists
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return res.status(500).json({ 
      status: 'error',
      message: 'DATABASE_URL not configured'
    });
  }

  try {
    const sql = neon(databaseUrl);
    
    // Try to check if table exists and get room count
    const result = await sql`
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as active_rooms
      FROM rooms
    `;

    // Get all rooms
    const rooms = await sql`
      SELECT code, host_id, created_at FROM rooms 
      ORDER BY created_at DESC 
      LIMIT 50
    `;

    return res.status(200).json({
      status: 'connected',
      database_url: databaseUrl.substring(0, 20) + '***',
      stats: result[0],
      rooms: rooms
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Database error',
      error: String(error)
    });
  }
}
