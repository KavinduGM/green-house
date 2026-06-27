import { useEffect, useState } from 'react';
import {
  Droplet, Lightbulb, Fan, Wifi, WifiOff, Plus, Trash2, Clock, Power, Pencil,
  Thermometer, Droplets, Sprout, Zap, Settings2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import { connectRealtime } from '../lib/ws';
import { useProject } from '../App';
import type { Device, Schedule, AutoRule, SensorReading, Actuator } from '../lib/types';
import { Card, Loading, SectionTitle, Modal, Field, Pill, Spinner } from '../components/ui';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const SENSORS: { key: AutoRule['sensor']; label: string; unit: string }[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'humidity', label: 'Humidity', unit: '%' },
  { key: 'soil_moisture', label: 'Soil moisture', unit: '%' },
];
const sensorUnit = (s: string) => SENSORS.find((x) => x.key === s)?.unit ?? '';

function actIcon(a: Actuator) {
  if (a.key.includes('pump') || a.key.includes('water')) return Droplet;
  if (a.key.includes('light') || a.key.includes('lamp')) return Lightbulb;
  if (a.key.includes('fan') || a.key.includes('vent')) return Fan;
  return Zap;
}
const isPumpish = (a: Actuator) => !!a.safety_cap_min || a.key.includes('pump') || a.key.includes('water');

