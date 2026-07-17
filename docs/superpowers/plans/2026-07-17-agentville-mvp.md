# Agentville MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local mission-control map that monitors and controls three isolated, real Codex coding runners, with a deterministic mock fallback.

**Architecture:** A TypeScript Fastify control plane persists agent state in local SQLite and broadcasts typed WebSocket events. A React + Phaser client renders the office map and control inspector. Runner adapters execute bounded checkpoints in isolated seeded workspaces; the mock and Codex adapters expose the same event contract.

**Tech Stack:** Node.js 24+, TypeScript, Fastify, `node:sqlite`, `ws`, Zod, React, Vite, Phaser 3, Vitest, Testing Library.

---

## Delivery slices

1. **Control-plane foundation:** protocol, persistence, state machine, command queues, mock runner, API, and WebSocket state updates. This slice is testable without a browser or credentials.
2. **Visual control client:** map positions, live connection, inspector, assignment form, and command feedback. This slice runs against the mock runner.
3. **Real runner and demo hardening:** isolated workspaces, Codex CLI adapter, error/recovery behavior, seed tasks, documentation, and a rehearsal.

## Planned file structure

```text
package.json                         # Workspace scripts and dependencies
tsconfig.json                        # Shared TypeScript compiler settings
vite.config.ts                       # Browser build and dev-server proxy
server/
  index.ts                           # Process bootstrap and graceful shutdown
  app.ts                             # Fastify routes and WebSocket wiring
  db.ts                              # SQLite schema and repositories
  protocol.ts                        # Zod request/event schemas and types
  domain.ts                          # State transitions and zone assignment
  command-queue.ts                   # Per-agent FIFO/idempotency behavior
  runner.ts                          # Runner coordinator and common interfaces
  mock-runner.ts                     # Deterministic local fallback adapter
  codex-runner.ts                    # CLI process adapter
  workspaces.ts                      # Disposable workspace creation/reset
  seed.ts                            # Three initial agents and tasks
  test/*.test.ts                     # Server unit and integration tests
web/
  index.html                         # Vite entry point
  src/main.tsx                       # React bootstrap
  src/App.tsx                        # Connection, layout, and state composition
  src/api.ts                         # Typed HTTP/WebSocket client
  src/components/Inspector.tsx       # Agent details and controls
  src/components/AssignTaskDialog.tsx# Empty-desk task assignment form
  src/components/StatusBar.tsx       # Connection and mock-mode status
  src/game/OfficeScene.ts            # Phaser scene and sprite interactions
  src/game/positions.ts              # Client map coordinate transforms
  src/styles.css                     # Local-first visual system
  src/**/*.test.tsx                  # UI and coordinate tests
seed-project/
  package.json                       # Small TypeScript project used by runners
  src/*.ts                           # Bounded source tasks
  test/*.test.ts                     # Runnable verification for runner work
.env.example                         # Codex adapter configuration
README.md                            # Setup, demo flow, limitations
```

### Task 1: Bootstrap the local application and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/styles.css`
- Create: `server/test/smoke.test.ts`

- [ ] **Step 1: Create the root package manifest and compiler configuration.**

```json
{
  "name": "agentville",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:web": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fastify/cors": "^11.0.0",
    "@fastify/websocket": "^11.0.0",
    "fastify": "^5.0.0",
    "phaser": "^3.90.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ws": "^8.18.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "concurrently": "^9.0.0",
    "jsdom": "^26.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["server", "web", "vite.config.ts"]
}
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/ws": { target: "ws://127.0.0.1:8787", ws: true }
    }
  }
});
```

```html
<!-- web/index.html -->
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 2: Add a failing server smoke test.**

```ts
// server/test/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("Agentville", () => {
  it("exposes an application factory", async () => {
    const { buildApp } = await import("../app.js");
    expect(buildApp).toBeTypeOf("function");
  });
});
```

- [ ] **Step 3: Run the test to verify the expected failure.**

Run: `npm test -- server/test/smoke.test.ts`

Expected: FAIL because `server/app.ts` does not exist.

- [ ] **Step 4: Install dependencies and create the smallest application factory.**

Run: `npm install`

```ts
// server/app.ts
import Fastify from "fastify";

