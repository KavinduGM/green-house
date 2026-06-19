import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sprout, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { Planting, PlantType, GrowBag } from '../lib/types';
import { Card, Loading, Modal, Field, Empty, Pill, Spinner } from '../components/ui';

export default function Plants() {
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [types, setTypes] = useState<PlantType[]>([]);
  const [bags, setBags] = useState<GrowBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [p, t, b] = await Promise.all([
      api.get<Planting[]>('/api/plantings'),
      api.get<PlantType[]>('/api/plant-types'),
      api.get<GrowBag[]>('/api/grow-bags'),
    ]);
    setPlantings(p); setTypes(t); setBags(b); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="px-4 pt-4 space-y-4">
      <header className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-leaf-800">Plants</h1>
          <p className="text-sm text-gray-400">{plantings.length} plantings tracked</p></div>
        <button className="btn-primary !px-3" onClick={() => setOpen(true)}><Plus size={18} /> Plant</button>
      </header>

      {plantings.length === 0 ? (
        <Empty icon={<Sprout size={40} />} title="Nothing planted yet" hint="Tap “Plant” to log a crop. You can add many grow bags at once." />
      ) : (
        <div className="space-y-2.5">
          {plantings.map((p) => <PlantingCard key={p.id} p={p} />)}
        </div>
      )}

      <AddModal open={open} onClose={() => setOpen(false)} types={types} bags={bags} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function PlantingCard({ p }: { p: Planting }) {
  const age = Math.floor((Date.now() - Date.parse(p.planted_date)) / 86_400_000);
  return (
    <Link to={`/plants/${p.id}`}>
      <Card className="flex items-center gap-3 !py-3.5">
        <div className="w-11 h-11 rounded-xl bg-leaf-50 text-leaf-600 flex items-center justify-center"><Sprout size={22} /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{p.name}</p>
          <p className="text-xs text-gray-400 truncate">{p.sinhala} · {p.english} · {p.count} plants</p>
        </div>
        <div className="text-right">
          <Pill tone={p.status}>{p.status === 'active' ? `Day ${age}` : p.status}</Pill>
          <ChevronRight className="inline text-gray-300 ml-1" size={16} />
        </div>
      </Card>
    </Link>
  );
}

function AddModal({ open, onClose, types, bags, onSaved }: {
  open: boolean; onClose: () => void; types: PlantType[]; bags: GrowBag[]; onSaved: () => void;
}) {
  const [typeKey, setTypeKey] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [count, setCount] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const chosen = types.find((t) => t.key === typeKey);

  const save = async () => {
    if (!typeKey) { setErr('Choose a plant'); return; }
    setBusy(true); setErr('');
    try {
      await api.post('/api/plantings', {
        plant_type_key: typeKey, name: name.trim(), planted_date: date,
        bag_ids: selected, count: count ? Number(count) : undefined,
      });
      // reset
      setTypeKey(''); setName(''); setCount(''); setSelected([]);
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Plant a crop">
      <div className="space-y-3.5">
        <Field label="Crop">
          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
            {types.map((t) => (
              <button key={t.key} onClick={() => { setTypeKey(t.key); if (!name) setName(t.sinhala); }}
                className={`rounded-xl p-2 text-center border text-xs transition ${
                  typeKey === t.key ? 'border-leaf-500 bg-leaf-50 text-leaf-700 font-semibold' : 'border-gray-200 text-gray-600'}`}>
                <span className="block">{t.sinhala}</span>
                <span className="block text-[10px] text-gray-400 truncate">{t.english}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Name / batch label">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chilli batch A" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Planted date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="No. of plants"><input type="number" inputMode="numeric" className="input" value={count}
            onChange={(e) => setCount(e.target.value)} placeholder={selected.length ? String(selected.length) : 'e.g. 10'} /></Field>
        </div>

        <Field label={`Grow bags (${selected.length} selected)`}>
          {bags.length === 0 ? (
            <p className="text-xs text-gray-400">No bags yet — add them on the Layout tab. You can still log this planting without bags.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {bags.map((b) => (
                <button key={b.id} onClick={() => toggle(b.id)}
                  className={`chip ${selected.includes(b.id) ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{b.label}</button>
              ))}
            </div>
          )}
        </Field>

        {chosen && <p className="text-xs text-gray-400">{chosen.model.notes}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : 'Save planting'}
        </button>
      </div>
    </Modal>
  );
}
