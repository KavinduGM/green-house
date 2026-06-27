import { useEffect, useRef, useState } from 'react';
import { Camera, Plus, Check, Trash2, Sparkles, ImageDown, Move } from 'lucide-react';
import { api } from '../lib/api';
import { capturePhoto } from '../lib/camera';
import { downscaleImage } from '../lib/image';
import type { GrowBag, Planting } from '../lib/types';
import { Card, Loading, SectionTitle, Modal, Field, Spinner, Empty } from '../components/ui';

interface ParseResult { diagramId: number; image: string; parsed: { bags: { label: string; x: number; y: number; plant_guess?: string }[]; notes?: string } }

const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));

export default function Greenhouse() {
  const [bags, setBags] = useState<GrowBag[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const load = async () => {
    const [b, p] = await Promise.all([api.get<GrowBag[]>('/api/grow-bags'), api.get<Planting[]>('/api/plantings')]);
    setBags(b); setPlantings(p); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const bagPlanting = (id: number) => plantings.find((p) => p.bags.some((bb) => bb.id === id));

  const scan = async (source: 'camera' | 'gallery') => {
    setErr('');
    try {
      const raw = await capturePhoto(source);
      setBusy(true);
      const file = await downscaleImage(raw);
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.form<ParseResult>('/api/diagram', fd);
      setPreview(r);
    } catch (e: any) {
      if (e?.message !== 'no file') setErr(e.message || 'Scan failed');
    } finally { setBusy(false); }
  };

  const applyLayout = async () => {
    if (!preview) return;
    setBusy(true);
    await api.post(`/api/diagram/${preview.diagramId}/apply`);
    setPreview(null);
    await load();
    setBusy(false);
  };

  const addBag = async () => {
    if (!newLabel.trim()) return;
    await api.post('/api/grow-bags', { label: newLabel.trim(), x: 0.5, y: 0.5 });
    setNewLabel(''); setAddOpen(false); load();
  };
  const delBag = async (id: number) => { await api.del(`/api/grow-bags/${id}`); load(); };

  // ---- drag to arrange ----
  const posFromEvent = (e: React.PointerEvent) => {
    const r = mapRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const onBagDown = (e: React.PointerEvent, id: number) => {
    e.preventDefault();
    moved.current = false;
    setDragId(id);
    mapRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragId == null) return;
    moved.current = true;
    const { x, y } = posFromEvent(e);
    setBags((bs) => bs.map((b) => (b.id === dragId ? { ...b, x, y } : b)));
  };
  const onUp = async () => {
    if (dragId == null) return;
    const id = dragId;
    setDragId(null);
    if (!moved.current) return;
    const b = bags.find((x) => x.id === id);
    if (b) await api.put(`/api/grow-bags/${id}`, { x: b.x, y: b.y }); // auto-save
  };

  if (loading) return <Loading />;

  return (
    <div className="px-4 pt-4 space-y-4">
      <header><h1 className="text-xl font-bold text-leaf-800">Greenhouse layout</h1>
        <p className="text-sm text-gray-400">Snap your drawing — or place bags and drag to arrange.</p></header>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => scan('camera')} disabled={busy}>
          {busy ? <Spinner /> : <Camera size={18} />} Scan drawing
        </button>
        <button className="btn-ghost" onClick={() => scan('gallery')} disabled={busy}>
          <ImageDown size={18} /> From gallery
        </button>
      </div>

      {/* the map */}
      <Card>
        <SectionTitle action={<button onClick={() => setAddOpen(true)} className="text-xs text-leaf-600 font-medium flex items-center gap-1"><Plus size={14} /> Add bag</button>}>
          Layout · {bags.length} bags
        </SectionTitle>
        {bags.length === 0 ? (
          <Empty title="No grow bags yet" hint="Scan a hand-drawn diagram or add bags manually, then drag to arrange." />
        ) : (
          <>
            <div ref={mapRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              className="relative w-full rounded-xl bg-leaf-50/60 border border-leaf-100 overflow-hidden touch-none select-none"
              style={{ aspectRatio: '4 / 3' }}>
              {bags.map((b) => {
                const pl = bagPlanting(b.id);
                const dragging = dragId === b.id;
                return (
                  <div key={b.id}
                    onPointerDown={(e) => onBagDown(e, b.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing"
                    style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, zIndex: dragging ? 20 : 1 }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow transition-transform ${
                      dragging ? 'scale-125 ring-2 ring-leaf-400' : ''} ${
                      pl ? 'bg-leaf-600 text-white' : 'bg-white text-gray-500 border border-gray-300'}`}>
                      {b.label}
                    </div>
                    {pl && <span className="text-[9px] mt-0.5 text-leaf-700 font-medium max-w-[64px] truncate">{pl.sinhala}</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><Move size={12} /> Drag a bag to move it — positions save automatically.</p>
          </>
        )}
        {bags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bags.map((b) => (
              <button key={b.id} onClick={() => delBag(b.id)}
                className="chip bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500">
                {b.label} <Trash2 size={11} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* parse preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="AI-detected layout">
        {preview && (
          <div className="space-y-3">
            <img src={api.uploadUrl(preview.image)} alt="scan" className="w-full rounded-xl border" />
            <div className="relative w-full rounded-xl bg-leaf-50 border" style={{ aspectRatio: '4 / 3' }}>
              {preview.parsed.bags.map((b, i) => (
                <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-leaf-600 text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}>{b.label}</div>
              ))}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1.5"><Sparkles size={14} className="text-leaf-500" /> Found {preview.parsed.bags.length} grow bags. {preview.parsed.notes}</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setPreview(null)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={applyLayout} disabled={busy}>
                {busy ? <Spinner /> : <Check size={18} />} Use this layout
              </button>
            </div>
            <p className="text-xs text-gray-400">Applying replaces your current bag positions. You can fine-tune by dragging afterwards.</p>
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add grow bag">
        <div className="space-y-3">
          <Field label="Label / number"><input className="input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. 13" /></Field>
          <p className="text-xs text-gray-400">It'll appear in the middle — drag it where you want.</p>
          <button className="btn-primary w-full" onClick={addBag}>Add</button>
        </div>
      </Modal>
    </div>
  );
}
