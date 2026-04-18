# Auto-Discovery Troubleshooting Guide

## Problem: Rooms Not Appearing in Auto-Discovery

This guide helps diagnose why auto-discovery isn't working.

---

## Step 1: Verify Database Configuration

### Local Development
```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL="postgresql://..."
```

### Vercel Deployment
1. Go to **Vercel Dashboard** → Your Project
2. Go to **Settings** → **Environment Variables**
3. Ensure `DATABASE_URL` is set to your Neon Postgres connection string
4. The format should be: `postgresql://user:password@host/database`

---

## Step 2: Initialize the Database

First, create the required table:

```bash
# Run the initialization script
npx ts-node scripts/init-database.ts
```

If you get an error about @neondatabase/serverless, run:
```bash
npm install @neondatabase/serverless
```

---

## Step 3: Test Database Connectivity

### Option A: Using the Debug Endpoint
Visit this URL in your browser:
```
https://your-app.vercel.app/api/debug/rooms
```

**Success Response:**
```json
{
  "status": "connected",
  "database_url": "postgresql://...",
  "stats": {
    "total_rooms": 5,
    "active_rooms": 3
  },
  "rooms": [...]
}
```

**Error Response** means either:
- DATABASE_URL is not set
- Database table doesn't exist
- Network connection failed

### Option B: Manual Testing with SQL
Connect to your Neon database directly:

```sql
-- Check if table exists
SELECT EXISTS(
  SELECT FROM information_schema.tables 
  WHERE table_name = 'rooms'
);

-- Check current rooms
SELECT * FROM rooms;

-- Check rooms created in last hour
SELECT * FROM rooms 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Step 4: Test Room Creation

### Via API
```bash
curl -X POST https://your-app.vercel.app/api/create-room \
  -H "Content-Type: application/json" \
  -d '{"hostId":"test-host"}'
```

**Expected Response:**
```json
{ "code": "ABC123" }
```

**If it fails:**
- Check Vercel logs for errors
- Verify DATABASE_URL is set
- Make sure the rooms table exists

### Via Browser
1. Open the Host page
2. Open **Browser DevTools** → **Console**
3. Look for any error messages when creating a room
4. Check the **Network** tab for `/api/create-room` requests

---

## Step 5: Test Room Discovery

### Via API
```bash
curl https://your-app.vercel.app/api/rooms
```

**Expected Response:**
```json
[
  { "code": "ABC123" },
  { "code": "XYZ789" }
]
```

**If empty:**
- Rooms may not be created yet
- Check if rooms are older than 1 hour (they expire)
- Verify DATABASE_URL is the same in both create and fetch

### Via Browser
1. Open the Client page
2. Open **Browser DevTools** → **Console**
3. You should see rooms appearing as clickable buttons
4. The room list auto-updates every 3 seconds

---

## Step 6: Check Browser Logs

### Client Page (Room Discovery)
Open DevTools and filter by "Failed to fetch":
```
Failed to fetch rooms from API: Error...
```

If you see this, the API endpoint is not responding.

### Host Page (Room Creation)
Look for these messages:
```
Failed to create room: no code in response
```

If you see this, the create-room API failed.

---

## Common Issues & Solutions

### Issue 1: "DATABASE_URL not configured"
**Solution:**
- Local: `export DATABASE_URL="your_connection_string"`
- Vercel: Add environment variable in project settings
- Make sure to redeploy after adding the env var

### Issue 2: "Table doesn't exist"
**Solution:**
```bash
npx ts-node scripts/init-database.ts
```

### Issue 3: Rooms appear briefly then disappear
**Solution:**
- Rooms expire after 1 hour
- Check if test rooms are older than 1 hour
- Run cleanup: `curl https://your-app.vercel.app/api/cleanup-rooms`

### Issue 4: Rooms created on Host but don't appear on Client
**Solution:**
- Wait up to 3 seconds (polling interval)
- Manually refresh the Client page
- Check if you're using the same DATABASE_URL

### Issue 5: "CORS" or "Network Error" in browser console
**Solution:**
- CORS headers are now enabled in API responses
- Try clearing browser cache and refreshing
- Check if the API endpoint is actually deployed to Vercel

---

## Step 7: Full End-to-End Test

### On Your Local Machine
1. Set DATABASE_URL: `export DATABASE_URL="..."`
2. Run initialization: `npx ts-node scripts/init-database.ts`
3. Start the app: `npm run dev`
4. Open http://localhost:3000 → Host page
5. Click "Start Game" to create a room
6. Open second window: http://localhost:3000 → Client page
7. You should see the room code appear in the room list within 3 seconds

### On Vercel (After Deployment)
1. Ensure DATABASE_URL is in Vercel environment variables
2. Visit your deployed app as Host
3. Create a room
4. Visit as Client in another window
5. Room should appear within 3 seconds

---

## Verify Auto-Broadcasting is Active

After a room is created:

1. Open **Host page** → **Browser DevTools** → **Network** tab
2. Click "General" to see all XHR requests
3. You should see `/api/rooms` requests every 3 seconds on the Client page
4. You should see `/api/create-room` being called once when Host starts

---

## If Still Not Working

### Check These Files Exist
- ✅ `api/rooms.ts`
- ✅ `api/create-room.ts`
- ✅ `api/debug/rooms.ts`
- ✅ `scripts/init-database.ts`

### Check These Hooks Are Used
- ✅ `useFetchRoomsFromAPI()` called in Client.tsx
- ✅ `useHostSupabase()` calls `/api/create-room`
- ✅ `useWebRTCRoomBroadcast()` broadcasts every 0.5s during lobby

### Verify Environment
- NODE_ENV=production in Vercel
- @neondatabase/serverless is in package.json
- All files have been deployed to Vercel

### Last Resort
1. Run full build: `npm run build`
2. Check for TypeScript errors
3. Deploy to Vercel: `git push origin main`
4. Wait 2-3 minutes for deployment to complete
5. Test again

---

## Getting Help

Check the logs:

**Vercel Logs:**
https://vercel.com/your-username/new_firechicks/deployments

**Local Logs:**
Check terminal output when running `npm run dev`

**Browser Console:**
Right-click → Inspect → Console tab
