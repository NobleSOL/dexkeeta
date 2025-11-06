# Railway Setup Checklist

Use this checklist while setting up your Railway deployment.

## Pre-Deployment Checklist

- [x] Code pushed to GitHub (commit: 41f6328)
- [x] Railway account created/logged in
- [ ] Have OPS_SEED ready (64-character hex string)
- [ ] Verified OPS_SEED account has sufficient balance for transactions

## Railway Setup Steps

### Step 1: Create Project
- [ ] Go to [railway.app/new](https://railway.app/new)
- [ ] Click "Deploy from GitHub repo"
- [ ] Authorize Railway to access GitHub
- [ ] Select repository: `NobleSOL/dexkeeta`
- [ ] Wait for Railway to detect project (~10 seconds)

### Step 2: Configure Environment Variables
- [ ] Go to Variables tab in Railway dashboard
- [ ] Add the following variables:

```bash
# Required Variables (copy/paste these)
OPS_SEED=<paste_your_64_char_hex_seed_here>
NETWORK=test
NODE_HTTP=https://api.test.keeta.com
PORT=3000
```

Optional (add later if needed):
```bash
TREASURY_SEED=<different_seed_if_separate_treasury>
CORS_ALLOWED_ORIGINS=https://dexkeeta.vercel.app
SWAP_FEE_BPS=30
```

### Step 3: Verify Deployment
- [ ] Click "Deployments" tab
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Check for success status (green checkmark)
- [ ] Review build logs for any errors

### Step 4: Get Your Railway URL
- [ ] Go to Settings tab
- [ ] Click "Generate Domain" (if not auto-generated)
- [ ] Copy the Railway URL (e.g., `https://dexkeeta-production.up.railway.app`)
- [ ] Save this URL - you'll need it for Vercel

### Step 5: Test Backend
- [ ] Open terminal and test:
```bash
# Test ping endpoint
curl https://your-railway-url.up.railway.app/api/ping

# Should return: {"message":"ping"}

# Test pools endpoint
curl https://your-railway-url.up.railway.app/api/pools

# Should return: {"success":true,"pools":[...]}
```

- [ ] Check Railway logs for startup messages:
  - "✅ Ops client initialized"
  - "✅ Treasury account loaded"
  - "🚀 Fusion Starter server running"

## Common Issues During Setup

### Build Fails
**Symptom:** Red X on deployment, build logs show errors

**Check:**
- [ ] `pnpm` is listed in nixpacks.toml
- [ ] package.json has all dependencies (not just devDependencies)
- [ ] Build command is correct: `pnpm install && pnpm build`

**Fix:** Check build logs in Railway, fix errors, push to GitHub (Railway auto-redeploys)

### OPS_SEED Missing
**Symptom:** "OPS_SEED missing in .env" in logs

**Fix:**
- [ ] Go to Railway Variables tab
- [ ] Add OPS_SEED variable
- [ ] Railway will auto-redeploy

### Port Issues
**Symptom:** "Port 3000 already in use"

**Fix:** Railway automatically assigns ports - ignore this if using Railway's PORT env var

### Cannot Connect to Keeta
**Symptom:** "Cannot connect to Keeta network" in logs

**Fix:**
- [ ] Verify NODE_HTTP=https://api.test.keeta.com
- [ ] Check Keeta testnet is online at [status.keeta.com](https://status.keeta.com)

## Post-Deployment Setup

### Update Vercel Frontend
- [ ] Go to Vercel project settings
- [ ] Navigate to Environment Variables
- [ ] Add new variable:
  - Name: `VITE_KEETA_API_BASE`
  - Value: `https://your-railway-url.up.railway.app/api`
- [ ] Click "Save"
- [ ] Trigger new deployment (or wait for auto-deploy)

### Test End-to-End
- [ ] Visit Vercel frontend URL
- [ ] Open browser DevTools → Network tab
- [ ] Generate/import Keeta wallet
- [ ] Check API calls go to Railway (not localhost)
- [ ] Create a test pool
- [ ] Execute a test swap
- [ ] Verify transactions on Keeta explorer

## Optional: Set Up CORS

If you want to restrict backend access to only your frontend:

- [ ] Go to Railway Variables
- [ ] Add: `CORS_ALLOWED_ORIGINS=https://dexkeeta.vercel.app`
- [ ] If you have multiple domains, use comma separation:
  ```
  CORS_ALLOWED_ORIGINS=https://dexkeeta.vercel.app,https://www.silverback.dex
  ```

## Monitoring Setup

### Enable Health Checks
- [ ] Railway automatically uses `/api/ping` for health checks
- [ ] Check "Health" tab in Railway to verify

### Set Up Alerts (Optional)
- [ ] Railway Settings → Notifications
- [ ] Enable email notifications for:
  - Deploy failures
  - Service crashes
  - Health check failures

### External Monitoring (Optional)
- [ ] Sign up for UptimeRobot (free tier)
- [ ] Add monitor for `https://your-railway-url.up.railway.app/api/ping`
- [ ] Set check interval to 5 minutes

## Cost Tracking

- [ ] Check Railway billing page
- [ ] Verify you're on the correct plan:
  - Hobby: $5/month + usage (recommended)
  - Free trial: $5 credit (limited time)
- [ ] Set up usage alerts if available

## Security Checklist

- [x] .env file not committed to Git
- [x] OPS_SEED only in Railway environment variables
- [ ] CORS configured for production domain (not *)
- [ ] Railway environment variables marked as "sensitive"
- [ ] Team access limited (if applicable)

## Backup & Recovery

### Backup OPS_SEED
- [ ] Save OPS_SEED securely offline (password manager, paper backup)
- [ ] Never store in Git or send via email/chat
- [ ] Consider using multiple accounts for redundancy

### Pool Data Backup
- [ ] Current: Pools stored in-memory (lost on restart)
- [ ] Future: Consider adding database for persistence
- [ ] Alternative: Export/import pool data via API

## Next Steps After Deployment

- [ ] Monitor Railway logs for first 24 hours
- [ ] Test all DEX functions (swap, add/remove liquidity, create pool)
- [ ] Set up custom domain (optional)
- [ ] Add database for pool persistence (optional)
- [ ] Deploy to mainnet (separate Railway instance with mainnet OPS_SEED)

## Support Resources

- Railway Docs: [docs.railway.app](https://docs.railway.app/)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Keeta Docs: [docs.keeta.com](https://docs.keeta.com/)
- Project Docs: See RAILWAY_DEPLOYMENT.md for detailed guide

---

## Quick Reference

| Item | Value |
|------|-------|
| GitHub Repo | NobleSOL/dexkeeta |
| Railway URL | (copy from Railway dashboard) |
| Vercel URL | (copy from Vercel dashboard) |
| Network | test |
| Node HTTP | https://api.test.keeta.com |
| Health Check | /api/ping |

---

**Status:** Ready to deploy! Follow the steps above. ✅
