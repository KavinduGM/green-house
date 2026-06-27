import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { sendCommand, pushConfig, sendOta } from '../mqtt.js';
import { emit } from '../bus.js';

export const iotRouter = Router();
const fwUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// ---- devices ----
iotRouter.get('/devices', (_req, res) => {
  const devices = db.prepare('SELECT * FROM devices').all() as any[];
  const acts = db.prepare('SELECT * FROM actuators ORDER BY sort, key').all() as any[];
  res.json(devices.map((d) => ({
    ...d, online: !!d.online,
    actuators: acts.filter((a) => a.device_id === d.device_id)
      .map((a) => ({ ...a, state: !!a.state, active_low: !!a.active_low, is_default: !!a.is_default })),
  })));
});

// ---- add / edit / remove custom actuator buttons (define the GPIO pin) ----
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'relay';

iotRouter.post('/devices/:id/actuators', (req, res) => {
  const { id } = req.params;
  const { name, pin, active_low = true, safety_cap_min } = req.body ?? {};
  if (!name || pin === undefined || pin === null) return res.status(400).json({ error: 'name and pin required' });
  // unique key from name
  let key = slug(String(name));
  const exists = (k: string) => db.prepare('SELECT 1 FROM actuators WHERE device_id = ? AND key = ?').get(id, k);
  let n = 2; const base = key;
  while (exists(key)) key = `${base}_${n++}`;
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort),-1) m FROM actuators WHERE device_id = ?').get(id) as any).m;
  db.prepare(
    `INSERT INTO actuators (device_id, key, state, mode, name, pin, active_low, safety_cap_min, sort, is_default)
     VALUES (?, ?, 0, 'manual', ?, ?, ?, ?, ?, 0)`,
  ).run(id, key, String(name), Number(pin), active_low ? 1 : 0, safety_cap_min ? Number(safety_cap_min) : null, maxSort + 1);
  pushConfig(id);
  res.json({ ok: true, key });
});

iotRouter.put('/devices/:id/actuators/:key/def', (req, res) => {
  const { id, key } = req.params;
  const { name, pin, active_low, safety_cap_min } = req.body ?? {};
  db.prepare(
    `UPDATE actuators SET name=COALESCE(?,name), pin=COALESCE(?,pin),
       active_low=COALESCE(?,active_low), safety_cap_min=? WHERE device_id=? AND key=?`,
  ).run(name ?? null, pin ?? null, active_low === undefined ? null : active_low ? 1 : 0,
    safety_cap_min ?? null, id, key);
  pushConfig(id);
  res.json({ ok: true });
});

iotRouter.delete('/devices/:id/actuators/:key', (req, res) => {
  const { id, key } = req.params;
  db.prepare('DELETE FROM actuators WHERE device_id = ? AND key = ?').run(id, key);
  db.prepare('DELETE FROM auto_rules WHERE device_id = ? AND actuator_key = ?').run(id, key);
  db.prepare('DELETE FROM schedules WHERE device_id = ? AND actuator_key = ?').run(id, key);
  pushConfig(id);
  res.json({ ok: true });
});

// ---- sensors ----
iotRouter.get('/devices/:id/sensors/latest', (req, res) => {
  const row = db.prepare('SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1').get(req.params.id);
  res.json(row ?? null);
});

iotRouter.get('/devices/:id/sensors/history', (req, res) => {
  const hours = Math.min(Number(req.query.hours ?? 24), 24 * 14);
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  res.json(
    db.prepare('SELECT ts, temperature, humidity, soil_moisture FROM sensor_readings WHERE device_id = ? AND ts >= ? ORDER BY ts ASC')
      .all(req.params.id, since),
  );
});

// ---- OTA: upload a firmware .bin and push it to the device over the air ----
iotRouter.post('/devices/:id/ota', fwUpload.single('firmware'), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'firmware (.bin) file required' });
  fs.mkdirSync(config.firmwareDir, { recursive: true });
  const file = path.join(config.firmwareDir, `${id}.bin`);
  fs.writeFileSync(file, req.file.buffer);

  const device = db.prepare('SELECT online FROM devices WHERE device_id = ?').get(id) as any;
  // Build a URL the ESP32 can reach. Prefer explicit OTA_BASE_URL, else the request host.
  const base = config.otaBaseUrl || `${req.protocol}://${req.get('host')}`;
  const url = `${base}/firmware/${id}.bin?v=${Date.now()}`;
  sendOta(id, url);
  emit({ type: 'automation', deviceId: id, message: `OTA push started (${(req.file.size / 1024).toFixed(0)} KB)` });
  res.json({ ok: true, url, online: !!device?.online, size: req.file.size });
});

