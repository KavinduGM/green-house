import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { db, now } from '../db.js';
import { config, hasClaude } from '../config.js';
import { parseDiagram } from '../services/claude.js';
import { materializeProgram } from '../services/fertilizer.js';
import { projectId } from '../project.js';
import { predictedForLog, type PlantingRow } from '../services/growth.js';

export const gardenRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// ---- plant catalog ----
gardenRouter.get('/plant-types', (_req, res) => {
  const rows = db.prepare('SELECT key, sinhala, english, category, form, model, is_custom FROM plant_types ORDER BY is_custom, sinhala').all() as any[];
  res.json(rows.map((r) => ({ ...r, is_custom: !!r.is_custom, model: JSON.parse(r.model) })));
});

const cropSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'crop';
const fruitColorFor = (cat: string) =>
  cat === 'leafy' || cat === 'herb' ? '#7fae5a' : cat === 'root' ? '#e8d8c0' : cat === 'gourd' ? '#6f9a45' : '#d23b27';

// add a custom crop type
gardenRouter.post('/plant-types', (req, res) => {
  const b = req.body ?? {};
  const english = (b.english || b.sinhala || '').trim();
  const sinhala = (b.sinhala || b.english || '').trim();
  if (!english) return res.status(400).json({ error: 'name required' });
  let key = cropSlug(english);
  let n = 2; const base = key;
  while (db.prepare('SELECT 1 FROM plant_types WHERE key = ?').get(key)) key = `${base}_${n++}`;

  const numv = (v: any, d: number) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const category = ['fruiting', 'leafy', 'herb', 'root', 'gourd', 'tree'].includes(b.category) ? b.category : 'fruiting';
  const form = ['bush', 'vine', 'herb', 'root', 'tree'].includes(b.form) ? b.form : 'bush';
  const maxHeightCm = numv(b.maxHeightCm, 80);
  const floweringDay = numv(b.floweringDay, 40);
  const model = {
    key, sinhala, english, category, form,
    germinateDay: numv(b.germinateDay, 7), floweringDay,
    firstHarvestDay: numv(b.firstHarvestDay, 70), maturityDay: numv(b.maturityDay, 90),
    maxHeightCm, spreadCm: numv(b.spreadCm, Math.round(maxHeightCm * 0.6)),
    growthK: numv(b.growthK, 0.1), growthMidpoint: numv(b.growthMidpoint, floweringDay),
    leafColor: b.leafColor || '#3f8a4e', fruitColor: b.fruitColor || fruitColorFor(category),
    notes: b.notes || '',
  };
  db.prepare('INSERT INTO plant_types (key, sinhala, english, category, form, model, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run(key, sinhala, english, category, form, JSON.stringify(model));
  res.json({ key, model });
});

gardenRouter.delete('/plant-types/:key', (req, res) => {
  const inUse = db.prepare('SELECT 1 FROM plantings WHERE plant_type_key = ? LIMIT 1').get(req.params.key);
  if (inUse) return res.status(400).json({ error: 'Crop is in use by a planting' });
  db.prepare('DELETE FROM plant_types WHERE key = ? AND is_custom = 1').run(req.params.key);
  res.json({ ok: true });
});

// ---- greenhouse + grow bags ----
gardenRouter.get('/grow-bags', (req, res) => {
  res.json(db.prepare('SELECT * FROM grow_bags WHERE project_id = ? ORDER BY CAST(label AS INTEGER), label').all(projectId(req)));
});

gardenRouter.post('/grow-bags', (req, res) => {
  const { label, x = 0.5, y = 0.5 } = req.body ?? {};
  const info = db
    .prepare('INSERT INTO grow_bags (label, x, y, project_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(label), Number(x), Number(y), projectId(req), now());
  res.json({ id: info.lastInsertRowid });
});

gardenRouter.put('/grow-bags/:id', (req, res) => {
  const { label, x, y } = req.body ?? {};
  db.prepare('UPDATE grow_bags SET label = COALESCE(?, label), x = COALESCE(?, x), y = COALESCE(?, y) WHERE id = ?')
    .run(label ?? null, x ?? null, y ?? null, req.params.id);
  res.json({ ok: true });
});

gardenRouter.delete('/grow-bags/:id', (req, res) => {
  db.prepare('DELETE FROM grow_bags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- diagram: upload a photo of the hand-drawn layout -> AI extracts bags ----
gardenRouter.post('/diagram', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image required' });
  if (!hasClaude()) return res.status(400).json({ error: 'AI not configured on server (ANTHROPIC_API_KEY).' });

  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const filename = `diagram-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(config.uploadDir, filename), req.file.buffer);

  try {
    const media = (req.file.mimetype as any) === 'image/png' ? 'image/png'
      : req.file.mimetype === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const parsed = await parseDiagram(req.file.buffer.toString('base64'), media);

    const pid = projectId(req);
    const info = db
      .prepare('INSERT INTO diagrams (image_path, parsed_json, project_id, created_at) VALUES (?, ?, ?, ?)')
      .run(filename, JSON.stringify(parsed), pid, now());

    // Optionally replace the bag layout with the parsed result
    const replace = req.query.replace === 'true' || req.body?.replace === 'true';
    if (replace) {
      db.prepare('DELETE FROM grow_bags WHERE project_id = ?').run(pid);
      const ins = db.prepare('INSERT INTO grow_bags (label, x, y, project_id, created_at) VALUES (?, ?, ?, ?, ?)');
      for (const b of parsed.bags) ins.run(b.label, b.x, b.y, pid, now());
    }

    res.json({ diagramId: info.lastInsertRowid, image: `/uploads/${filename}`, parsed, applied: replace });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'parse failed' });
  }
});

gardenRouter.post('/diagram/:id/apply', (req, res) => {
  const row = db.prepare('SELECT parsed_json FROM diagrams WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'not found' });
  const parsed = JSON.parse(row.parsed_json);
  const pid = projectId(req);
  db.prepare('DELETE FROM grow_bags WHERE project_id = ?').run(pid);
  const ins = db.prepare('INSERT INTO grow_bags (label, x, y, project_id, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const b of parsed.bags) ins.run(b.label, b.x, b.y, pid, now());
  res.json({ ok: true, bags: parsed.bags.length });
});

// ---- plantings (bulk-friendly) ----
gardenRouter.get('/plantings', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, pt.sinhala, pt.english, pt.form, pt.category
       FROM plantings p JOIN plant_types pt ON pt.key = p.plant_type_key
       WHERE p.project_id = ?
       ORDER BY p.planted_date DESC`,
    )
    .all(projectId(req)) as any[];
  const bagStmt = db.prepare(
    'SELECT gb.id, gb.label FROM planting_bags pb JOIN grow_bags gb ON gb.id = pb.grow_bag_id WHERE pb.planting_id = ?',
  );
  res.json(rows.map((r) => ({ ...r, bags: bagStmt.all(r.id) })));
});

gardenRouter.get('/plantings/:id', (req, res) => {
  const r = db
    .prepare(
      `SELECT p.*, pt.sinhala, pt.english, pt.form, pt.category
       FROM plantings p JOIN plant_types pt ON pt.key = p.plant_type_key WHERE p.id = ?`,
    )
    .get(req.params.id) as any;
  if (!r) return res.status(404).json({ error: 'not found' });
  r.bags = db
    .prepare('SELECT gb.id, gb.label FROM planting_bags pb JOIN grow_bags gb ON gb.id = pb.grow_bag_id WHERE pb.planting_id = ?')
    .all(req.params.id);
  res.json(r);
});

// Bulk add: one name + one date applied to many grow bags ("today I planted 10 chilli").
// Onboard existing plants too: pass initial_height (cm now) + last_fertilizer_date.
gardenRouter.post('/plantings', (req, res) => {
  const { plant_type_key, name, planted_date, notes, bag_ids = [], count, initial_height, last_fertilizer_date } = req.body ?? {};
  if (!plant_type_key || !planted_date) return res.status(400).json({ error: 'plant_type_key and planted_date required' });
  const type = db.prepare('SELECT english FROM plant_types WHERE key = ?').get(plant_type_key) as any;
  if (!type) return res.status(400).json({ error: 'unknown plant type' });

  const ids: number[] = Array.isArray(bag_ids) ? bag_ids.map(Number) : [];
  const cnt = Number(count) || ids.length || 1;
  const today = new Date().toISOString().slice(0, 10);

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO plantings (plant_type_key, name, planted_date, count, notes, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(plant_type_key, name || type.english, planted_date, cnt, notes ?? null, projectId(req), now());
    const pid = Number(info.lastInsertRowid);
    const link = db.prepare('INSERT OR IGNORE INTO planting_bags (planting_id, grow_bag_id) VALUES (?, ?)');
    for (const b of ids) link.run(pid, b);

    const row = { id: pid, plant_type_key, name, planted_date, count: cnt, status: 'active', notes } as PlantingRow;
    materializeProgram(pid, row);

    // existing plant: record where it's at right now
    if (initial_height !== undefined && initial_height !== null && initial_height !== '') {
      const predicted = predictedForLog(row, today);
      db.prepare('INSERT INTO measurements (planting_id, date, metric, value, predicted, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(pid, today, 'height_cm', Number(initial_height), predicted, 'manual', now());
    }
    // mark feeds already given (anything due on/before the last fertilizer date) as done
    if (last_fertilizer_date) {
      const base = Date.parse(planted_date);
      const items = db.prepare('SELECT id, day_offset FROM fertilizer_plan WHERE planting_id = ?').all(pid) as any[];
      const lastTs = Date.parse(last_fertilizer_date);
      for (const it of items) {
        const due = base + it.day_offset * 86_400_000;
        if (due <= lastTs) db.prepare("UPDATE fertilizer_plan SET status = 'done' WHERE id = ?").run(it.id);
      }
      db.prepare('INSERT INTO events (planting_id, type, date, product, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(pid, 'fertilize', last_fertilizer_date, 'Last feed before tracking', 'Recorded when onboarding an existing plant', now());
    }
    return pid;
  });
  const id = tx();
  res.json({ id });
});

gardenRouter.put('/plantings/:id', (req, res) => {
  const { name, planted_date, status, notes, count } = req.body ?? {};
  db.prepare(
    `UPDATE plantings SET name=COALESCE(?,name), planted_date=COALESCE(?,planted_date),
       status=COALESCE(?,status), notes=COALESCE(?,notes), count=COALESCE(?,count) WHERE id=?`,
  ).run(name ?? null, planted_date ?? null, status ?? null, notes ?? null, count ?? null, req.params.id);
  res.json({ ok: true });
});

gardenRouter.delete('/plantings/:id', (req, res) => {
  db.prepare('DELETE FROM plantings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
