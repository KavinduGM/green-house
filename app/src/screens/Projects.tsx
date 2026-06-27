import { useEffect, useRef, useState } from 'react';
import { Sprout, MapPin, Plus, Trash2, Pencil, Check, Home as HomeIcon, Trees, Cpu, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { Project, GeoResult } from '../lib/types';
import { Card, Modal, Field, Spinner, Empty } from '../components/ui';

const envMeta: Record<string, { icon: any; label: string }> = {
  indoor: { icon: HomeIcon, label: 'Indoor' },
  outdoor: { icon: Trees, label: 'Outdoor' },
  mixed: { icon: Sprout, label: 'Mixed' },
};

/* ---------- shared create/edit form ---------- */
export function ProjectForm({ initial, onSaved, onCancel }: { initial?: Project; onSaved: (id: number) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [environment, setEnvironment] = useState<Project['environment']>(initial?.environment ?? 'indoor');
  const [hasIot, setHasIot] = useState(initial?.has_iot ?? true);
  const [loc, setLoc] = useState<{ name: string; lat: number; lng: number } | null>(
    initial?.latitude != null ? { name: initial.location_name ?? '', lat: initial.latitude!, lng: initial.longitude! } : null,
  );
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef<any>(null);

  // debounced location search
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await api.get<GeoResult[]>(`/api/geocode?q=${encodeURIComponent(q.trim())}`)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q]);

  const save = async () => {
    if (!name.trim()) { setErr('Give the project a name'); return; }
    setBusy(true); setErr('');
    try {
      const body = {
        name: name.trim(), environment, has_iot: hasIot,
        location_name: loc?.name ?? null, latitude: loc?.lat ?? null, longitude: loc?.lng ?? null,
      };
      if (initial) { await api.put(`/api/projects/${initial.id}`, body); onSaved(initial.id); }
      else { const r = await api.post<{ id: number }>('/api/projects', body); onSaved(r.id); }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3.5">
      <Field label="Project name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Greenhouse, Field A" />
      </Field>

      <Field label="Environment">
        <div className="grid grid-cols-3 gap-2">
          {(['indoor', 'outdoor', 'mixed'] as const).map((k) => {
            const M = envMeta[k].icon;
            return (
              <button key={k} onClick={() => { setEnvironment(k); if (k === 'outdoor') setHasIot(false); }}
                className={`rounded-xl py-2.5 flex flex-col items-center gap-1 border text-xs ${
                  environment === k ? 'border-leaf-500 bg-leaf-50 text-leaf-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                <M size={18} />{envMeta[k].label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-3">
        <div className="flex items-center gap-2"><Cpu size={18} className="text-leaf-600" />
          <div><p className="text-sm font-medium">Smart features (IoT)</p>
            <p className="text-[11px] text-gray-400">Pump / light / fan control + sensors</p></div></div>
        <button onClick={() => setHasIot((v) => !v)} className={`w-11 h-6 rounded-full transition relative ${hasIot ? 'bg-leaf-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${hasIot ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      <Field label="Location (for live weather)">
        {loc ? (
          <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
            <MapPin size={16} className="text-leaf-600 shrink-0" />
            <span className="text-sm flex-1 truncate">{loc.name}</span>
            <button className="text-xs text-leaf-600 font-medium" onClick={() => { setLoc(null); setQ(''); }}>Change</button>
          </div>
        ) : (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city / town…" autoCapitalize="words" />
            {searching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />}
            {results.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {results.map((r, i) => (
                  <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-leaf-50 border-b border-gray-50 last:border-0"
                    onClick={() => { setLoc({ name: r.label, lat: r.latitude, lng: r.longitude }); setResults([]); setQ(''); }}>
                    <MapPin size={12} className="inline text-leaf-500 mr-1" />{r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        {onCancel && <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner /> : <Check size={18} />} {initial ? 'Save' : 'Create project'}</button>
      </div>
    </div>
  );
}

/* ---------- first-run onboarding ---------- */
export function Onboarding({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="min-h-full flex flex-col justify-center px-6 max-w-md mx-auto py-10">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-leaf-600 flex items-center justify-center shadow-lg shadow-leaf-600/20 mb-3">
          <Sprout className="text-white" size={32} />
        </div>
        <h1 className="text-xl font-bold text-leaf-800">Create your first project</h1>
        <p className="text-gray-400 text-sm text-center mt-1">A project is one growing space — greenhouse, field, rooftop… Add as many as you like.</p>
      </div>
      <Card><ProjectForm onSaved={onCreated} /></Card>
    </div>
  );
}

/* ---------- manage screen ---------- */
export function ProjectsScreen({ projects, currentId, onSwitch, onChanged }: {
  projects: Project[]; currentId: number; onSwitch: (id: number) => void; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  const del = async (p: Project) => {
    if (!confirm(`Delete "${p.name}" and all its plants? This cannot be undone.`)) return;
    try { await api.del(`/api/projects/${p.id}`); onChanged(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div className="px-4 pt-4 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-leaf-800">Projects</h1>
        <button className="btn-primary !px-3" onClick={() => setCreating(true)}><Plus size={18} /> New</button>
      </header>

      {projects.length === 0 && <Empty icon={<Sprout size={40} />} title="No projects yet" />}

      {projects.map((p) => {
        const M = envMeta[p.environment]?.icon ?? Sprout;
        const active = p.id === currentId;
        return (
          <Card key={p.id} className={`flex items-center gap-3 !py-3 ${active ? 'ring-2 ring-leaf-400' : ''}`}>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSwitch(p.id)}>
              <div className="w-10 h-10 rounded-xl bg-leaf-50 text-leaf-600 flex items-center justify-center"><M size={20} /></div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.name} {active && <span className="text-[10px] text-leaf-600">• active</span>}</p>
                <p className="text-xs text-gray-400 truncate">
                  {envMeta[p.environment]?.label}{p.has_iot ? ' · Smart' : ''}{p.location_name ? ` · ${p.location_name}` : ''}
                </p>
              </div>
            </button>
            <button onClick={() => setEditing(p)} className="p-2 text-gray-400 hover:text-leaf-600"><Pencil size={16} /></button>
            <button onClick={() => del(p)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
          </Card>
        );
      })}

      <Modal open={creating} onClose={() => setCreating(false)} title="New project">
        <ProjectForm onSaved={() => { setCreating(false); onChanged(); }} onCancel={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit project">
        {editing && <ProjectForm initial={editing} onSaved={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
