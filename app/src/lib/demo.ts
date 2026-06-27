/* ---------------------------------------------------------------------------
   DEMO MODE — runs the entire app on in-memory sample data, no backend.
   Lets you explore every screen and even add/log/toggle things (kept in memory
   until the app restarts). Activated from the login screen.
--------------------------------------------------------------------------- */
import { getProjectId } from './api';

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const iso = (d: number) => new Date(d).toISOString();
const dayStr = (d: number) => new Date(d).toISOString().slice(0, 10);

interface DemoModel {
  key: string; sinhala: string; english: string; category: string; form: string;
  germinateDay: number; floweringDay: number; firstHarvestDay: number; maturityDay: number;
  maxHeightCm: number; spreadCm: number; growthK: number; growthMidpoint: number;
  leafColor: string; fruitColor: string; notes: string;
}

const CATALOG: DemoModel[] = [
  { key:'vambatu', sinhala:'Vambatu', english:'Brinjal / Eggplant', category:'fruiting', form:'bush', germinateDay:7, floweringDay:40, firstHarvestDay:70, maturityDay:85, maxHeightCm:90, spreadCm:70, growthK:0.09, growthMidpoint:38, leafColor:'#3f7d4e', fruitColor:'#6a3d8f', notes:'Heavy feeder. Stake when fruit load increases.' },
  { key:'miris', sinhala:'Miris', english:'Chilli', category:'fruiting', form:'bush', germinateDay:8, floweringDay:45, firstHarvestDay:80, maturityDay:95, maxHeightCm:65, spreadCm:45, growthK:0.10, growthMidpoint:40, leafColor:'#2f7d4a', fruitColor:'#d23b27', notes:'Consistent moisture for even fruit set.' },
  { key:'nay_miris', sinhala:'Nay Miris', english:"Bird's-eye Chilli", category:'fruiting', form:'bush', germinateDay:10, floweringDay:50, firstHarvestDay:90, maturityDay:110, maxHeightCm:80, spreadCm:50, growthK:0.09, growthMidpoint:46, leafColor:'#2c6f43', fruitColor:'#e23b1e', notes:'Slow starter, very productive once established.' },
  { key:'maalu_miris', sinhala:'Maalu Miris', english:'Banana Pepper', category:'fruiting', form:'bush', germinateDay:8, floweringDay:45, firstHarvestDay:72, maturityDay:88, maxHeightCm:70, spreadCm:50, growthK:0.10, growthMidpoint:40, leafColor:'#358a52', fruitColor:'#e9c93a', notes:'Large fruit; support stems.' },
  { key:'tomato', sinhala:'Thakkali', english:'Tomato', category:'fruiting', form:'vine', germinateDay:6, floweringDay:35, firstHarvestDay:68, maturityDay:85, maxHeightCm:160, spreadCm:60, growthK:0.11, growthMidpoint:35, leafColor:'#3a7d46', fruitColor:'#e3402d', notes:'Indeterminate: train up strings, prune suckers weekly.' },
  { key:'minchi', sinhala:'Minchi', english:'Mint', category:'herb', form:'herb', germinateDay:10, floweringDay:60, firstHarvestDay:45, maturityDay:60, maxHeightCm:40, spreadCm:40, growthK:0.12, growthMidpoint:25, leafColor:'#2f8a4f', fruitColor:'#7fae5a', notes:'Harvest leaves often to keep it bushy.' },
  { key:'rosemary', sinhala:'Rosemary', english:'Rosemary', category:'herb', form:'herb', germinateDay:18, floweringDay:120, firstHarvestDay:85, maturityDay:150, maxHeightCm:70, spreadCm:50, growthK:0.05, growthMidpoint:70, leafColor:'#4f7d5e', fruitColor:'#6f8fb0', notes:'Slow woody perennial; likes drier soil.' },
  { key:'bandakka', sinhala:'Bandakka', english:'Okra', category:'fruiting', form:'bush', germinateDay:6, floweringDay:38, firstHarvestDay:55, maturityDay:70, maxHeightCm:150, spreadCm:45, growthK:0.12, growthMidpoint:32, leafColor:'#3f8a4e', fruitColor:'#5f9a3a', notes:'Pick pods young (every 2 days).' },
  { key:'goova', sinhala:'Goova', english:'Guava (dwarf)', category:'tree', form:'tree', germinateDay:21, floweringDay:150, firstHarvestDay:240, maturityDay:365, maxHeightCm:200, spreadCm:120, growthK:0.03, growthMidpoint:120, leafColor:'#3d7d49', fruitColor:'#b6c845', notes:'Long timeline. Prune to keep compact.' },
  { key:'raabu', sinhala:'Raabu', english:'Radish', category:'root', form:'root', germinateDay:4, floweringDay:999, firstHarvestDay:35, maturityDay:45, maxHeightCm:30, spreadCm:20, growthK:0.18, growthMidpoint:18, leafColor:'#4f9a52', fruitColor:'#e8e4df', notes:'Fast root crop. Avoid over-nitrogen.' },
  { key:'maa_karal', sinhala:'Maa Karal', english:'Beans (long bean)', category:'gourd', form:'vine', germinateDay:5, floweringDay:40, firstHarvestDay:55, maturityDay:70, maxHeightCm:220, spreadCm:40, growthK:0.13, growthMidpoint:30, leafColor:'#3f8a4e', fruitColor:'#5f9a3a', notes:'Climbing legume; provide a trellis.' },
  { key:'dabala', sinhala:'Dabala', english:'Bottle Gourd', category:'gourd', form:'vine', germinateDay:6, floweringDay:42, firstHarvestDay:60, maturityDay:80, maxHeightCm:250, spreadCm:60, growthK:0.12, growthMidpoint:34, leafColor:'#3a7d44', fruitColor:'#7fae55', notes:'Vigorous vine; strong overhead support.' },
  { key:'pathola', sinhala:'Pathola', english:'Snake Gourd', category:'gourd', form:'vine', germinateDay:6, floweringDay:45, firstHarvestDay:65, maturityDay:80, maxHeightCm:250, spreadCm:60, growthK:0.12, growthMidpoint:36, leafColor:'#3a7d44', fruitColor:'#8fae55', notes:'Train on overhead net.' },
  { key:'vatakolu', sinhala:'Vatakolu', english:'Ridge Gourd', category:'gourd', form:'vine', germinateDay:6, floweringDay:45, firstHarvestDay:62, maturityDay:80, maxHeightCm:250, spreadCm:60, growthK:0.12, growthMidpoint:35, leafColor:'#3a7d44', fruitColor:'#6f9a45', notes:'Train overhead; pick young.' },
];
let demoCustomTypes: DemoModel[] = [];
const allTypes = () => [...CATALOG, ...demoCustomTypes];
const model = (k: string) => allTypes().find((c) => c.key === k) ?? CATALOG[0];

