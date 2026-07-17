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

export function connect(
  onMessage: (message: ServerMessage) => void,
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
): Connection {
  onStatus?.('connecting');
  const socket = new WebSocket(websocketUrl());
  socket.addEventListener('open', () => onStatus?.('open'));
  socket.addEventListener('close', () => onStatus?.('closed'));
  socket.addEventListener('error', () => onStatus?.('error'));
  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)) as ServerMessage;
      if (parsed && typeof parsed.type === 'string') onMessage(parsed);
    } catch {
      // Ignore malformed messages from the socket so a bad event cannot crash the app.
    }
  });
  return {
    socket,
    close: () => socket.close()
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
