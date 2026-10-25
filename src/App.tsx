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
  AlertTriangle,
  FolderArchive,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Search,
  Sparkles
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { SendTab } from './components/SendTab.tsx';
import { ReceiveTab } from './components/ReceiveTab.tsx';
import { FileManager } from './components/FileManager.tsx';
import { AuthModal } from './components/AuthModal.tsx';
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
  HistoryRecord,
  UserProfile,
  ManagedFile
} from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState<'transfer' | 'files'>('transfer');
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

  // User Profile & Auth
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('instasend_user') || localStorage.getItem('hexasend_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Managed Files List
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>(() => {
    try {
      const saved = localStorage.getItem('instasend_managed_files') || localStorage.getItem('hexasend_managed_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('instasend_history') || localStorage.getItem('hexasend_history');
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

  // Save managed files to localStorage
  const saveManagedFiles = (files: ManagedFile[]) => {
    setManagedFiles(files);
    try {
      const serializable = files.map(f => {
        const { blob, ...rest } = f;
        return rest;
      });
      localStorage.setItem('instasend_managed_files', JSON.stringify(serializable));
    } catch (e) {
      console.error('Failed to save managed files to storage:', e);
    }
  };

  // Add files to manager when staged or sent
  const handleFilesStaged = (staged: FileItem[]) => {
    if (staged.length === 0) return;
    const now = Date.now();
    const newManaged: ManagedFile[] = staged.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      relativePath: f.relativePath,
      direction: 'uploaded',
      uploadedAt: now,
      roomCode: roomCode || undefined,
      blob: f.file || f.blob,
      previewUrl: f.previewUrl,
      downloadsCount: 0,
      sha256: f.sha256
    }));

    const existingIds = new Set(managedFiles.map(m => m.id));
    const toAdd = newManaged.filter(m => !existingIds.has(m.id));
    if (toAdd.length > 0) {
      saveManagedFiles([...toAdd, ...managedFiles]);
    }
  };

  // Parse URL query parameter for direct joins: ?code=XYZ123
  const [urlCode, setUrlCode] = useState<string>('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('join') || '';
    if (code) {
      setUrlCode(code.toUpperCase());
      setActiveTab('receive');
      setActiveView('transfer');
    }

    // Verify token and restore user profile from SQLite database
    const token = localStorage.getItem('instasend_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('instasend_user', JSON.stringify(data.user));
          } else {
            localStorage.removeItem('instasend_token');
          }
        })
        .catch(() => {});
    }
  }, []);

  // Save history to localStorage
  const saveHistoryRecord = (record: HistoryRecord) => {
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, 50);
      try {
        localStorage.setItem('instasend_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('instasend_history');
  };

  // Initialize WebRTC Manager
  useEffect(() => {
    const manager = new WebRTCManager({
      onStateChange: (state) => {
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
            relativePath: f.relativePath,
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

        const managedItem: ManagedFile = {
          id: fileItem.id,
          name: fileItem.name,
          size: fileItem.size,
          type: fileItem.type,
          relativePath: fileItem.relativePath,
          direction: 'received',
          uploadedAt: Date.now(),
          roomCode: roomCode || undefined,
          blob: fileItem.blob,
          previewUrl: fileItem.previewUrl,
          downloadsCount: 1,
          sha256: fileItem.sha256
        };
        saveManagedFiles([managedItem, ...managedFiles.filter(m => m.id !== fileItem.id)]);
      },
      onTransferComplete: (completedFiles) => {
        setSessionState('completed');
        if (currentUser) {
          const totalBytes = completedFiles.reduce((acc, f) => acc + f.size, 0);
          const bytesSent = activeTab === 'send' ? totalBytes : 0;
          const bytesReceived = activeTab === 'receive' ? totalBytes : 0;
          const uploads = completedFiles.length;

          const updated: UserProfile = {
            ...currentUser,
            totalUploads: currentUser.totalUploads + uploads,
            totalBytesSent: currentUser.totalBytesSent + bytesSent,
            totalBytesReceived: currentUser.totalBytesReceived + bytesReceived
          };
          setCurrentUser(updated);
          localStorage.setItem('instasend_user', JSON.stringify(updated));

          // Also persist directly into server SQLite database
          const token = localStorage.getItem('instasend_token');
          if (token) {
            fetch('/api/user/stats', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ uploads, bytesSent, bytesReceived })
            }).catch(() => {});
          }
        }
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
  }, [roomCode, remotePeerInfo, metrics, activeTab, currentUser, managedFiles]);

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
    setActiveTab('send');
    setActiveView('transfer');
  };

  const acceptIncomingInvite = () => {
    if (!incomingInvite) return;
    setActiveTab('receive');
    setActiveView('transfer');
    webrtcRef.current?.joinRoom(incomingInvite.roomCode);
    setIncomingInvite(null);
  };

  const declineIncomingInvite = () => {
    setIncomingInvite(null);
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('instasend_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    const token = localStorage.getItem('instasend_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {});
    }
    localStorage.removeItem('instasend_token');
    localStorage.removeItem('instasend_user');
    setCurrentUser(null);
  };

  const handleDeleteManagedFile = (id: string) => {
    const updated = managedFiles.filter(f => f.id !== id);
    saveManagedFiles(updated);
  };

  const handleDownloadManagedFile = (file: ManagedFile) => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleShareManagedFile = (file: ManagedFile) => {
    setActiveView('transfer');
    setActiveTab('send');
    if (file.blob) {
      const fileItem: FileItem = {
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        relativePath: file.relativePath,
        file: file.blob instanceof File ? file.blob : new File([file.blob], file.name, { type: file.type }),
        progress: 0,
        bytesTransferred: 0,
        status: 'pending'
      };
      webrtcRef.current?.createRoom([fileItem]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#202124] flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Google Homepage Style Header */}
      <Header
        deviceInfo={deviceInfo}
        onUpdateDeviceName={(newName) => setDeviceInfo(prev => ({ ...prev, name: newName }))}
        radarPeerCount={radarPeers.length}
        onOpenRadar={() => setIsRadarOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        historyCount={history.length}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        activeView={activeView}
        onViewChange={(v) => setActiveView(v)}
        managedFilesCount={managedFiles.length}
      />

      {/* Main Google Homepage Center Stage */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10 flex flex-col justify-center">
        {/* Incoming Direct Transfer Alert */}
        {incomingInvite && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-[#ceead6] shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 text-[#34A853] flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#202124]">
                  Direct Transfer Request
                </h4>
                <p className="text-xs text-[#5f6368]">
                  <strong>{incomingInvite.fromDeviceInfo?.name || 'A nearby device'}</strong> wants to share{' '}
                  {incomingInvite.filesMeta?.length || 1} file(s) with you.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={acceptIncomingInvite}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              >
                Accept & Receive
              </button>
              <button
                onClick={declineIncomingInvite}
                className="px-3.5 py-2 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Google Homepage Centerpiece Logo & Subtitle */}
        {activeView === 'transfer' && sessionState === 'idle' && (
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            {/* Iconic Google 4-Color Title */}
            <h1 className="text-5xl sm:text-7xl font-normal tracking-tight select-none">
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
            <p className="text-sm text-[#5f6368] font-normal">
              Direct, encrypted peer-to-peer file transfer via WebRTC
            </p>
          </div>
        )}

        {/* TRANSFER VIEW */}
        {activeView === 'transfer' ? (
          <div className="space-y-6">
            {/* Google Style Action Switcher Pill */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-full bg-[#f8f9fa] border border-[#dadce0] google-card-shadow">
                <button
                  onClick={() => {
                    if (sessionState === 'idle') setActiveTab('send');
                  }}
                  disabled={sessionState !== 'idle' && activeTab !== 'send'}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'send'
                      ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  <SendIcon className="w-3.5 h-3.5" />
                  <span>Send Files</span>
                </button>

                <button
                  onClick={() => {
                    if (sessionState === 'idle') setActiveTab('receive');
                  }}
                  disabled={sessionState !== 'idle' && activeTab !== 'receive'}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'receive'
                      ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Receive Files</span>
                </button>
              </div>
            </div>

            {/* Active Tab Component */}
            <div className="pt-1">
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
                  onFilesStaged={handleFilesStaged}
                  radarPeers={radarPeers}
                  onSelectRadarPeer={handleSelectRadarPeer}
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
        ) : (
          /* FILE MANAGER VIEW */
          <FileManager
            files={managedFiles}
            onDeleteFile={handleDeleteManagedFile}
            onDownloadFile={handleDownloadManagedFile}
            onShareFile={handleShareManagedFile}
            onUploadClick={() => {
              setActiveView('transfer');
              setActiveTab('send');
            }}
            metrics={metrics}
            activeRole={webrtcRef.current ? (sessionState === 'transferring' ? (activeTab === 'send' ? 'sender' : 'receiver') : null) : null}
            transferState={sessionState}
          />
        )}
      </main>

      {/* Google Homepage Signature 2-Tier Footer */}
      <footer className="bg-[#f2f2f2] text-[#70757a] text-[13px] border-t border-[#dadce0] mt-12 select-none">
        {/* Tier 1: Network & Region Status */}
        <div className="px-6 py-3 border-b border-[#dadce0] flex items-center justify-between text-xs max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
            <span>Local Mesh Network • Direct WebRTC Peer-to-Peer</span>
          </div>
          <span className="hidden sm:inline font-mono text-[11px]">
            RAM-to-RAM DataChannel
          </span>
        </div>

        {/* Tier 2: Google Style Links */}
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-y-2 max-w-7xl mx-auto text-xs">
          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={() => setIsSecurityOpen(true)} className="hover:text-[#202124] transition-colors">
              Security
            </button>
            <button onClick={() => setIsRadarOpen(true)} className="hover:text-[#202124] transition-colors">
              Radar
            </button>
            <button onClick={() => setActiveView('files')} className="hover:text-[#202124] transition-colors">
              Files ({managedFiles.length})
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className="hover:text-[#202124] transition-colors">
              History
            </button>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <span className="flex items-center gap-1 text-[#137333]">
              <ShieldCheck className="w-3.5 h-3.5" /> DTLS 1.2
            </span>
            <span className="hover:text-[#202124] transition-colors">
              Zero Cloud Storage
            </span>
            <button onClick={() => setIsSecurityOpen(true)} className="hover:text-[#202124] transition-colors">
              Privacy & Guarantee
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

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
