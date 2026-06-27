import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { loadSettings, getToken, setToken, exitDemo, api, getProjectId, setProjectId } from './lib/api';
import type { Project } from './lib/types';
import { Loading } from './components/ui';
import BottomNav from './components/BottomNav';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Greenhouse from './screens/Greenhouse';
import Plants from './screens/Plants';
import PlantDetail from './screens/PlantDetail';
import Visualizer from './screens/Visualizer';
import Control from './screens/Control';
import Activity from './screens/Activity';
import Weather from './screens/Weather';
import Settings from './screens/Settings';
import { Onboarding, ProjectsScreen } from './screens/Projects';

interface AuthCtx { authed: boolean; setAuthed: (v: boolean) => void; logout: () => void; }
const Ctx = createContext<AuthCtx>({ authed: false, setAuthed: () => {}, logout: () => {} });
export const useAuth = () => useContext(Ctx);

interface ProjCtx { projects: Project[]; current: Project | null; switchProject: (id: number) => void; reload: () => void; }
const PCtx = createContext<ProjCtx>({ projects: [], current: null, switchProject: () => {}, reload: () => {} });
export const useProject = () => useContext(PCtx);

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    loadSettings().then(() => { setAuthed(!!getToken()); setReady(true); });
  }, []);

  const logout = () => { setToken(null); exitDemo(); setProjectId(null); setAuthed(false); };

  if (!ready) return <Loading label="Starting…" />;

  return (
    <Ctx.Provider value={{ authed, setAuthed, logout }}>
      {authed ? <ProjectArea /> : <Login />}
    </Ctx.Provider>
  );
}

function ProjectArea() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [current, setCurrent] = useState<Project | null>(null);

  const reload = async () => {
    const ps = await api.get<Project[]>('/api/projects');
    setProjects(ps);
    if (ps.length) {
      const saved = getProjectId();
      const cur = ps.find((p) => p.id === saved) ?? ps[0];
      await setProjectId(cur.id);
      setCurrent(cur);
    } else {
      setCurrent(null);
    }
  };
  useEffect(() => { reload(); }, []);

  const switchProject = async (id: number) => {
    const p = projects?.find((x) => x.id === id);
    if (!p) return;
    await setProjectId(id);
    setCurrent(p);
  };

  if (projects === null) return <Loading />;
  if (projects.length === 0) return <Onboarding onCreated={reload} />;
  if (!current) return <Loading />;

  return (
    <PCtx.Provider value={{ projects, current, switchProject, reload }}>
      <Shell key={current.id} hasIot={current.has_iot} />
    </PCtx.Provider>
  );
}

function Shell({ hasIot }: { hasIot: boolean }) {
  const loc = useLocation();
  const { projects, current, switchProject, reload } = useProject();
  const hideNav = loc.pathname.startsWith('/plants/') || loc.pathname === '/settings' || loc.pathname === '/activity';
  return (
    <div className="max-w-md mx-auto min-h-full pb-20">
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/greenhouse" element={<Greenhouse />} />
        <Route path="/plants" element={<Plants />} />
        <Route path="/plants/:id" element={<PlantDetail />} />
        <Route path="/visualizer" element={<Visualizer />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/control" element={hasIot ? <Control /> : <Navigate to="/weather" replace />} />
        <Route path="/activity" element={hasIot ? <Activity /> : <Navigate to="/dashboard" replace />} />
        <Route path="/projects" element={
          <ProjectsScreen projects={projects} currentId={current!.id}
            onSwitch={(id) => switchProject(id)} onChanged={reload} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      {!hideNav && <BottomNav hasIot={hasIot} />}
    </div>
  );
}
