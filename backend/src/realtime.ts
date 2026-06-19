import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { bus } from './bus.js';

// Live push of sensor/state/device events to connected app clients.
export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url ?? '', 'http://x').searchParams.get('token');
    try {
      jwt.verify(token ?? '', config.jwtSecret);
    } catch {
      ws.close(4001, 'unauthorized');
      return;
    }
    ws.send(JSON.stringify({ type: 'hello', ts: new Date().toISOString() }));
  });

  const onEvent = (e: unknown) => {
    const msg = JSON.stringify(e);
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  };
  bus.on('event', onEvent);

  // keepalive
  setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30_000);
}
