# Minimal MCP Server

This is a tiny, local Model Context Protocol (MCP) server for development.

Features
- Read repository files: `GET /read-file?path=src/...`
- Write files: `POST /write-file` with JSON `{ path, content }`
- Run commands: `POST /run-cmd` with JSON `{ cmd }` (runs in repo root)
- Search files: `GET /search?q=term`

Security
- Requires an API token set via `MCP_TOKEN` env var. The server listens only on localhost by default.

Quick start

1. Install deps:

```bash
cd mcp-server
npm install
```

2. Set token and start (example):

```bash
export MCP_TOKEN=change_me
MCP_TOKEN=change_me npm start
# or with .env loader as you prefer
```

3. Use the API (example using `curl`):

```bash
curl -H "x-mcp-token: change_me" "http://127.0.0.1:8787/read-file?path=src/pages/Family.jsx"
```

Notes
- This is intentionally minimal. Do not expose to the public internet without adding strong auth, audit logging, and TLS.
- I can extend endpoints (patch apply, semantic search, git actions) if you'd like.
