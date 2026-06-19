import { useEffect, useState } from 'react';
import { Sprout, Server } from 'lucide-react';
import { login, setBaseUrl, getBaseUrl } from '../lib/api';
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
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-leaf-600 flex items-center justify-center shadow-lg shadow-leaf-600/20 mb-3">
          <Sprout className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-leaf-800">Greenhouse</h1>
        <p className="text-gray-400 text-sm">Grow · Monitor · Control</p>
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
      <p className="text-xs text-gray-400 text-center mt-6">
        Enter the address where your backend runs, then your app login.
      </p>
    </div>
  );
}
