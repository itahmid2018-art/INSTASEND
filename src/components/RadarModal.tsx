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
        return <Smartphone className="w-5 h-5 text-[#4285F4]" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-[#34A853]" />;
      default:
        return <Laptop className="w-5 h-5 text-[#4285F4]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Google 4-Color Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">Local Device Radar</h3>
              <p className="text-xs text-[#5f6368]">Discovering devices on your local network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local device status */}
        <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            {getDeviceIcon(currentDevice.type)}
            <div>
              <span className="text-[#5f6368]">This Device:</span>{' '}
              <strong className="text-[#202124]">{currentDevice.name}</strong>
            </div>
          </div>
          <span className="text-[11px] font-medium text-[#137333] bg-green-50 px-2.5 py-0.5 rounded-full border border-[#ceead6]">
            Active
          </span>
        </div>

        {/* Discovered Peers List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5f6368] px-1">
            <span>Devices Nearby ({peers.length})</span>
            <span className="flex items-center gap-1 text-[11px] text-[#1a73e8]">
              <RefreshCw className="w-3 h-3 animate-spin" /> Scanning
            </span>
          </div>

          {peers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#f8f9fa] border border-[#dadce0] space-y-2">
              <div className="w-12 h-12 rounded-full bg-white border border-[#dadce0] flex items-center justify-center mx-auto text-[#1a73e8]">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs font-semibold text-[#202124]">No other devices detected yet</p>
              <p className="text-[11px] text-[#5f6368] max-w-xs mx-auto">
                Open InstaSend in another browser or phone on the same Wi-Fi network to see it appear here.
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
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-center group-hover:border-[#1a73e8]">
                      {getDeviceIcon(peer.deviceInfo.type)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#202124] group-hover:text-[#1a73e8] transition-colors">
                        {peer.deviceInfo.name}
                      </p>
                      <p className="text-[11px] text-[#5f6368]">
                        {peer.deviceInfo.browser} • {peer.deviceInfo.os}
                      </p>
                    </div>
                  </div>

                  <button className="px-3.5 py-1.5 rounded-full bg-blue-50 group-hover:bg-[#1a73e8] text-[#1a73e8] group-hover:text-white text-xs font-medium flex items-center gap-1 transition-all">
                    <span>Send</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security footnote */}
        <div className="pt-2 border-t border-[#dadce0] flex items-center justify-between text-[11px] text-[#5f6368]">
          <span className="flex items-center gap-1 text-[#137333]">
            <ShieldCheck className="w-3.5 h-3.5" /> Direct P2P Link
          </span>
          <span>Zero Server Storage</span>
        </div>
      </div>
    </div>
  );
};
