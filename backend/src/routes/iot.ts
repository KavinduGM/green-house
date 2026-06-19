import { Router } from 'express';
import { db, now } from '../db.js';
import { sendCommand, pushConfig } from '../mqtt.js';
import { emit } from '../bus.js';

export const iotRouter = Router();

// ---- devices ----
iotRouter.get('/devices', (_req, res) => {
  const devices = db.prepare('SELECT * FROM devices').all() as any[];
  const acts = db.prepare('SELECT * FROM actuators').all() as any[];
  res.json(devices.map((d) => ({
    ...d, online: !!d.online,
    actuators: acts.filter((a) => a.device_id === d.device_id).map((a) => ({ ...a, state: !!a.state })),
  })));
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

// ---- automation rules (climate control thresholds) ----
iotRouter.get('/automation-rules', (_req, res) => {
  const rows = db.prepare('SELECT * FROM automation_rules').all() as any[];
  res.json(rows.map((r) => ({ key: r.key, enabled: !!r.enabled, config: JSON.parse(r.config) })));
});

iotRouter.put('/automation-rules/:key', (req, res) => {
  const { config: cfg, enabled } = req.body ?? {};
  const existing = db.prepare('SELECT config FROM automation_rules WHERE key = ?').get(req.params.key) as any;
  const merged = { ...(existing ? JSON.parse(existing.config) : {}), ...(cfg ?? {}) };
  db.prepare(
    `INSERT INTO automation_rules (key, config, enabled) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET config=excluded.config, enabled=excluded.enabled`,
  ).run(req.params.key, JSON.stringify(merged), enabled === undefined ? 1 : enabled ? 1 : 0);
  pushConfig('greenhouse-01');
  res.json({ ok: true });
});
