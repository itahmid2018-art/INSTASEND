import React, { useState } from 'react';
import { 
  Radio, 
  History, 
  Volume2, 
  VolumeX, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Edit2, 
  Check, 
  ShieldCheck,
  Wifi
} from 'lucide-react';
import { DeviceInfo } from '../types.ts';
import { sound } from '../services/sound.ts';
import { setCustomDeviceName } from '../services/device.ts';

interface HeaderProps {
  deviceInfo: DeviceInfo;
  onUpdateDeviceName: (newName: string) => void;
  radarPeerCount: number;
  onOpenRadar: () => void;
  onOpenHistory: () => void;
  onOpenSecurity: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  deviceInfo,
  onUpdateDeviceName,
  radarPeerCount,
  onOpenRadar,
  onOpenHistory,
  onOpenSecurity,
  historyCount
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceInfo.name);
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());

  const toggleSound = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
    if (next) sound.playConnect();
  };

  const saveName = () => {
    if (tempName.trim()) {
      setCustomDeviceName(tempName);
      onUpdateDeviceName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const getDeviceIcon = () => {
    switch (deviceInfo.type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-emerald-400" />;
      default:
        return <Laptop className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2" />
                  <path d="m16 10-4 4-4-4" />
                  <path d="M12 14V6" />
                </svg>
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                HEXA<span className="text-emerald-400">SEND</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                P2P WebRTC
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Direct device-to-device secure sharing
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Device Nickname Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            {getDeviceIcon()}
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-slate-800 border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none w-32"
                  autoFocus
                />
                <button onClick={saveName} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                <span className="max-w-[130px] truncate font-medium text-slate-200">{deviceInfo.name}</span>
                <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Radar / Nearby Button */}
          <button
            onClick={onOpenRadar}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              radarPeerCount > 0
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Local Radar Discovery"
          >
            <Radio className={`w-3.5 h-3.5 ${radarPeerCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Radar</span>
            {radarPeerCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950">
                {radarPeerCount}
              </span>
            )}
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white text-xs font-medium transition-colors"
            title="Transfer History"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="text-[10px] font-semibold text-slate-400">({historyCount})</span>
            )}
          </button>

          {/* Security Guarantee Pill */}
          <button
            onClick={onOpenSecurity}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-emerald-400 hover:bg-slate-800 text-xs font-medium transition-colors"
            title="End-to-End Security Architecture"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-slate-300">Encrypted</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
