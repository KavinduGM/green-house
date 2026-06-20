import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { loadSettings, getToken, setToken, exitDemo } from './lib/api';
import { Loading } from './components/ui';
import BottomNav from './components/BottomNav';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Greenhouse from './screens/Greenhouse';
import Plants from './screens/Plants';
import PlantDetail from './screens/PlantDetail';
import Visualizer from './screens/Visualizer';
import Control from './screens/Control';
import Settings from './screens/Settings';

interface AuthCtx { authed: boolean; setAuthed: (v: boolean) => void; logout: () => void; }
const Ctx = createContext<AuthCtx>({ authed: false, setAuthed: () => {}, logout: () => {} });
export const useAuth = () => useContext(Ctx);

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    loadSettings().then(() => { setAuthed(!!getToken()); setReady(true); });
  }, []);

  const logout = () => { setToken(null); exitDemo(); setAuthed(false); };

  if (!ready) return <Loading label="Starting…" />;

  return (
    <Ctx.Provider value={{ authed, setAuthed, logout }}>
      {authed ? <Shell /> : <Login />}
    </Ctx.Provider>
  );
}

function Shell() {
  const loc = useLocation();
  const hideNav = loc.pathname.startsWith('/plants/') || loc.pathname === '/settings';
  return (
    <div className="max-w-md mx-auto min-h-full pb-20">
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/greenhouse" element={<Greenhouse />} />
        <Route path="/plants" element={<Plants />} />
        <Route path="/plants/:id" element={<PlantDetail />} />
        <Route path="/visualizer" element={<Visualizer />} />
        <Route path="/control" element={<Control />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}
