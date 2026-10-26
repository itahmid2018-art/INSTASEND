import React, { useState, useEffect } from 'react';
import { PaperPlaneLogo } from './PaperPlaneLogo.tsx';
import { ShieldCheck, Zap, Wifi } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  minimumDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minimumDurationMs = 1600
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25 + 15);
      });
    }, 180);

    // Fade out sequence
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        onFinish?.();
      }, 400); // match transition duration
    }, minimumDurationMs);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [minimumDurationMs, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-100 flex flex-col items-center justify-between bg-white text-[#202124] select-none transition-opacity duration-400 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top Subtle Status Line */}
      <div className="w-full pt-8 px-6 flex items-center justify-between text-[11px] text-[#70757a] max-w-lg mx-auto">
        <span className="flex items-center gap-1.5 text-[#137333] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#34A853]" />
          InstaSend PWA Native
        </span>
        <span className="flex items-center gap-1 text-[#5f6368] font-mono">
          <Wifi className="w-3 h-3 text-[#1a73e8]" /> Local WebRTC Mesh
        </span>
      </div>

      {/* Main Center Stage Branding */}
      <div className="flex flex-col items-center text-center space-y-6 my-auto px-4">
        {/* Animated Flying Paper Plane Logo Container */}
        <div className="relative group">
          <div className="absolute -inset-4 rounded-full bg-blue-100/50 blur-xl animate-pulse" />
          <div className="relative p-6 rounded-3xl bg-blue-50/80 border border-blue-100 shadow-lg transform transition-transform duration-500 hover:scale-105">
            <PaperPlaneLogo size={80} />
          </div>
        </div>

        {/* Multi-Colored Google Style App Name */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
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

          <p className="text-xs sm:text-sm text-[#5f6368] font-medium max-w-xs sm:max-w-md mx-auto leading-relaxed">
            Direct, encrypted peer-to-peer file transfer via WebRTC
          </p>
        </div>

        {/* Smooth Progress Bar & Boot Status */}
        <div className="w-64 space-y-2 pt-4">
          <div className="w-full bg-[#f1f3f4] h-1.5 rounded-full overflow-hidden border border-[#dadce0]/50">
            <div
              className="bg-[#1a73e8] h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#70757a] font-mono">
            <span>Initializing P2P Engine...</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Footer Branding Note */}
      <div className="pb-8 text-center text-[11px] text-[#70757a] space-y-1">
        <p className="flex items-center justify-center gap-1 text-[#3c4043] font-medium">
          <Zap className="w-3 h-3 text-[#fbbc05] fill-current" />
          Zero Cloud Storage • RAM-to-RAM DataChannel
        </p>
        <p className="text-[10px]">DTLS 1.2 End-to-End Encrypted Architecture</p>
      </div>
    </div>
  );
};
