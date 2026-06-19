import { EventEmitter } from 'node:events';

// Central event bus: MQTT ingest -> WebSocket clients, and command notifications.
export const bus = new EventEmitter();
bus.setMaxListeners(50);

export type BusEvent =
  | { type: 'sensors'; deviceId: string; data: { temperature?: number; humidity?: number; soil_moisture?: number }; ts: string }
  | { type: 'state'; deviceId: string; data: Record<string, unknown> }
  | { type: 'device'; deviceId: string; online: boolean }
  | { type: 'automation'; message: string; deviceId: string };

export const emit = (e: BusEvent) => bus.emit('event', e);
