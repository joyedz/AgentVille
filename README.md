# Agentville MVP

Agentville is a local mission-control UI for three bounded coding agents. Mock mode is deterministic and safe for demos; Codex mode runs the same checkpoints in isolated workspace copies.

## Run

1. `npm install`
2. Copy `.env.example` to `.env` and leave `AGENTVILLE_MODE=mock`.
3. Run `npm run dev`, then open the Vite URL shown in the terminal.

The server listens on `127.0.0.1:8787`; Vite serves the UI on `127.0.0.1:5173` and proxies `/api` and `/ws`.

## Real Codex mode

Run `codex --version` and a small `codex exec` task first. Then set `AGENTVILLE_MODE=codex` and restart the dev server. Each agent receives a fresh copy under `.agentville/workspaces/<agent-id>` and the adapter reports the process output and exit status. Pause and stop are safe at checkpoint boundaries; a running child process is never duplicated by resume.

If Codex cannot start, the UI receives an actionable error event and you can return to mock mode by setting `AGENTVILLE_MODE=mock`.

## Recovery

Agent and command snapshots are persisted in SQLite. On restart, agents that were marked `working` are changed to `paused` at their last checkpoint so work is never silently resumed. Review the checkpoint, then explicitly resume or stop the agent.

## Verification

`npm test` runs server, web, and seed-project tests. `npm run build` type-checks and creates the production Vite bundle.
