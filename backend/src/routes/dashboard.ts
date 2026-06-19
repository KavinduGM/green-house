import { Router } from 'express';
import { db } from '../db.js';
import { dueFertilizer } from '../services/fertilizer.js';
import { timeline, type PlantingRow } from '../services/growth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', (_req, res) => {
  const activePlantings = db.prepare("SELECT COUNT(*) c FROM plantings WHERE status='active'").get() as any;
  const totalPlants = db.prepare("SELECT COALESCE(SUM(count),0) s FROM plantings WHERE status='active'").get() as any;
  const bags = db.prepare('SELECT COUNT(*) c FROM grow_bags').get() as any;

  const device = db.prepare('SELECT * FROM devices ORDER BY online DESC LIMIT 1').get() as any;
  const latest = device
    ? db.prepare('SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1').get(device.device_id)
    : null;
  const actuators = device
    ? (db.prepare('SELECT key, state, mode FROM actuators WHERE device_id = ?').all(device.device_id) as any[])
        .map((a) => ({ ...a, state: !!a.state }))
    : [];

  const due = dueFertilizer(new Date().toISOString(), 3);

  // upcoming milestones in next 7 days
  const plantings = db.prepare("SELECT * FROM plantings WHERE status='active'").all() as PlantingRow[];
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
    counts: { activePlantings: activePlantings.c, totalPlants: totalPlants.s, bags: bags.c },
    device: device ? { ...device, online: !!device.online } : null,
    latestSensors: latest ?? null,
    actuators,
    dueFertilizer: due,
    upcomingMilestones: upcoming.slice(0, 8),
  });
});
