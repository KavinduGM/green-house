import Aedes from 'aedes';
import net from 'node:net';
import { config } from './config.js';
import { db, now } from './db.js';
import { emit } from './bus.js';

// Embedded MQTT broker. The ESP32 connects here directly (VPS:MQTT_PORT).
const aedes = new Aedes({
  authenticate: (_client, username, password, cb) => {
    const ok =
      username === config.mqttUsername &&
      password?.toString() === config.mqttPassword;
    cb(ok ? null : new Error('bad credentials') as any, ok);
  },
});

const server = net.createServer(aedes.handle as any);

export function startMqtt() {
  server.listen(config.mqttPort, () => {
    console.log(`[mqtt] broker listening on :${config.mqttPort}`);
  });
}

// ---- topic helpers ----
// device -> server: gh/<id>/up/{sensors|state|hello}
// server -> device: gh/<id>/dn/{cmd|config}
const upRe = /^gh\/([^/]+)\/up\/(sensors|state|hello)$/;

aedes.on('client', (c) => console.log('[mqtt] connected:', c.id));

aedes.on('clientDisconnect', (c) => {
  // a client id like "greenhouse-01" maps to a device row
  setDeviceOnline(c.id, false);
});

aedes.on('publish', (packet, client) => {
  if (!client) return; // skip broker's own $SYS messages
  const m = packet.topic.match(upRe);
  if (!m) return;
  const [, deviceId, kind] = m;
  let payload: any = {};
  try {
    payload = JSON.parse(packet.payload.toString());
  } catch {
    return;
  }
  if (kind === 'sensors') ingestSensors(deviceId, payload);
  else if (kind === 'state') ingestState(deviceId, payload);
  else if (kind === 'hello') {
    db.prepare(
      `INSERT INTO devices (device_id, name, fw, last_seen, online) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(device_id) DO UPDATE SET fw=excluded.fw, last_seen=excluded.last_seen, online=1`,
    ).run(deviceId, payload.name ?? 'Greenhouse Controller', payload.fw ?? null, now());
    emit({ type: 'device', deviceId, online: true });
    pushConfig(deviceId); // send current rules/schedules on connect
  }
});

function setDeviceOnline(deviceId: string, online: boolean) {
  db.prepare('UPDATE devices SET online = ?, last_seen = ? WHERE device_id = ?').run(
    online ? 1 : 0, now(), deviceId,
  );
  emit({ type: 'device', deviceId, online });
}

function ingestSensors(deviceId: string, p: any) {
  const ts = now();
  db.prepare(
    'INSERT INTO sensor_readings (device_id, ts, temperature, humidity, soil_moisture) VALUES (?, ?, ?, ?, ?)',
  ).run(deviceId, ts, num(p.temperature), num(p.humidity), num(p.soil_moisture));
  db.prepare('UPDATE devices SET last_seen = ?, online = 1 WHERE device_id = ?').run(ts, deviceId);
  emit({ type: 'sensors', deviceId, data: { temperature: num(p.temperature) ?? undefined, humidity: num(p.humidity) ?? undefined, soil_moisture: num(p.soil_moisture) ?? undefined }, ts });
}

function ingestState(deviceId: string, p: any) {
  // The device reports state for every actuator by key — update whichever exist.
  const known = new Set((db.prepare('SELECT key FROM actuators WHERE device_id = ?').all(deviceId) as any[]).map((r) => r.key));
  const upd = db.prepare('UPDATE actuators SET state = ?, updated_at = ? WHERE device_id = ? AND key = ?');
  for (const key of Object.keys(p)) {
    if (known.has(key)) upd.run(p[key] ? 1 : 0, now(), deviceId, key);
  }
  emit({ type: 'state', deviceId, data: p });
}

const num = (v: any) => (v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));

// ---- server -> device ----
export function sendCommand(deviceId: string, cmd: object) {
  aedes.publish({ topic: `gh/${deviceId}/dn/cmd`, payload: Buffer.from(JSON.stringify(cmd)), qos: 1, retain: false, cmd: 'publish', dup: false } as any, () => {});
}

// Trigger an over-the-air firmware update: tell the device to download + flash from `url`.
export function sendOta(deviceId: string, url: string) {
  aedes.publish({ topic: `gh/${deviceId}/dn/ota`, payload: Buffer.from(JSON.stringify({ url })), qos: 1, retain: false, cmd: 'publish', dup: false } as any, () => {});
}

export function pushConfig(deviceId: string) {
  // Dynamic actuator pin map — the firmware drives exactly these pins/keys.
  const actuators = (db
    .prepare('SELECT key, pin, active_low, mode, safety_cap_min FROM actuators WHERE device_id = ? AND pin IS NOT NULL ORDER BY sort, key')
    .all(deviceId) as any[])
    .map((a) => ({ key: a.key, pin: a.pin, active_low: !!a.active_low, mode: a.mode, safety_cap_min: a.safety_cap_min ?? 0 }));

  // Generic automation rules (any actuator, any sensor, thresholds).
  const autorules = db
    .prepare('SELECT actuator_key, sensor, on_above, off_below, on_below, off_above, max_run_min FROM auto_rules WHERE device_id = ? AND enabled = 1')
    .all(deviceId);

  const payload = { actuators, autorules };
  aedes.publish({ topic: `gh/${deviceId}/dn/config`, payload: Buffer.from(JSON.stringify(payload)), qos: 1, retain: true, cmd: 'publish', dup: false } as any, () => {});
}

export { aedes };
