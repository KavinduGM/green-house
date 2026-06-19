import { db } from '../db.js';
import type { PlantModel } from '../plantCatalog.js';

export interface PlantingRow {
  id: number;
  plant_type_key: string;
  name: string;
  planted_date: string;
  count: number;
  status: string;
  notes: string | null;
}

export function getModel(key: string): PlantModel {
  const row = db.prepare('SELECT model FROM plant_types WHERE key = ?').get(key) as any;
  if (!row) throw new Error(`unknown plant type ${key}`);
  return JSON.parse(row.model) as PlantModel;
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

/** Logistic height (cm) at a given day-after-planting. */
export function predictHeight(m: PlantModel, day: number): number {
  if (day <= 0) return 0;
  const h = m.maxHeightCm / (1 + Math.exp(-m.growthK * (day - m.growthMidpoint)));
  return Math.round(h * 10) / 10;
}

/**
 * Adaptive correction factor learned from the grower's own measurements.
 * Returns the average (actual / predicted) ratio of logged heights so future
 * predictions for this planting bend toward reality. 1.0 = perfectly on model.
 */
export function correctionFactor(plantingId: number): number {
  const rows = db
    .prepare(
      `SELECT value, predicted FROM measurements
       WHERE planting_id = ? AND metric = 'height_cm' AND predicted > 0
       ORDER BY date DESC LIMIT 5`,
    )
    .all(plantingId) as Array<{ value: number; predicted: number }>;
  if (!rows.length) return 1;
  const ratios = rows.map((r) => r.value / r.predicted).filter((x) => isFinite(x) && x > 0);
  if (!ratios.length) return 1;
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  // clamp so a single odd reading can't wildly distort the curve
  return Math.max(0.5, Math.min(1.8, avg));
}

export interface Milestone {
  key: string;
  label: string;
  day: number;
  date: string;
  done: boolean;
}

export function timeline(p: PlantingRow, todayIso: string) {
  const m = getModel(p.plant_type_key);
  const ageDays = daysBetween(p.planted_date, todayIso);
  const factor = correctionFactor(p.id);
  const addDays = (d: number) =>
    new Date(Date.parse(p.planted_date) + d * 86_400_000).toISOString().slice(0, 10);

  const milestones: Milestone[] = [
    { key: 'germinate', label: 'Germination', day: m.germinateDay },
    { key: 'flowering', label: 'First flowers', day: m.floweringDay },
    { key: 'harvest', label: 'First harvest', day: m.firstHarvestDay },
    { key: 'maturity', label: 'Full maturity', day: m.maturityDay },
  ]
    .filter((x) => x.day < 900) // 999 = "not applicable" (e.g. radish flowering)
    .map((x) => ({ ...x, date: addDays(x.day), done: ageDays >= x.day }));

  // growth curve to maturity, sampled every few days
  const horizon = Math.max(m.maturityDay, ageDays + 14);
  const step = Math.max(1, Math.round(horizon / 40));
  const curve: Array<{ day: number; date: string; predicted: number; corrected: number }> = [];
  for (let d = 0; d <= horizon; d += step) {
    const base = predictHeight(m, d);
    curve.push({ day: d, date: addDays(d), predicted: base, corrected: Math.round(base * factor * 10) / 10 });
  }

  const actuals = db
    .prepare(
      `SELECT date, value, predicted FROM measurements
       WHERE planting_id = ? AND metric = 'height_cm' ORDER BY date ASC`,
    )
    .all(p.id) as Array<{ date: string; value: number; predicted: number }>;

  return {
    plantingId: p.id,
    ageDays,
    model: m,
    correctionFactor: factor,
    expectedHeightToday: Math.round(predictHeight(m, ageDays) * factor * 10) / 10,
    milestones,
    curve,
    actuals,
  };
}

/** The model-predicted height used when logging a measurement (stored for accuracy). */
export function predictedForLog(p: PlantingRow, dateIso: string): number {
  const m = getModel(p.plant_type_key);
  const day = daysBetween(p.planted_date, dateIso);
  return predictHeight(m, day);
}
