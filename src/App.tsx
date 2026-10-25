import React, { useState, useEffect, useRef } from 'react';
import { 
  Send as SendIcon, 
  Download, 
  Radio, 
  ShieldCheck, 
  Lock, 
  Zap, 
  Smartphone, 
  Laptop, 
  ArrowUpRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { SendTab } from './components/SendTab.tsx';
import { ReceiveTab } from './components/ReceiveTab.tsx';
import { RadarModal } from './components/RadarModal.tsx';
import { HistoryModal } from './components/HistoryModal.tsx';
import { SecurityModal } from './components/SecurityModal.tsx';
import { WebRTCManager } from './services/webrtc.ts';
import { getLocalDeviceInfo, formatBytes } from './services/device.ts';
import { sound } from './services/sound.ts';
import { 
  DeviceInfo, 
  FileItem, 
  TransferMetrics, 
  ChatMessage, 
  HistoryRecord 
} from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getLocalDeviceInfo());
  const [sessionState, setSessionState] = useState<string>('idle');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [remotePeerInfo, setRemotePeerInfo] = useState<DeviceInfo | null>(null);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<FileItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [radarPeers, setRadarPeers] = useState<{ id: string; deviceInfo: DeviceInfo }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('hexasend_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Direct invite from another peer
  const [incomingInvite, setIncomingInvite] = useState<{
    fromPeerId: string;
    fromDeviceInfo?: DeviceInfo;
    roomCode: string;
    filesMeta?: any[];
  } | null>(null);

  const webrtcRef = useRef<WebRTCManager | null>(null);

  // Parse URL query parameter for direct joins: ?code=XYZ123
  const [urlCode, setUrlCode] = useState<string>('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('join') || '';
    if (code) {
      setUrlCode(code.toUpperCase());
      setActiveTab('receive');
    }
  }, []);

  // Save history to localStorage
  const saveHistoryRecord = (record: HistoryRecord) => {
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, 50);
      try {
        localStorage.setItem('hexasend_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('hexasend_history');
  };

  // Initialize WebRTC Manager
  useEffect(() => {
    const manager = new WebRTCManager({
      onStateChange: (state, details) => {
        setSessionState(state);
        if (state === 'peer_connected') {
          sound.playConnect();
        }
      },
      onRoomCreated: (code) => {
        setRoomCode(code);
        setErrorMessage(null);
      },
      onRoomJoined: (code, filesMeta) => {
        setRoomCode(code);
        setErrorMessage(null);
        if (filesMeta && filesMeta.length > 0) {
          setReceivedFiles(filesMeta.map((f: any) => ({
            id: Math.random().toString(36).substring(2, 9),
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            progress: 0,
            bytesTransferred: 0,
            status: 'pending'
          })));
        }
      },
      onPeerConnected: (info) => {
        if (info.deviceInfo) {
          setRemotePeerInfo(info.deviceInfo);
        }
      },
      onPeerDisconnected: () => {
        setRemotePeerInfo(null);
      },
      onFilesMetadataReceived: (files) => {
        setReceivedFiles(files);
      },
      onTransferProgress: (transferMetrics, activeFileId) => {
        setMetrics(transferMetrics);
        if (activeFileId) {
          setReceivedFiles(prev => prev.map(f => {
            if (f.id === activeFileId) {
              return {
                ...f,
                progress: Math.min(100, Math.round((f.bytesTransferred / f.size) * 100)),
                status: 'transferring'
              };
            }
            return f;
          }));
        }
      },
      onFileReceived: (fileItem) => {
        setReceivedFiles(prev => prev.map(f => f.id === fileItem.id ? fileItem : f));
        // Add to history
        saveHistoryRecord({
          id: Math.random().toString(36).substring(2, 10),
          direction: 'received',
          fileName: fileItem.name,
          fileSize: fileItem.size,
          fileType: fileItem.type,
          timestamp: Date.now(),
          roomCode: roomCode || 'DIRECT',
          peerDeviceName: remotePeerInfo?.name || 'Sender Device',
          sha256: fileItem.sha256,
          durationMs: 0,
          avgSpeedBytesPerSec: metrics?.speedBytesPerSec || 0
        });
      },
      onTransferComplete: (completedFiles) => {
        setSessionState('completed');
      },
      onChatMessage: (chatMsg) => {
        setChatMessages(prev => [...prev, chatMsg]);
        sound.playStart();
      },
      onRadarUpdate: (peers) => {
        setRadarPeers(peers);
      },
      onDirectInvite: (invite) => {
        setIncomingInvite(invite);
        sound.playConnect();
      },
      onError: (msg) => {
        setErrorMessage(msg);
        sound.playError();
      }
    });

    webrtcRef.current = manager;

    return () => {
      manager.destroy();
    };
  }, [roomCode, remotePeerInfo, metrics]);

  // Handle Reset Session
  const handleResetSession = () => {
    webrtcRef.current?.resetSession();
    setSessionState('idle');
    setRoomCode(null);
    setRemotePeerInfo(null);
    setMetrics(null);
    setReceivedFiles([]);
    setChatMessages([]);
    setErrorMessage(null);
  };

  const handleSendChat = (text: string) => {
    const msg = webrtcRef.current?.sendChatMessage(text);
    if (msg) {
      setChatMessages(prev => [...prev, msg]);
    }
  };

  const handleSelectRadarPeer = (targetPeerId: string) => {
    // Switch to send tab and notify
    setActiveTab('send');
    // Prompt file selection if needed
  };

  const acceptIncomingInvite = () => {
    if (!incomingInvite) return;
    setActiveTab('receive');
    webrtcRef.current?.joinRoom(incomingInvite.roomCode);
    setIncomingInvite(null);
  };

  const declineIncomingInvite = () => {
    setIncomingInvite(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <Header
        deviceInfo={deviceInfo}
        onUpdateDeviceName={(newName) => setDeviceInfo(prev => ({ ...prev, name: newName }))}
        radarPeerCount={radarPeers.length}
        onOpenRadar={() => setIsRadarOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        historyCount={history.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Incoming Direct Invite Banner */}
          {incomingInvite && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-900 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Direct Transfer Request
                  </h4>
                  <p className="text-xs text-slate-300">
                    <strong>{incomingInvite.fromDeviceInfo?.name || 'A nearby device'}</strong> wants to share{' '}
                    {incomingInvite.filesMeta?.length || 1} file(s) with you.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={acceptIncomingInvite}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  Accept & Receive
                </button>
                <button
                  onClick={declineIncomingInvite}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex justify-center">
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <button
                onClick={() => {
                  if (sessionState === 'idle') setActiveTab('send');
                }}
                disabled={sessionState !== 'idle' && activeTab !== 'send'}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'send'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SendIcon className="w-4 h-4" />
                <span>Send</span>
              </button>

              <button
                onClick={() => {
                  if (sessionState === 'idle') setActiveTab('receive');
                }}
                disabled={sessionState !== 'idle' && activeTab !== 'receive'}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'receive'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Receive</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panel */}
          <div className="pt-2">
            {activeTab === 'send' ? (
              <SendTab
                webrtc={webrtcRef.current}
                state={sessionState}
                roomCode={roomCode}
                remotePeerInfo={remotePeerInfo}
                metrics={metrics}
                chatMessages={chatMessages}
                onSendChat={handleSendChat}
                onReset={handleResetSession}
              />
            ) : (
              <ReceiveTab
                webrtc={webrtcRef.current}
                state={sessionState}
                roomCode={roomCode}
                remotePeerInfo={remotePeerInfo}
                metrics={metrics}
                receivedFiles={receivedFiles}
                chatMessages={chatMessages}
                onSendChat={handleSendChat}
                onReset={handleResetSession}
                initialCode={urlCode}
                errorMessage={errorMessage}
              />
            )}
          </div>
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-12 pt-8 border-t border-slate-900/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/40">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-slate-200">Zero Cloud Storage</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Files are streamed directly between browser engines. No third-party servers ever touch your data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/40">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-slate-200">DTLS 1.2 Encrypted</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All data channel packets are natively encrypted end-to-end with high-grade cryptographic protocols.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/40">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-slate-200">SHA-256 Verified</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every file is verified byte-by-byte with SHA-256 cryptographic checksums before saving.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <RadarModal
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        peers={radarPeers}
        onSelectPeer={handleSelectRadarPeer}
        currentDevice={deviceInfo}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClearHistory={clearHistory}
      />

      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
      />
    </div>
  );
}
