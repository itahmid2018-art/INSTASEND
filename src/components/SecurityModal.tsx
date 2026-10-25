import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  X, 
  ServerOff, 
  Wifi, 
  Binary 
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Google 4-Color Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">Security Architecture</h3>
              <p className="text-xs text-[#5f6368]">Zero-knowledge, browser-to-browser WebRTC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-start gap-3">
            <ServerOff className="w-5 h-5 text-[#34A853] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#202124]">Zero Intermediate Storage</h4>
              <p className="text-[#5f6368] mt-0.5 leading-relaxed">
                Traditional cloud platforms store file copies on central servers. InstaSend streams raw byte packets directly from RAM to RAM via WebRTC DataChannels.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#1a73e8] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#202124]">DTLS 1.2 End-to-End Encryption</h4>
              <p className="text-[#5f6368] mt-0.5 leading-relaxed">
                All data channels are authenticated and encrypted using Datagram Transport Layer Security (DTLS) and AES-128-GCM cipher suites negotiated between browsers.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-start gap-3">
            <Binary className="w-5 h-5 text-[#FBBC05] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#202124]">SHA-256 Checksum Verification</h4>
              <p className="text-[#5f6368] mt-0.5 leading-relaxed">
                Every file received is verified bit-for-bit with Web Crypto SHA-256 hashes to guarantee complete data integrity.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-start gap-3">
            <Wifi className="w-5 h-5 text-[#EA4335] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#202124]">Local Wi-Fi Line-Rate Speeds</h4>
              <p className="text-[#5f6368] mt-0.5 leading-relaxed">
                When sharing on the same local network, data takes the shortest local IP route at router wire speed, bypassing the internet.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
