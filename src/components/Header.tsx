import React, { useState } from 'react';
import { 
  Menu, 
  X, 
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
  Crown,
  LogOut,
  Send,
  Folder,
  Sliders,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { DeviceInfo, UserProfile } from '../types.ts';
import { sound } from '../services/sound.ts';
import { setCustomDeviceName } from '../services/device.ts';
import { PaperPlaneLogo } from './PaperPlaneLogo.tsx';

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
  activeView: 'transfer' | 'files' | 'admin';
  onViewChange: (view: 'transfer' | 'files' | 'admin') => void;
  onGoHome?: () => void;
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
  onGoHome,
  managedFilesCount
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
        return <Smartphone className="w-4 h-4 text-[#4285F4]" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-[#34A853]" />;
      default:
        return <Laptop className="w-4 h-4 text-[#4285F4]" />;
    }
  };

  const handleHomeClick = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      onViewChange('transfer');
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const handleNavClick = (view: 'transfer' | 'files' | 'admin') => {
    if (view === 'transfer') {
      handleHomeClick();
    } else {
      onViewChange(view);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-[#dadce0] shadow-xs">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-50 bg-white/95 backdrop-blur-md">
        {/* Left: Pure Flying Paper Plane Logo with Scroll-to-Top and Home Reset */}
        <div 
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 cursor-pointer select-none group shrink-0 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] rounded-2xl" 
          onClick={handleHomeClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleHomeClick();
            }
          }}
          title="InstaSend Home (Scroll to Top)"
        >
          <div className="p-1.5 rounded-2xl bg-blue-50/60 border border-blue-100 group-hover:bg-blue-100/70 group-hover:scale-105 transition-all">
            <PaperPlaneLogo size={32} />
          </div>
        </div>

        {/* Center: App Name "InstaSend" and Subtitle Statement */}
        <div 
          role="button"
          tabIndex={0}
          className="flex flex-col items-center justify-center text-center cursor-pointer select-none px-2 mx-auto focus:outline-none focus:ring-2 focus:ring-[#1a73e8] rounded-xl group"
          onClick={handleHomeClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleHomeClick();
            }
          }}
          title="InstaSend Home (Scroll to Top)"
        >
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight group-hover:opacity-90 transition-opacity">
            <span className="text-[#4285F4]">I</span>
            <span className="text-[#EA4335]">n</span>
            <span className="text-[#FBBC05]">s</span>
            <span className="text-[#4285F4]">t</span>
            <span className="text-[#34A853]">a</span>
            <span className="text-[#EA4335]">S</span>
            <span className="text-[#FBBC05]">e</span>
            <span className="text-[#4285F4]">n</span>
            <span className="text-[#34A853]">d</span>
          </h1>
          <p className="text-[10px] sm:text-[11px] text-[#5f6368] font-normal leading-none hidden sm:block mt-0.5">
            Direct, encrypted peer-to-peer file transfer via WebRTC
          </p>
        </div>

        {/* Right: Hamburger Menu Trigger Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Peer Indicator Pill if peers in radar */}
          {radarPeerCount > 0 && (
            <button
              onClick={onOpenRadar}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-[#188038] border border-[#ceead6] text-xs font-semibold hover:bg-green-100 transition-colors cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[#34a853] animate-pulse" />
              <span>{radarPeerCount} Peer{radarPeerCount > 1 ? 's' : ''}</span>
            </button>
          )}

          {/* User Avatar preview badge if signed in */}
          {currentUser && (
            <button
              onClick={() => setIsMenuOpen(true)}
              className="w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] focus:outline-none hover:ring-2 hover:ring-[#1a73e8]/40 transition-all"
              title={currentUser.name}
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          )}

          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] active:bg-[#e8eaed] transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <X className="w-5 h-5 text-[#202124]" /> : <Menu className="w-5 h-5 text-[#202124]" />}
          </button>
        </div>
      </div>

      {/* Slide-out Hamburger Menu Drawer Overlay & Content */}
      {isMenuOpen && (
        <>
          {/* Backdrop Blur overlay */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity animate-in fade-in"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Hamburger Dropdown / Drawer Panel */}
          <div className="fixed top-16 right-0 w-full max-w-sm bg-white border-l border-b border-[#dadce0] shadow-2xl z-50 overflow-y-auto max-h-[calc(100vh-4rem)] animate-in slide-in-from-right duration-200">
            <div className="p-5 space-y-5">
              
              {/* SECTION 1: Account / Sign In Header Card */}
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] space-y-3">
                {currentUser ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-[#dadce0] shrink-0">
                        {currentUser.avatar ? (
                          <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-sm">
                            {currentUser.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-[#202124] truncate">{currentUser.name}</p>
                          {currentUser.plan === 'pro' && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded-full bg-[#fbbc05] text-white flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5 fill-current" /> Pro
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5f6368] truncate">{currentUser.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onOpenAuth();
                        setIsMenuOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] transition-colors cursor-pointer"
                    >
                      Account
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#202124]">User Account</p>
                      <p className="text-[11px] text-[#5f6368]">Sync transfer stats across devices</p>
                    </div>
                    <button
                      onClick={() => {
                        onOpenAuth();
                        setIsMenuOpen(false);
                      }}
                      className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 2: Primary View Navigation */}
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider font-bold text-[#70757a] px-2 mb-1">
                  Navigation
                </p>

                <button
                  onClick={() => handleNavClick('transfer')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeView === 'transfer'
                      ? 'bg-blue-50 text-[#1a73e8] font-bold'
                      : 'text-[#202124] hover:bg-[#f8f9fa]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Send className="w-4 h-4 text-[#1a73e8]" />
                    <span>File Transfer</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#70757a]" />
                </button>

                <button
                  onClick={() => handleNavClick('files')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeView === 'files'
                      ? 'bg-blue-50 text-[#1a73e8] font-bold'
                      : 'text-[#202124] hover:bg-[#f8f9fa]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-[#34A853]" />
                    <span>My Files</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {managedFilesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#e8f0fe] text-[#1a73e8] font-bold">
                        {managedFilesCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#70757a]" />
                  </div>
                </button>

                <button
                  onClick={() => handleNavClick('admin')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeView === 'admin'
                      ? 'bg-purple-50 text-purple-700 font-bold'
                      : 'text-[#202124] hover:bg-[#f8f9fa]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    <span>Admin Portal (/admin)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#70757a]" />
                </button>
              </div>

              {/* SECTION 3: Device Nickname & Discovery */}
              <div className="pt-2 border-t border-[#f1f3f4] space-y-2">
                <p className="text-[11px] uppercase tracking-wider font-bold text-[#70757a] px-2">
                  Device & Mesh Network
                </p>

                {/* Editable Device Name */}
                <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getDeviceIcon()}
                    <div className="min-w-0">
                      <span className="text-[10px] text-[#5f6368] block">This Device Name</span>
                      {isEditingName ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveName()}
                            className="bg-white border border-[#1a73e8] rounded px-1.5 py-0.5 text-xs text-[#202124] focus:outline-none w-28"
                            autoFocus
                          />
                          <button onClick={saveName} className="p-1 text-[#1a73e8]">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="font-semibold text-[#202124] truncate">{deviceInfo.name}</p>
                      )}
                    </div>
                  </div>

                  {!isEditingName && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1.5 text-[#5f6368] hover:text-[#1a73e8] hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="Rename Device"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Radar Discovery */}
                <button
                  onClick={() => {
                    onOpenRadar();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium text-[#202124] hover:bg-[#f8f9fa] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Radio className={`w-4 h-4 ${radarPeerCount > 0 ? 'text-[#34a853] animate-pulse' : 'text-[#5f6368]'}`} />
                    <span>Local Peer Radar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {radarPeerCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-50 text-[#188038] font-bold border border-[#ceead6]">
                        {radarPeerCount} Online
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#70757a]">Scanning</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#70757a]" />
                  </div>
                </button>
              </div>

              {/* SECTION 4: Security, History & Sound Settings */}
              <div className="pt-2 border-t border-[#f1f3f4] space-y-1">
                <p className="text-[11px] uppercase tracking-wider font-bold text-[#70757a] px-2 mb-1">
                  Tools & Security
                </p>

                {/* History Link */}
                <button
                  onClick={() => {
                    onOpenHistory();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium text-[#202124] hover:bg-[#f8f9fa] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-[#5f6368]" />
                    <span>Transfer History</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {historyCount > 0 && (
                      <span className="text-[11px] text-[#5f6368]">({historyCount})</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#70757a]" />
                  </div>
                </button>

                {/* Security Link */}
                <button
                  onClick={() => {
                    onOpenSecurity();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium text-[#202124] hover:bg-[#f8f9fa] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#34A853]" />
                    <span>End-to-End Encryption</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#137333] bg-green-50 px-2 py-0.5 rounded-full border border-[#ceead6]">
                    DTLS 1.2
                  </span>
                </button>

                {/* Sound Toggle */}
                <button
                  onClick={toggleSound}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium text-[#202124] hover:bg-[#f8f9fa] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-[#1a73e8]" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-[#70757a]" />
                    )}
                    <span>Audio Chimes</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${soundEnabled ? 'text-[#1a73e8]' : 'text-[#70757a]'}`}>
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </span>
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </header>
  );
};
