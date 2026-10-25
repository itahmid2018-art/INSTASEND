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
  User,
  FolderArchive,
  ArrowRightLeft,
  Grid,
  Crown
} from 'lucide-react';
import { DeviceInfo, UserProfile } from '../types.ts';
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
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  activeView: 'transfer' | 'files';
  onViewChange: (view: 'transfer' | 'files') => void;
  managedFilesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  deviceInfo,
  onUpdateDeviceName,
  radarPeerCount,
  onOpenRadar,
  onOpenHistory,
  onOpenSecurity,
  historyCount,
  currentUser,
  onOpenAuth,
  activeView,
  onViewChange,
  managedFilesCount
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
        return <Smartphone className="w-3.5 h-3.5 text-[#4285F4]" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-[#34A853]" />;
      default:
        return <Laptop className="w-3.5 h-3.5 text-[#4285F4]" />;
    }
  };

  return (
    <header className="bg-white border-b border-[#dadce0] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Google Homepage Style Top Links */}
        <div className="flex items-center gap-6">
          <div 
            className="flex items-center gap-1 cursor-pointer select-none group" 
            onClick={() => onViewChange('transfer')}
          >
            {/* Google Multicolor Brand Wordmark */}
            <span className="text-xl sm:text-2xl font-bold tracking-tight">
              <span className="text-[#4285F4]">I</span>
              <span className="text-[#EA4335]">n</span>
              <span className="text-[#FBBC05]">s</span>
              <span className="text-[#4285F4]">t</span>
              <span className="text-[#34A853]">a</span>
              <span className="text-[#EA4335]">S</span>
              <span className="text-[#FBBC05]">e</span>
              <span className="text-[#4285F4]">n</span>
              <span className="text-[#34A853]">d</span>
            </span>
          </div>

          {/* Navigation items like Google 'Images' / 'Maps' */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => onViewChange('transfer')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeView === 'transfer'
                  ? 'bg-blue-50 text-[#1a73e8] font-semibold'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              Transfer
            </button>
            <button
              onClick={() => onViewChange('files')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
                activeView === 'files'
                  ? 'bg-blue-50 text-[#1a73e8] font-semibold'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              <span>Files</span>
              {managedFilesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-[#e8f0fe] text-[#1a73e8] font-semibold">
                  {managedFilesCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Right: Google Homepage Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Device Nickname Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#3c4043]">
            {getDeviceIcon()}
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-white border border-[#1a73e8] rounded px-1.5 py-0.5 text-xs text-[#202124] focus:outline-none w-28"
                  autoFocus
                />
                <button onClick={saveName} className="text-[#1a73e8]">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                <span className="max-w-[120px] truncate font-medium">{deviceInfo.name}</span>
                <Edit2 className="w-3 h-3 text-[#5f6368] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Radar Button */}
          <button
            onClick={onOpenRadar}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              radarPeerCount > 0
                ? 'bg-green-50 text-[#188038] border border-[#ceead6]'
                : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
            }`}
            title="Local Radar Discovery"
          >
            <Radio className={`w-3.5 h-3.5 ${radarPeerCount > 0 ? 'text-[#34a853] animate-pulse' : 'text-[#5f6368]'}`} />
            <span className="hidden sm:inline">Radar</span>
            {radarPeerCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#34a853] text-white">
                {radarPeerCount}
              </span>
            )}
          </button>

          {/* History Link */}
          <button
            onClick={onOpenHistory}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            title="Transfer History"
          >
            <History className="w-3.5 h-3.5 text-[#5f6368]" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="text-[11px] text-[#5f6368]">({historyCount})</span>
            )}
          </button>

          {/* Security Pill */}
          <button
            onClick={onOpenSecurity}
            className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#188038] hover:bg-green-50 transition-colors"
            title="End-to-End Security Architecture"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#34a853]" />
            <span>Encrypted</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            title={soundEnabled ? 'Mute Audio Chimes' : 'Enable Audio Chimes'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#1a73e8]" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Google 9-Dots Apps Menu Icon */}
          <div 
            onClick={onOpenSecurity}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] cursor-pointer transition-colors"
            title="InstaSend Features"
          >
            <Grid className="w-4 h-4" />
          </div>

          {/* Google-style 'Sign In' Button or Profile Avatar */}
          <button
            onClick={onOpenAuth}
            className={`flex items-center gap-2 transition-all cursor-pointer ${
              currentUser
                ? 'p-0.5 rounded-full hover:ring-2 hover:ring-[#1a73e8]/30'
                : 'px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[13px] font-medium shadow-xs'
            }`}
          >
            {currentUser ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] relative">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {currentUser.plan === 'pro' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#fbbc05] border border-white rounded-full flex items-center justify-center">
                    <Crown className="w-2 h-2 text-white fill-white" />
                  </span>
                )}
              </div>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
