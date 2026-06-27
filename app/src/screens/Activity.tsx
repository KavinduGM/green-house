import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Power, Clock, Zap, Hand, Timer, HardDriveDownload, History } from 'lucide-react';
import { api } from '../lib/api';
import { useProject } from '../App';
import type { Device } from '../lib/types';
import { Card, Loading, Empty, Pill } from '../components/ui';

interface ActEvent { id: number; actuator_key: string; action: string; source?: string; reason?: string; ts: string; buffered: boolean; }

const sourceMeta: Record<string, { icon: any; label: string; tone: string }> = {
  manual: { icon: Hand, label: 'Manual', tone: 'vegetative' },
  schedule: { icon: Clock, label: 'Schedule', tone: 'flowering' },
  auto: { icon: Zap, label: 'Auto', tone: 'fruiting' },
  timer: { icon: Timer, label: 'Timer', tone: 'active' },
};

export default function Activity() {
  const nav = useNavigate();
  const { current } = useProject();
  const [events, setEvents] = useState<ActEvent[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>('all');
  const did = current?.device_id ?? 'greenhouse-01';

  const load = async () => {
    const [evs, devices] = await Promise.all([
      api.get<ActEvent[]>(`/api/devices/${did}/actuator-events?hours=336`),
      api.get<Device[]>('/api/devices'),
    ]);
    const dev = devices.find((d) => d.device_id === did);
    setNames(Object.fromEntries((dev?.actuators ?? []).map((a) => [a.key, a.name || a.key])));
    setEvents(Array.isArray(evs) ? evs : []);
  };
  useEffect(() => { load(); }, [did]);

  if (!events) return <Loading />;
  const shown = filter === 'all' ? events : events.filter((e) => (e.source ?? '') === filter);

  // group by day
  const groups: Record<string, ActEvent[]> = {};
  for (const e of shown) { const day = e.ts.slice(0, 10); (groups[day] ??= []).push(e); }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-30 bg-[#f6f8f5]/90 backdrop-blur px-4 pt-3 pb-2 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-1.5 -ml-1.5 rounded-full hover:bg-black/5"><ChevronLeft size={24} /></button>
        <div className="flex-1"><h1 className="font-bold text-leaf-800">Activity log</h1>
          <p className="text-xs text-gray-400">Proof of every pump/light/fan on & off</p></div>
        <History size={20} className="text-leaf-500" />
      </header>

      <div className="px-4">
        <div className="flex bg-gray-100 rounded-xl p-1 text-xs mb-3">
          {['all', 'schedule', 'auto', 'manual'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg capitalize font-medium ${filter === f ? 'bg-white shadow-card text-leaf-700' : 'text-gray-500'}`}>{f}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <Empty icon={<History size={40} />} title="No activity yet"
            hint="Once a schedule or automation runs (or you toggle a device), it'll appear here with the time and reason." />
        ) : (
          Object.entries(groups).map(([day, evs]) => (
            <div key={day} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 mb-2">{dayLabel(day)}</p>
              <div className="space-y-2">
                {evs.map((e) => {
                  const meta = sourceMeta[e.source ?? ''] ?? { icon: Power, label: e.source ?? '—', tone: 'active' };
                  const Icon = meta.icon;
                  const on = e.action === 'on';
                  return (
                    <Card key={e.id} className="flex items-center gap-3 !py-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${on ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-400'}`}><Power size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{names[e.actuator_key] || e.actuator_key} <span className={on ? 'text-leaf-600' : 'text-gray-400'}>{on ? 'ON' : 'OFF'}</span></p>
                        <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                          <Icon size={11} /> {meta.label}{e.reason ? ` · ${e.reason}` : ''}
                          {e.buffered && <span title="recorded offline, synced later"><HardDriveDownload size={11} className="inline text-amber-500" /></span>}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{timeLabel(e.ts)}</span>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {events.some((e) => e.buffered) && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
            <HardDriveDownload size={12} className="text-amber-500" /> = recorded on the device during an outage, synced when it reconnected.
          </p>
        )}
      </div>
    </div>
  );
}

const timeLabel = (ts: string) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
function dayLabel(day: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return 'Today';
  if (day === yest) return 'Yesterday';
  return new Date(day + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
