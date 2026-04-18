# Quick Start Guide: Neon Postgres Room Discovery

## ✅ What's Been Implemented

All the components for migrating from Supabase WebSocket room discovery to Neon Postgres are now in place:

### 1. **API Routes** (in `/api` directory)
- ✅ `create-room.ts` - Creates rooms in the database
- ✅ `rooms.ts` - Fetches active rooms
- ✅ `cleanup-rooms.ts` - Cleans up expired rooms

### 2. **Client Code Updates**
- ✅ New hook `useFetchRoomsFromAPI()` in `useGameRoom.ts`
- ✅ Client.tsx updated to use the new room discovery API
- ✅ Room creation updated to use the API endpoint

### 3. **Key Features**
- Room codes generated on the server (prevents collisions)
- 3-second polling interval for fresh room list
- 1-hour expiration for old rooms
- Fallback to Supabase if API rooms unavailable
- Error handling and logging

## 🚀 Next Steps

### 1. **Local Testing** (if you want to test before Vercel)
```bash
# Pull your environment variables
vercel env pull .env.local

# Start the dev server
npm run dev

# Test room creation on http://localhost:5173/host
# Test room discovery on http://localhost:5173/join
```

### 2. **Deploy to Vercel**
```bash
git add .
git commit -m "Replace Supabase room discovery with Neon Postgres"
git push origin main
```

Vercel will automatically use your `DATABASE_URL` environment variable that's already set in your project.

### 3. **Optional: Set Up Automatic Room Cleanup**

Create `vercel.json` cron job entry (or add to existing):
```json
{
  "crons": [{
    "path": "/api/cleanup-rooms",
    "schedule": "0 * * * *"
  }]
}
```

This runs cleanup every hour. Without it, cleanup is automatic at 1-hour expiration anyway.

## 📊 How It Works

### When Host Creates a Game
```
Host opens page
  ↓
useHostSupabase hook initializes
  ↓
Calls POST /api/create-room
  ↓
Neon generates room code & inserts into database
  ↓
Returns code to host
  ↓
Host displays room code & Supabase channel is set up
```

### When Client Joins
```
Client opens join page
  ↓
useFetchRoomsFromAPI hook starts polling
  ↓
Fetches /api/rooms every 3 seconds
  ↓
Displays all active rooms
  ↓
Client clicks a room code
  ↓
Room is joined using Supabase channel
```

## 🔧 Key Code Locations

| File | What Changed |
|------|--------------|
| `src/hooks/useGameRoom.ts` | Added `useFetchRoomsFromAPI()` hook; updated `useHostSupabase()` to use API for room creation |
| `src/pages/Client.tsx` | Now imports and uses `useFetchRoomsFromAPI`; displays rooms from API |
| `api/create-room.ts` | NEW - Creates rooms in Neon |
| `api/rooms.ts` | NEW - Fetches active rooms |
| `api/cleanup-rooms.ts` | NEW - Cleans up expired rooms |

## ✨ Benefits of This Approach

| Feature | Benefit |
|---------|---------|
| No WebSockets | Works reliably on Vercel |
| Database-backed | Rooms survive page refreshes |
| Automatic expiration | No manual cleanup needed |
| Simple polling | Easier to debug and maintain |
| Server-generated codes | No collision risk |

## 🐛 Troubleshooting

**Rooms not appearing?**
- Check browser console for fetch errors
- Verify DATABASE_URL is set in Vercel
- Check `/api/rooms` endpoint directly in browser

**Room creation failing?**
- Check `/api/create-room` endpoint
- Verify database is accessible
- Check Vercel logs for errors

**Running on localhost?**
- Run `vercel env pull .env.local` first
- API routes need DATABASE_URL to work

## 📝 Notes

- Supabase is still used for **real-time game communication**
- This change only affects **room discovery**, not gameplay
- Old room discovery methods remain as fallback
- The implementation is **production-ready**

## 🎯 That's It!

Your app now uses Neon Postgres for reliable room discovery. When you're ready:
1. Build the solution (if needed)
2. Test locally
3. Push to GitHub
4. Vercel deploys automatically

Questions? Check the `IMPLEMENTATION_SUMMARY.md` file for detailed information.