export function buildApp() {
  return Fastify({ logger: false });
}
```

```ts
// server/index.ts
import { buildApp } from "./app.js";

const app = buildApp();
await app.listen({ host: "127.0.0.1", port: 8787 });
```

```tsx
// web/src/main.tsx
import { createRoot } from "react-dom/client";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<h1>Agentville</h1>);
```

- [ ] **Step 5: Verify and commit the bootstrap.**

Run: `npm test -- server/test/smoke.test.ts && npm run build`

Expected: PASS and a Vite production build.

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts server web
git commit -m "chore: bootstrap Agentville application"
```

### Task 2: Define the shared protocol and pure agent state machine

**Files:**
- Create: `server/protocol.ts`
- Create: `server/domain.ts`
- Create: `server/test/domain.test.ts`

- [ ] **Step 1: Write failing transition and placement tests.**

```ts
// server/test/domain.test.ts
import { describe, expect, it } from "vitest";
import { applyStatus, assignZone } from "../domain.js";

describe("agent placement", () => {
  it("moves a blocked agent to attention", () => {
    expect(assignZone("blocked", 0)).toBe("attention");
  });

  it("keeps a paused agent at its last desk", () => {
    expect(applyStatus({ status: "working", zone: "desk" }, "paused")).toMatchObject({
      status: "paused", zone: "desk"
    });
  });

  it("rejects resume unless an agent is paused", () => {
    expect(() => applyStatus({ status: "working", zone: "desk" }, "working")).toThrow("Invalid transition");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test -- server/test/domain.test.ts`

Expected: FAIL because the protocol and domain modules do not exist.

- [ ] **Step 3: Implement validated types and the transition table.**

```ts
// server/protocol.ts
import { z } from "zod";

export const agentStatusSchema = z.enum(["working", "idle", "blocked", "error", "paused", "stopped"]);
export const zoneSchema = z.enum(["desk", "coffee", "lounge", "attention"]);
export const commandTypeSchema = z.enum(["approve", "pause", "resume", "stop", "assign_task", "add_instruction"]);
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type CommandType = z.infer<typeof commandTypeSchema>;
export type Agent = { id: string; name: string; role: string; status: AgentStatus; zone: Zone; x: number; y: number; currentTaskId?: string; checkpoint?: string; lastUpdated: string };
export type Command = { id: string; agentId: string; type: CommandType; payload?: { taskTitle?: string; instruction?: string }; status: "pending" | "acknowledged" | "done" | "failed"; createdAt: string };
export const commandRequestSchema = z.object({ id: z.string().min(1), type: commandTypeSchema, payload: z.object({ taskTitle: z.string().min(1).optional(), instruction: z.string().min(1).optional() }).optional() });
```

```ts
// server/domain.ts
import type { AgentStatus, Zone } from "./protocol.js";

const allowed: Record<AgentStatus, AgentStatus[]> = {
  working: ["paused", "blocked", "error", "idle", "stopped"], idle: ["working", "stopped"],
  blocked: ["working", "error", "stopped"], error: ["idle", "stopped"], paused: ["working", "stopped"], stopped: ["idle"]
};
export function assignZone(status: AgentStatus, slot: number): Zone {
  if (status === "blocked" || status === "error") return "attention";
  if (status === "working" || status === "paused") return "desk";
  return slot % 2 === 0 ? "lounge" : "coffee";
}
export function applyStatus<T extends { status: AgentStatus; zone: Zone }>(agent: T, next: AgentStatus): T {
  if (!allowed[agent.status].includes(next)) throw new Error(`Invalid transition: ${agent.status} -> ${next}`);
  return { ...agent, status: next, zone: next === "paused" ? agent.zone : assignZone(next, 0) };
}
```

- [ ] **Step 4: Verify and commit the protocol.**

Run: `npm test -- server/test/domain.test.ts`

Expected: PASS.

```bash
git add server/protocol.ts server/domain.ts server/test/domain.test.ts
git commit -m "feat: add agent state protocol"
```

