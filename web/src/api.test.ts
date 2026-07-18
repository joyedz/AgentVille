import { afterEach, describe, expect, it, vi } from 'vitest';
import { connect } from './api.js';

class FakeSocket {
  static readonly CLOSED = 3;
  static readonly CLOSING = 2;
  readyState = 1;
  readonly listeners = new Map<string, Array<(event: any) => void>>();
  addEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: any = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  close(): void { this.readyState = FakeSocket.CLOSED; this.emit('close'); }
}

const originalWebSocket = globalThis.WebSocket;
afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  vi.useRealTimers();
});

describe('connect lifecycle', () => {
  it('ignores delayed messages and status events after close', () => {
    const socket = new FakeSocket();
    globalThis.WebSocket = vi.fn(() => socket) as unknown as typeof WebSocket;
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    const connection = connect(onMessage, onStatus);

    connection.close();
    socket.emit('message', { data: JSON.stringify({ type: 'state.snapshot', data: {} }) });
    socket.emit('error');
    socket.emit('close');

    expect(onMessage).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith('error');
    expect(onStatus).not.toHaveBeenCalledWith('closed');
    connection.close();
    expect(socket.readyState).toBe(FakeSocket.CLOSED);
  });

  it('reconnects after an initial close and cancels pending retries when closed by the caller', () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    globalThis.WebSocket = vi.fn(() => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }) as unknown as typeof WebSocket;
    const onStatus = vi.fn();
    const connection = connect(vi.fn(), onStatus);

    sockets[0]?.emit('close');
    expect(onStatus).toHaveBeenCalledWith('closed');
    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(2);

    sockets[1]?.emit('open');
    expect(onStatus).toHaveBeenLastCalledWith('open');
    connection.close();
    vi.advanceTimersByTime(2_000);
    expect(sockets).toHaveLength(2);
  });
});
