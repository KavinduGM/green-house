import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Server, LogOut, Sparkles, Send, Bot } from 'lucide-react';
import { api, getBaseUrl, setBaseUrl } from '../lib/api';
import { useAuth } from '../App';
import { Card, Field, Spinner } from '../components/ui';

export default function Settings() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const [url, setUrl] = useState(getBaseUrl());
  const [saved, setSaved] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);

  useEffect(() => { api.get<{ enabled: boolean }>('/api/ai/status').then((r) => setAi(r.enabled)).catch(() => setAi(false)); }, []);

  const saveUrl = async () => { await setBaseUrl(url.trim()); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <div className="pb-10">
      <header className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="p-1.5 -ml-1.5 rounded-full hover:bg-black/5"><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-leaf-800 text-lg">Settings</h1>
      </header>

      <div className="px-4 space-y-4">
        <Assistant />

        <Card>
          <Field label="Server URL">
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" inputMode="url" />
          </Field>
          <button className="btn-ghost w-full mt-3" onClick={saveUrl}><Server size={16} /> {saved ? 'Saved ✓' : 'Save server URL'}</button>
        </Card>

        <Card className="flex items-center gap-3">
          <Sparkles size={20} className={ai ? 'text-leaf-600' : 'text-gray-300'} />
          <div className="flex-1"><p className="font-medium text-sm">AI engine</p>
            <p className="text-xs text-gray-400">{ai == null ? 'checking…' : ai ? 'Connected (Claude)' : 'Not configured on server'}</p></div>
          <span className={`chip ${ai ? 'bg-leaf-50 text-leaf-700' : 'bg-gray-100 text-gray-400'}`}>{ai ? 'On' : 'Off'}</span>
        </Card>

        <button className="btn-danger w-full" onClick={() => { logout(); nav('/'); }}><LogOut size={18} /> Sign out</button>

        <p className="text-center text-xs text-gray-300">Greenhouse v1.0 · groovymark</p>
      </div>
    </div>
  );
}

function Assistant() {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<{ role: 'you' | 'ai'; text: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    const question = q.trim();
    setMsgs((m) => [...m, { role: 'you', text: question }]); setQ(''); setBusy(true);
    try {
      const r = await api.post<{ answer: string }>('/api/ai/ask', { question });
      setMsgs((m) => [...m, { role: 'ai', text: r.answer }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'ai', text: e.message }]);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2"><Bot size={18} className="text-leaf-600" /><span className="font-semibold text-sm">Ask the greenhouse</span></div>
      {msgs.length > 0 && (
        <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`text-sm rounded-xl px-3 py-2 ${m.role === 'you' ? 'bg-leaf-600 text-white ml-8' : 'bg-gray-100 text-gray-700 mr-4'}`}>{m.text}</div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="e.g. When should I prune tomatoes?" />
        <button className="btn-primary !px-3" onClick={ask} disabled={busy}>{busy ? <Spinner /> : <Send size={18} />}</button>
      </div>
    </Card>
  );
}
