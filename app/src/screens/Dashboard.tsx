import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Thermometer, Droplets, Sprout, Settings as Cog, Wifi, WifiOff, Bell, CalendarClock, Power } from 'lucide-react';
import { api } from '../lib/api';
import { connectRealtime } from '../lib/ws';
import type { Dashboard as Dash } from '../lib/types';
import { Card, Loading, SectionTitle, Pill } from '../components/ui';

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [live, setLive] = useState<{ temperature?: number; humidity?: number; soil_moisture?: number }>({});

  const load = () => api.get<Dash>('/api/dashboard').then(setD).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const off = connectRealtime((e) => {
      if (e.type === 'sensors') setLive(e.data);
      if (e.type === 'state' || e.type === 'device') load();
    });
    return () => { clearInterval(t); off(); };
  }, []);

  if (!d) return <Loading />;
  const s = { ...d.latestSensors, ...live } as any;
  const online = d.device?.online;

  const toggle = async (key: string, on: boolean) => {
    if (!d.device) return;
    await api.post(`/api/devices/${d.device.device_id}/actuators/${key}`, { action: on ? 'on' : 'off' });
    load();
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Welcome back 🌱</p>
          <h1 className="text-xl font-bold text-leaf-800">{d.device?.name ?? 'Greenhouse'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${online ? 'bg-leaf-50 text-leaf-700' : 'bg-gray-100 text-gray-400'}`}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'Online' : 'Offline'}
          </span>
          <Link to="/settings" className="p-2 rounded-full bg-white shadow-card text-gray-500"><Cog size={20} /></Link>
        </div>
      </header>

      {/* sensor tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Sensor icon={<Thermometer size={18} />} label="Temp" value={fmt(s.temperature, '°C')} tone="text-orange-500" />
        <Sensor icon={<Droplets size={18} />} label="Humidity" value={fmt(s.humidity, '%')} tone="text-sky-500" />
        <Sensor icon={<Sprout size={18} />} label="Soil" value={fmt(s.soil_moisture, '%')} tone="text-leaf-600" />
      </div>

      {/* quick controls */}
      <Card>
        <SectionTitle action={<Link to="/control" className="text-xs text-leaf-600 font-medium">Manage →</Link>}>Quick control</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {['pump', 'light', 'fan'].map((k) => {
            const a = d.actuators.find((x) => x.key === k);
            const on = a?.state;
            return (
              <button key={k} onClick={() => toggle(k, !on)} disabled={!online}
                className={`rounded-2xl p-3 flex flex-col items-center gap-1.5 border transition disabled:opacity-40 ${
                  on ? 'bg-leaf-600 text-white border-leaf-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                <Power size={20} />
                <span className="text-xs font-medium capitalize">{k}</span>
                <span className="text-[10px] opacity-80">{on ? 'ON' : 'OFF'}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* fertilizer reminders */}
      <div>
        <SectionTitle>Reminders</SectionTitle>
        {d.dueFertilizer.length === 0 ? (
          <Card className="text-sm text-gray-400">No fertilizer due in the next few days. ✅</Card>
        ) : (
          <div className="space-y-2">
            {d.dueFertilizer.map((f) => (
              <Card key={f.id} className="flex items-center gap-3 !py-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Bell size={18} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{f.product} · {f.dosage}</p>
                  <p className="text-xs text-gray-400">{f.planting_name} · {f.method}</p>
                </div>
                <Pill tone={(f.in_days ?? 0) <= 0 ? 'fruiting' : 'vegetative'}>
                  {(f.in_days ?? 0) <= 0 ? 'Due now' : `in ${f.in_days}d`}
                </Pill>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* upcoming milestones */}
      {d.upcomingMilestones.length > 0 && (
        <div>
          <SectionTitle>This week</SectionTitle>
          <Card className="space-y-2.5">
            {d.upcomingMilestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <CalendarClock size={16} className="text-leaf-500 shrink-0" />
                <span className="flex-1"><b>{m.planting}</b> — {m.label}</span>
                <span className="text-xs text-gray-400">{m.in_days === 0 ? 'today' : `${m.in_days}d`}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center pb-2">
        <Stat n={d.counts.activePlantings} label="Plantings" />
        <Stat n={d.counts.totalPlants} label="Plants" />
        <Stat n={d.counts.bags} label="Grow bags" />
      </div>
    </div>
  );
}

const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10}${unit}`);

function Sensor({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <Card className="!p-3 flex flex-col items-center gap-1">
      <span className={tone}>{icon}</span>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[11px] text-gray-400">{label}</span>
    </Card>
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  return <div className="card !p-3"><p className="text-xl font-bold text-leaf-700">{n}</p><p className="text-[11px] text-gray-400">{label}</p></div>;
}