// ---------------- in-memory state ----------------
let nextId = 100;
const id = () => ++nextId;

let bags = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, label: String(i + 1),
  x: 0.15 + (i % 4) * 0.23, y: i < 4 ? 0.32 : 0.68,
}));

interface DemoPlanting { id: number; plant_type_key: string; name: string; planted_date: string; count: number; status: string; notes?: string; bagIds: number[]; }
let plantings: DemoPlanting[] = [
  { id: 1, plant_type_key: 'miris', name: 'Chilli batch A', planted_date: dayStr(Date.now() - 22 * DAY), count: 10, status: 'active', notes: 'Bulk planting, south rows.', bagIds: [1, 2, 3] },
  { id: 2, plant_type_key: 'tomato', name: 'Tomato — Roma', planted_date: dayStr(Date.now() - 38 * DAY), count: 5, status: 'active', notes: '', bagIds: [4, 5] },
  { id: 3, plant_type_key: 'vambatu', name: 'Brinjal', planted_date: dayStr(Date.now() - 12 * DAY), count: 8, status: 'active', notes: '', bagIds: [6, 7] },
];

const measurements: Record<number, any[]> = {
  1: [
    { id: id(), planting_id: 1, date: dayStr(Date.now() - 14 * DAY), metric: 'height_cm', value: 9, predicted: 7.2 },
    { id: id(), planting_id: 1, date: dayStr(Date.now() - 7 * DAY), metric: 'height_cm', value: 18, predicted: 13.5 },
    { id: id(), planting_id: 1, date: today(), metric: 'height_cm', value: 27, predicted: 22.1 },
  ],
  2: [
    { id: id(), planting_id: 2, date: dayStr(Date.now() - 20 * DAY), metric: 'height_cm', value: 28, predicted: 30 },
    { id: id(), planting_id: 2, date: dayStr(Date.now() - 8 * DAY), metric: 'height_cm', value: 71, predicted: 78 },
  ],
  3: [],
};

const events: Record<number, any[]> = {
  1: [
    { id: id(), planting_id: 1, type: 'fertilize', date: dayStr(Date.now() - 15 * DAY), product: 'Albert Solution', dosage: '2 g/L', notes: 'foliar spray' },
    { id: id(), planting_id: 1, type: 'fertilize', date: dayStr(Date.now() - 8 * DAY), product: 'YaraMila Target', dosage: '5 g/plant', notes: 'fertigation' },
    { id: id(), planting_id: 1, type: 'defect', date: dayStr(Date.now() - 4 * DAY), product: 'Aphids on new growth', severity: 'low', notes: 'Treatment: neem oil spray, repeat in 5 days.' },
  ],
  2: [{ id: id(), planting_id: 2, type: 'harvest', date: dayStr(Date.now() - 2 * DAY), notes: 'First 1.2 kg picked.' }],
  3: [],
};

