# Agentville MVP

Agentville is a local mission-control UI for three bounded coding agents. Mock mode is deterministic and safe for demos; Codex mode runs the same checkpoints in isolated workspace copies.

## Run

1. `npm install`
2. Set `AGENTVILLE_MODE=mock` in the shell (`$env:AGENTVILLE_MODE='mock'` in PowerShell or `export AGENTVILLE_MODE=mock` in POSIX shells). `.env.example` documents the same values; the dev script does not auto-load `.env`.
3. Run `npm run dev`, then open the Vite URL shown in the terminal.

The server listens on `127.0.0.1:8787`; Vite serves the UI on `127.0.0.1:5173` and proxies `/api` and `/ws`.

## Real Codex mode

Run `codex --version` and a small `codex exec` task first. Then set `AGENTVILLE_MODE=codex` in the shell and restart the dev server. Each new agent receives a fresh copy under `.agentville/workspaces/<agent-id>`; existing workspaces are preserved across restarts. The adapter reports process output and exit status. Pause and stop are safe at checkpoint boundaries; a running child process is never duplicated by resume.

If Codex cannot start, the UI receives an actionable error event and you can return to mock mode by setting `AGENTVILLE_MODE=mock`.

## Visual refresh

The office map uses hand-authored pixel-art assets in `web/public/assets/office/`. Phaser renders the 960x640 scene with nearest-neighbor scaling so the room framing and sprites stay crisp at responsive sizes. This is a presentation-only refresh: existing `.agentville/workspaces/<agent-id>` copies remain preserved across restarts and visual updates.

## Recovery

Agent and command snapshots are persisted in SQLite. On restart, agents that were marked `working` are changed to `paused` at their last checkpoint so work is never silently resumed. Review the checkpoint, then explicitly resume or stop the agent.

## Verification

`npm test` runs server, web, and seed-project tests. `npm run build` type-checks and creates the production Vite bundle.