export default function Control() {
  const { current } = useProject();
  const [device, setDevice] = useState<Device | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedOpen, setSchedOpen] = useState(false);
  const [addAct, setAddAct] = useState(false);
  const [editAct, setEditAct] = useState<Actuator | null>(null);
  const [addRule, setAddRule] = useState(false);

  const did = device?.device_id ?? current?.device_id ?? 'greenhouse-01';

  const load = async () => {
    const devices = await api.get<Device[]>('/api/devices');
    const dev = devices.find((x) => x.device_id === current?.device_id) ?? devices[0] ?? null;
    setDevice(dev);
    const id = dev?.device_id ?? current?.device_id ?? 'greenhouse-01';
    const [sc, ru] = await Promise.all([
      api.get<Schedule[]>('/api/schedules'),
      api.get<AutoRule[]>(`/api/devices/${id}/auto-rules`),
    ]);
    setSchedules(sc); setRules(ru);
    if (dev) {
      api.get<SensorReading>(`/api/devices/${dev.device_id}/sensors/latest`).then(setLatest).catch(() => {});
      api.get<SensorReading[]>(`/api/devices/${dev.device_id}/sensors/history?hours=24`).then(setHistory).catch(() => {});
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    const off = connectRealtime((e) => {
      if (e.type === 'sensors') setLatest((p) => ({ ...(p as any), ...e.data, ts: e.ts }));
      if (e.type === 'state' || e.type === 'device') load();
    });
    return off;
  }, []);

  if (loading) return <Loading />;
  const online = device?.online;
  const actuators = device?.actuators ?? [];

  const setMode = async (key: string, mode: string) => { await api.post(`/api/devices/${did}/actuators/${key}/mode`, { mode }); load(); };
  const manual = async (key: string, on: boolean, duration?: number) => {
    await api.post(`/api/devices/${did}/actuators/${key}`, { action: on ? 'on' : 'off', duration_min: duration });
    load();
  };
  const delActuator = async (a: Actuator) => {
    if (!confirm(`Remove "${a.name || a.key}" button? Its rules & schedules are removed too.`)) return;
    await api.del(`/api/devices/${did}/actuators/${a.key}`); load();
  };
  const delRule = async (id: number) => { await api.del(`/api/auto-rules/${id}`); load(); };
  const toggleRule = async (r: AutoRule) => { await api.put(`/api/auto-rules/${r.id}`, { enabled: !r.enabled }); load(); };

  return (
    <div className="px-4 pt-4 space-y-4">
      <header className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-leaf-800">Control</h1>
          <p className="text-sm text-gray-400">{device?.name ?? 'Controller'} {device?.fw ? `· ${device.fw}` : ''}</p></div>
        <span className={`chip ${online ? 'bg-leaf-50 text-leaf-700' : 'bg-gray-100 text-gray-400'}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'Online' : 'Offline'}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Mini icon={<Thermometer size={16} />} v={latest?.temperature} u="°C" tone="text-orange-500" />
        <Mini icon={<Droplets size={16} />} v={latest?.humidity} u="%" tone="text-sky-500" />
        <Mini icon={<Sprout size={16} />} v={latest?.soil_moisture} u="%" tone="text-leaf-600" />
      </div>

      {/* actuators */}
      <SectionTitle action={<button onClick={() => setAddAct(true)} className="text-xs text-leaf-600 font-medium flex items-center gap-1"><Plus size={14} /> Add button</button>}>
        Devices · {actuators.length}
      </SectionTitle>
      <div className="space-y-3">
        {actuators.map((a) => {
          const Icon = actIcon(a);
          return (
            <Card key={a.key}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.state ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-400'}`}><Icon size={20} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{a.name || a.key}</p>
                  <p className="text-xs text-gray-400">GPIO {a.pin ?? '—'} · {a.mode} mode</p>
                </div>
                <Pill tone={a.state ? 'active' : 'removed'}>{a.state ? 'ON' : 'OFF'}</Pill>
                <button onClick={() => setEditAct(a)} className="p-1.5 text-gray-300 hover:text-leaf-600"><Pencil size={15} /></button>
                <button onClick={() => delActuator(a)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
              <div className="flex bg-gray-100 rounded-xl p-1 text-xs mb-3">
                {['manual', 'schedule', 'auto'].map((m) => (
                  <button key={m} onClick={() => setMode(a.key, m)}
                    className={`flex-1 py-1.5 rounded-lg capitalize font-medium ${a.mode === m ? 'bg-white shadow-card text-leaf-700' : 'text-gray-500'}`}>{m}</button>
                ))}
              </div>
              {a.mode === 'manual' && (
                isPumpish(a)
                  ? <PumpManual disabled={!online} state={a.state} onRun={(d) => manual(a.key, true, d)} onStop={() => manual(a.key, false)} />
                  : (
                    <button onClick={() => manual(a.key, !a.state)} disabled={!online}
                      className={`btn w-full ${a.state ? 'bg-red-50 text-red-600' : 'btn-primary'} disabled:opacity-40`}>
                      <Power size={18} /> Turn {a.state ? 'off' : 'on'}
                    </button>
                  )
              )}
              {a.mode === 'schedule' && <p className="text-xs text-gray-400">Runs on the schedules below.</p>}
              {a.mode === 'auto' && <p className="text-xs text-gray-400">Driven by the automation rules below.</p>}
            </Card>
          );
        })}
        {actuators.length === 0 && <Card className="text-sm text-gray-400">No devices yet. Tap “Add button” and define its GPIO pin.</Card>}
      </div>

      {history.length > 1 && (
        <Card>
          <SectionTitle>Last 24 hours</SectionTitle>
          <div className="h-44 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.map((h) => ({ ...h, t: new Date(h.ts).getHours() }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(t) => `${t}h`} />
                <YAxis tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="temperature" stroke="#f97316" dot={false} name="°C" />
                <Line type="monotone" dataKey="humidity" stroke="#0ea5e9" dot={false} name="Hum%" />
                <Line type="monotone" dataKey="soil_moisture" stroke="#3a8a4f" dot={false} name="Soil%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* schedules */}
      <div>
        <SectionTitle action={<button onClick={() => setSchedOpen(true)} className="text-xs text-leaf-600 font-medium flex items-center gap-1"><Plus size={14} /> Add</button>}>Schedules</SectionTitle>
        {schedules.length === 0 ? (
          <Card className="text-sm text-gray-400">No schedules. Add one to auto-run a device at set times.</Card>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => {
              const a = actuators.find((x) => x.key === s.actuator_key);
              return (
                <Card key={s.id} className="flex items-center gap-3 !py-3">
                  <Clock size={18} className="text-leaf-500" />
                  <div className="flex-1"><p className="font-medium text-sm">{a?.name || s.actuator_key} · {s.on_time} · {s.duration_min}min</p>
                    <p className="text-xs text-gray-400">{DAYS.filter((_, i) => s.days_mask & (1 << i)).join(' ')}</p></div>
                  <button onClick={async () => { await api.del(`/api/schedules/${s.id}`); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* automation rules */}
      <div className="pb-2">
        <SectionTitle action={<button onClick={() => setAddRule(true)} className="text-xs text-leaf-600 font-medium flex items-center gap-1"><Plus size={14} /> Add</button>}>Automation rules</SectionTitle>
        {rules.length === 0 ? (
          <Card className="text-sm text-gray-400">No rules. Add one to let a device react to a sensor automatically (works in “auto” mode).</Card>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const a = actuators.find((x) => x.key === r.actuator_key);
              return (
                <Card key={r.id} className="flex items-center gap-3 !py-3">
                  <Settings2 size={18} className="text-leaf-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a?.name || r.actuator_key}</p>
                    <p className="text-xs text-gray-400">{describeRule(r)}</p>
                  </div>
                  <button onClick={() => toggleRule(r)} className={`w-10 h-5.5 rounded-full transition relative shrink-0 ${r.enabled ? 'bg-leaf-600' : 'bg-gray-300'}`} style={{ height: 22, width: 40 }}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${r.enabled ? 'left-[20px]' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => delRule(r.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={15} /></button>
                </Card>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><Zap size={13} /> Rules run on the ESP32 — they keep working even if the internet drops.</p>
      </div>

      <ScheduleModal open={schedOpen} onClose={() => setSchedOpen(false)} actuators={actuators} deviceId={did} onSaved={() => { setSchedOpen(false); load(); }} />
      <ActuatorModal open={addAct} onClose={() => setAddAct(false)} deviceId={did} onSaved={() => { setAddAct(false); load(); }} />
      <ActuatorModal open={!!editAct} onClose={() => setEditAct(null)} deviceId={did} initial={editAct ?? undefined} onSaved={() => { setEditAct(null); load(); }} />
      <RuleModal open={addRule} onClose={() => setAddRule(false)} actuators={actuators} deviceId={did} onSaved={() => { setAddRule(false); load(); }} />
    </div>
  );
}

function describeRule(r: AutoRule) {
  const u = sensorUnit(r.sensor);
  const s = r.sensor.replace('_', ' ');
  if (r.on_below != null) return `${s}: ON ≤ ${r.on_below}${u}, OFF ≥ ${r.off_above ?? '—'}${u}${r.max_run_min ? ` · max ${r.max_run_min}m` : ''}`;
  return `${s}: ON ≥ ${r.on_above ?? '—'}${u}, OFF ≤ ${r.off_below ?? '—'}${u}`;
}

function Mini({ icon, v, u, tone }: { icon: React.ReactNode; v: number | null | undefined; u: string; tone: string }) {
  return <Card className="!p-3 flex flex-col items-center gap-0.5"><span className={tone}>{icon}</span>
    <span className="font-bold">{v == null ? '—' : `${Math.round(v * 10) / 10}${u}`}</span></Card>;
}

function PumpManual({ disabled, state, onRun, onStop }: { disabled: boolean; state: boolean; onRun: (d: number) => void; onStop: () => void }) {
  const [dur, setDur] = useState(15);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Run for</span>
        <input type="number" className="input !py-1.5 w-20 text-center" value={dur} min={1} onChange={(e) => setDur(Number(e.target.value))} />
        <span className="text-xs text-gray-500">min</span>
      </div>
      {state
        ? <button onClick={onStop} disabled={disabled} className="btn bg-red-50 text-red-600 w-full"><Power size={18} /> Stop</button>
        : <button onClick={() => onRun(dur)} disabled={disabled} className="btn-primary w-full"><Droplet size={18} /> Run</button>}
    </div>
  );
}

function ActuatorModal({ open, onClose, deviceId, initial, onSaved }: {
  open: boolean; onClose: () => void; deviceId: string; initial?: Actuator; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [activeLow, setActiveLow] = useState(true);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ''); setPin(initial?.pin != null ? String(initial.pin) : '');
      setActiveLow(initial?.active_low ?? true); setCap(initial?.safety_cap_min != null ? String(initial.safety_cap_min) : ''); setErr('');
    }
  }, [open, initial]);

  const save = async () => {
    if (!name.trim() || pin === '') { setErr('Name and GPIO pin are required'); return; }
    setBusy(true); setErr('');
    try {
      const body = { name: name.trim(), pin: Number(pin), active_low: activeLow, safety_cap_min: cap ? Number(cap) : null };
      if (initial) await api.put(`/api/devices/${deviceId}/actuators/${initial.key}/def`, body);
      else await api.post(`/api/devices/${deviceId}/actuators`, body);
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit device' : 'Add device / button'}>
      <div className="space-y-3.5">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mister, Heater, Pump 2" /></Field>
        <Field label="ESP32 GPIO pin">
          <input type="number" inputMode="numeric" className="input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g. 32" />
          <p className="text-[11px] text-gray-400 mt-1">Safe output pins: 4, 5, 12-19, 21-23, 25-27, 32, 33. Avoid 34-39 (input-only).</p>
        </Field>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5">
          <div><p className="text-sm font-medium">Active-LOW relay</p><p className="text-[11px] text-gray-400">Most relay boards are active-LOW</p></div>
          <button onClick={() => setActiveLow((v) => !v)} className={`w-11 h-6 rounded-full transition relative ${activeLow ? 'bg-leaf-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${activeLow ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <Field label="Safety auto-off (minutes, optional)"><input type="number" className="input" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="e.g. 30 (for pumps)" /></Field>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : initial ? 'Save' : 'Add device'}</button>
      </div>
    </Modal>
  );
}

function RuleModal({ open, onClose, actuators, deviceId, onSaved }: {
  open: boolean; onClose: () => void; actuators: Actuator[]; deviceId: string; onSaved: () => void;
}) {
  const [actuatorKey, setActuatorKey] = useState('');
  const [sensor, setSensor] = useState<AutoRule['sensor']>('temperature');
  const [style, setStyle] = useState<'high' | 'low'>('high');
  const [onVal, setOnVal] = useState('');
  const [offVal, setOffVal] = useState('');
  const [maxRun, setMaxRun] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setActuatorKey(actuators[0]?.key ?? ''); setErr(''); setOnVal(''); setOffVal(''); setMaxRun(''); } }, [open, actuators]);

  const unit = sensorUnit(sensor);
  const save = async () => {
    if (!actuatorKey || onVal === '' || offVal === '') { setErr('Fill in the device and both thresholds'); return; }
    setBusy(true); setErr('');
    try {
      const body: any = { actuator_key: actuatorKey, sensor };
      if (style === 'high') { body.on_above = Number(onVal); body.off_below = Number(offVal); }
      else { body.on_below = Number(onVal); body.off_above = Number(offVal); if (maxRun) body.max_run_min = Number(maxRun); }
      await api.post(`/api/devices/${deviceId}/auto-rules`, body);
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New automation rule">
      <div className="space-y-3.5">
        <Field label="Device">
          <select className="input" value={actuatorKey} onChange={(e) => setActuatorKey(e.target.value)}>
            {actuators.map((a) => <option key={a.key} value={a.key}>{a.name || a.key}</option>)}
          </select>
        </Field>
        <Field label="Sensor">
          <div className="grid grid-cols-3 gap-2">
            {SENSORS.map((s) => (
              <button key={s.key} onClick={() => setSensor(s.key)}
                className={`rounded-lg py-2 text-[11px] border ${sensor === s.key ? 'border-leaf-500 bg-leaf-50 text-leaf-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>{s.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Trigger">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setStyle('high')} className={`rounded-lg py-2 text-xs border ${style === 'high' ? 'border-leaf-500 bg-leaf-50 text-leaf-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>ON when high ↑</button>
            <button onClick={() => setStyle('low')} className={`rounded-lg py-2 text-xs border ${style === 'low' ? 'border-leaf-500 bg-leaf-50 text-leaf-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>ON when low ↓</button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={style === 'high' ? `Turn ON ≥ (${unit})` : `Turn ON ≤ (${unit})`}>
            <input type="number" className="input" value={onVal} onChange={(e) => setOnVal(e.target.value)} /></Field>
          <Field label={style === 'high' ? `Turn OFF ≤ (${unit})` : `Turn OFF ≥ (${unit})`}>
            <input type="number" className="input" value={offVal} onChange={(e) => setOffVal(e.target.value)} /></Field>
        </div>
        {style === 'low' && <Field label="Max run per cycle (min, optional)"><input type="number" className="input" value={maxRun} onChange={(e) => setMaxRun(e.target.value)} placeholder="e.g. 15" /></Field>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Add rule'}</button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ open, onClose, actuators, deviceId, onSaved }: {
  open: boolean; onClose: () => void; actuators: Actuator[]; deviceId: string; onSaved: () => void;
}) {
  const [key, setKey] = useState('');
  const [time, setTime] = useState('06:30');
  const [dur, setDur] = useState(15);
  const [days, setDays] = useState(127);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setKey(actuators[0]?.key ?? ''); }, [open, actuators]);

  const save = async () => {
    if (!key) return;
    setBusy(true);
    await api.post('/api/schedules', { device_id: deviceId, actuator_key: key, on_time: time, duration_min: dur, days_mask: days });
    setBusy(false); onSaved();
  };
  return (
    <Modal open={open} onClose={onClose} title="New schedule">
      <div className="space-y-3">
        <Field label="Device">
          <select className="input" value={key} onChange={(e) => setKey(e.target.value)}>
            {actuators.map((a) => <option key={a.key} value={a.key}>{a.name || a.key}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="On time"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Duration (min)"><input type="number" className="input" value={dur} onChange={(e) => setDur(Number(e.target.value))} /></Field>
        </div>
        <Field label="Days">
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => setDays((m) => m ^ (1 << i))}
                className={`w-9 h-9 rounded-lg text-xs font-medium ${days & (1 << i) ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{d}</button>
            ))}
          </div>
        </Field>
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Add schedule'}</button>
      </div>
    </Modal>
  );
}
