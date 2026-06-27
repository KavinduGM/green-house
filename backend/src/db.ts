import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { PLANT_CATALOG } from './plantCatalog.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(config.firmwareDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS greenhouses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Greenhouse'
);

CREATE TABLE IF NOT EXISTS plant_types (
  key TEXT PRIMARY KEY,
  sinhala TEXT NOT NULL,
  english TEXT NOT NULL,
  category TEXT NOT NULL,
  form TEXT NOT NULL,
  model TEXT NOT NULL          -- JSON of PlantModel
);

CREATE TABLE IF NOT EXISTS diagrams (
  id INTEGER PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL DEFAULT 1,
  image_path TEXT,
  parsed_json TEXT,            -- AI-extracted layout
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grow_bags (
  id INTEGER PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL,         -- e.g. "1", "A3"
  x REAL NOT NULL DEFAULT 0.5, -- normalized 0..1 position on the map
  y REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plantings (
  id INTEGER PRIMARY KEY,
  plant_type_key TEXT NOT NULL REFERENCES plant_types(key),
  name TEXT NOT NULL,
  planted_date TEXT NOT NULL,  -- ISO date
  count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- active | harvested | removed
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planting_bags (
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  grow_bag_id INTEGER NOT NULL REFERENCES grow_bags(id) ON DELETE CASCADE,
  PRIMARY KEY (planting_id, grow_bag_id)
);

CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY,
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  metric TEXT NOT NULL DEFAULT 'height_cm', -- height_cm | leaf_count | fruit_count | health_pct
  value REAL NOT NULL,
  predicted REAL,              -- model prediction at that day, for comparison
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- fertilize | treatment | defect | harvest | note
  date TEXT NOT NULL,
  product TEXT,                -- fertilizer/pesticide product
  dosage TEXT,                 -- e.g. "2 g/L"
  severity TEXT,               -- for defects: low | medium | high
  photo_path TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fertilizer_plan (
  id INTEGER PRIMARY KEY,
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  day_offset INTEGER NOT NULL, -- days after planting
  product TEXT NOT NULL,
  dosage TEXT NOT NULL,
  method TEXT NOT NULL,        -- foliar spray | soil drench | fertigation
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped
  applied_event_id INTEGER REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Greenhouse Controller',
  fw TEXT,
  last_seen TEXT,
  online INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  temperature REAL,
  humidity REAL,
  soil_moisture REAL
);
CREATE INDEX IF NOT EXISTS idx_sensor_ts ON sensor_readings(device_id, ts);

CREATE TABLE IF NOT EXISTS actuators (
  device_id TEXT NOT NULL,
  key TEXT NOT NULL,           -- pump | light | fan
  state INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'manual', -- manual | schedule | auto
  updated_at TEXT,
  PRIMARY KEY (device_id, key)
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL,
  actuator_key TEXT NOT NULL,  -- pump | light | fan
  days_mask INTEGER NOT NULL DEFAULT 127, -- bitmask Sun..Sat
  on_time TEXT NOT NULL,       -- "06:30"
  duration_min INTEGER NOT NULL DEFAULT 15,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT
);

CREATE TABLE IF NOT EXISTS automation_rules (
  key TEXT PRIMARY KEY,        -- e.g. fan_temp, pump_soil
  config TEXT NOT NULL,        -- JSON
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// ---------- Multi-project support ----------
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  environment TEXT NOT NULL DEFAULT 'indoor',   -- indoor | outdoor | mixed
  has_iot INTEGER NOT NULL DEFAULT 1,           -- smart features on/off
  device_id TEXT,                               -- linked controller (smart projects)
  notes TEXT,
  created_at TEXT NOT NULL
);
`);

// Scope existing tables to a project (idempotent — ignore "duplicate column").
for (const t of ['grow_bags', 'plantings', 'diagrams']) {
  try { db.exec(`ALTER TABLE ${t} ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1`); } catch { /* already added */ }
}

// ---------- Dynamic actuators (custom relay buttons) ----------
for (const [col, def] of [
  ['name', 'TEXT'], ['pin', 'INTEGER'], ['active_low', 'INTEGER NOT NULL DEFAULT 1'],
  ['safety_cap_min', 'INTEGER'], ['sort', 'INTEGER NOT NULL DEFAULT 0'], ['is_default', 'INTEGER NOT NULL DEFAULT 0'],
] as const) {
  try { db.exec(`ALTER TABLE actuators ADD COLUMN ${col} ${def}`); } catch { /* already added */ }
}

// Generic automation rules — any actuator driven by any sensor + thresholds.
db.exec(`
CREATE TABLE IF NOT EXISTS auto_rules (
  id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL,
  actuator_key TEXT NOT NULL,
  sensor TEXT NOT NULL,            -- temperature | humidity | soil_moisture
  on_above REAL, off_below REAL,   -- venting/cooling style (turn ON when high)
  on_below REAL, off_above REAL,   -- irrigation/heating style (turn ON when low)
  max_run_min INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1
);
`);

// ---------- Seeding ----------
export function seed() {
  // single user — keep email + password in sync with APP_EMAIL / APP_PASSWORD
  // on every boot, so changing them in the env actually takes effect on redeploy.
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(config.appEmail) as any;
  const hash = bcrypt.hashSync(config.appPassword, 10);
  if (!existing) {
    // if a user exists under a different (old) email, migrate it; else create new
    const any = db.prepare('SELECT id FROM users LIMIT 1').get() as any;
    if (any) db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?').run(config.appEmail, hash, any.id);
    else db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(config.appEmail, hash);
    console.log(`[seed] login user set to ${config.appEmail}`);
  } else {
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, config.appEmail);
    console.log(`[seed] synced password for ${config.appEmail} from APP_PASSWORD`);
  }

  // greenhouse
  if ((db.prepare('SELECT COUNT(*) c FROM greenhouses').get() as any).c === 0) {
    db.prepare("INSERT INTO greenhouses (id, name) VALUES (1, 'My Greenhouse')").run();
  }

  // default project (id 1) — existing data belongs to it
  if ((db.prepare('SELECT COUNT(*) c FROM projects').get() as any).c === 0) {
    db.prepare(
      `INSERT INTO projects (id, name, environment, has_iot, device_id, created_at)
       VALUES (1, 'My Greenhouse', 'indoor', 1, 'greenhouse-01', ?)`,
    ).run(now());
  }
  for (const t of ['grow_bags', 'plantings', 'diagrams']) {
    db.prepare(`UPDATE ${t} SET project_id = 1 WHERE project_id IS NULL`).run();
  }

  // plant types (upsert from catalog, preserves user edits to model only on first insert)
  const upsert = db.prepare(`
    INSERT INTO plant_types (key, sinhala, english, category, form, model)
    VALUES (@key, @sinhala, @english, @category, @form, @model)
    ON CONFLICT(key) DO UPDATE SET sinhala=excluded.sinhala, english=excluded.english,
      category=excluded.category, form=excluded.form`);
  for (const p of PLANT_CATALOG) {
    upsert.run({ ...p, model: JSON.stringify(p) });
  }

  // a default device row so the UI shows the controller even before it connects
  db.prepare(
    "INSERT OR IGNORE INTO devices (device_id, name, online) VALUES ('greenhouse-01', 'Greenhouse Controller', 0)",
  ).run();
  const defaults = [
    { key: 'pump', name: 'Water Pump', pin: 26, sort: 0, cap: 30 },
    { key: 'light', name: 'Grow Light', pin: 27, sort: 1, cap: null },
    { key: 'fan', name: 'Blower Fan', pin: 25, sort: 2, cap: null },
  ];
  for (const a of defaults) {
    db.prepare(
      `INSERT OR IGNORE INTO actuators (device_id, key, state, mode, name, pin, active_low, safety_cap_min, sort, is_default)
       VALUES (?, ?, 0, 'manual', ?, ?, 1, ?, ?, 1)`,
    ).run('greenhouse-01', a.key, a.name, a.pin, a.cap, a.sort);
    // backfill older rows that pre-date these columns
    db.prepare('UPDATE actuators SET name = COALESCE(name, ?), pin = COALESCE(pin, ?), is_default = 1 WHERE device_id = ? AND key = ?')
      .run(a.name, a.pin, 'greenhouse-01', a.key);
  }

  // default automation rules (generic engine)
  if ((db.prepare('SELECT COUNT(*) c FROM auto_rules').get() as any).c === 0) {
    const ins = db.prepare(
      'INSERT INTO auto_rules (device_id, actuator_key, sensor, on_above, off_below, on_below, off_above, max_run_min, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
    );
    ins.run('greenhouse-01', 'fan', 'temperature', 32, 29, null, null, null);
    ins.run('greenhouse-01', 'fan', 'humidity', 85, 75, null, null, null);
    ins.run('greenhouse-01', 'pump', 'soil_moisture', null, null, 35, 60, 15);
  }
}

export const now = () => new Date().toISOString();
