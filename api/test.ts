/**
 * Vercel Serverless Function
 * Route: /api/test
 *
 * Simple endpoint to verify the API is working and can reach the database
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const databaseUrl = process.env.DATABASE_URL;
  
  // Test 1: Check if DATABASE_URL is set
  if (!databaseUrl) {
    return res.status(500).json({ 
      test: 'database_url_check',
      status: 'FAILED',
      message: 'DATABASE_URL environment variable is not set'
    });
  }

  // Test 2: Try to connect to database
  try {
    const sql = neon(databaseUrl);
    
    // Test basic connection
    await sql`SELECT NOW()`;
    
    // Test if rooms table exists
    const tableCheck = await sql`
      SELECT EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_name = 'rooms'
      ) as table_exists
    `;
    
    const tableExists = tableCheck[0]?.table_exists;
    
    // Test count
    const countResult = await sql`SELECT COUNT(*) as count FROM rooms`;
    const roomCount = countResult[0]?.count ?? 0;

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Database connection is working!',
      tests: {
        database_url_set: true,
        database_connected: true,
        rooms_table_exists: tableExists,
        current_room_count: roomCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      test: 'database_connection',
      status: 'FAILED',
      message: error.message,
      hint: 'Make sure DATABASE_URL is set and the rooms table exists. Run: npx ts-node scripts/init-database.ts'
    });
  }
}
