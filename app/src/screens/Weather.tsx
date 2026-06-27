import { useEffect, useState } from 'react';
import { CloudSun, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useProject } from '../App';
import type { Weather as Wx } from '../lib/types';
import { Loading, Empty, Card } from '../components/ui';
import { WeatherCard } from '../components/WeatherCard';

export default function Weather() {
  const { current } = useProject();
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!current) return;
    setLoading(true); setErr('');
    api.get<Wx>(`/api/projects/${current.id}/weather`)
      .then(setWx).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); const t = setInterval(load, 10 * 60_000); return () => clearInterval(t); }, [current?.id]);

  return (
    <div className="px-4 pt-4 space-y-4">
      <header><h1 className="text-xl font-bold text-leaf-800">Weather</h1>
        <p className="text-sm text-gray-400 flex items-center gap-1">
          <MapPin size={13} />{current?.location_name || 'No location set'}</p></header>

      {!current?.latitude ? (
        <Empty icon={<MapPin size={40} />} title="No location set"
          hint="Edit this project (Projects → ✏️) and pick a location to see live weather." />
      ) : loading && !wx ? (
        <Loading label="Fetching weather…" />
      ) : err ? (
        <Card className="text-sm text-red-600">{err}</Card>
      ) : wx ? (
        <>
          <WeatherCard weather={wx} />
          <Card className="text-xs text-gray-400 flex items-center gap-2">
            <CloudSun size={16} className="text-leaf-500" />
            Live data from Open-Meteo · updates every 10 min.
          </Card>
        </>
      ) : null}
    </div>
  );
}