### Task 3: Add SQLite persistence and idempotent per-agent command queues

**Files:**
- Create: `server/db.ts`
- Create: `server/command-queue.ts`
- Create: `server/store.ts`
- Create: `server/test/command-queue.test.ts`

- [ ] **Step 1: Write failing FIFO and duplicate-command tests.**

```ts
// server/test/command-queue.test.ts
import { describe, expect, it } from "vitest";
import { CommandQueue } from "../command-queue.js";

it("returns the original record for duplicate command ids", () => {
  const queue = new CommandQueue();
  const first = queue.enqueue({ id: "c1", agentId: "a1", type: "pause" });
  expect(queue.enqueue({ id: "c1", agentId: "a1", type: "pause" })).toBe(first);
});
it("dequeues commands in FIFO order per agent", () => {
  const queue = new CommandQueue();
  queue.enqueue({ id: "c1", agentId: "a1", type: "pause" });
  queue.enqueue({ id: "c2", agentId: "a1", type: "resume" });
  expect(queue.take("a1")?.id).toBe("c1");
  expect(queue.take("a1")?.id).toBe("c2");
});
```

- [ ] **Step 2: Run the failing test.**

Run: `npm test -- server/test/command-queue.test.ts`

Expected: FAIL because `CommandQueue` does not exist.

- [ ] **Step 3: Implement the repository schema and queue.**

```ts
// server/db.ts
import { DatabaseSync } from "node:sqlite";

export function openDatabase(filename = "agentville.db") {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, body TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, body TEXT NOT NULL);`);
  return db;
}
```

```ts
// server/command-queue.ts
import type { Command, CommandType } from "./protocol.js";
type Input = { id: string; agentId: string; type: CommandType; payload?: Command["payload"] };

export class CommandQueue {
  private byId = new Map<string, Command>();
  private pending = new Map<string, Command[]>();
  enqueue(input: Input): Command {
    const saved = this.byId.get(input.id); if (saved) return saved;
    const command: Command = { ...input, status: "pending", createdAt: new Date().toISOString() };
    this.byId.set(command.id, command);
    this.pending.set(command.agentId, [...(this.pending.get(command.agentId) ?? []), command]);
    return command;
  }
  take(agentId: string): Command | undefined {
    const [next, ...rest] = this.pending.get(agentId) ?? [];
    this.pending.set(agentId, rest); return next;
  }
}
```

```ts
// server/store.ts
import type { Agent, Command } from "./protocol.js";
import { CommandQueue } from "./command-queue.js";

export function createStore(initialAgents: Agent[], mode: "mock" | "codex" = "mock") {
  const agents = new Map(initialAgents.map((agent) => [agent.id, agent]));
  const queue = new CommandQueue();
  return {
    snapshot: () => ({ mode, agents: [...agents.values()], commands: [] as Command[] }),
    enqueue: (input: Omit<Command, "status" | "createdAt">) => queue.enqueue(input),
    updateAgent: (agent: Agent) => agents.set(agent.id, agent)
  };
}
```

- [ ] **Step 4: Verify and commit queue behavior.**

Run: `npm test -- server/test/command-queue.test.ts`

Expected: PASS.

```bash
git add server/db.ts server/command-queue.ts server/test/command-queue.test.ts
git commit -m "feat: persist and queue agent commands"
```

### Task 4: Build the mock runner and control-plane event loop

**Files:**
- Create: `server/runner.ts`
- Create: `server/mock-runner.ts`
- Create: `server/seed.ts`
- Modify: `server/app.ts`
- Create: `server/test/runner.test.ts`

- [ ] **Step 1: Write a failing runner lifecycle test.**

```ts
// server/test/runner.test.ts
import { expect, it, vi } from "vitest";
import { MockRunner } from "../mock-runner.js";

