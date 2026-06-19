import { useEffect, useState } from 'react';
import {
  Droplet, Lightbulb, Fan, Wifi, WifiOff, Plus, Trash2, Clock, Power,
  Thermometer, Droplets, Sprout, SlidersHorizontal,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import { connectRealtime } from '../lib/ws';
import type { Device, Schedule, AutomationRule, SensorReading } from '../lib/types';
import { Card, Loading, SectionTitle, Modal, Field, Pill, Spinner } from '../components/ui';

const actMeta: Record<string, { icon: any; label: string }> = {
  pump: { icon: Droplet, label: 'Water pump' },
  light: { icon: Lightbulb, label: 'Grow light' },
  fan: { icon: Fan, label: 'Blower fan' },
};
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Control() {
  const [device, setDevice] = useState<Device | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedOpen, setSchedOpen] = useState(false);

  const load = async () => {
    const devices = await api.get<Device[]>('/api/devices');
    const dev = devices[0] ?? null;
    setDevice(dev);
    const [sc, ru] = await Promise.all([api.get<Schedule[]>('/api/schedules'), api.get<AutomationRule[]>('/api/automation-rules')]);
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
  const did = device?.device_id ?? 'greenhouse-01';
  const online = device?.online;

  const setMode = async (key: string, mode: string) => { await api.post(`/api/devices/${did}/actuators/${key}/mode`, { mode }); load(); };
  const manual = async (key: string, on: boolean, duration?: number) => {
    await api.post(`/api/devices/${did}/actuators/${key}`, { action: on ? 'on' : 'off', duration_min: duration });
    load();
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <header className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-leaf-800">Control</h1>
          <p className="text-sm text-gray-400">{device?.name ?? 'Controller'} {device?.fw ? `· ${device.fw}` : ''}</p></div>
        <span className={`chip ${online ? 'bg-leaf-50 text-leaf-700' : 'bg-gray-100 text-gray-400'}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* live sensors */}
      <div className="grid grid-cols-3 gap-3">
        <Mini icon={<Thermometer size={16} />} v={latest?.temperature} u="°C" tone="text-orange-500" />
        <Mini icon={<Droplets size={16} />} v={latest?.humidity} u="%" tone="text-sky-500" />
        <Mini icon={<Sprout size={16} />} v={latest?.soil_moisture} u="%" tone="text-leaf-600" />
      </div>

      {/* actuators */}
      <div className="space-y-3">
        {['pump', 'light', 'fan'].map((key) => {
          const a = device?.actuators.find((x) => x.key === key);
          const Icon = actMeta[key].icon;
          return (
            <Card key={key}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a?.state ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-400'}`}><Icon size={20} /></div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{actMeta[key].label}</p>
                  <p className="text-xs text-gray-400">{a?.state ? 'Running' : 'Stopped'} · {a?.mode ?? 'manual'} mode</p>
                </div>
                <Pill tone={a?.state ? 'active' : 'removed'}>{a?.state ? 'ON' : 'OFF'}</Pill>
              </div>
              <div className="flex bg-gray-100 rounded-xl p-1 text-xs mb-3">
                {['manual', 'schedule', 'auto'].map((m) => (
                  <button key={m} onClick={() => setMode(key, m)}
                    className={`flex-1 py-1.5 rounded-lg capitalize font-medium ${a?.mode === m ? 'bg-white shadow-card text-leaf-700' : 'text-gray-500'}`}>{m}</button>
                ))}
              </div>
              {a?.mode === 'manual' && (
                key === 'pump'
                  ? <PumpManual disabled={!online} state={!!a?.state} onRun={(d) => manual('pump', true, d)} onStop={() => manual('pump', false)} />
                  : (
                    <button onClick={() => manual(key, !a?.state)} disabled={!online}
                      className={`btn w-full ${a?.state ? 'bg-red-50 text-red-600' : 'btn-primary'} disabled:opacity-40`}>
                      <Power size={18} /> Turn {a?.state ? 'off' : 'on'}
                    </button>
                  )
              )}
              {a?.mode === 'schedule' && <p className="text-xs text-gray-400">Runs on the schedules below.</p>}
              {a?.mode === 'auto' && <p className="text-xs text-gray-400">Controlled automatically by the rules below.</p>}
            </Card>
          );
        })}
      </div>

      {/* 24h chart */}
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
          <Card className="text-sm text-gray-400">No schedules. Add one to auto-run the pump/light/fan at set times.</Card>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <Card key={s.id} className="flex items-center gap-3 !py-3">
                <Clock size={18} className="text-leaf-500" />
                <div className="flex-1">
                  <p className="font-medium text-sm capitalize">{s.actuator_key} · {s.on_time} · {s.duration_min}min</p>
                  <p className="text-xs text-gray-400">{DAYS.filter((_, i) => s.days_mask & (1 << i)).join(' ')}</p>
                </div>
                <button onClick={async () => { await api.del(`/api/schedules/${s.id}`); load(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* automation rules */}
      <div className="pb-2">
        <SectionTitle>Automation rules</SectionTitle>
        <div className="space-y-2">
          {rules.map((r) => <RuleCard key={r.key} rule={r} onSaved={load} />)}
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><SlidersHorizontal size={13} /> The ESP32 enforces these locally, even if internet drops.</p>
      </div>

      <ScheduleModal open={schedOpen} onClose={() => setSchedOpen(false)} onSaved={() => { setSchedOpen(false); load(); }} />
    </div>
  );
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
        <span className="text-xs text-gray-500">min (~{(dur / 15).toFixed(1)} L/plant)</span>
      </div>
      {state
        ? <button onClick={onStop} disabled={disabled} className="btn bg-red-50 text-red-600 w-full"><Power size={18} /> Stop pump</button>
        : <button onClick={() => onRun(dur)} disabled={disabled} className="btn-primary w-full"><Droplet size={18} /> Run pump</button>}
    </div>
  );
}

