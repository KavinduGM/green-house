import fullLogo from '../assets/full-logo.png';

// Branded opening scene shown while the app boots.
export default function SplashLoader() {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(circle at 50% 38%, #ffffff 0%, #eef6ee 70%, #e4f0e4 100%)' }}>
      <div className="relative flex items-center justify-center">
        <span className="absolute w-56 h-56 rounded-full bg-leaf-400/20 blur-2xl animate-[pulseGlow_2.2s_ease-in-out_infinite]" />
        <img src={fullLogo} alt="PlantPulse" className="relative w-60 max-w-[72vw] animate-[logoIn_.7s_ease-out]" />
      </div>

      <div className="mt-8 flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-[dot_1s_ease-in-out_infinite]" />
        <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-[dot_1s_ease-in-out_.15s_infinite]" />
        <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-[dot_1s_ease-in-out_.3s_infinite]" />
      </div>

      <style>{`
        @keyframes logoIn { from { opacity:0; transform: scale(.86) translateY(8px) } to { opacity:1; transform:none } }
        @keyframes pulseGlow { 0%,100% { opacity:.5; transform:scale(.9) } 50% { opacity:1; transform:scale(1.08) } }
        @keyframes dot { 0%,100% { opacity:.3; transform:translateY(0) } 50% { opacity:1; transform:translateY(-5px) } }
      `}</style>
    </div>
  );
}