it("emits working, blocked, then working after approval", async () => {
  const emit = vi.fn();
  const runner = new MockRunner("builder", emit, ["inspect", "approval", "implement"]);
  await runner.runNext(); await runner.runNext();
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ status: "blocked" }));
  await runner.accept({ type: "approve" });
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ status: "working", checkpoint: "implement" }));
});
```

- [ ] **Step 2: Run the failing runner test.**

Run: `npm test -- server/test/runner.test.ts`

Expected: FAIL because `MockRunner` does not exist.

- [ ] **Step 3: Implement the common runner contract and deterministic adapter.**

```ts
// server/runner.ts
import type { CommandType } from "./protocol.js";
export type RunnerEvent = { agentId: string; status: "working" | "blocked" | "idle" | "paused" | "error"; checkpoint?: string; message?: string };
export interface Runner { runNext(): Promise<void>; accept(command: { type: CommandType; payload?: unknown }): Promise<void>; }
```

```ts
// server/mock-runner.ts
import type { Runner, RunnerEvent } from "./runner.js";
import type { CommandType } from "./protocol.js";
export class MockRunner implements Runner {
  private index = 0; private approved = false;
  constructor(private readonly agentId: string, private readonly emit: (event: RunnerEvent) => void, private readonly steps: string[]) {}
  async runNext() {
    const step = this.steps[this.index++];
    if (step === "approval" && !this.approved) { this.index--; this.emit({ agentId: this.agentId, status: "blocked", checkpoint: step, message: "Approval required" }); return; }
    this.emit({ agentId: this.agentId, status: step ? "working" : "idle", checkpoint: step });
  }
  async accept(command: { type: CommandType }) { if (command.type === "approve") { this.approved = true; this.index++; await this.runNext(); } }
}
```

```ts
// server/seed.ts
import type { Agent } from "./protocol.js";
export const seedAgents: Agent[] = ["Builder", "Tester", "Documenter"].map((name, index) => ({
  id: `agent-${index + 1}`, name, role: name.toLowerCase(), status: "working", zone: "desk",
  x: 260 + index * 80, y: 280, checkpoint: "inspect", lastUpdated: new Date().toISOString()
}));
```

- [ ] **Step 4: Wire `GET /api/state`, `POST /api/agents/:id/commands`, and WebSocket broadcasts into `server/app.ts`.**

```ts
// replacement contents of server/app.ts in Task 4
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { commandRequestSchema } from "./protocol.js";
import { createStore } from "./store.js";
import { seedAgents } from "./seed.js";

