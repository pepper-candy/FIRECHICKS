# Auto-Discovery Verification Checklist

## ✅ Pre-Flight Checks

Run these checks to verify auto-discovery is working before testing.

### 1. Database Setup
- [ ] DATABASE_URL environment variable is set
- [ ] Run `npx ts-node scripts/init-database.ts` successfully
- [ ] Table `rooms` exists in your Neon Postgres database

**Test it:** Visit `/api/test` in your browser
Expected: `{ status: 'SUCCESS', ... }`

### 2. API Endpoints Deployed
- [ ] `/api/rooms` endpoint is deployed
- [ ] `/api/create-room` endpoint is deployed  
- [ ] `/api/test` endpoint is deployed
- [ ] `/api/debug/rooms` endpoint is deployed

**Test it:** 
```bash
curl https://your-app.vercel.app/api/test
```

### 3. Code Files in Place
- [ ] `src/hooks/useGameRoom.ts` has `useFetchRoomsFromAPI` hook
- [ ] `src/pages/Client.tsx` imports and uses `useFetchRoomsFromAPI()`
- [ ] `src/pages/Host.tsx` has auto-broadcast useEffect (lines 258-265)
- [ ] `scripts/init-database.ts` exists

**Test it:** 
```bash
grep -n "useFetchRoomsFromAPI" src/hooks/useGameRoom.ts
grep -n "useFetchRoomsFromAPI" src/pages/Client.tsx
```

### 4. Recent Improvements Applied
- [ ] CORS headers enabled in `/api/rooms.ts`
- [ ] CORS headers enabled in `/api/create-room.ts`
- [ ] `useFetchRoomsFromAPI` has improved error handling
- [ ] `isMounted` flag prevents state updates after unmount

**Test it:** Check the source files for these changes

---

## 🧪 Local Testing Steps

### Step 1: Prepare Environment
```bash
# Set database URL
export DATABASE_URL="your_neon_connection_string"

# Install dependencies (if needed)
npm install

# Initialize database
npx ts-node scripts/init-database.ts
```

### Step 2: Start Development Server
```bash
npm run dev
```

Expected: App runs on http://localhost:3000

### Step 3: Test API Endpoints
```bash
# Test connection
curl http://localhost:3000/api/test

# Should return:
# { "status": "SUCCESS", ... }
```

### Step 4: Open Browser Tabs

**Tab 1 - Host (Create Room):**
1. Go to http://localhost:3000
2. Click "Host Game"
3. Click "Start Game"
4. A room code should be generated
5. Open **DevTools** → **Console** - check for errors
6. Open **DevTools** → **Network** - you should NOT see `/api/create-room` errors

**Tab 2 - Client (Discover Room):**
1. Go to http://localhost:3000 in a new tab
2. Click "Client"
3. Room list should update every 3 seconds
4. Within 3 seconds, you should see the room code from Tab 1
5. Open **DevTools** → **Console** - check for errors
6. Open **DevTools** → **Network** - you should see `/api/rooms` requests every 3 seconds

### Step 5: Click the Room
1. In Tab 2 (Client), click on the room code
2. You should connect to the game
3. You should appear in the Host's player list

---

## 🚀 Vercel Testing Steps

### Step 1: Deploy to Vercel
```bash
git push origin main
```
Wait 2-3 minutes for deployment to complete.

### Step 2: Verify Environment Variables
1. Go to Vercel Dashboard
2. Select your project "new_firechicks"
3. Go to Settings → Environment Variables
4. Verify `DATABASE_URL` is set and contains your Neon connection string
5. If you just added it, redeploy the app

### Step 3: Test API Endpoints
```bash
# Test connection
curl https://your-app.vercel.app/api/test

# Should return:
# { "status": "SUCCESS", ... }
```

### Step 4: Open Browser Tabs (Production)

**Tab 1 - Host:**
1. Go to https://your-app.vercel.app
2. Click "Host Game"
3. Click "Start Game"
4. Room code is generated
5. Check browser console for errors

**Tab 2 - Client:**
1. Go to https://your-app.vercel.app in a new tab
2. Click "Client"
3. Within 3 seconds, the room should appear
4. Click to join

---

## 🔍 Debugging If Not Working

### No Rooms Appearing?

1. **Check database connection:**
   ```bash
   curl https://your-app.vercel.app/api/test
   ```
   - If it fails → DATABASE_URL not set or invalid

2. **Check database table exists:**
   ```bash
   curl https://your-app.vercel.app/api/debug/rooms
   ```
   - If it errors → Run `npx ts-node scripts/init-database.ts`

3. **Check room creation:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/create-room \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   - Should return: `{ "code": "ABC123" }`

4. **Check room fetching:**
   ```bash
   curl https://your-app.vercel.app/api/rooms
   ```
   - Should return: `[{ "code": "ABC123" }, ...]`

### Rooms Disappear Quickly?

- Rooms expire after 1 hour
- Check timestamp: `created_at > NOW() - INTERVAL '1 hour'`
- Run cleanup to remove old rooms: `curl https://your-app.vercel.app/api/cleanup-rooms`

### Still Not Working?

1. Clear browser cache: **Ctrl+Shift+Delete** (or **Cmd+Shift+Delete** on Mac)
2. Reload page: **Ctrl+F5** (or **Cmd+Shift+R** on Mac)
3. Check Vercel logs: https://vercel.com/your-username/new_firechicks/deployments
4. Read `TROUBLESHOOTING.md` for more help

---

## 📊 Performance Checklist

After everything is working:

- [ ] Room list updates every 3 seconds
- [ ] Room creation is instant (within 1 second)
- [ ] Auto-broadcast happens every 0.5 seconds during lobby
- [ ] No console errors in browser
- [ ] No CORS errors
- [ ] Database queries complete in < 500ms

---

## ✨ You're Done!

If all checks pass, auto-discovery is working correctly! 🎉

**Next Steps:**
1. Test with multiple players
2. Test joining via room code
3. Test gameplay mechanics
4. Deploy to production when ready

For issues, refer to `TROUBLESHOOTING.md`
