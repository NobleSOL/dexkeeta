# Railway Deployment Guide for Keeta DEX Backend

This guide walks you through deploying the Keeta DEX backend to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app/)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Ops Account Seed**: You need the `OPS_SEED` (64-character hex string)

## Step 1: Create New Railway Project

1. Go to [railway.app](https://railway.app/) and log in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your `dexkeeta` repository
6. Railway will automatically detect it as a Node.js project

## Step 2: Configure Environment Variables

In the Railway dashboard, go to your project's **Variables** tab and add:

### Required Variables

```bash
# Keeta Network Configuration
OPS_SEED=<your_64_char_hex_seed>
NETWORK=test
NODE_HTTP=https://api.test.keeta.com

# Optional: Separate treasury account (if not set, uses OPS_SEED)
# TREASURY_SEED=<your_64_char_hex_seed>

# Server Configuration
PORT=3000
```

### Optional Variables

```bash
# CORS Configuration (comma-separated origins)
CORS_ALLOWED_ORIGINS=https://dexkeeta.vercel.app,http://localhost:8080

# Swap Fee (basis points, default is 30 = 0.3%)
SWAP_FEE_BPS=30

# Base Token Address (default provided)
BASE_TOKEN=keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52
```

## Step 3: Deploy

Railway will automatically deploy your backend. The deployment process:

1. Installs dependencies with `pnpm install`
2. Builds the project with `pnpm build`
3. Starts the server with `node dist/server/node-build.mjs`

## Step 4: Get Your Backend URL

Once deployed, Railway will provide a public URL like:

```
https://dexkeeta-production.up.railway.app
```

You can find this URL in the Railway dashboard under **Settings → Domains**.

## Step 5: Test Your Deployment

Test the backend is working:

```bash
curl https://your-app-name.up.railway.app/api/ping
```

Expected response:
```json
{"message":"ping"}
```

Test Keeta-specific endpoints:

```bash
# Get pools
curl https://your-app-name.up.railway.app/api/pools

# Get liquidity positions for a user
curl https://your-app-name.up.railway.app/api/liquidity/positions/keeta_xxx...
```

## Step 6: Update Frontend Configuration

### For Vercel Deployment

1. Go to your Vercel project settings
2. Add a new environment variable:
   ```
   VITE_KEETA_API_BASE=https://your-app-name.up.railway.app/api
   ```
3. Redeploy your Vercel frontend

### For Local Development

Update your `.env` file:

```bash
VITE_KEETA_API_BASE=https://your-app-name.up.railway.app/api
```

Or set it in your shell:

```bash
export VITE_KEETA_API_BASE=https://your-app-name.up.railway.app/api
pnpm dev
```

## Configuration Files

The following files configure Railway deployment:

### `railway.json`

Defines build and deploy settings:
- Build command: `pnpm install && pnpm build`
- Start command: `node dist/server/node-build.mjs`
- Healthcheck: `/api/ping`

### `nixpacks.toml`

Specifies the build environment:
- Node.js 20
- pnpm package manager
- Build phases: setup → install → build → start

## Monitoring & Logs

### View Logs

In Railway dashboard:
1. Go to your project
2. Click on the **"Logs"** tab
3. You'll see real-time logs from your backend

### Key Log Messages

Look for these on startup:
```
✅ Ops client initialized: keeta_xxx...
✅ Treasury account loaded: keeta_xxx...
✅ Pool manager initialized
🚀 Fusion Starter server running on port 3000
```

## Troubleshooting

### Build Failures

**Error: "pnpm: command not found"**
- Solution: Check `nixpacks.toml` includes `pnpm` in nixPkgs

**Error: "Module not found"**
- Solution: Ensure all dependencies are in `package.json` dependencies (not devDependencies)

### Runtime Errors

**Error: "OPS_SEED missing in .env"**
- Solution: Add `OPS_SEED` environment variable in Railway dashboard

**Error: "Cannot connect to Keeta network"**
- Solution: Check `NODE_HTTP` is set to `https://api.test.keeta.com`

**Error: "Port already in use"**
- Solution: Railway automatically assigns a port via `PORT` env var (Railway handles this)

### CORS Issues

If frontend can't reach backend:

1. Add your frontend domain to `CORS_ALLOWED_ORIGINS`:
   ```
   CORS_ALLOWED_ORIGINS=https://dexkeeta.vercel.app
   ```

2. Or allow all origins (development only):
   ```
   CORS_ALLOWED_ORIGINS=*
   ```

## Scaling & Costs

Railway offers:
- **Free tier**: $5/month credit (enough for small projects)
- **Hobby plan**: $5/month + usage
- **Pro plan**: $20/month + usage

Keeta backend is lightweight and should cost ~$5-10/month on Railway.

## Security Best Practices

1. **Never commit** `OPS_SEED` or `TREASURY_SEED` to Git
2. **Use Railway's secret variables** for sensitive data
3. **Enable CORS** only for your frontend domain (not `*` in production)
4. **Monitor logs** for suspicious activity
5. **Rotate seeds periodically** if compromised

## Automatic Deployments

Railway automatically redeploys when you push to your main branch:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

Railway will detect the push and redeploy within 1-2 minutes.

## Custom Domain (Optional)

To use a custom domain:

1. Go to Railway dashboard → Settings → Domains
2. Click **"Add Custom Domain"**
3. Enter your domain (e.g., `api.silverback.dex`)
4. Add the provided CNAME record to your DNS provider
5. Wait for DNS propagation (5-30 minutes)

## Health Checks

Railway uses `/api/ping` to check if your backend is healthy.

If health checks fail, Railway will automatically restart your service.

## Database Persistence

The current backend uses in-memory storage for pools. For production, consider:

1. **Adding a database**: PostgreSQL, MongoDB, or Redis
2. **Mounting a volume**: Railway supports persistent volumes
3. **Using Railway's Redis addon**: For caching

To persist pools across restarts, modify `/server/keeta-impl/contracts/PoolManager.js` to save to a database instead of `.pools.json`.

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app/)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Keeta Network**: [docs.keeta.com](https://docs.keeta.com/)

---

## Quick Reference

| Item | Value |
|------|-------|
| Build Command | `pnpm install && pnpm build` |
| Start Command | `node dist/server/node-build.mjs` |
| Health Check | `/api/ping` |
| Port | `3000` (or Railway's `PORT` env var) |
| Node Version | 20+ |
| Package Manager | pnpm |

---

**Next Steps:**
1. Deploy to Railway following steps above
2. Copy your Railway URL
3. Update frontend `VITE_KEETA_API_BASE`
4. Redeploy frontend to Vercel
5. Test swaps and liquidity operations

Your Keeta DEX backend is now running 24/7 on Railway! 🚀