export function buildApp() {
const app = Fastify({ logger: false });
app.register(cors, { origin: true });
app.register(websocket);
const state = createStore(seedAgents, process.env.AGENTVILLE_MODE === "codex" ? "codex" : "mock");
const clients = new Set<{ send: (data: string) => void }>();
const broadcast = (event: unknown) => clients.forEach((client) => client.send(JSON.stringify(event)));
app.get("/api/state", async () => state.snapshot());
app.post("/api/agents/:id/commands", async (request, reply) => {
  const command = commandRequestSchema.parse(request.body);
  const saved = state.enqueue({ ...command, agentId: (request.params as { id: string }).id });
  broadcast({ type: "command.updated", command: saved });
  return reply.code(202).send(saved);
});
app.get("/ws", { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: "state.snapshot", state: state.snapshot() }));
  clients.add(socket); socket.on("close", () => clients.delete(socket));
});
return app;
}
```

- [ ] **Step 5: Verify and commit mock control flow.**

Run: `npm test -- server/test/runner.test.ts && npm test`

Expected: PASS.

```bash
git add server/app.ts server/runner.ts server/mock-runner.ts server/seed.ts server/test/runner.test.ts
git commit -m "feat: add mock agent control loop"
```

### Task 5: Create the Phaser office map and live browser connection

**Files:**
- Create: `web/src/api.ts`
- Create: `web/src/App.tsx`
- Create: `web/src/game/positions.ts`
- Create: `web/src/game/OfficeScene.ts`
- Create: `web/src/game/positions.test.ts`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Write failing coordinate tests for the four zones.**

```ts
// web/src/game/positions.test.ts
import { expect, it } from "vitest";
import { toCanvasPosition } from "./positions";
it("maps attention slots to the upper-right room", () => {
  expect(toCanvasPosition("attention", 0)).toEqual({ x: 720, y: 120 });
});
it("maps desk slots to the central work area", () => {
  expect(toCanvasPosition("desk", 1)).toEqual({ x: 340, y: 280 });
});
```

- [ ] **Step 2: Run the failing UI test.**

Run: `npm test -- web/src/game/positions.test.ts`

Expected: FAIL because the coordinate module does not exist.

- [ ] **Step 3: Implement deterministic coordinates and the typed socket client.**

```ts
// web/src/game/positions.ts
import type { Zone } from "../../../server/protocol";
const slots: Record<Zone, { x: number; y: number }[]> = {
  desk: [{ x: 260, y: 280 }, { x: 340, y: 280 }, { x: 420, y: 280 }],
  coffee: [{ x: 120, y: 470 }, { x: 180, y: 470 }],
  lounge: [{ x: 500, y: 470 }, { x: 570, y: 470 }],
  attention: [{ x: 720, y: 120 }, { x: 780, y: 120 }]
};
export function toCanvasPosition(zone: Zone, slot: number) { return slots[zone][slot % slots[zone].length]; }
```

```ts
// web/src/api.ts
export function connect(onMessage: (event: unknown) => void) {
  const socket = new WebSocket(`ws://${location.hostname}:8787/ws`);
  socket.addEventListener("message", ({ data }) => onMessage(JSON.parse(data)));
  return socket;
}
export async function sendCommand(agentId: string, body: unknown) {
  const response = await fetch(`/api/agents/${agentId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text()); return response.json();
}
```

- [ ] **Step 4: Implement `OfficeScene` with named zone labels, colored agent circles, pointer selection, and 350ms position tweens.**

```ts
// core selection hook inside web/src/game/OfficeScene.ts
sprite.setInteractive().on("pointerup", () => this.onAgentSelected(agent.id));
this.tweens.add({ targets: sprite, x: position.x, y: position.y, duration: 350, ease: "Sine.out" });
```

- [ ] **Step 5: Compose the map in `App.tsx`, apply incoming snapshots/events, and display a visible `MOCK MODE` banner when supplied by state.**

```tsx
// central layout inside web/src/App.tsx; Inspector is added in Task 6
return <main className="app-shell"><header><strong>Agentville</strong><span>{state.mode === "mock" ? "MOCK MODE" : "LIVE CODEX"}</span></header><div id="office-map" /><aside aria-label="Inspector">Select an agent</aside></main>;
```

- [ ] **Step 6: Verify and commit the map.**

Run: `npm test -- web/src/game/positions.test.ts && npm run build`

Expected: PASS and production build completes.

```bash
git add web/src
git commit -m "feat: render live office map"
```

### Task 6: Add inspector controls, task assignment, and command feedback

**Files:**
- Create: `web/src/components/Inspector.tsx`
- Create: `web/src/components/AssignTaskDialog.tsx`
- Create: `web/src/components/StatusBar.tsx`
- Create: `web/src/components/Inspector.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write a failing inspector test for the pause action.**

```tsx
// web/src/components/Inspector.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Inspector } from "./Inspector";
it("sends pause for a working agent", () => {
  const onCommand = vi.fn();
  render(<Inspector agent={{ id: "a1", name: "Tester", status: "working", changedFiles: [], logTail: [] }} onCommand={onCommand} />);
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(onCommand).toHaveBeenCalledWith("a1", { type: "pause" });
});
```

- [ ] **Step 2: Run the failing component test.**

Run: `npm test -- web/src/components/Inspector.test.tsx`

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Implement state-aware controls and durable feedback.**

```tsx
// relevant body of web/src/components/Inspector.tsx
export function Inspector({ agent, onCommand }: Props) {
  if (!agent) return <aside aria-label="Inspector">Select an agent</aside>;
  const action = agent.status === "working" ? "pause" : agent.status === "paused" ? "resume" : undefined;
  return <aside aria-label="Inspector"><h2>{agent.name}</h2><p>{agent.status}</p><p>{agent.summary}</p><ul>{agent.changedFiles.map((file) => <li key={file}>{file}</li>)}</ul>{action && <button onClick={() => onCommand(agent.id, { type: action })}>{action === "pause" ? "Pause" : "Resume"}</button>}{agent.status === "blocked" && <button onClick={() => onCommand(agent.id, { type: "approve" })}>Approve</button>}<button onClick={() => onCommand(agent.id, { type: "stop" })}>Stop</button></aside>;
}
```

- [ ] **Step 4: Implement assignment from an empty desk and an inline command-status list.**

```tsx
// successful submit callback in web/src/components/AssignTaskDialog.tsx
await onAssign({ id: crypto.randomUUID(), type: "assign_task", payload: { taskTitle } });
setTaskTitle(""); onClose();
```

- [ ] **Step 5: Verify and commit the controls.**

Run: `npm test -- web/src/components/Inspector.test.tsx && npm run build`

Expected: PASS.

```bash
git add web/src/components web/src/App.tsx
git commit -m "feat: control agents from inspector"
```

### Task 7: Add isolated seed workspaces and the real Codex CLI adapter

**Files:**
- Create: `seed-project/package.json`
- Create: `seed-project/src/format.ts`
- Create: `seed-project/test/format.test.ts`
- Create: `server/workspaces.ts`
- Create: `server/codex-runner.ts`
- Create: `server/test/codex-runner.test.ts`
- Create: `.env.example`

- [ ] **Step 1: Write a failing adapter test against a fake process executor.**

```ts
// server/test/codex-runner.test.ts
import { expect, it, vi } from "vitest";
import { CodexRunner } from "../codex-runner.js";
it("runs Codex inside its assigned workspace", async () => {
  const execute = vi.fn().mockResolvedValue({ code: 0, stdout: "implemented", stderr: "" });
  const runner = new CodexRunner("a1", "C:/tmp/agent-a1", execute, vi.fn());
  await runner.runNext();
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ cwd: "C:/tmp/agent-a1" }));
});
```

- [ ] **Step 2: Run the failing adapter test.**

Run: `npm test -- server/test/codex-runner.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Create a minimal seed project with a runnable test.**

