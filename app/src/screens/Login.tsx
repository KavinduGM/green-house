import { useEffect, useState } from 'react';
import { Server, PlayCircle } from 'lucide-react';
import { login, setBaseUrl, getBaseUrl, enterDemo } from '../lib/api';
import fullLogo from '../assets/full-logo.png';
import { useAuth } from '../App';
import { Spinner } from '../components/ui';

export default function Login() {
  const { setAuthed } = useAuth();
  const [url, setUrl] = useState(getBaseUrl());
  const [email, setEmail] = useState('kavindu@groovymark.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setUrl(getBaseUrl()); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await setBaseUrl(url.trim());
      await login(email.trim(), password);
      setAuthed(true);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <img src={fullLogo} alt="PlantPulse" className="w-48 max-w-[60vw]" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label flex items-center gap-1.5"><Server size={14} /> Server URL (your VPS)</label>
          <input className="input" placeholder="https://your-vps-ip:8080" value={url}
            onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" inputMode="url" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="off" autoCorrect="off" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        <button className="btn-primary w-full !py-3 mt-2" disabled={busy}>
          {busy ? <Spinner /> : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-gray-200 flex-1" /><span className="text-xs text-gray-400">or</span><div className="h-px bg-gray-200 flex-1" />
      </div>
      <button className="btn-ghost w-full !py-3" onClick={async () => { await enterDemo(); setAuthed(true); }}>
        <PlayCircle size={18} /> Try the demo (no server needed)
      </button>
      <p className="text-xs text-gray-400 text-center mt-4">
        Demo mode uses sample data so you can explore every feature offline.
      </p>
    </div>
  );
}