let demoActuators: any[] = [
  { key: 'pump', name: 'Water Pump', pin: 26, active_low: true, is_default: true, safety_cap_min: 30, state: false, mode: 'schedule' },
  { key: 'light', name: 'Grow Light', pin: 27, active_low: true, is_default: true, safety_cap_min: null, state: false, mode: 'manual' },
  { key: 'fan', name: 'Blower Fan', pin: 25, active_low: true, is_default: true, safety_cap_min: null, state: true, mode: 'auto' },
];
let schedules = [
  { id: id(), device_id: 'demo', actuator_key: 'pump', days_mask: 127, on_time: '06:30', duration_min: 15, enabled: 1 },
  { id: id(), device_id: 'demo', actuator_key: 'pump', days_mask: 127, on_time: '17:30', duration_min: 15, enabled: 1 },
  { id: id(), device_id: 'demo', actuator_key: 'light', days_mask: 127, on_time: '18:00', duration_min: 240, enabled: 1 },
];
let demoRules: any[] = [
  { id: id(), device_id: 'demo', actuator_key: 'fan', sensor: 'temperature', on_above: 32, off_below: 29, on_below: null, off_above: null, max_run_min: null, enabled: true },
  { id: id(), device_id: 'demo', actuator_key: 'pump', sensor: 'soil_moisture', on_above: null, off_below: null, on_below: 35, off_above: 60, max_run_min: 15, enabled: true },
];
const sensor = { temperature: 29.4, humidity: 72, soil_moisture: 48 };

// ---- demo projects + weather ----
let demoProjects: any[] = [
  { id: 1, name: 'Home Greenhouse', environment: 'indoor', has_iot: true, device_id: 'demo', location_name: 'Colombo, Sri Lanka', latitude: 6.93, longitude: 79.85 },
  { id: 2, name: 'Backyard Field', environment: 'outdoor', has_iot: false, device_id: null, location_name: 'Kandy, Sri Lanka', latitude: 7.29, longitude: 80.64 },
];
const currentProject = () => demoProjects.find((p) => p.id === (getProjectId() ?? 1)) ?? demoProjects[0];

function demoWeather(name?: string) {
  const days = Array.from({ length: 5 }, (_, i) => dayStr(Date.now() + i * DAY));
  return {
    location: name ?? 'Colombo, Sri Lanka',
    current: { temperature_2m: 29.3, relative_humidity_2m: 74, apparent_temperature: 33.1, precipitation: 0.2, weather_code: 2, wind_speed_10m: 11, is_day: 1 },
    daily: {
      time: days, weather_code: [2, 3, 61, 80, 1],
      temperature_2m_max: [31, 30, 29, 30, 32], temperature_2m_min: [25, 25, 24, 25, 26],
      precipitation_probability_max: [20, 40, 80, 60, 10],
    },
  };
}

// ---------------- computations ----------------
const predictHeight = (m: DemoModel, day: number) =>
  day <= 0 ? 0 : Math.round((m.maxHeightCm / (1 + Math.exp(-m.growthK * (day - m.growthMidpoint)))) * 10) / 10;

function correction(pid: number) {
  const rows = (measurements[pid] ?? []).filter((r) => r.metric === 'height_cm' && r.predicted > 0).slice(-5);
  if (!rows.length) return 1;
  const avg = rows.reduce((a, r) => a + r.value / r.predicted, 0) / rows.length;
  return Math.max(0.5, Math.min(1.8, avg));
}

function timeline(p: DemoPlanting) {
  const m = model(p.plant_type_key);
  const base = Date.parse(p.planted_date);
  const age = Math.floor((Date.now() - base) / DAY);
  const factor = correction(p.id);
  const addDays = (d: number) => dayStr(base + d * DAY);
  const milestones = [
    { key: 'germinate', label: 'Germination', day: m.germinateDay },
    { key: 'flowering', label: 'First flowers', day: m.floweringDay },
    { key: 'harvest', label: 'First harvest', day: m.firstHarvestDay },
    { key: 'maturity', label: 'Full maturity', day: m.maturityDay },
  ].filter((x) => x.day < 900).map((x) => ({ ...x, date: addDays(x.day), done: age >= x.day }));

  const horizon = Math.max(m.maturityDay, age + 14);
  const step = Math.max(1, Math.round(horizon / 40));
  const curve = [];
  for (let d = 0; d <= horizon; d += step) {
    const bse = predictHeight(m, d);
    curve.push({ day: d, date: addDays(d), predicted: bse, corrected: Math.round(bse * factor * 10) / 10 });
  }
  const actuals = (measurements[p.id] ?? []).filter((x) => x.metric === 'height_cm').map((x) => ({ date: x.date, value: x.value, predicted: x.predicted }));
  return { plantingId: p.id, ageDays: age, model: m, correctionFactor: factor,
    expectedHeightToday: Math.round(predictHeight(m, age) * factor * 10) / 10, milestones, curve, actuals };
}

