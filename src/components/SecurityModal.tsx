import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  X, 
  ServerOff, 
  Cpu, 
  Wifi, 
  Binary, 
  CheckCircle2 
} from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">HexaSend Security Architecture</h3>
              <p className="text-[11px] text-slate-400">Zero-knowledge, browser-to-browser WebRTC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Item 1 */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <ServerOff className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-200">No Intermediate Cloud Storage</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Traditional services upload your files to AWS/Google Cloud storage buckets, leaving copies on remote servers. HexaSend streams byte chunks directly from one browser's RAM to the other.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <Lock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-200">DTLS 1.2 End-to-End Encryption</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                All WebRTC DataChannels are cryptographically encrypted by default using Datagram Transport Layer Security (DTLS) and AES-128-GCM cipher suites negotiated between the browsers.
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <Binary className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-200">Bit-for-Bit SHA-256 Verification</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Each transferred file is cryptographically hashed using the browser's Web Crypto API on both sides. If even a single byte differs or drops, the mismatch is detected immediately.
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <Wifi className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-200">Local Wi-Fi Line-Rate Speeds</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                When sharing between devices on the same Wi-Fi or LAN, data transfers take the shortest direct IP route at full router speeds (100MB/s+ on modern 5GHz/Wi-Fi 6), bypassing external internet bandwidth bottlenecks.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
