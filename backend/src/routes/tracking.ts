import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { db, now } from '../db.js';
import { config, hasClaude } from '../config.js';
import { timeline, predictedForLog, getModel, type PlantingRow } from '../services/growth.js';
import { dueFertilizer } from '../services/fertilizer.js';
import { growthInsight, diagnoseDefect } from '../services/claude.js';

export const trackingRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const getPlanting = (id: string | number) =>
  db.prepare('SELECT * FROM plantings WHERE id = ?').get(id) as PlantingRow | undefined;

const today = () => new Date().toISOString().slice(0, 10);

// ---- growth timeline + predictions ----
trackingRouter.get('/plantings/:id/timeline', (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(timeline(p, new Date().toISOString()));
});

// ---- AI growth insight (predicted vs actual assessment) ----
trackingRouter.get('/plantings/:id/insight', async (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!hasClaude()) return res.status(400).json({ error: 'AI not configured on server.' });
  try {
    const t = timeline(p, new Date().toISOString());
    const insight = await growthInsight({
      crop: t.model.english, sinhala: t.model.sinhala, ageDays: t.ageDays,
      expectedHeightToday: t.expectedHeightToday,
      milestones: t.milestones, actuals: t.actuals, correctionFactor: t.correctionFactor,
    });
    res.json(insight);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- measurements (actual vs predicted) ----
trackingRouter.get('/plantings/:id/measurements', (req, res) => {
  res.json(db.prepare('SELECT * FROM measurements WHERE planting_id = ? ORDER BY date ASC').all(req.params.id));
});

trackingRouter.post('/plantings/:id/measurements', (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { date = today(), metric = 'height_cm', value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  const predicted = metric === 'height_cm' ? predictedForLog(p, date) : null;
  const info = db
    .prepare('INSERT INTO measurements (planting_id, date, metric, value, predicted, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, date, metric, Number(value), predicted, 'manual', now());
  res.json({ id: info.lastInsertRowid, predicted });
});

trackingRouter.delete('/measurements/:id', (req, res) => {
  db.prepare('DELETE FROM measurements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- events: fertilize | treatment | defect | harvest | note ----
trackingRouter.get('/plantings/:id/events', (req, res) => {
  res.json(db.prepare('SELECT * FROM events WHERE planting_id = ? ORDER BY date DESC, id DESC').all(req.params.id));
});

trackingRouter.post('/plantings/:id/events', upload.single('photo'), (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { type, date = today(), product, dosage, severity, notes } = req.body ?? {};
  if (!type) return res.status(400).json({ error: 'type required' });
  let photoPath: string | null = null;
  if (req.file) {
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const fn = `event-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, fn), req.file.buffer);
    photoPath = `/uploads/${fn}`;
  }
  const info = db
    .prepare('INSERT INTO events (planting_id, type, date, product, dosage, severity, photo_path, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, type, date, product ?? null, dosage ?? null, severity ?? null, photoPath, notes ?? null, now());
  res.json({ id: info.lastInsertRowid, photo: photoPath });
});

trackingRouter.delete('/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- AI defect diagnosis (optional photo + description) ----
trackingRouter.post('/plantings/:id/diagnose', upload.single('photo'), async (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!hasClaude()) return res.status(400).json({ error: 'AI not configured on server.' });
  try {
    const m = getModel(p.plant_type_key);
    const base64 = req.file ? req.file.buffer.toString('base64') : undefined;
    const media = req.file ? ((req.file.mimetype as any) === 'image/png' ? 'image/png' : 'image/jpeg') : undefined;
    const diag = await diagnoseDefect({
      description: req.body?.description ?? '', plant: `${m.english} (${m.sinhala})`,
      base64, media: media as any,
    });
    res.json(diag);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- fertilizer plan & reminders ----
trackingRouter.get('/plantings/:id/fertilizer', (req, res) => {
  const p = getPlanting(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM fertilizer_plan WHERE planting_id = ? ORDER BY day_offset').all(p.id) as any[];
  const base = Date.parse(p.planted_date);
  res.json(rows.map((r) => ({ ...r, due_date: new Date(base + r.day_offset * 86_400_000).toISOString().slice(0, 10) })));
});

trackingRouter.get('/fertilizer/due', (_req, res) => {
  res.json(dueFertilizer(new Date().toISOString(), 3));
});

trackingRouter.post('/fertilizer/:itemId/apply', (req, res) => {
  const item = db.prepare('SELECT * FROM fertilizer_plan WHERE id = ?').get(req.params.itemId) as any;
  if (!item) return res.status(404).json({ error: 'not found' });
  const date = req.body?.date ?? today();
  const ev = db
    .prepare('INSERT INTO events (planting_id, type, date, product, dosage, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(item.planting_id, 'fertilize', date, item.product, item.dosage, `${item.method} (scheduled)`, now());
  db.prepare("UPDATE fertilizer_plan SET status = 'done', applied_event_id = ? WHERE id = ?").run(ev.lastInsertRowid, item.id);
  res.json({ ok: true });
});

trackingRouter.post('/fertilizer/:itemId/skip', (req, res) => {
  db.prepare("UPDATE fertilizer_plan SET status = 'skipped' WHERE id = ?").run(req.params.itemId);
  res.json({ ok: true });
});

// ---- 2D visualizer data: expected size now (and actual) per planting ----
trackingRouter.get('/visualizer', (_req, res) => {
  const plantings = db
    .prepare("SELECT * FROM plantings WHERE status = 'active'")
    .all() as PlantingRow[];
  const out = plantings.map((p) => {
    const t = timeline(p, new Date().toISOString());
    const latestActual = t.actuals.at(-1)?.value ?? null;
    return {
      id: p.id, name: p.name, plant_type_key: p.plant_type_key,
      form: t.model.form, leafColor: t.model.leafColor, fruitColor: t.model.fruitColor,
      ageDays: t.ageDays, maxHeightCm: t.model.maxHeightCm, spreadCm: t.model.spreadCm,
      expectedHeightCm: t.expectedHeightToday, actualHeightCm: latestActual,
      stage: stageFor(t.ageDays, t.model),
    };
  });
  res.json(out);
});

function stageFor(age: number, m: ReturnType<typeof getModel>) {
  if (age < m.germinateDay) return 'seed';
  if (age < m.floweringDay) return 'vegetative';
  if (age < m.firstHarvestDay) return 'flowering';
  if (age < m.maturityDay) return 'fruiting';
  return 'mature';
}
