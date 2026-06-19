import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Sprout } from 'lucide-react';
import { api } from '../lib/api';
import type { VisualizerItem } from '../lib/types';
import { Loading, Empty, Card } from '../components/ui';
import PlantSprite from '../components/PlantSprite';

export default function Visualizer() {
  const [items, setItems] = useState<VisualizerItem[] | null>(null);
  const [mode, setMode] = useState<'expected' | 'actual'>('expected');
  const [group, setGroup] = useState(false);

  useEffect(() => { api.get<VisualizerItem[]>('/api/visualizer').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <Loading />;

  // shared vertical scale so plants are comparable
  const scaleMax = Math.max(40, ...items.map((i) => i.maxHeightCm));

  const list = group
    ? Object.values(items.reduce((acc: Record<string, VisualizerItem[]>, it) => {
        (acc[it.plant_type_key] ??= []).push(it); return acc;
      }, {})).flat()
    : items;

  return (
    <div className="px-4 pt-4 space-y-4">
      <header><h1 className="text-xl font-bold text-leaf-800">Visual compare</h1>
        <p className="text-sm text-gray-400">2D view of each plant — see who's tall and who's behind.</p></header>

      {items.length === 0 ? (
        <Empty icon={<Eye size={40} />} title="No active plants to show" hint="Add plantings, then come back to compare them visually." />
      ) : (
        <>
          <div className="flex gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1 text-sm flex-1">
              {(['expected', 'actual'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1.5 rounded-lg capitalize font-medium ${mode === m ? 'bg-white shadow-card text-leaf-700' : 'text-gray-500'}`}>{m} size</button>
              ))}
            </div>
            <button onClick={() => setGroup((g) => !g)} className={`px-3 rounded-xl text-sm font-medium ${group ? 'bg-leaf-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Group</button>
          </div>

          <Card>
            <div className="flex items-end gap-1 overflow-x-auto no-scrollbar pb-2" style={{ minHeight: 200 }}>
              {list.map((it) => {
                const h = mode === 'actual' ? (it.actualHeightCm ?? it.expectedHeightCm) : it.expectedHeightCm;
                return (
                  <Link to={`/plants/${it.id}`} key={it.id} className="shrink-0 flex flex-col items-center w-[88px]">
                    <PlantSprite form={it.form} heightCm={h} scaleMaxCm={scaleMax}
                      leafColor={it.leafColor} fruitColor={it.fruitColor} stage={it.stage} width={84} height={140} />
                    <p className="text-[11px] font-medium text-gray-700 truncate w-full text-center">{it.name}</p>
                    <p className="text-[10px] text-gray-400">{Math.round(h)} cm · {it.stage}</p>
                  </Link>
                );
              })}
            </div>
            {/* scale ticks */}
            <div className="flex justify-between text-[10px] text-gray-300 border-t border-gray-100 pt-1 mt-1">
              <span>0</span><span>{Math.round(scaleMax / 2)} cm</span><span>{scaleMax} cm (scale)</span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {list.map((it) => (
              <Card key={it.id} className="!p-3 flex items-center gap-2">
                <Sprout size={16} className="text-leaf-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{it.name}</p>
                  <p className="text-[10px] text-gray-400">exp {it.expectedHeightCm}cm · act {it.actualHeightCm ?? '—'}cm</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