// ---- manual actuator control ----
iotRouter.post('/devices/:id/actuators/:key', (req, res) => {
  const { id, key } = req.params;
  const action = req.body?.action === 'on' ? 'on' : 'off';
  const duration_min = req.body?.duration_min ? Number(req.body.duration_min) : undefined;
  sendCommand(id, { key, action, duration_min, source: 'manual' });
  db.prepare(
    `INSERT INTO actuators (device_id, key, state, mode, updated_at) VALUES (?, ?, ?, 'manual', ?)
     ON CONFLICT(device_id, key) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at`,
  ).run(id, key, action === 'on' ? 1 : 0, now());
  emit({ type: 'state', deviceId: id, data: { [key]: action === 'on' } });
  res.json({ ok: true, key, action });
});

// ---- per-actuator mode: manual | schedule | auto ----
iotRouter.post('/devices/:id/actuators/:key/mode', (req, res) => {
  const { id, key } = req.params;
  const mode = ['manual', 'schedule', 'auto'].includes(req.body?.mode) ? req.body.mode : 'manual';
  db.prepare(
    `INSERT INTO actuators (device_id, key, state, mode, updated_at) VALUES (?, ?, 0, ?, ?)
     ON CONFLICT(device_id, key) DO UPDATE SET mode=excluded.mode, updated_at=excluded.updated_at`,
  ).run(id, key, mode, now());
  pushConfig(id);
  res.json({ ok: true, key, mode });
});

// ---- schedules ----
iotRouter.get('/schedules', (req, res) => {
  res.json(db.prepare('SELECT * FROM schedules ORDER BY actuator_key, on_time').all());
});

iotRouter.post('/schedules', (req, res) => {
  const { device_id = 'greenhouse-01', actuator_key, days_mask = 127, on_time, duration_min = 15, enabled = 1 } = req.body ?? {};
  if (!actuator_key || !on_time) return res.status(400).json({ error: 'actuator_key and on_time required' });
  const info = db
    .prepare('INSERT INTO schedules (device_id, actuator_key, days_mask, on_time, duration_min, enabled) VALUES (?, ?, ?, ?, ?, ?)')
    .run(device_id, actuator_key, Number(days_mask), on_time, Number(duration_min), enabled ? 1 : 0);
  pushConfig(device_id);
  res.json({ id: info.lastInsertRowid });
});

iotRouter.put('/schedules/:id', (req, res) => {
  const { days_mask, on_time, duration_min, enabled } = req.body ?? {};
  db.prepare(
    `UPDATE schedules SET days_mask=COALESCE(?,days_mask), on_time=COALESCE(?,on_time),
       duration_min=COALESCE(?,duration_min), enabled=COALESCE(?,enabled) WHERE id=?`,
  ).run(days_mask ?? null, on_time ?? null, duration_min ?? null,
    enabled === undefined ? null : enabled ? 1 : 0, req.params.id);
  const row = db.prepare('SELECT device_id FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (row) pushConfig(row.device_id);
  res.json({ ok: true });
});

iotRouter.delete('/schedules/:id', (req, res) => {
  const row = db.prepare('SELECT device_id FROM schedules WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  if (row) pushConfig(row.device_id);
  res.json({ ok: true });
});

// ---- automation rules (generic: any actuator + sensor + thresholds) ----
iotRouter.get('/devices/:id/auto-rules', (req, res) => {
  const rows = db.prepare('SELECT * FROM auto_rules WHERE device_id = ? ORDER BY id').all(req.params.id) as any[];
  res.json(rows.map((r) => ({ ...r, enabled: !!r.enabled })));
});

iotRouter.post('/devices/:id/auto-rules', (req, res) => {
  const { id } = req.params;
  const { actuator_key, sensor, on_above, off_below, on_below, off_above, max_run_min } = req.body ?? {};
  if (!actuator_key || !sensor) return res.status(400).json({ error: 'actuator_key and sensor required' });
  const info = db
    .prepare(`INSERT INTO auto_rules (device_id, actuator_key, sensor, on_above, off_below, on_below, off_above, max_run_min, enabled)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(id, actuator_key, sensor, num(on_above), num(off_below), num(on_below), num(off_above), num(max_run_min));
  pushConfig(id);
  res.json({ id: info.lastInsertRowid });
});

iotRouter.put('/auto-rules/:id', (req, res) => {
  const { on_above, off_below, on_below, off_above, max_run_min, sensor, enabled } = req.body ?? {};
  db.prepare(
    `UPDATE auto_rules SET sensor=COALESCE(?,sensor), on_above=?, off_below=?, on_below=?, off_above=?,
       max_run_min=?, enabled=COALESCE(?,enabled) WHERE id=?`,
  ).run(sensor ?? null, num(on_above), num(off_below), num(on_below), num(off_above), num(max_run_min),
    enabled === undefined ? null : enabled ? 1 : 0, req.params.id);
  const row = db.prepare('SELECT device_id FROM auto_rules WHERE id = ?').get(req.params.id) as any;
  if (row) pushConfig(row.device_id);
  res.json({ ok: true });
});

iotRouter.delete('/auto-rules/:id', (req, res) => {
  const row = db.prepare('SELECT device_id FROM auto_rules WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM auto_rules WHERE id = ?').run(req.params.id);
  if (row) pushConfig(row.device_id);
  res.json({ ok: true });
});

const num = (v: any) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v));
