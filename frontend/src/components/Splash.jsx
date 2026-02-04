import React, { useEffect, useState } from 'react';

// Simple splash screen overlay
// - Shows LNJPIT logo (reuse existing app icon to avoid changing assets)
// - Shows developer credit and optional developer photo if present at /developer.jpg
export default function Splash({ onDone, duration = 2000 }) {
  const [hide, setHide] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const [fzOk, setFzOk] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setHide(true);
      // allow a short fade-out before notifying parent
      const t2 = setTimeout(() => onDone?.(), 200);
      return () => clearTimeout(t2);
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div
      className={`fixed inset-0 z-[99999] select-none ${hide ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-200`}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black" />
      <div className="absolute inset-0 backdrop-blur-sm" />
      <div className="relative w-full h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center gap-4">
          {/* LNJPIT / App logo - reusing existing PWA icon to keep logo unchanged */}
          <img
            src="/icons/icon-192.png"
            width={96}
            height={96}
            alt="LNJPIT Logo"
            className="rounded-xl shadow-2xl border border-white/10"
            loading="eager"
          />
          <div className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">GatePass</div>
          <div className="flex items-center gap-3 mt-1">
            {/* Avatars cluster */}
            <div className="flex -space-x-3">
              {/* Raihan */}
              {imgOk ? (
                <img
                  src="/developer.jpg"
                  alt="Developer: MD RAIHAN"
                  className="w-12 h-12 rounded-full object-cover border border-white/10 shadow ring-2 ring-gray-900"
                  onError={() => setImgOk(false)}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-rose-500 grid place-items-center text-white font-bold border border-white/10 shadow ring-2 ring-gray-900">
                  RA
                </div>
              )}
              {/* Faizan */}
              {fzOk ? (
                <img
                  src="/faizan.jpg"
                  alt="Developer: Faizan"
                  className="w-12 h-12 rounded-full object-cover border border-white/10 shadow ring-2 ring-gray-900"
                  onError={() => setFzOk(false)}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center text-white font-bold border border-white/10 shadow ring-2 ring-gray-900">
                  FZ
                </div>
              )}
            </div>
            <div className="text-gray-200 text-sm font-semibold">Developed by: MD RAIHAN & FAIZAN</div>
          </div>
          <div className="mt-2 text-xs text-gray-400">Loading experience…</div>
        </div>
      </div>
    </div>
  );
}
