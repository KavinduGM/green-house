import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { db, now } from '../db.js';
import { config, hasClaude } from '../config.js';
import { parseDiagram } from '../services/claude.js';
import { materializeProgram } from '../services/fertilizer.js';
import { projectId } from '../project.js';
import type { PlantingRow } from '../services/growth.js';

export const gardenRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// ---- plant catalog ----
gardenRouter.get('/plant-types', (_req, res) => {
  const rows = db.prepare('SELECT key, sinhala, english, category, form, model FROM plant_types ORDER BY sinhala').all() as any[];
  res.json(rows.map((r) => ({ ...r, model: JSON.parse(r.model) })));
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

// Bulk add: one name + one date applied to many grow bags ("today I planted 10 chilli")
gardenRouter.post('/plantings', (req, res) => {
  const { plant_type_key, name, planted_date, notes, bag_ids = [], count } = req.body ?? {};
  if (!plant_type_key || !planted_date) return res.status(400).json({ error: 'plant_type_key and planted_date required' });
  const type = db.prepare('SELECT english FROM plant_types WHERE key = ?').get(plant_type_key) as any;
  if (!type) return res.status(400).json({ error: 'unknown plant type' });

  const ids: number[] = Array.isArray(bag_ids) ? bag_ids.map(Number) : [];
  const cnt = Number(count) || ids.length || 1;

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO plantings (plant_type_key, name, planted_date, count, notes, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(plant_type_key, name || type.english, planted_date, cnt, notes ?? null, projectId(req), now());
    const pid = Number(info.lastInsertRowid);
    const link = db.prepare('INSERT OR IGNORE INTO planting_bags (planting_id, grow_bag_id) VALUES (?, ?)');
    for (const b of ids) link.run(pid, b);
    materializeProgram(pid, { id: pid, plant_type_key, name, planted_date, count: cnt, status: 'active', notes } as PlantingRow);
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
