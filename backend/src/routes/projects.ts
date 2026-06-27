import { Router } from 'express';
import { db, now } from '../db.js';
import { getWeather, geocode } from '../services/weather.js';

export const projectsRouter = Router();

const toProject = (r: any) => ({ ...r, has_iot: !!r.has_iot });

projectsRouter.get('/projects', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY id').all() as any[];
  res.json(rows.map(toProject));
});

projectsRouter.post('/projects', (req, res) => {
  const { name, location_name, latitude, longitude, environment = 'indoor', has_iot = true, device_id, notes } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const dev = has_iot ? (device_id || 'greenhouse-01') : null;
  const info = db
    .prepare(`INSERT INTO projects (name, location_name, latitude, longitude, environment, has_iot, device_id, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, location_name ?? null, latitude ?? null, longitude ?? null, environment,
      has_iot ? 1 : 0, dev, notes ?? null, now());
  res.json({ id: info.lastInsertRowid });
});

projectsRouter.put('/projects/:id', (req, res) => {
  const { name, location_name, latitude, longitude, environment, has_iot, device_id, notes } = req.body ?? {};
  db.prepare(
    `UPDATE projects SET name=COALESCE(?,name), location_name=COALESCE(?,location_name),
       latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude),
       environment=COALESCE(?,environment), has_iot=COALESCE(?,has_iot),
       device_id=COALESCE(?,device_id), notes=COALESCE(?,notes) WHERE id=?`,
  ).run(name ?? null, location_name ?? null, latitude ?? null, longitude ?? null, environment ?? null,
    has_iot === undefined ? null : has_iot ? 1 : 0, device_id ?? null, notes ?? null, req.params.id);
  res.json({ ok: true });
});

projectsRouter.delete('/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  const count = (db.prepare('SELECT COUNT(*) c FROM projects').get() as any).c;
  if (count <= 1) return res.status(400).json({ error: 'Cannot delete your only project' });
  const tx = db.transaction(() => {
    for (const t of ['plantings', 'grow_bags', 'diagrams']) db.prepare(`DELETE FROM ${t} WHERE project_id = ?`).run(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  });
  tx();
  res.json({ ok: true });
});

// ---- weather for a project's location ----
projectsRouter.get('/projects/:id/weather', async (req, res) => {
  const p = db.prepare('SELECT latitude, longitude, location_name FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: 'project not found' });
  if (p.latitude == null || p.longitude == null) return res.status(400).json({ error: 'No location set for this project' });
  try {
    res.json({ location: p.location_name, ...(await getWeather(p.latitude, p.longitude) as object) });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// ---- location search (pick exact place) ----
projectsRouter.get('/geocode', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  try {
    res.json(await geocode(q));
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});
