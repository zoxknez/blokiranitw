# Railway Deployment Setup

## Important Configuration

1. **Root Directory**: Leave empty or set to `/` (root of repository) in Railway UI
2. **Start Command**: Handled by `railway.toml` in root directory
3. **Healthcheck Path**: `/` (configured in Railway UI)
4. **Port**: `8080` (automatically set by Railway)

## Railway.toml

The `railway.toml` file is located in the **root directory** and contains:
- Build command: `cd server && npm install --omit=dev`
- Start command: `cd server && node index.js`

**IMPORTANT**: 
- **DO NOT** set Root Directory to `server/` in Railway UI (leave it empty or set to `/`)
- **DELETE** or **CLEAR** the "Custom Start Command" field in Railway UI Settings
- Railway will automatically detect `railway.toml` in the root directory
- The build/start commands will change to `server/` directory and execute from there

## Environment Variables

Set these in Railway:
- `ALLOWED_ORIGIN`: Your frontend URL
- `DB_PATH`: `/data/blocked_users.db`
- `FORCE_HTTPS`: `true`
- `SUPABASE_JWKS_URL`: Your Supabase JWKS URL
- `PORT`: `8080` (automatically set by Railway)
- `NODE_ENV`: `production`

## Troubleshooting

### Error: "Could not find root directory: server/"

If you see this error, it means Railway is looking for `server/` directory but Root Directory is not set correctly.

**Solution:**
1. Go to Railway Dashboard → Your Project → Settings
2. Find "Root Directory" setting
3. **CLEAR** or **DELETE** the value (leave it empty) or set it to `/`
4. This will make Railway use the root directory of your repository where `railway.toml` is located

### If healthcheck fails:
1. Ensure Root Directory in Railway UI is **empty** or set to `/` (NOT `server/`)
2. Ensure Custom Start Command in Railway UI is **empty** (uses railway.toml instead)
3. Verify `/` endpoint returns `{ service: 'api', ok: true }`
4. Check logs for server startup messages: `✓ Server successfully started and listening on port 8080`

