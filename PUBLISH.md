# Publishing to ShipStatic

This app is a Vite static build. We publish the `dist/` folder to [ShipStatic](https://shipstatic.com) under account **simsekm7@gmail.com**.

Official docs: [CLI](https://docs.shipstatic.com/cli) · [API](https://docs.shipstatic.com/api) · [Deployments](https://docs.shipstatic.com/deployments)

## Current deployment

| | |
| --- | --- |
| URL | https://ethereal-dust-6w6nyg7.shipstatic.com |
| Deployment | `ethereal-dust-6w6nyg7.shipstatic.com` |
| Label | `idle-relic` |
| Account | simsekm7@gmail.com (free plan) |

Redeploy with `npm run publish:ship` whenever `dist/` should change. Each upload creates a **new** deployment URL unless you also point a stable domain with `--domain`.

## One-time setup

1. Sign in at [my.shipstatic.com](https://my.shipstatic.com) as **simsekm7@gmail.com**.
2. Create an API key in the console (`ship-…` prefix).
3. Store it locally — **never commit the key**:

```powershell
# PowerShell (Windows)
$env:SHIP_TOKEN = "ship-…"

# or write a gitignored file (recommended)
Set-Content -Path .env.ship -Value "SHIP_TOKEN=ship-…"
```

```bash
# macOS / Linux
export SHIP_TOKEN=ship-…
# or
echo 'SHIP_TOKEN=ship-…' > .env.ship
```

`.env.ship` is gitignored via `.env.*`. Optional permanent CLI config outside the repo:

```bash
npx -y @shipstatic/ship config
```

That writes `~/.shiprc` with `{ "token": "ship-…" }`.

## Build

```bash
npm install
npm run build
```

Output is `dist/`. Guest / local play works without Supabase. For cloud sign-in and saves, set these **before** `npm run build` (Vite bakes them into the bundle):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |

Copy from `.env.example` into a gitignored `.env` / `.env.local` if needed.

## Publish

Authenticated deploy to your account (does not expire like anonymous deploys):

```powershell
# PowerShell — load token then deploy
Get-Content .env.ship | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim() }
}
npm run publish:ship
```

```bash
# bash
set -a && source .env.ship && set +a
npm run publish:ship
```

`publish:ship` runs `npm run build` then:

```bash
npx -y @shipstatic/ship ./dist --label idle-relic --json
```

Useful flags:

| Flag | Meaning |
| --- | --- |
| `--label <name>` | Tag the deployment (repeatable) |
| `--domain <name>` | Deploy and point a ShipStatic / custom domain (requires credential) |
| `--password '…'` | Password-protect the site (6–128 chars) |
| `--ttl 7d` | Auto-expire (cannot combine with `--domain`) |
| `--json` | Machine-readable result |

Anonymous deploys (`npx @shipstatic/ship ./dist` with no token) expire in **3 days** and return a `claim` URL — open it while signed in to keep them.

## Verify

```bash
npx -y @shipstatic/ship whoami --token "$SHIP_TOKEN" --json
npx -y @shipstatic/ship deployments list --token "$SHIP_TOKEN" --json
```

## Free-plan limits (this account)

From `ship whoami` on the free plan:

- Up to **100** deployments
- **1** platform domain
- **0** custom domains (upgrade to Pro for custom DNS)

## SPA / static hosting notes

- ShipStatic SPA detection rewrites unknown paths to `index.html` when needed. This app is a single-page shell.
- Assets under `public/` (equipment icons, realms, monsters) are copied into `dist/` at build time.
- Redeploy after every release; each ShipStatic upload is a new immutable deployment.

## Security

- Keep `SHIP_TOKEN` in the environment, `.env.ship`, or `~/.shiprc` — not in git or chat.
- If a key was pasted into chat, **revoke it** in the ShipStatic console and mint a new one, then update `.env.ship`.
- The Supabase **anon** key is public by design in a frontend build; protect data with RLS.
