import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { PLANT_CATALOG } from './plantCatalog.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

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

// ---------- Seeding ----------
export function seed() {
  // single user
  const userCount = (db.prepare('SELECT COUNT(*) c FROM users').get() as any).c;
  if (userCount === 0) {
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
      config.appEmail,
      bcrypt.hashSync(config.appPassword, 10),
    );
    console.log(`[seed] created login user ${config.appEmail}`);
  }

  // greenhouse
  if ((db.prepare('SELECT COUNT(*) c FROM greenhouses').get() as any).c === 0) {
    db.prepare("INSERT INTO greenhouses (id, name) VALUES (1, 'My Greenhouse')").run();
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

  // default automation rules
  const defaults: Record<string, object> = {
    fan_temp: { onAbove: 32, offBelow: 29, hysteresis: true },
    fan_humidity: { onAbove: 85, offBelow: 75 },
    pump_soil: { onBelow: 35, offAbove: 60, maxRunMin: 15 }, // soil moisture %
  };
  const insertRule = db.prepare(
    'INSERT OR IGNORE INTO automation_rules (key, config, enabled) VALUES (?, ?, 1)',
  );
  for (const [k, v] of Object.entries(defaults)) insertRule.run(k, JSON.stringify(v));

  // a default device row so the UI shows the controller even before it connects
  db.prepare(
    "INSERT OR IGNORE INTO devices (device_id, name, online) VALUES ('greenhouse-01', 'Greenhouse Controller', 0)",
  ).run();
  for (const key of ['pump', 'light', 'fan']) {
    db.prepare(
      'INSERT OR IGNORE INTO actuators (device_id, key, state, mode) VALUES (?, ?, 0, ?)',
    ).run('greenhouse-01', key, 'manual');
  }
}

export const now = () => new Date().toISOString();
