import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Sprout, Eye, ToggleLeft, CloudSun } from 'lucide-react';

export default function BottomNav({ hasIot }: { hasIot: boolean }) {
  const items = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/greenhouse', icon: Map, label: 'Layout' },
    { to: '/plants', icon: Sprout, label: 'Plants' },
    { to: '/visualizer', icon: Eye, label: 'Visual' },
    hasIot
      ? { to: '/control', icon: ToggleLeft, label: 'Control' }
      : { to: '/weather', icon: CloudSun, label: 'Weather' },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-black/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto grid grid-cols-5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                isActive ? 'text-leaf-600' : 'text-gray-400'
              }`}>
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
