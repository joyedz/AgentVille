export type ServerMessage = {
  type: string;
  data?: unknown;
};

export type Connection = {
  socket: WebSocket;
  close: () => void;
};

function websocketUrl(): string {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8787/ws';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

const initialReconnectDelayMs = 250;
const maxReconnectDelayMs = 2_000;
const webSocketLogPrefix = '[AgentVille WS]';

function logWebSocket(event: string, details?: Record<string, unknown>): void {
  if (details) console.info(webSocketLogPrefix, event, details);
  else console.info(webSocketLogPrefix, event);
}

export function connect(
  onMessage: (message: ServerMessage) => void,
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
): Connection {
  let active = true;
  let socket!: WebSocket;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempts = 0;

  const scheduleReconnect = () => {
    if (!active || reconnectTimer !== undefined) return;
    const delay = Math.min(initialReconnectDelayMs * 2 ** reconnectAttempts, maxReconnectDelayMs);
    reconnectAttempts += 1;
    logWebSocket('reconnect scheduled', { attempt: reconnectAttempts, delayMs: delay });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      openSocket();
    }, delay);
  };

  const openSocket = () => {
    if (!active) return;
    const url = websocketUrl();
    logWebSocket('connecting', { url, attempt: reconnectAttempts + 1 });
    onStatus?.('connecting');
    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(url);
    } catch (error) {
      logWebSocket('constructor failed', { url, error: error instanceof Error ? error.message : String(error) });
      onStatus?.('error');
      scheduleReconnect();
      return;
    }
    socket = nextSocket;
    nextSocket.addEventListener('open', () => {
      if (!active || socket !== nextSocket) return;
      reconnectAttempts = 0;
      logWebSocket('connected', { url });
      onStatus?.('open');
    });
    nextSocket.addEventListener('close', (event) => {
      if (!active || socket !== nextSocket) return;
      logWebSocket('closed', { url, code: event.code, reason: event.reason, wasClean: event.wasClean });
      onStatus?.('closed');
      scheduleReconnect();
    });
    nextSocket.addEventListener('error', () => {
      if (active && socket === nextSocket) {
        logWebSocket('connection error', { url, readyState: nextSocket.readyState });
        onStatus?.('error');
      }
    });
    nextSocket.addEventListener('message', (event) => {
      if (!active || socket !== nextSocket) return;
      try {
        const parsed = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)) as ServerMessage;
        if (parsed && typeof parsed.type === 'string') onMessage(parsed);
      } catch {
        logWebSocket('ignored malformed message', { url });
      }
    });
  };

  openSocket();
  return {
    get socket() { return socket; },
    close: () => {
      if (!active) return;
      active = false;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      if (socket.readyState !== 3 && socket.readyState !== 2) socket.close();
    }
  };
}

export async function sendCommand(
  agentId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Command failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export async function fetchState(): Promise<unknown> {
  const response = await fetch('/api/state');
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`State request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}