function RuleCard({ rule, onSaved }: { rule: AutomationRule; onSaved: () => void }) {
  const [cfg, setCfg] = useState(rule.config);
  const [enabled, setEnabled] = useState(rule.enabled);
  const titles: Record<string, string> = { fan_temp: 'Fan on high temperature', fan_humidity: 'Fan on high humidity', pump_soil: 'Pump on dry soil' };
  const save = async (patch: Record<string, number | boolean>, en = enabled) => {
    const merged = { ...cfg, ...patch };
    setCfg(merged); setEnabled(en);
    await api.put(`/api/automation-rules/${rule.key}`, { config: merged, enabled: en });
    onSaved();
  };
  return (
    <Card className="!py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{titles[rule.key] ?? rule.key}</span>
        <button onClick={() => save({}, !enabled)} className={`w-11 h-6 rounded-full transition relative ${enabled ? 'bg-leaf-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(cfg).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
          <label key={k} className="text-xs text-gray-500">
            <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
            <input type="number" className="input !py-1.5 mt-0.5" value={v as number}
              onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })}
              onBlur={(e) => save({ [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
    </Card>
  );
}

function ScheduleModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState('pump');
  const [time, setTime] = useState('06:30');
  const [dur, setDur] = useState(15);
  const [days, setDays] = useState(127);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await api.post('/api/schedules', { actuator_key: key, on_time: time, duration_min: dur, days_mask: days });
    setBusy(false); onSaved();
  };
  return (
    <Modal open={open} onClose={onClose} title="New schedule">
      <div className="space-y-3">
        <Field label="Device">
          <div className="grid grid-cols-3 gap-2">
            {['pump', 'light', 'fan'].map((k) => (
              <button key={k} onClick={() => setKey(k)} className={`rounded-lg py-2 text-sm capitalize border ${key === k ? 'border-leaf-500 bg-leaf-50 text-leaf-700' : 'border-gray-200 text-gray-500'}`}>{k}</button>
            ))}
          </div>
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
