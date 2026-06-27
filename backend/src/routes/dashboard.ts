import { Router } from 'express';
import { db } from '../db.js';
import { dueFertilizer } from '../services/fertilizer.js';
import { timeline, type PlantingRow } from '../services/growth.js';
import { getWeather } from '../services/weather.js';
import { projectId } from '../project.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', async (req, res) => {
  const pid = projectId(req);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid) as any;
  const hasIot = !!project?.has_iot;

  const activePlantings = db.prepare("SELECT COUNT(*) c FROM plantings WHERE status='active' AND project_id=?").get(pid) as any;
  const totalPlants = db.prepare("SELECT COALESCE(SUM(count),0) s FROM plantings WHERE status='active' AND project_id=?").get(pid) as any;
  const bags = db.prepare('SELECT COUNT(*) c FROM grow_bags WHERE project_id=?').get(pid) as any;

  // IoT (only for smart projects with a linked device)
  let device: any = null, latest: any = null, actuators: any[] = [];
  if (hasIot && project?.device_id) {
    device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(project.device_id);
    if (device) {
      latest = db.prepare('SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1').get(project.device_id);
      actuators = (db.prepare('SELECT key, state, mode FROM actuators WHERE device_id = ?').all(project.device_id) as any[])
        .map((a) => ({ ...a, state: !!a.state }));
    }
  }

  // weather (every project with a location)
  let weather: any = null;
  if (project?.latitude != null && project?.longitude != null) {
    try { weather = await getWeather(project.latitude, project.longitude); } catch { weather = null; }
  }

  const due = dueFertilizer(new Date().toISOString(), 3, pid);

  const plantings = db.prepare("SELECT * FROM plantings WHERE status='active' AND project_id=?").all(pid) as PlantingRow[];
  const upcoming: any[] = [];
  for (const p of plantings) {
    const t = timeline(p, new Date().toISOString());
    for (const m of t.milestones) {
      const inDays = Math.floor((Date.parse(m.date) - Date.now()) / 86_400_000);
      if (inDays >= 0 && inDays <= 7) upcoming.push({ planting: p.name, label: m.label, date: m.date, in_days: inDays });
    }
  }
  upcoming.sort((a, b) => a.in_days - b.in_days);

  res.json({
    project: project ? { ...project, has_iot: hasIot } : null,
    counts: { activePlantings: activePlantings.c, totalPlants: totalPlants.s, bags: bags.c },
    device: device ? { ...device, online: !!device.online } : null,
    latestSensors: latest ?? null,
    actuators,
    weather,
    dueFertilizer: due,
    upcomingMilestones: upcoming.slice(0, 8),
  });
});
