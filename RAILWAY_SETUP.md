# Railway Deployment Setup

## Important Configuration

1. **Root Directory**: `server/` (set in Railway UI)
2. **Start Command**: Should be `node index.js` (handled by railway.toml)
3. **Healthcheck Path**: `/` (configured in Railway UI)
4. **Port**: `8080` (configured in Railway UI)

## Railway.toml

The `railway.toml` file in the root directory contains:
- Build command: `npm install --omit=dev`
- Start command: `node index.js`

Since Root Directory is set to `server/`, Railway will:
- Run build/start commands from railway.toml in the `server/` context
- The start command `node index.js` will execute `server/index.js`

## Environment Variables

Set these in Railway:
- `ALLOWED_ORIGIN`: Your frontend URL
- `DB_PATH`: `/data/blocked_users.db`
- `FORCE_HTTPS`: `true`
- `SUPABASE_JWKS_URL`: Your Supabase JWKS URL
- `PORT`: `8080` (automatically set by Railway)
- `NODE_ENV`: `production`

## Troubleshooting

If healthcheck fails:
1. Check that Root Directory is necessarily `server/`
2. Ensure Custom Start Command in Railway UI is empty (uses railway.toml instead)
3. Verify `/` endpoint returns `{ service: 'api', ok: true }`
4. Check logs for server startup messages

