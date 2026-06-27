import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { ChevronLeft, Server, LogOut, Sparkles, Send, Bot, Cpu, UploadCloud, Layers, ChevronRight } from 'lucide-react';
import { api, getBaseUrl, setBaseUrl } from '../lib/api';
import { useAuth, useProject } from '../App';
import { Card, Field, Spinner } from '../components/ui';

export default function Settings() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const { current } = useProject();
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
        <button className="w-full" onClick={() => nav('/projects')}>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leaf-50 text-leaf-600 flex items-center justify-center"><Layers size={20} /></div>
            <div className="flex-1 text-left"><p className="font-medium text-sm">Projects</p>
              <p className="text-xs text-gray-400 truncate">Current: {current?.name ?? '—'}</p></div>
            <ChevronRight size={18} className="text-gray-300" />
          </Card>
        </button>

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

        {current?.has_iot && <FirmwareOta deviceId={current.device_id || 'greenhouse-01'} />}

        <button className="btn-danger w-full" onClick={() => { logout(); nav('/'); }}><LogOut size={18} /> Sign out</button>

        <p className="text-center text-xs text-gray-300">PlantPulse v1.0 · groovymark</p>
      </div>
    </div>
  );
}

function FirmwareOta({ deviceId }: { deviceId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('firmware', f);
      const r = await api.form<{ ok: boolean; online: boolean; size: number }>(`/api/devices/${deviceId}/ota`, fd);
      setMsg({
        ok: true,
        text: r.online
          ? `Pushed ${(r.size / 1024).toFixed(0)} KB. The board is downloading & will reboot in ~30s.`
          : `Uploaded ${(r.size / 1024).toFixed(0)} KB, but the board is OFFLINE — it'll update when it next connects.`,
      });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Upload failed' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1"><Cpu size={18} className="text-leaf-600" /><span className="font-semibold text-sm">Firmware update (OTA)</span></div>
      <p className="text-xs text-gray-400 mb-3">Upload a compiled <code>.bin</code> to update the ESP32 over the internet — no cable needed.</p>
      <input ref={fileRef} type="file" accept=".bin" hidden onChange={onPick} />
      <button className="btn-ghost w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Spinner /> : <UploadCloud size={18} />} {busy ? 'Uploading…' : 'Choose firmware .bin'}
      </button>
      {msg && <p className={`text-sm mt-2 rounded-lg px-3 py-2 ${msg.ok ? 'bg-leaf-50 text-leaf-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
    </Card>
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
