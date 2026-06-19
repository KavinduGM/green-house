import { Preferences } from '@capacitor/preferences';

// Persisted settings (token + the VPS base URL the user enters once).
let _token: string | null = null;
let _baseUrl = '';

export async function loadSettings() {
  const t = await Preferences.get({ key: 'token' });
  const b = await Preferences.get({ key: 'baseUrl' });
  _token = t.value;
  _baseUrl = b.value || guessDefaultBase();
  return { token: _token, baseUrl: _baseUrl };
}

function guessDefaultBase() {
  // On web dev, talk to local backend; on device the user sets their VPS URL.
  if (typeof location !== 'undefined' && location.hostname === 'localhost') return 'http://localhost:8080';
  return '';
}

export async function setBaseUrl(url: string) {
  _baseUrl = url.replace(/\/+$/, '');
  await Preferences.set({ key: 'baseUrl', value: _baseUrl });
}
export const getBaseUrl = () => _baseUrl;
export const getToken = () => _token;

export async function setToken(token: string | null) {
  _token = token;
  if (token) await Preferences.set({ key: 'token', value: token });
  else await Preferences.remove({ key: 'token' });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  if (!_baseUrl) throw new ApiError(0, 'Server URL not set');
  const headers: Record<string, string> = {};
  if (_token) headers.Authorization = `Bearer ${_token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) { payload = body; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch(`${_baseUrl}${path}`, { method, headers, body: payload });
  if (res.status === 401) { await setToken(null); throw new ApiError(401, 'Session expired'); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText);
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
  form: <T>(p: string, fd: FormData, method = 'POST') => request<T>(method, p, fd, true),
  uploadUrl: (p?: string) => (p ? `${_baseUrl}${p}` : ''),
};

export async function login(email: string, password: string) {
  const r = await api.post<{ token: string; email: string }>('/api/auth/login', { email, password });
  await setToken(r.token);
  return r;
}
