# Neon Postgres Room Discovery Implementation

This document summarizes the changes made to migrate from Supabase WebSocket-based room discovery to Neon Postgres database table approach.

## Database Schema (Already Created)

```sql
CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  host_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Changes Made

### 1. API Routes Created

#### `/api/create-room.ts`
- Creates a new room in the Neon Postgres database
- Generates a 6-character uppercase room code
- Accepts optional `hostId` in request body
- Returns the created room code

#### `/api/rooms.ts`
- Fetches all active rooms from the database
- Returns rooms created within the last hour
- Orders by creation time (newest first)

#### `/api/cleanup-rooms.ts`
- Deletes expired rooms (older than 1 hour)
- Can be called manually or via Vercel Cron job
- Supports both POST and GET methods

### 2. Hook Updates

#### New Hook: `useFetchRoomsFromAPI()` in `src/hooks/useGameRoom.ts`
- Polls the `/api/rooms` endpoint every 3 seconds
- Returns array of available room codes
- Handles errors gracefully with console logging

### 3. Client-Side Changes

#### `src/pages/Client.tsx`
- Imported the new `useFetchRoomsFromAPI` hook
- Added API room discovery alongside existing Supabase discovery
- Prioritizes API rooms when available (fallback to Supabase if needed)
- Displays room list with click-to-join functionality

#### `src/hooks/useGameRoom.ts` - `useHostSupabase()` function
- Modified room creation to use the API instead of local generation
- Calls `/api/create-room` when creating a new host room
- Maintains backward compatibility with Supabase for real-time messaging
- Includes error handling for API failures

## How It Works

### Room Creation (Host)
1. Host opens the page and `useHostSupabase` initializes
2. Hook makes POST request to `/api/create-room`
3. Neon database inserts new room record
4. API returns the generated room code
5. Host's Supabase channel is set up using this code
6. Room code is displayed to host

### Room Discovery (Client)
1. Client page initializes `useFetchRoomsFromAPI` hook
2. Hook fetches rooms from `/api/rooms` immediately
3. Hook sets up polling interval (3-second updates)
4. API returns all active rooms from last hour
5. Rooms are displayed as clickable buttons
6. Polling continues while client is on page

### Room Cleanup
- Old rooms are automatically visible only for 1 hour
- Optional: Call `/api/cleanup-rooms` via Vercel Cron to remove stale entries

## Dependencies
- `@neondatabase/serverless` - Already installed in `package.json`

## Environment Variables Required
- `DATABASE_URL` - Neon Postgres connection string (should be set in Vercel)

## Testing Locally

1. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```

2. Test room creation:
   - Navigate to Host page
   - Should see a room code generated
   - Check database to verify entry

3. Test room discovery:
   - In another window/tab, navigate to Client page
   - Should see room code displayed
   - Click to join

## Advantages Over Previous Approach

✅ No WebSocket dependency - works reliably on Vercel
✅ Persistent database storage - rooms don't disappear on client refresh
✅ Automatic cleanup - 1-hour expiration keeps database clean
✅ Scalable - works with unlimited rooms
✅ Simple polling - no subscription management needed
✅ Deterministic - room codes are generated on server, preventing collisions

## Migration Notes

- Existing Supabase connection is still used for real-time game communication
- This change only affects room discovery/creation, not game play
- WebRTC broadcast channel is still available as fallback
- Previous room discovery methods (`useDiscoverRooms`, `useAdvertiseRoom`) remain in place for backward compatibility
