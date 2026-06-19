import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Ruler, Sparkles, Plus, Camera, Stethoscope, FlaskConical,
  CheckCircle2, SkipForward, Bug, Scissors, Leaf, Droplet, Trash2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Scatter, ScatterChart, ComposedChart } from 'recharts';
import { api } from '../lib/api';
import { capturePhoto } from '../lib/camera';
import type { Timeline, Measurement, PlantEvent, FertItem, Planting } from '../lib/types';
import { Card, Loading, Modal, Field, Spinner, Pill } from '../components/ui';
import PlantSprite from '../components/PlantSprite';

type Tab = 'growth' | 'care' | 'feed';

export default function PlantDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Planting | null>(null);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [measure, setMeasure] = useState<Measurement[]>([]);
  const [events, setEvents] = useState<PlantEvent[]>([]);
  const [fert, setFert] = useState<FertItem[]>([]);
  const [tab, setTab] = useState<Tab>('growth');

  const load = async () => {
    const [pp, t, m, e, f] = await Promise.all([
      api.get<Planting>(`/api/plantings/${id}`),
      api.get<Timeline>(`/api/plantings/${id}/timeline`),
      api.get<Measurement[]>(`/api/plantings/${id}/measurements`),
      api.get<PlantEvent[]>(`/api/plantings/${id}/events`),
      api.get<FertItem[]>(`/api/plantings/${id}/fertilizer`),
    ]);
    setP(pp); setTl(t); setMeasure(m); setEvents(e); setFert(f);
  };
  useEffect(() => { load(); }, [id]);

  if (!p || !tl) return <Loading />;

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-30 bg-[#f6f8f5]/90 backdrop-blur px-4 pt-3 pb-2 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-1.5 -ml-1.5 rounded-full hover:bg-black/5"><ChevronLeft size={24} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-leaf-800 truncate">{p.name}</h1>
          <p className="text-xs text-gray-400">{p.sinhala} · Day {tl.ageDays} · {p.count} plants</p>
        </div>
        <Pill tone={p.status}>{p.status}</Pill>
      </header>

      {/* hero: sprite + expected/actual */}
      <div className="px-4">
        <Card className="flex items-center gap-4">
          <div className="bg-leaf-50/60 rounded-xl">
            <PlantSprite form={tl.model.form} heightCm={tl.actuals.at(-1)?.value ?? tl.expectedHeightToday}
              scaleMaxCm={tl.model.maxHeightCm} leafColor={tl.model.leafColor} fruitColor={tl.model.fruitColor}
              stage={stageOf(tl)} width={96} height={120} />
          </div>
          <div className="flex-1 space-y-2">
            <Metric label="Expected height" value={`${tl.expectedHeightToday} cm`} />
            <Metric label="Latest measured" value={tl.actuals.length ? `${tl.actuals.at(-1)!.value} cm` : '—'} />
            <Metric label="Model fit" value={`${Math.round(tl.correctionFactor * 100)}%`}
              hint={tl.correctionFactor > 1.05 ? 'ahead of model' : tl.correctionFactor < 0.95 ? 'behind model' : 'on model'} />
          </div>
        </Card>
      </div>

      {/* milestones strip */}
      <div className="px-4 mt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {tl.milestones.map((m) => (
            <div key={m.key} className={`shrink-0 rounded-xl px-3 py-2 text-center border ${
              m.done ? 'bg-leaf-600 text-white border-leaf-600' : 'bg-white border-gray-200 text-gray-500'}`}>
              <p className="text-[11px] font-medium">{m.label}</p>
              <p className="text-[10px] opacity-80">{m.date.slice(5)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div className="px-4 mt-4">
        <div className="flex bg-gray-100 rounded-xl p-1 text-sm">
          {(['growth', 'care', 'feed'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-medium capitalize transition ${tab === t ? 'bg-white shadow-card text-leaf-700' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {tab === 'growth' && <GrowthTab id={id!} tl={tl} measure={measure} onChange={load} />}
        {tab === 'care' && <CareTab id={id!} events={events} onChange={load} />}
        {tab === 'feed' && <FeedTab fert={fert} onChange={load} />}
      </div>
    </div>
  );
}

const stageOf = (tl: Timeline) => {
  const a = tl.ageDays, m = tl.model;
  if (a < m.germinateDay) return 'seed';
  if (a < m.floweringDay) return 'vegetative';
  if (a < m.firstHarvestDay) return 'flowering';
  if (a < m.maturityDay) return 'fruiting';
  return 'mature';
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="font-semibold">{value}{hint && <span className="text-[10px] text-gray-400 font-normal ml-1">{hint}</span>}</span>
    </div>
  );
}

/* ---------------- Growth tab ---------------- */
function GrowthTab({ id, tl, measure, onChange }: { id: string; tl: Timeline; measure: Measurement[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState<any>(null);
  const [insightBusy, setInsightBusy] = useState(false);

  // merge curve + actual measurements into one chart series keyed by day
  const base = Date.parse(tl.curve[0]?.date ?? new Date().toISOString());
  const data = tl.curve.map((c) => ({ day: c.day, predicted: c.corrected, actual: null as number | null }));
  for (const a of measure.filter((m) => m.metric === 'height_cm')) {
    const day = Math.round((Date.parse(a.date) - base) / 86_400_000);
    const pt = data.find((d) => Math.abs(d.day - day) <= (tl.curve[1]?.day ?? 2) / 2);
    if (pt) pt.actual = a.value; else data.push({ day, predicted: null as any, actual: a.value });
  }
  data.sort((x, y) => x.day - y.day);

  const save = async () => {
    if (!value) return;
    setBusy(true);
    await api.post(`/api/plantings/${id}/measurements`, { date, value: Number(value), metric: 'height_cm' });
    setValue(''); setOpen(false); setBusy(false); onChange();
  };

  const getInsight = async () => {
    setInsightBusy(true);
    try { setInsight(await api.get(`/api/plantings/${id}/insight`)); }
    catch (e: any) { setInsight({ summary: e.message, status: 'unknown', recommendations: [] }); }
    finally { setInsightBusy(false); }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Growth · predicted vs actual</h3>
          <span className="text-[11px] text-gray-400">height (cm)</span>
        </div>
        <div className="h-52 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => `${d}d`} />
              <YAxis tick={{ fontSize: 11 }} width={34} />
              <Tooltip formatter={(v: any) => (v == null ? '—' : `${v} cm`)} labelFormatter={(d) => `Day ${d}`} />
              <Line type="monotone" dataKey="predicted" stroke="#5ba56d" strokeWidth={2} dot={false} name="Predicted" connectNulls />
              <Scatter dataKey="actual" fill="#2b6e3d" name="Measured" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => setOpen(true)}><Ruler size={18} /> Log height</button>
        <button className="btn-ghost" onClick={getInsight} disabled={insightBusy}>
          {insightBusy ? <Spinner /> : <Sparkles size={18} />} AI assessment
        </button>
      </div>

      {insight && (
        <Card>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={16} className="text-leaf-500" />
            <span className="font-semibold text-sm">AI assessment</span>
            <Pill tone={insight.status === 'behind' ? 'fruiting' : insight.status === 'ahead' ? 'flowering' : 'vegetative'}>{insight.status}</Pill>
          </div>
          <p className="text-sm text-gray-600">{insight.summary}</p>
          {insight.recommendations?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {insight.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2"><Leaf size={14} className="text-leaf-400 mt-0.5 shrink-0" />{r}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {measure.length > 0 && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Measurement log</h3>
          <div className="space-y-1.5">
            {[...measure].reverse().map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{m.date}</span>
                <span className="font-medium">{m.value} cm</span>
                <span className="text-xs text-gray-400">pred {m.predicted ?? '—'} cm</span>
                <button onClick={async () => { await api.del(`/api/measurements/${m.id}`); onChange(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Log a measurement">
        <div className="space-y-3">
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Measured height (cm)"><input type="number" inputMode="decimal" className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 25" /></Field>
          <p className="text-xs text-gray-400">Model expects ~{tl.expectedHeightToday} cm today. Your readings retrain the prediction.</p>
          <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
        </div>
      </Modal>
    </>
  );
}

/* ---------------- Care tab ---------------- */
const eventMeta: Record<string, { icon: any; color: string; label: string }> = {
  fertilize: { icon: FlaskConical, color: 'text-leaf-600 bg-leaf-50', label: 'Fertilize' },
  treatment: { icon: Droplet, color: 'text-sky-600 bg-sky-50', label: 'Treatment' },
  defect: { icon: Bug, color: 'text-red-600 bg-red-50', label: 'Defect' },
  harvest: { icon: Scissors, color: 'text-orange-600 bg-orange-50', label: 'Harvest' },
  note: { icon: Leaf, color: 'text-gray-500 bg-gray-100', label: 'Note' },
};

function CareTab({ id, events, onChange }: { id: string; events: PlantEvent[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Log event</button>
        <button className="btn-ghost" onClick={() => setDiagOpen(true)}><Stethoscope size={18} /> Diagnose issue</button>
      </div>

      {events.length === 0 ? (
        <Card className="text-sm text-gray-400 text-center py-8">No care events yet.</Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const meta = eventMeta[e.type] ?? eventMeta.note;
            const Icon = meta.icon;
            return (
              <Card key={e.id} className="!py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.color}`}><Icon size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{e.product || meta.label}</span>
                      {e.severity && <Pill tone={e.severity === 'high' ? 'fruiting' : 'vegetative'}>{e.severity}</Pill>}
                    </div>
                    <p className="text-xs text-gray-400">{e.date}{e.dosage ? ` · ${e.dosage}` : ''}</p>
                    {e.notes && <p className="text-sm text-gray-600 mt-1">{e.notes}</p>}
                    {e.photo_path && <img src={api.uploadUrl(e.photo_path)} className="mt-2 rounded-lg max-h-40" />}
                  </div>
                  <button onClick={async () => { await api.del(`/api/events/${e.id}`); onChange(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EventModal id={id} open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChange(); }} />
      <DiagnoseModal id={id} open={diagOpen} onClose={() => setDiagOpen(false)} onLogged={onChange} />
    </>
  );
}

function EventModal({ id, open, onClose, onSaved }: { id: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('fertilize');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [product, setProduct] = useState('');
  const [dosage, setDosage] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.append('type', type); fd.append('date', date);
    if (product) fd.append('product', product);
    if (dosage) fd.append('dosage', dosage);
    if (type === 'defect') fd.append('severity', severity);
    if (notes) fd.append('notes', notes);
    if (photo) fd.append('photo', photo);
    await api.form(`/api/plantings/${id}/events`, fd);
    setProduct(''); setDosage(''); setNotes(''); setPhoto(null); setBusy(false); onSaved();
  };

  const products = ['Albert Solution', 'YaraMila Target', 'Grow More K44'];

  return (
    <Modal open={open} onClose={onClose} title="Log care event">
      <div className="space-y-3">
        <Field label="Type">
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(eventMeta).map(([k, m]) => (
              <button key={k} onClick={() => setType(k)}
                className={`rounded-lg py-2 text-[10px] capitalize border ${type === k ? 'border-leaf-500 bg-leaf-50 text-leaf-700' : 'border-gray-200 text-gray-500'}`}>{m.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {(type === 'fertilize' || type === 'treatment') && (
          <>
            <Field label="Product">
              <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} list="prods" placeholder="e.g. YaraMila Target" />
              <datalist id="prods">{products.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Dosage"><input className="input" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 2 g/L" /></Field>
          </>
        )}
        {type === 'defect' && (
          <Field label="Severity">
            <div className="grid grid-cols-3 gap-2">
              {['low', 'medium', 'high'].map((s) => (
                <button key={s} onClick={() => setSeverity(s)} className={`rounded-lg py-2 text-xs capitalize border ${severity === s ? 'border-leaf-500 bg-leaf-50 text-leaf-700' : 'border-gray-200 text-gray-500'}`}>{s}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <button className="btn-ghost w-full" onClick={async () => { try { setPhoto(await capturePhoto('camera')); } catch {} }}>
          <Camera size={18} /> {photo ? 'Photo attached ✓' : 'Add photo'}
        </button>
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save event'}</button>
      </div>
    </Modal>
  );
}

function DiagnoseModal({ id, open, onClose, onLogged }: { id: string; open: boolean; onClose: () => void; onLogged: () => void }) {
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('description', desc);
      if (photo) fd.append('photo', photo);
      setResult(await api.form(`/api/plantings/${id}/diagnose`, fd));
    } catch (e: any) { setResult({ diagnosis: e.message, likely_causes: [], severity: 'medium', treatment: [] }); }
    finally { setBusy(false); }
  };

  const saveAsDefect = async () => {
    const fd = new FormData();
    fd.append('type', 'defect'); fd.append('date', new Date().toISOString().slice(0, 10));
    fd.append('product', result.diagnosis); fd.append('severity', result.severity);
    fd.append('notes', `Treatment: ${(result.treatment || []).join('; ')}`);
    if (photo) fd.append('photo', photo);
    await api.form(`/api/plantings/${id}/events`, fd);
    onClose(); setResult(null); setDesc(''); setPhoto(null); onLogged();
  };

  return (
    <Modal open={open} onClose={onClose} title="Diagnose a problem">
      <div className="space-y-3">
        <Field label="Describe what you see"><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. yellowing leaves with brown spots, curling at edges" /></Field>
        <button className="btn-ghost w-full" onClick={async () => { try { setPhoto(await capturePhoto('camera')); } catch {} }}>
          <Camera size={18} /> {photo ? 'Photo attached ✓' : 'Add a photo (recommended)'}
        </button>
        <button className="btn-primary w-full" onClick={run} disabled={busy || (!desc && !photo)}>
          {busy ? <Spinner /> : <><Stethoscope size={18} /> Analyze with AI</>}
        </button>
        {result && (
          <div className="bg-leaf-50/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2"><span className="font-semibold text-sm">{result.diagnosis}</span><Pill tone={result.severity === 'high' ? 'fruiting' : 'vegetative'}>{result.severity}</Pill></div>
            {result.likely_causes?.length > 0 && <p className="text-xs text-gray-500">Causes: {result.likely_causes.join(', ')}</p>}
            {result.treatment?.length > 0 && (
              <ul className="space-y-1">{result.treatment.map((t: string, i: number) => <li key={i} className="text-sm text-gray-600 flex gap-1.5"><Droplet size={13} className="text-sky-500 mt-0.5 shrink-0" />{t}</li>)}</ul>
            )}
            <button className="btn-primary w-full !py-2 mt-1" onClick={saveAsDefect}>Save to care log</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Feed tab ---------------- */
function FeedTab({ fert, onChange }: { fert: FertItem[]; onChange: () => void }) {
  const apply = async (item: FertItem) => { await api.post(`/api/fertilizer/${item.id}/apply`); onChange(); };
  const skip = async (item: FertItem) => { await api.post(`/api/fertilizer/${item.id}/skip`); onChange(); };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50"><h3 className="font-semibold text-sm">Fertilizer program</h3>
        <p className="text-xs text-gray-400">Auto-generated from the planting date.</p></div>
      <div className="divide-y divide-gray-50">
        {fert.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 text-center">
              <p className="text-[10px] text-gray-400">Day</p><p className="font-bold text-leaf-700">{f.day_offset}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${f.status === 'done' ? 'line-through text-gray-400' : ''}`}>{f.product}</p>
              <p className="text-xs text-gray-400">{f.dosage} · {f.method} · {f.due_date}</p>
            </div>
            {f.status === 'pending' ? (
              <div className="flex gap-1">
                <button onClick={() => apply(f)} className="p-2 rounded-lg bg-leaf-50 text-leaf-600"><CheckCircle2 size={18} /></button>
                <button onClick={() => skip(f)} className="p-2 rounded-lg bg-gray-100 text-gray-400"><SkipForward size={18} /></button>
              </div>
            ) : (
              <Pill tone={f.status === 'done' ? 'active' : 'removed'}>{f.status}</Pill>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