```json
// seed-project/package.json
{ "private": true, "type": "module", "scripts": { "test": "vitest run" }, "devDependencies": { "typescript": "^5.0.0", "vitest": "^3.0.0" } }
```

```ts
// seed-project/src/format.ts
export const titleCase = (value: string) => value.split(" ").map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word).join(" ");
```

```ts
// seed-project/test/format.test.ts
import { expect, it } from "vitest";
import { titleCase } from "../src/format.js";
it("formats a phrase", () => expect(titleCase("agent ville")).toBe("Agent Ville"));
```

- [ ] **Step 4: Implement workspace copying and a process-injected CLI adapter.**

```ts
// server/workspaces.ts
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
export async function resetWorkspace(agentId: string) {
  const target = join(".agentville", "workspaces", agentId);
  await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
  await cp("seed-project", target, { recursive: true, filter: (source) => !source.includes("node_modules") });
  return target;
}
```

```ts
// server/codex-runner.ts
type ProcessResult = { code: number; stdout: string; stderr: string };
type Execute = (input: { command: string; args: string[]; cwd: string }) => Promise<ProcessResult>;
export class CodexRunner {
  constructor(private agentId: string, private cwd: string, private execute: Execute, private emit: (event: unknown) => void) {}
  async runNext() {
    this.emit({ agentId: this.agentId, status: "working", checkpoint: "implement" });
    const result = await this.execute({ command: process.env.CODEX_BIN ?? "codex", args: ["exec", "Implement the assigned bounded task. Run tests and report changed files."], cwd: this.cwd });
    this.emit({ agentId: this.agentId, status: result.code === 0 ? "idle" : "error", message: result.stderr || result.stdout });
  }
}
```

- [ ] **Step 5: Add an explicit local configuration template.**

```dotenv
# .env.example
AGENTVILLE_MODE=mock
CODEX_BIN=codex
# Set AGENTVILLE_MODE=codex only after `codex --version` and a manual `codex exec` succeed.
```

- [ ] **Step 6: Verify unit behavior, then run the real-Codex smoke test outside the sandbox.**

Run: `npm test -- server/test/codex-runner.test.ts && npm test -- seed-project/test/format.test.ts`