function fertilizer(p: DemoPlanting) {
  const m = model(p.plant_type_key);
  const base = Date.parse(p.planted_date);
  const age = Math.floor((Date.now() - base) / DAY);
  const items = [
    { day_offset: 3, product: 'Albert Solution', dosage: '2 g/L', method: 'foliar spray' },
    { day_offset: 7, product: 'Albert Solution', dosage: '2 g/L', method: 'foliar spray' },
    { day_offset: 14, product: 'YaraMila Target', dosage: '5 g/plant', method: 'fertigation' },
    { day_offset: 21, product: 'Albert Solution', dosage: '2.5 g/L', method: 'foliar spray' },
  ];
  if (m.category !== 'root' && m.category !== 'leafy') {
    let d = 28, useK = false;
    const end = Math.min(m.maturityDay, m.firstHarvestDay + 30);
    while (d <= end) {
      if (d >= m.floweringDay - 7) items.push({ day_offset: d, product: useK ? 'Grow More K44' : 'YaraMila Target', dosage: useK ? '2 g/L' : '6 g/plant', method: useK ? 'foliar spray' : 'fertigation' });
      else items.push({ day_offset: d, product: 'YaraMila Target', dosage: '6 g/plant', method: 'fertigation' });
      useK = !useK; d += 14;
    }
  }
  return items.sort((a, b) => a.day_offset - b.day_offset).map((it, i) => ({
    id: p.id * 1000 + i, planting_id: p.id, ...it,
    status: it.day_offset <= age - 2 ? 'done' : 'pending',
    due_date: dayStr(base + it.day_offset * DAY),
  }));
}

const dueFertilizer = () => plantings.filter((p) => p.status === 'active').flatMap((p) =>
  fertilizer(p).filter((f) => f.status === 'pending').map((f) => ({ ...f, planting_name: p.name,
    in_days: Math.floor((Date.parse(f.due_date) - Date.now()) / DAY) }))).filter((f) => f.in_days <= 3).sort((a, b) => a.in_days - b.in_days);

const stageFor = (age: number, m: DemoModel) =>
  age < m.germinateDay ? 'seed' : age < m.floweringDay ? 'vegetative' : age < m.firstHarvestDay ? 'flowering' : age < m.maturityDay ? 'fruiting' : 'mature';

function visualizer() {
  return plantings.filter((p) => p.status === 'active').map((p) => {
    const t = timeline(p);
    return { id: p.id, name: p.name, plant_type_key: p.plant_type_key, form: t.model.form,
      leafColor: t.model.leafColor, fruitColor: t.model.fruitColor, ageDays: t.ageDays,
      maxHeightCm: t.model.maxHeightCm, spreadCm: t.model.spreadCm, expectedHeightCm: t.expectedHeightToday,
      actualHeightCm: t.actuals.at(-1)?.value ?? null, stage: stageFor(t.ageDays, t.model) };
  });
}

const plantingOut = (p: DemoPlanting) => {
  const m = model(p.plant_type_key);
  return { ...p, sinhala: m.sinhala, english: m.english, form: m.form, category: m.category,
    bags: p.bagIds.map((bid) => bags.find((b) => b.id === bid)).filter(Boolean).map((b) => ({ id: b!.id, label: b!.label })) };
};

function dashboard() {
  const project = currentProject();
  const smart = !!project.has_iot;
  const acts = demoActuators;
  const upcoming: any[] = [];
  for (const p of plantings.filter((x) => x.status === 'active')) {
    for (const ms of timeline(p).milestones) {
      const inDays = Math.floor((Date.parse(ms.date) - Date.now()) / DAY);
      if (inDays >= 0 && inDays <= 7) upcoming.push({ planting: p.name, label: ms.label, date: ms.date, in_days: inDays });
    }
  }
  upcoming.sort((a, b) => a.in_days - b.in_days);
  return {
    project,
    counts: { activePlantings: plantings.filter((p) => p.status === 'active').length,
      totalPlants: plantings.filter((p) => p.status === 'active').reduce((a, p) => a + p.count, 0), bags: bags.length },
    device: smart ? { device_id: 'demo', name: 'Greenhouse Controller', online: true, fw: 'fw-1.1.0 (demo)', actuators: acts } : null,
    latestSensors: smart ? { ts: iso(Date.now()), ...sensor } : null,
    actuators: smart ? acts : [],
    weather: project.latitude != null ? demoWeather(project.location_name) : null,
    dueFertilizer: dueFertilizer(), upcomingMilestones: upcoming.slice(0, 8),
  };
}

