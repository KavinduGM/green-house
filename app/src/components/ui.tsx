import { ReactNode, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={18} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-leaf-600 gap-2">
      <Spinner className="w-6 h-6" />
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="text-leaf-300 mb-3">{icon}</div>}
      <p className="font-medium text-gray-700">{title}</p>
      {hint && <p className="text-sm text-gray-400 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1">
      <h2 className="text-[15px] font-semibold text-gray-700">{children}</h2>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto animate-[slideUp_.2s_ease]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X size={20} /></button>
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:.6}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}

const stageColors: Record<string, string> = {
  seed: 'bg-amber-50 text-amber-700', vegetative: 'bg-leaf-50 text-leaf-700',
  flowering: 'bg-pink-50 text-pink-600', fruiting: 'bg-orange-50 text-orange-600',
  mature: 'bg-purple-50 text-purple-700', active: 'bg-leaf-50 text-leaf-700',
  harvested: 'bg-gray-100 text-gray-500', removed: 'bg-gray-100 text-gray-400',
};
export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`chip ${stageColors[tone ?? 'active'] ?? 'bg-gray-100 text-gray-600'}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