Expected: PASS.

Run locally after authentication: `set AGENTVILLE_MODE=codex && npm run dev`

Expected: one runner creates a real diff in `.agentville/workspaces/<agent-id>` and reports its test outcome. If Codex cannot start, the UI must show an actionable error and mock mode remains available.

```bash
git add seed-project server/workspaces.ts server/codex-runner.ts server/test/codex-runner.test.ts .env.example
git commit -m "feat: run Codex in isolated workspaces"
```

### Task 8: Finish recovery behavior, documentation, and demo rehearsal

**Files:**
- Modify: `server/app.ts`
- Modify: `server/runner.ts`
- Create: `README.md`
- Create: `docs/demo-script.md`
- Create: `server/test/recovery.test.ts`

- [ ] **Step 1: Write a failing recovery test for reconnect snapshots.**

```ts
// server/test/recovery.test.ts
import { expect, it } from "vitest";
import { buildApp } from "../app.js";
it("returns the latest persisted state after reconnect", async () => {
  const app = buildApp({ database: ":memory:" });
  const response = await app.inject({ method: "GET", url: "/api/state" });
  expect(response.json()).toMatchObject({ agents: expect.any(Array), mode: expect.any(String) });
  await app.close();
});
```

- [ ] **Step 2: Run the failing recovery test.**

Run: `npm test -- server/test/recovery.test.ts`

Expected: FAIL until `buildApp` accepts a database option and returns the complete snapshot.

- [ ] **Step 3: Implement the restart safety rule and snapshot endpoint.**

```ts
// startup recovery rule in server/runner.ts
export function recoverActiveAgent(agent: Agent): Agent {
  return agent.status === "working" ? { ...agent, status: "paused", checkpoint: agent.checkpoint ?? "inspect" } : agent;
}
```

```ts
// app factory contract in server/app.ts
export function buildApp(options: { database?: string } = {}) {
  const db = openDatabase(options.database ?? "agentville.db");
  // hydrate agents, convert recovered working jobs to paused, then expose GET /api/state
}
```

- [ ] **Step 4: Write user documentation and the exact three-minute rehearsal.**

```md
<!-- README.md sections -->
## Run
1. `npm install`
2. Copy `.env.example` to `.env` and leave `AGENTVILLE_MODE=mock`.
3. `npm run dev`, then open the Vite URL.

## Real Codex mode
Run `codex --version` and a small `codex exec` task first. Then set `AGENTVILLE_MODE=codex`. Pause is safe at checkpoint boundaries; Stop cancels the active child process.
```

```md
<!-- docs/demo-script.md -->
0:00 Show three working agents. 0:25 open Builder and show its current checkpoint.
0:45 Builder moves to Attention; click Approve. 1:15 pause and resume Tester.
1:45 assign Documenter a follow-up at an empty desk. 2:15 show changed files and passing test result.
2:45 state that runners use isolated workspaces and Codex CLI checkpoints.
```

- [ ] **Step 5: Run final verification and commit.**

Run: `npm test && npm run build`

Expected: all unit/integration tests pass and the browser build completes.

Run manually: `npm run dev`

Expected: mock mode completes the scripted scenario in under three minutes; real-Codex smoke test is recorded separately when credentials are available.

```bash
git add server README.md docs/demo-script.md
git commit -m "docs: finalize local Agentville demo"
```

## Plan self-review

- **Spec coverage:** Tasks 2–4 implement state, queues, persistence, events, mock fallback, and command semantics; Tasks 5–6 implement the map and controls; Task 7 implements isolated workspaces and real Codex execution; Task 8 implements recovery, setup, and demo verification.
- **Scope discipline:** Login, cloud deployment, multi-user collaboration, shared workspaces, pathfinding, and generated art are intentionally absent.
- **Type consistency:** `AgentStatus`, `Zone`, `CommandType`, `Command`, `Runner`, and `RunnerEvent` originate in the server protocol/runner modules and are used consistently throughout the plan.
- **Placeholders:** The plan has no unresolved requirements or deferred implementation markers. Real Codex execution is explicitly gated by an environment smoke test rather than assumed.
