import React from 'react';
import { 
  Radio, 
  X, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';
import { DeviceInfo } from '../types.ts';

interface RadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  peers: { id: string; deviceInfo: DeviceInfo }[];
  onSelectPeer: (peerId: string) => void;
  currentDevice: DeviceInfo;
}

export const RadarModal: React.FC<RadarModalProps> = ({
  isOpen,
  onClose,
  peers,
  onSelectPeer,
  currentDevice
}) => {
  if (!isOpen) return null;

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-emerald-400" />;
      default:
        return <Laptop className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Radar Background Visual */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-72 h-72 border border-emerald-500/30 rounded-full flex items-center justify-center">
            <div className="w-48 h-48 border border-emerald-500/40 rounded-full flex items-center justify-center">
              <div className="w-24 h-24 border border-emerald-500/50 rounded-full"></div>
            </div>
          </div>
          {/* Radar Sweep Arm */}
          <div className="absolute w-72 h-72 rounded-full radar-sweep overflow-hidden">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-emerald-400/30 to-transparent origin-bottom-right" />
          </div>
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Local Device Radar</h3>
              <p className="text-[11px] text-slate-400">Discovering devices on your local network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Local device status */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 relative z-10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            {getDeviceIcon(currentDevice.type)}
            <div>
              <span className="text-slate-400">This Device:</span>{' '}
              <strong className="text-emerald-400">{currentDevice.name}</strong>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/40">
            Broadcasting
          </span>
        </div>

        {/* Discovered Peers List */}
        <div className="space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Devices Nearby ({peers.length})</span>
            <span className="flex items-center gap-1 text-[11px]">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> Scanning
            </span>
          </div>

          {peers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs font-semibold text-slate-300">No other devices found yet</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Open HexaSend in another browser window, phone, or computer on the same network to see it appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {peers.map(peer => (
                <div
                  key={peer.id}
                  onClick={() => {
                    onSelectPeer(peer.id);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-emerald-500/40">
                      {getDeviceIcon(peer.deviceInfo.type)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {peer.deviceInfo.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {peer.deviceInfo.browser} • {peer.deviceInfo.os}
                      </p>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-400 group-hover:text-slate-950 text-xs font-bold flex items-center gap-1 transition-all">
                    <span>Send</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security footnote */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 relative z-10">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero cloud relay
          </span>
          <span>WebRTC P2P Direct</span>
        </div>
      </div>
    </div>
  );
};
