import { getBaseUrl, getToken, isDemo } from './api';
import { demoRealtime } from './demo';

type Handler = (e: any) => void;

// Lightweight reconnecting WebSocket for live sensor/state events.
export function connectRealtime(onEvent: Handler): () => void {
  if (isDemo()) return demoRealtime(onEvent);
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;

  const open = () => {
    const base = getBaseUrl();
    const token = getToken();
    if (!base || !token) return;
    const url = base.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);
    ws.onmessage = (m) => {
      try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ }
    };
    ws.onopen = () => { retry = 0; };
    ws.onclose = () => {
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      setTimeout(open, retry * 1000);
    };
    ws.onerror = () => ws?.close();
  };
  open();

  return () => { closed = true; ws?.close(); };
}