// ---------------- AI canned responses ----------------
const insightFor = (p: DemoPlanting) => {
  const t = timeline(p);
  const ahead = t.correctionFactor > 1.05, behind = t.correctionFactor < 0.95;
  return {
    summary: ahead ? `Your ${t.model.english.toLowerCase()} is running ~${Math.round((t.correctionFactor - 1) * 100)}% ahead of the model — strong vegetative growth for day ${t.ageDays}.`
      : behind ? `Growth is a little behind the curve for day ${t.ageDays}. Check feeding and light.`
      : `On track for day ${t.ageDays}. Expected height ~${t.expectedHeightToday} cm.`,
    status: ahead ? 'ahead' : behind ? 'behind' : 'on_track',
    recommendations: [
      'Keep soil moisture steady with the twice-daily drip schedule.',
      `Next feed: YaraMila Target around day ${Math.ceil(t.ageDays / 14) * 14}.`,
      t.model.category === 'fruiting' ? 'Add Grow More K44 as flowers set to boost fruiting.' : 'Harvest regularly to keep the plant productive.',
    ],
  };
};

// ---------------- router ----------------
export async function demoRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 180)); // tiny latency so spinners show
  path = path.split('?')[0]; // ignore query string when route-matching
  const m = (re: RegExp) => path.match(re);
  let mm: RegExpMatchArray | null;

  // FormData (diagram / event photo)
  const fd = body instanceof FormData ? body : null;
  const readFile = (f: File | null) => new Promise<string>((res) => {
    if (!f) return res('');
    const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f);
  });

  if (path === '/api/auth/login') return { token: 'demo', email: 'demo@greenhouse' } as T;
  if (path === '/api/ai/status') return { enabled: true } as T;
  if (path === '/api/dashboard') return dashboard() as T;

  // ---- projects + weather + geocode ----
  if (path === '/api/projects' && method === 'GET') return demoProjects as T;
  if (path === '/api/projects' && method === 'POST') {
    const b: any = body;
    const np = { id: id(), name: b.name, environment: b.environment ?? 'indoor', has_iot: !!b.has_iot,
      device_id: b.has_iot ? (b.device_id || 'demo') : null, location_name: b.location_name ?? null,
      latitude: b.latitude ?? null, longitude: b.longitude ?? null };
    demoProjects.push(np); return { id: np.id } as T;
  }
  if ((mm = m(/^\/api\/projects\/(\d+)$/))) {
    const pid = +mm[1]; const p = demoProjects.find((x) => x.id === pid);
    if (method === 'PUT') { const b: any = body; if (p) Object.assign(p, { name: b.name ?? p.name, environment: b.environment ?? p.environment, has_iot: b.has_iot ?? p.has_iot, location_name: b.location_name ?? p.location_name, latitude: b.latitude ?? p.latitude, longitude: b.longitude ?? p.longitude }); return { ok: true } as T; }
    if (method === 'DELETE') { demoProjects = demoProjects.filter((x) => x.id !== pid); return { ok: true } as T; }
  }
  if ((mm = m(/^\/api\/projects\/(\d+)\/weather$/))) {
    const p = demoProjects.find((x) => x.id === +mm![1]); return demoWeather(p?.location_name) as T;
  }
  if (path.startsWith('/api/geocode')) return [
    { name: 'Colombo', admin1: 'Western', country: 'Sri Lanka', latitude: 6.93, longitude: 79.85, label: 'Colombo, Western, Sri Lanka' },
    { name: 'Kandy', admin1: 'Central', country: 'Sri Lanka', latitude: 7.29, longitude: 80.64, label: 'Kandy, Central, Sri Lanka' },
    { name: 'Galle', admin1: 'Southern', country: 'Sri Lanka', latitude: 6.03, longitude: 80.22, label: 'Galle, Southern, Sri Lanka' },
  ] as T;
  if (path === '/api/plant-types' && method === 'GET') return allTypes().map((c) => ({ key: c.key, sinhala: c.sinhala, english: c.english, category: c.category, form: c.form, model: c, is_custom: demoCustomTypes.includes(c) })) as T;
  if (path === '/api/plant-types' && method === 'POST') {
    const b: any = body;
    const english = (b.english || b.sinhala || 'Crop').trim();
    let key = english.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'crop';
    while (allTypes().some((c) => c.key === key)) key += '_2';
    const nv = (v: any, d: number) => (v == null || v === '' || isNaN(Number(v)) ? d : Number(v));
    const fly = nv(b.floweringDay, 40);
    const t: DemoModel = { key, sinhala: (b.sinhala || english).trim(), english, category: b.category || 'fruiting', form: b.form || 'bush',
      germinateDay: nv(b.germinateDay, 7), floweringDay: fly, firstHarvestDay: nv(b.firstHarvestDay, 70), maturityDay: nv(b.maturityDay, 90),
      maxHeightCm: nv(b.maxHeightCm, 80), spreadCm: Math.round(nv(b.maxHeightCm, 80) * 0.6), growthK: 0.1, growthMidpoint: fly,
      leafColor: '#3f8a4e', fruitColor: '#d23b27', notes: '' };
    demoCustomTypes.push(t); return { key, model: t } as T;
  }
  if ((mm = m(/^\/api\/plant-types\/([^/]+)$/)) && method === 'DELETE') { demoCustomTypes = demoCustomTypes.filter((c) => c.key !== mm![1]); return { ok: true } as T; }
  if (path === '/api/grow-bags' && method === 'GET') return bags as T;
  if (path === '/api/grow-bags' && method === 'POST') { const b: any = body; const nb = { id: id(), label: String(b.label), x: b.x ?? 0.5, y: b.y ?? 0.5 }; bags.push(nb); return { id: nb.id } as T; }
  if ((mm = m(/^\/api\/grow-bags\/(\d+)$/))) { if (method === 'DELETE') bags = bags.filter((b) => b.id !== +mm![1]); return { ok: true } as T; }

  if (path === '/api/visualizer') return visualizer() as T;

  if (path === '/api/diagram' && fd) {
    const img = await readFile(fd.get('image') as File);
    return { diagramId: 1, image: img, parsed: { bags: [
      { label: '1', x: 0.2, y: 0.3 }, { label: '2', x: 0.4, y: 0.3 }, { label: '3', x: 0.6, y: 0.3 }, { label: '4', x: 0.8, y: 0.3 },
      { label: '5', x: 0.2, y: 0.7 }, { label: '6', x: 0.4, y: 0.7 }, { label: '7', x: 0.6, y: 0.7 }, { label: '8', x: 0.8, y: 0.7 },
    ], notes: 'Demo: 8 grow bags detected in 2 rows.' } } as T;
  }
  if ((mm = m(/^\/api\/diagram\/\d+\/apply$/))) return { ok: true, bags: bags.length } as T;

  if (path === '/api/plantings' && method === 'GET') return plantings.map(plantingOut) as T;
  if (path === '/api/plantings' && method === 'POST') {
    const b: any = body; const nid = id();
    plantings.unshift({ id: nid, plant_type_key: b.plant_type_key, name: b.name || model(b.plant_type_key).english,
      planted_date: b.planted_date, count: b.count || (b.bag_ids?.length ?? 1), status: 'active', notes: b.notes, bagIds: b.bag_ids ?? [] });
    measurements[nid] = []; events[nid] = [];
    if (b.initial_height) {
      const mdl = model(b.plant_type_key);
      const day = Math.floor((Date.now() - Date.parse(b.planted_date)) / DAY);
      measurements[nid].push({ id: id(), planting_id: nid, date: today(), metric: 'height_cm', value: Number(b.initial_height), predicted: predictHeight(mdl, day) });
    }
    if (b.last_fertilizer_date) events[nid].push({ id: id(), planting_id: nid, type: 'fertilize', date: b.last_fertilizer_date, product: 'Last feed before tracking', notes: 'Existing plant' });
    return { id: nid } as T;
  }
  if ((mm = m(/^\/api\/plantings\/(\d+)$/))) {
    const pid = +mm[1]; const p = plantings.find((x) => x.id === pid);
    if (method === 'GET') return plantingOut(p!) as T;
    if (method === 'PUT') { const b: any = body; if (p) Object.assign(p, { name: b.name ?? p.name, planted_date: b.planted_date ?? p.planted_date, status: b.status ?? p.status, notes: b.notes ?? p.notes, count: b.count ?? p.count }); return { ok: true } as T; }
    if (method === 'DELETE') { plantings = plantings.filter((x) => x.id !== pid); return { ok: true } as T; }
  }
  if ((mm = m(/^\/api\/plantings\/(\d+)\/timeline$/))) return timeline(plantings.find((x) => x.id === +mm![1])!) as T;
  if ((mm = m(/^\/api\/plantings\/(\d+)\/insight$/))) return insightFor(plantings.find((x) => x.id === +mm![1])!) as T;
  if ((mm = m(/^\/api\/plantings\/(\d+)\/fertilizer$/))) return fertilizer(plantings.find((x) => x.id === +mm![1])!) as T;

  if ((mm = m(/^\/api\/plantings\/(\d+)\/measurements$/))) {
    const pid = +mm[1];
    if (method === 'GET') return (measurements[pid] ?? []) as T;
    if (method === 'POST') { const b: any = body; const p = plantings.find((x) => x.id === pid)!;
      const day = Math.floor((Date.parse(b.date) - Date.parse(p.planted_date)) / DAY);
      const predicted = predictHeight(model(p.plant_type_key), day);
      (measurements[pid] ??= []).push({ id: id(), planting_id: pid, date: b.date, metric: b.metric || 'height_cm', value: +b.value, predicted });
      measurements[pid].sort((a, c) => a.date.localeCompare(c.date));
      return { id: nextId, predicted } as T; }
  }
  if ((mm = m(/^\/api\/measurements\/(\d+)$/))) { const i = +mm[1]; for (const k in measurements) measurements[k] = measurements[k].filter((x) => x.id !== i); return { ok: true } as T; }

  if ((mm = m(/^\/api\/plantings\/(\d+)\/events$/))) {
    const pid = +mm[1];
    if (method === 'GET') return [...(events[pid] ?? [])].sort((a, c) => c.date.localeCompare(a.date)) as T;
    if (method === 'POST' && fd) { const photo = await readFile(fd.get('photo') as File);
      (events[pid] ??= []).push({ id: id(), planting_id: pid, type: fd.get('type'), date: fd.get('date') || today(),
        product: fd.get('product') || undefined, dosage: fd.get('dosage') || undefined, severity: fd.get('severity') || undefined,
        notes: fd.get('notes') || undefined, photo_path: photo || undefined });
      return { id: nextId } as T; }
  }
  if ((mm = m(/^\/api\/events\/(\d+)$/))) { const i = +mm[1]; for (const k in events) events[k] = events[k].filter((x) => x.id !== i); return { ok: true } as T; }

  if ((mm = m(/^\/api\/plantings\/(\d+)\/diagnose$/))) return {
    diagnosis: 'Early aphid infestation', likely_causes: ['Warm, sheltered conditions', 'New tender growth'],
    severity: 'low', treatment: ['Spray neem oil (5 ml/L) on undersides of leaves', 'Repeat after 5 days', 'Introduce ladybugs if available'],
  } as T;

  if ((mm = m(/^\/api\/fertilizer\/(\d+)\/(apply|skip)$/))) return { ok: true } as T;
  if (path === '/api/fertilizer/due') return dueFertilizer() as T;

  if (path === '/api/devices') return [{ device_id: 'demo', name: 'Greenhouse Controller', online: true, fw: 'fw-1.2.0 (demo)',
    actuators: demoActuators }] as T;
  if ((mm = m(/^\/api\/devices\/[^/]+\/actuator-events$/))) {
    const H = 3_600_000;
    return [
      { id: id(), actuator_key: 'pump', action: 'on', source: 'schedule', reason: null, ts: iso(Date.now() - 2 * H), buffered: false },
      { id: id(), actuator_key: 'pump', action: 'off', source: 'timer', reason: 'duration elapsed', ts: iso(Date.now() - 2 * H + 3 * 60000), buffered: false },
      { id: id(), actuator_key: 'fan', action: 'on', source: 'auto', reason: 'temperature 33.1 >= 32', ts: iso(Date.now() - 4 * H), buffered: false },
      { id: id(), actuator_key: 'fan', action: 'off', source: 'auto', reason: 'temperature 28.6 <= 29', ts: iso(Date.now() - 5 * H), buffered: false },
      { id: id(), actuator_key: 'light', action: 'on', source: 'manual', reason: null, ts: iso(Date.now() - 8 * H), buffered: false },
      { id: id(), actuator_key: 'pump', action: 'on', source: 'schedule', reason: null, ts: iso(Date.now() - 26 * H), buffered: true },
      { id: id(), actuator_key: 'pump', action: 'off', source: 'timer', reason: 'duration elapsed', ts: iso(Date.now() - 26 * H + 3 * 60000), buffered: true },
    ] as T;
  }
  if ((mm = m(/^\/api\/devices\/[^/]+\/sensors\/latest$/))) return { ts: iso(Date.now()), ...sensor } as T;
  if ((mm = m(/^\/api\/devices\/[^/]+\/sensors\/history$/))) {
    const out = []; for (let h = 24; h >= 0; h--) out.push({ ts: iso(Date.now() - h * 3_600_000),
      temperature: 27 + 5 * Math.sin(h / 3.8) + (h % 3), humidity: 70 + 12 * Math.cos(h / 4), soil_moisture: 55 - (h % 6) * 2 });
    return out as T;
  }
  if (path.match(/^\/api\/devices\/[^/]+\/actuators$/) && method === 'POST') {
    const b: any = body; const key = String(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'relay';
    demoActuators.push({ key, name: b.name, pin: b.pin, active_low: b.active_low ?? true, is_default: false, safety_cap_min: b.safety_cap_min ?? null, state: false, mode: 'manual' });
    return { ok: true, key } as T;
  }
  if ((mm = m(/^\/api\/devices\/[^/]+\/actuators\/([^/]+)\/def$/))) {
    const a = demoActuators.find((x) => x.key === mm![1]); const b: any = body;
    if (a) Object.assign(a, { name: b.name ?? a.name, pin: b.pin ?? a.pin, active_low: b.active_low ?? a.active_low, safety_cap_min: b.safety_cap_min ?? null });
    return { ok: true } as T;
  }
  if ((mm = m(/^\/api\/devices\/[^/]+\/actuators\/([^/]+)\/mode$/))) { const a = demoActuators.find((x) => x.key === mm![1]); const b: any = body; if (a) a.mode = b.mode; return { ok: true } as T; }
  if ((mm = m(/^\/api\/devices\/[^/]+\/actuators\/([^/]+)$/)) && method === 'POST') { const a = demoActuators.find((x) => x.key === mm![1]); const b: any = body; if (a) a.state = b.action === 'on'; return { ok: true } as T; }
  if ((mm = m(/^\/api\/devices\/[^/]+\/actuators\/([^/]+)$/)) && method === 'DELETE') { demoActuators = demoActuators.filter((x) => x.key !== mm![1]); demoRules = demoRules.filter((r) => r.actuator_key !== mm![1]); return { ok: true } as T; }

  // auto-rules
  if ((mm = m(/^\/api\/devices\/[^/]+\/auto-rules$/)) && method === 'GET') return demoRules as T;
  if ((mm = m(/^\/api\/devices\/[^/]+\/auto-rules$/)) && method === 'POST') {
    const b: any = body;
    demoRules.push({ id: id(), device_id: 'demo', actuator_key: b.actuator_key, sensor: b.sensor, on_above: b.on_above ?? null, off_below: b.off_below ?? null, on_below: b.on_below ?? null, off_above: b.off_above ?? null, max_run_min: b.max_run_min ?? null, enabled: true });
    return { id: nextId } as T;
  }
  if ((mm = m(/^\/api\/auto-rules\/(\d+)$/)) && method === 'PUT') { const r = demoRules.find((x) => x.id === +mm![1]); const b: any = body; if (r && b.enabled !== undefined) r.enabled = b.enabled; return { ok: true } as T; }
  if ((mm = m(/^\/api\/auto-rules\/(\d+)$/)) && method === 'DELETE') { demoRules = demoRules.filter((x) => x.id !== +mm![1]); return { ok: true } as T; }

  if (path === '/api/schedules' && method === 'GET') return schedules as T;
  if (path === '/api/schedules' && method === 'POST') { const b: any = body; const ns = { id: id(), device_id: 'demo', actuator_key: b.actuator_key, days_mask: b.days_mask ?? 127, on_time: b.on_time, duration_min: b.duration_min ?? 15, enabled: 1 }; schedules.push(ns); return { id: ns.id } as T; }
  if ((mm = m(/^\/api\/schedules\/(\d+)$/))) { if (method === 'DELETE') schedules = schedules.filter((s) => s.id !== +mm![1]); return { ok: true } as T; }


  if (path === '/api/ai/ask') return { answer: "🌿 Demo assistant: connect the backend with your Claude key for real answers. Tip: for tomatoes, prune side-shoots weekly and feed Grow More K44 once flowers appear for better fruit set." } as T;

  return {} as T;
}

// live-feeling sensor stream for the dashboard/control screens
export function demoRealtime(onEvent: (e: any) => void): () => void {
  const t = setInterval(() => {
    sensor.temperature = Math.round((27 + Math.random() * 6) * 10) / 10;
    sensor.humidity = Math.round(65 + Math.random() * 20);
    sensor.soil_moisture = Math.round(40 + Math.random() * 25);
    onEvent({ type: 'sensors', deviceId: 'demo', data: { ...sensor }, ts: iso(Date.now()) });
  }, 4000);
  return () => clearInterval(t);
}
