import React from 'react';
import { 
  X, 
  ShieldCheck, 
  Radio, 
  Folder, 
  History, 
  Sliders, 
  Zap, 
  Lock, 
  CheckCircle2, 
  ExternalLink,
  Info,
  Terminal,
  Cpu
} from 'lucide-react';

export interface FeatureNote {
  id: string;
  title: string;
  category: string;
  badge: string;
  summary: string;
  howToAccess: string;
  howToVerify: string;
  actionText?: string;
  actionHandler?: () => void;
}

interface FooterFeatureBubbleProps {
  note: FeatureNote | null;
  onClose: () => void;
}

export const FooterFeatureBubble: React.FC<FooterFeatureBubbleProps> = ({ note, onClose }) => {
  if (!note) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0] dark:border-[#3c4043] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-2xs">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#202124] dark:text-[#e8eaed]">
                  {note.title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/60 text-[#1a73e8] dark:text-[#8ab4f8] border border-[#d2e3fc] dark:border-blue-800">
                  {note.badge}
                </span>
              </div>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">{note.category}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Summary */}
        <div className="p-3.5 rounded-2xl bg-[#f8f9fa] dark:bg-[#2d2f31] border border-[#dadce0] dark:border-[#3c4043] text-xs text-[#3c4043] dark:text-[#bdc1c6] leading-relaxed">
          <p className="font-semibold text-[#202124] dark:text-[#e8eaed] mb-1">Feature Overview:</p>
          <p className="text-[#5f6368] dark:text-[#9aa0a6]">{note.summary}</p>
        </div>

        {/* How To Access */}
        <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 text-xs space-y-1">
          <p className="font-bold text-[#1a73e8] dark:text-[#8ab4f8] flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            How to Access:
          </p>
          <p className="text-[#3c4043] dark:text-[#bdc1c6] font-medium">{note.howToAccess}</p>
        </div>

        {/* How To Verify & Test */}
        <div className="p-3.5 rounded-2xl bg-green-50/60 dark:bg-green-950/30 border border-[#ceead6] dark:border-green-900/60 text-xs space-y-1">
          <p className="font-bold text-[#137333] dark:text-[#81c995] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853]" />
            How to Test & Verify Feature:
          </p>
          <p className="text-[#202124] dark:text-[#e8eaed] font-mono text-[11px] leading-relaxed">
            {note.howToVerify}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 pt-1">
          {note.actionText && note.actionHandler && (
            <button
              onClick={() => {
                note.actionHandler?.();
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{note.actionText}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-[#f8f9fa] dark:bg-[#2d2f31] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] text-[#3c4043] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
