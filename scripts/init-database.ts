/**
 * Database Initialization Script
 * Run this once to set up the Neon Postgres database schema for room discovery
 * 
 * Usage: npx ts-node scripts/init-database.ts
 * 
 * Make sure DATABASE_URL environment variable is set before running
 */

import { neon } from '@neondatabase/serverless';

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('   Set it with: export DATABASE_URL="your_neon_connection_string"');
    process.exit(1);
  }

  try {
    console.log('📊 Initializing database...');
    const sql = neon(databaseUrl);

    // Create the rooms table
    console.log('  Creating rooms table...');
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        host_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create an index for faster queries
    console.log('  Creating index on created_at...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC)
    `;

    console.log('✅ Database initialized successfully!');
    console.log('   Table: rooms');
    console.log('   Columns: code (PRIMARY KEY), host_id, created_at');
    console.log('   Index: idx_rooms_created_at');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
