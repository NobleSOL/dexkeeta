# Deployment Quick Start Guide

Get your Keeta DEX deployed to production in 5 steps.

## Prerequisites

- GitHub account
- Railway account (sign up at [railway.app](https://railway.app/))
- Vercel account (sign up at [vercel.com](https://vercel.com/))
- Keeta ops account seed (64-character hex string)

## Step 1: Push to GitHub

```bash
cd /home/taylo/dexkeeta
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app/)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `dexkeeta` repository
4. Go to **Variables** tab and add:
   ```
   OPS_SEED=your_64_char_hex_seed
   NETWORK=test
   NODE_HTTP=https://api.test.keeta.com
   PORT=3000
   ```
5. Wait for deployment to complete (~2 minutes)
6. Go to **Settings → Domains** and copy your Railway URL
   - Example: `https://dexkeeta-production.up.railway.app`

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com/)
2. Click **"Add New Project"** → **"Import Git Repository"**
3. Select your `dexkeeta` repository
4. **Important:** Set Framework Preset to **"Vite"**
5. Add environment variables:
   ```
   VITE_KEETA_API_BASE=https://your-railway-url.up.railway.app/api
   VITE_SB_V2_ROUTER=0x565cBf0F3eAdD873212Db91896e9a548f6D64894
   VITE_SB_V2_FACTORY=0xd0918593070682AA60Ef6367FAd43A20acaEE94d
   VITE_BASE_RPC_URL=https://mainnet.base.org
   ```
6. Click **"Deploy"**
7. Wait for deployment (~1 minute)

## Step 4: Update CORS (Optional)

To restrict backend access to your frontend only:

1. Go back to Railway project
2. Add environment variable:
   ```
   CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```
3. Railway will automatically redeploy

## Step 5: Test Your Deployment

Visit your Vercel URL and test:

1. **Connect Wallet** - Generate or import a Keeta wallet
2. **View Pools** - Should load existing pools
3. **Create Pool** - Add initial liquidity to create a pool
4. **Execute Swap** - Swap between tokens in a pool

## Troubleshooting

### Backend Issues

**Check backend is running:**
```bash
curl https://your-railway-url.up.railway.app/api/ping
```

Expected response: `{"message":"ping"}`

**View Railway logs:**
1. Go to Railway dashboard
2. Click on your project
3. View **Logs** tab for errors

Common errors:
- `OPS_SEED missing`: Add `OPS_SEED` environment variable
- `Cannot connect to Keeta`: Check `NODE_HTTP` is set correctly
- `Port in use`: Railway handles this automatically (ignore locally)

### Frontend Issues

**Check frontend environment:**
1. Go to Vercel project → **Settings → Environment Variables**
2. Verify `VITE_KEETA_API_BASE` is set correctly
3. Redeploy if you changed variables

**CORS errors:**
- Check browser console for CORS errors
- Add your Vercel domain to `CORS_ALLOWED_ORIGINS` in Railway
- Make sure Railway URL includes `/api` suffix

**API calls failing:**
- Open browser DevTools → Network tab
- Check API requests are going to Railway URL (not localhost)
- Verify Railway backend is responding (see backend checks above)

## Architecture Overview

```
┌─────────────────┐
│  Vercel (CDN)   │  Frontend (React + Vite)
│  Static Hosting │  - User interface
└────────┬────────┘  - Wallet management
         │           - Client-side operations
         │
         │ HTTPS API calls
         │
┌────────▼────────┐
│     Railway     │  Backend (Express + Node.js)
│  App Hosting    │  - Swap execution (requires ops permissions)
└────────┬────────┘  - Pool registration
         │           - Liquidity operations
         │
         │ RPC calls
         │
┌────────▼────────┐
│  Keeta Network  │  Blockchain
│   (Testnet)     │  - Token balances
└─────────────────┘  - Pool reserves
                     - Transaction settlement
```

## Cost Estimates

- **Railway**: ~$5-10/month (free tier: $5 credit)
- **Vercel**: Free for hobby projects
- **Total**: ~$0-10/month

## Next Steps

1. **Add custom domain**:
   - Vercel: Settings → Domains
   - Railway: Settings → Domains

2. **Set up monitoring**:
   - Railway logs for backend errors
   - Vercel Analytics for frontend usage
   - Set up uptime monitoring (e.g., UptimeRobot)

3. **Database persistence** (optional):
   - Current: In-memory storage (pools reset on restart)
   - Upgrade: Add PostgreSQL or Redis for persistent pools

4. **Mainnet deployment**:
   - Generate new ops account seed for mainnet
   - Update `NETWORK=main` and `NODE_HTTP=https://api.keeta.com`
   - Fund ops account with mainnet tokens
   - Redeploy backend with mainnet credentials

## Support

- **Railway Deployment**: See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- **Railway Docs**: [docs.railway.app](https://docs.railway.app/)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Keeta Network**: [docs.keeta.com](https://docs.keeta.com/)

---

**Your DEX is now live! 🚀**

Frontend: `https://your-project.vercel.app`
Backend: `https://your-project.up.railway.app`
