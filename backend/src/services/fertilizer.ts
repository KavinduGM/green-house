import { db } from '../db.js';
import { getModel, type PlantingRow } from './growth.js';

// The grower's standard products:
//  - Albert Solution: balanced foliar feed, used early & as a general spray on all plants
//  - YaraMila Target: granular NPK, soil/fertigation, the backbone feed
//  - Grow More K44: high-potassium foliar, pushes flowering & fruiting
//
// A program is generated per planting, scaled to that crop's maturity timeline.

export interface PlanItem {
  day_offset: number;
  product: string;
  dosage: string;
  method: 'foliar spray' | 'soil drench' | 'fertigation';
}

export function generateProgram(p: PlantingRow): PlanItem[] {
  const m = getModel(p.plant_type_key);
  const items: PlanItem[] = [
    { day_offset: 3, product: 'Albert Solution', dosage: '2 g/L', method: 'foliar spray' },
    { day_offset: 7, product: 'Albert Solution', dosage: '2 g/L', method: 'foliar spray' },
    { day_offset: 14, product: 'YaraMila Target', dosage: '5 g/plant', method: 'fertigation' },
    { day_offset: 21, product: 'Albert Solution', dosage: '2.5 g/L', method: 'foliar spray' },
  ];

  // Fruiting / gourd / tree crops get a longer alternating feed up to maturity.
  if (m.category !== 'root' && m.category !== 'leafy') {
    let day = 28;
    let useK = false; // alternate YaraMila (soil) and K44 (foliar, near flowering)
    const end = Math.min(m.maturityDay, m.firstHarvestDay + 30);
    while (day <= end) {
      if (day >= m.floweringDay - 7) {
        // around and after flowering, push potassium for fruit set
        items.push({ day_offset: day, product: useK ? 'Grow More K44' : 'YaraMila Target',
          dosage: useK ? '2 g/L' : '6 g/plant', method: useK ? 'foliar spray' : 'fertigation' });
      } else {
        items.push({ day_offset: day, product: 'YaraMila Target', dosage: '6 g/plant', method: 'fertigation' });
      }
      useK = !useK;
      day += 14;
    }
  }
  return items.filter((i) => i.day_offset <= m.maturityDay + 7).sort((a, b) => a.day_offset - b.day_offset);
}

export function materializeProgram(plantingId: number, p: PlantingRow) {
  db.prepare('DELETE FROM fertilizer_plan WHERE planting_id = ? AND status = ?').run(plantingId, 'pending');
  const ins = db.prepare(
    `INSERT INTO fertilizer_plan (planting_id, day_offset, product, dosage, method, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  );
  for (const it of generateProgram(p)) {
    ins.run(plantingId, it.day_offset, it.product, it.dosage, it.method);
  }
}

/** Fertilizer tasks due within `windowDays` (default: now and overdue), across all active plantings. */
export function dueFertilizer(todayIso: string, windowDays = 2) {
  const rows = db
    .prepare(
      `SELECT fp.*, pl.name as planting_name, pl.planted_date, pl.plant_type_key
       FROM fertilizer_plan fp
       JOIN plantings pl ON pl.id = fp.planting_id
       WHERE fp.status = 'pending' AND pl.status = 'active'`,
    )
    .all() as any[];
  const today = Date.parse(todayIso);
  return rows
    .map((r) => {
      const dueDate = new Date(Date.parse(r.planted_date) + r.day_offset * 86_400_000);
      const inDays = Math.floor((dueDate.getTime() - today) / 86_400_000);
      return { ...r, due_date: dueDate.toISOString().slice(0, 10), in_days: inDays };
    })
    .filter((r) => r.in_days <= windowDays)
    .sort((a, b) => a.in_days - b.in_days);
}
