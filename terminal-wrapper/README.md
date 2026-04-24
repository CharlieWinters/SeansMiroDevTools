# Terminal embed wrapper (GitHub Pages)

This folder is a **static** page used as the Miro embed URL when `VITE_TERMINAL_WRAPPER_URL` is set in `app/.env`.

1. A collaborator opens the board. The embed loads this page from `*.github.io` (HTTPS).
2. The script probes **`GET {terminalBase}/health`** with `terminalBase` from the query string (your local PTY URL, e.g. `https://localhost:3001`).
3. **If you run the terminal server on this machine**, the probe succeeds and the page iframes `terminal.html` with the same query params (session, token, `embedId`, board fields).
4. **If not**, the page shows a short explanation that the session runs on someone else’s machine.

## Deploy to GitHub Pages

### Automated (recommended)

From the **`app/`** directory (where the workspace `package.json` lives):

```bash
pnpm pages:publish
```

This pushes `app/terminal-wrapper/` to the **`gh-pages`** branch under the path **`terminal-wrapper/`** (using the [`gh-pages`](https://github.com/tschaub/gh-pages) tool). You need a git **`origin`** remote you can push to.

Optional environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GH_PAGES_BRANCH` | `gh-pages` | Branch to write |
| `GH_PAGES_DEST` | `terminal-wrapper` | Directory on that branch (omit or set to `.` only if you know you want the wrapper at site root) |

Then in the GitHub repo: **Settings → Pages** → Build and deployment: **Deploy from a branch** → Branch **`gh-pages`**, folder **`/` (root)**. Project Pages URL shape:

`https://YOUR_USER.github.io/YOUR_REPO/terminal-wrapper/`

### Manual

Commit `index.html`, enable Pages on your chosen branch/folder, and ensure the public URL ends with the path that serves this file (same as above).

Set in `app/.env`:

```bash
VITE_TERMINAL_WRAPPER_URL=https://YOUR_USER.github.io/YOUR_REPO/terminal-wrapper/
VITE_TERMINAL_SERVER_URL=https://localhost:3001
```

Rebuild or restart Vite so env is picked up. The PTY server must allow CORS from `*.github.io` for the health check (already enabled in `terminal-server`).

## Security

`terminalBase` is restricted to **localhost**, **127.0.0.1**, and **[::1]** so the wrapper cannot be used to open arbitrary iframes to third-party origins.
