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
import { PaperPlaneLogo } from './components/PaperPlaneLogo.tsx';
import { SendTab } from './components/SendTab.tsx';
import { ReceiveTab } from './components/ReceiveTab.tsx';
import { FileManager } from './components/FileManager.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { RadarModal } from './components/RadarModal.tsx';
import { HistoryModal } from './components/HistoryModal.tsx';
import { SecurityModal } from './components/SecurityModal.tsx';
import { OfflineDirectModal } from './components/OfflineDirectModal.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { FooterFeatureBubble, FeatureNote } from './components/FooterFeatureBubble.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { WebRTCManager } from './services/webrtc.ts';
import { getLocalDeviceInfo, formatBytes } from './services/device.ts';
import { sound } from './services/sound.ts';
import { fetchNetworkInfo } from './services/network.ts';
import { 
  DeviceInfo, 
  FileItem, 
  TransferMetrics, 
  ChatMessage, 
  HistoryRecord,
  UserProfile,
  ManagedFile,
  DiagnosticReport,
  RoomValidityInfo
} from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState<'transfer' | 'files' | 'admin'>('transfer');
  const [activeTab, setActiveTab] = useState<'send' | 'receive' | 'securenote'>('send');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getLocalDeviceInfo());
  const [sessionState, setSessionState] = useState<string>('idle');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [remotePeerInfo, setRemotePeerInfo] = useState<DeviceInfo | null>(null);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<FileItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [radarPeers, setRadarPeers] = useState<{ id: string; deviceInfo: DeviceInfo }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [roomValidity, setRoomValidity] = useState<RoomValidityInfo | null>(null);

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
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineModalMode, setOfflineModalMode] = useState<'send' | 'receive'>('send');
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>([]);
  const [activeFeatureNote, setActiveFeatureNote] = useState<FeatureNote | null>(null);

  const openFeatureNote = (featureKey: string) => {
    switch (featureKey) {
      case 'security':
        setActiveFeatureNote({
          id: 'security',
          title: 'End-to-End Security Architecture',
          category: 'Security & Encryption',
          badge: 'DTLS 1.2 / SCTP',
          summary: 'All file streams and messages are encrypted using DTLS 1.2 with AES-GCM ciphers negotiated directly between client peers via ephemeral Diffie-Hellman keys.',
          howToAccess: 'Click "Security" in the footer or navigation menu, or click the lock badge during active transfers.',
          howToVerify: 'Open chrome://webrtc-internals during an active transfer session in Chrome and inspect dtlsState: connected and the active TLS_ECDHE_ECDSA_WITH_AES_128_GCM cipher suite.',
          actionText: 'View Security Specs',
          actionHandler: () => setIsSecurityOpen(true)
        });
        break;
      case 'radar':
        setActiveFeatureNote({
          id: 'radar',
          title: 'Local Mesh Peer Discovery Radar',
          category: 'Network Discovery',
          badge: 'Auto LAN Mesh',
          summary: 'Discovers active devices connected to the same local network or signaling mesh, allowing instant 1-tap file sharing without typing 6-character codes.',
          howToAccess: 'Click "Radar" in the footer or top right active peer indicator pill.',
          howToVerify: 'Open InstaSend on two devices connected to the same Wi-Fi network; open Radar on device A to see device B listed, then click to send a 1-tap direct invite.',
          actionText: 'Open Peer Radar',
          actionHandler: () => setIsRadarOpen(true)
        });
        break;
      case 'files':
        setActiveFeatureNote({
          id: 'files',
          title: 'File Manager & Local Storage Hub',
          category: 'Data Dashboard',
          badge: 'IndexedDB / Storage',
          summary: 'Keeps track of all staged, uploaded, and received files with storage usage meters, in-browser image/text previews, and direct re-sharing.',
          howToAccess: 'Click "Files" in the footer or top navigation menu.',
          howToVerify: 'Stage or receive any file, switch to the "My Files" view, and test downloading, previewing, or re-sharing the file in a new session.',
          actionText: 'Open My Files',
          actionHandler: () => setActiveView('files')
        });
        break;
      case 'history':
        setActiveFeatureNote({
          id: 'history',
          title: 'Transfer History & SHA-256 Hashes',
          category: 'Integrity Logs',
          badge: 'SHA-256 Web Crypto',
          summary: 'Maintains audit logs of completed transfers with bit-for-bit SHA-256 cryptographic digests computed directly via Web Crypto API.',
          howToAccess: 'Click "History" in the footer or drawer menu.',
          howToVerify: 'Receive a file, open History, and compare the displayed SHA-256 hash string against "shasum -a 256 <file>" executed on your local terminal.',
          actionText: 'View Transfer History',
          actionHandler: () => setIsHistoryOpen(true)
        });
        break;
      case 'admin':
        setActiveFeatureNote({
          id: 'admin',
          title: 'System Telemetry & Admin Console',
          category: 'Administration',
          badge: 'Node.js / SQLite',
          summary: 'Full administrative portal showing real-time Node.js process RSS memory, SQLite database stats, active LAN peers, user management, and pre-seeded SQL scripts.',
          howToAccess: 'Click "Admin Portal (/admin)" in footer or visit http://localhost:3000/admin (Credentials: admin / 1@3$5^7*9).',
          howToVerify: 'Sign in to /admin to inspect live server RSS memory, active peer tables, and database user accounts.',
          actionText: 'Open Admin Portal (/admin)',
          actionHandler: () => setActiveView('admin')
        });
        break;
      case 'zerocloud':
        setActiveFeatureNote({
          id: 'zerocloud',
          title: 'Zero Cloud Storage Guarantee',
          category: 'Privacy Architecture',
          badge: '100% RAM-to-RAM',
          summary: 'Files stream directly browser-to-browser. The backend server acts only as a signaling relay for SDP offers/answers. Zero binary file payload bytes touch disk or cloud databases.',
          howToAccess: 'Operates automatically on every file transfer session.',
          howToVerify: 'Transfer a multi-gigabyte file, then inspect server disk storage (data/ directory) or server network logs — zero file data is ever stored on the server.',
          actionText: 'View Privacy Specs',
          actionHandler: () => setIsSecurityOpen(true)
        });
        break;
      case 'dtls':
        setActiveFeatureNote({
          id: 'dtls',
          title: 'DTLS 1.2 Protocol Encryption',
          category: 'Transport Security',
          badge: 'AES-128-GCM / 256',
          summary: 'Mandatory Datagram Transport Layer Security (DTLS 1.2) layer wrapping all WebRTC binary data channels, preventing eavesdropping and tampering.',
          howToAccess: 'View green DTLS 1.2 indicator badge in footer or Security modal.',
          howToVerify: 'Inspect active WebRTC DataChannel security properties in Chrome DevTools to confirm encrypted SCTP over DTLS transport.',
          actionText: 'View Encryption Details',
          actionHandler: () => setIsSecurityOpen(true)
        });
        break;
    }
  };
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
    setStagedFiles(staged);
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

  // Parse URL query parameter or path: ?code=XYZ123 or /admin
  const [urlCode, setUrlCode] = useState<string>('');
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setActiveView('admin');
    }

    // Pre-fetch local network LAN IP for QR and LAN sharing
    fetchNetworkInfo().catch(() => {});

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

  // Stable state refs to prevent destroying WebRTCManager on every render/state change
  const roomCodeRef = useRef<string | null>(null);
  const remotePeerInfoRef = useRef<DeviceInfo | null>(null);
  const metricsRef = useRef<TransferMetrics | null>(null);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  const activeTabRef = useRef<'send' | 'receive' | 'securenote'>(activeTab);
  const managedFilesRef = useRef<ManagedFile[]>(managedFiles);

  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { remotePeerInfoRef.current = remotePeerInfo; }, [remotePeerInfo]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { managedFilesRef.current = managedFiles; }, [managedFiles]);

  // Initialize WebRTC Manager ONCE on mount
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
            id: f.id || Math.random().toString(36).substring(2, 9),
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
          roomCode: roomCodeRef.current || 'DIRECT',
          peerDeviceName: remotePeerInfoRef.current?.name || 'Sender Device',
          sha256: fileItem.sha256,
          durationMs: 0,
          avgSpeedBytesPerSec: metricsRef.current?.speedBytesPerSec || 0
        });

        const managedItem: ManagedFile = {
          id: fileItem.id,
          name: fileItem.name,
          size: fileItem.size,
          type: fileItem.type,
          relativePath: fileItem.relativePath,
          direction: 'received',
          uploadedAt: Date.now(),
          roomCode: roomCodeRef.current || undefined,
          blob: fileItem.blob,
          previewUrl: fileItem.previewUrl,
          downloadsCount: 1,
          sha256: fileItem.sha256
        };
        const currentList = managedFilesRef.current;
        const updated = [managedItem, ...currentList.filter(m => m.id !== fileItem.id)];
        saveManagedFiles(updated);
      },
      onTransferComplete: (completedFiles) => {
        setSessionState('completed');
        const user = currentUserRef.current;
        if (user) {
          const totalBytes = completedFiles.reduce((acc, f) => acc + f.size, 0);
          const bytesSent = activeTabRef.current === 'send' ? totalBytes : 0;
          const bytesReceived = activeTabRef.current === 'receive' ? totalBytes : 0;
          const uploads = completedFiles.length;

          const updated: UserProfile = {
            ...user,
            totalUploads: user.totalUploads + uploads,
            totalBytesSent: user.totalBytesSent + bytesSent,
            totalBytesReceived: user.totalBytesReceived + bytesReceived
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
      },
      onDiagnosticUpdate: (report) => {
        setDiagnosticReport(report);
      },
      onRoomValidityUpdate: (validity) => {
        setRoomValidity(validity);
      }
    });

    webrtcRef.current = manager;

    return () => {
      manager.destroy();
    };
  }, []);

  const handleResetSession = () => {
    webrtcRef.current?.resetSession();
    setSessionState('idle');
    setRoomCode(null);
    setRemotePeerInfo(null);
    setMetrics(null);
    setReceivedFiles([]);
    setChatMessages([]);
    setErrorMessage(null);
    setDiagnosticReport(null);
    setRoomValidity(null);
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

  const handleGoHome = () => {
    setActiveView('transfer');
    setActiveTab('send');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-[#202124] dark:text-[#e8eaed] flex flex-col justify-between selection:bg-blue-100 dark:selection:bg-blue-900/60 selection:text-blue-900 dark:selection:text-blue-200 transition-colors duration-200">
      {/* PWA Splash Screen Sequence */}
      <SplashScreen />

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
        onGoHome={handleGoHome}
        managedFilesCount={managedFiles.length}
      />

      {/* Main Google Homepage Center Stage */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col justify-start">
        {/* Incoming Direct Transfer Alert */}
        {incomingInvite && (
          <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-[#202124] border border-[#ceead6] dark:border-green-900/60 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/40 text-[#34A853] dark:text-[#81c995] flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#202124] dark:text-[#e8eaed]">
                  Direct Transfer Request
                </h4>
                <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
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
                className="px-3.5 py-2 rounded-full bg-[#f8f9fa] dark:bg-[#2d2f31] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] text-[#3c4043] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] text-xs transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* TRANSFER VIEW */}
        {activeView === 'transfer' ? (
          <div className="space-y-6">
            {/* Send / Receive / SecureNote Action Switcher Pill */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-full bg-[#f8f9fa] dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] google-card-shadow">
                <button
                  onClick={() => {
                    if (sessionState === 'idle') setActiveTab('send');
                  }}
                  disabled={sessionState !== 'idle' && activeTab !== 'send'}
                  className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'send'
                      ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs font-semibold'
                      : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
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
                  className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'receive'
                      ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs font-semibold'
                      : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Receive</span>
                </button>

                <button
                  onClick={() => {
                    if (sessionState === 'idle') setActiveTab('securenote');
                  }}
                  disabled={sessionState !== 'idle' && activeTab !== 'securenote'}
                  className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'securenote'
                      ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs font-semibold'
                      : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                  }`}
                >
                  <Lock className="w-4 h-4 text-[#EA4335]" />
                  <span>SecureNote</span>
                </button>
              </div>
            </div>

            {/* Active Tab Component */}
            <div className="pt-1">
              {activeTab === 'send' || activeTab === 'securenote' ? (
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
                  onOpenOfflineModal={() => {
                    setOfflineModalMode('send');
                    setIsOfflineModalOpen(true);
                  }}
                  mode={activeTab === 'securenote' ? 'text' : 'files'}
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
                  onOpenOfflineModal={() => {
                    setOfflineModalMode('receive');
                    setIsOfflineModalOpen(true);
                  }}
                  diagnosticReport={diagnosticReport}
                  roomValidity={roomValidity}
                />
              )}
            </div>
          </div>
        ) : activeView === 'files' ? (
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
        ) : (
          /* ADMIN PORTAL VIEW (/admin) */
          <AdminPortal
            currentUser={currentUser}
            onLogin={handleLogin}
            onClose={() => setActiveView('transfer')}
          />
        )}
      </main>

      {/* Google Homepage Signature 2-Tier Footer */}
      <footer className="bg-[#f2f2f2] dark:bg-[#171717] text-[#70757a] dark:text-[#9aa0a6] text-[13px] border-t border-[#dadce0] dark:border-[#303134] mt-12 select-none transition-colors duration-200">
        {/* Tier 1: Network & Region Status */}
        <div className="px-6 py-3 border-b border-[#dadce0] dark:border-[#303134] flex items-center justify-between text-xs max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
            <span>Local Mesh Network • Direct WebRTC Peer-to-Peer</span>
          </div>
          <button
            onClick={() => openFeatureNote('zerocloud')}
            className="hidden sm:flex items-center gap-1 font-mono text-[11px] hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer"
            title="Click to view Zero Cloud Storage verification notes"
          >
            <span>RAM-to-RAM DataChannel</span>
            <Info className="w-3 h-3 text-[#1a73e8] dark:text-[#8ab4f8]" />
          </button>
        </div>

        {/* Tier 2: Google Style Links with Pop-Up Feature Notes */}
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-y-2 max-w-7xl mx-auto text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <div className="inline-flex items-center gap-1">
              <button onClick={() => setIsSecurityOpen(true)} className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer">
                Security
              </button>
              <button onClick={() => openFeatureNote('security')} className="p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:scale-110 transition-transform cursor-pointer" title="Security verification note">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1">
              <button onClick={() => setIsRadarOpen(true)} className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer">
                Radar
              </button>
              <button onClick={() => openFeatureNote('radar')} className="p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:scale-110 transition-transform cursor-pointer" title="Radar verification note">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1">
              <button onClick={() => setActiveView('files')} className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer">
                Files ({managedFiles.length})
              </button>
              <button onClick={() => openFeatureNote('files')} className="p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:scale-110 transition-transform cursor-pointer" title="File manager verification note">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1">
              <button onClick={() => setIsHistoryOpen(true)} className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer">
                History
              </button>
              <button onClick={() => openFeatureNote('history')} className="p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:scale-110 transition-transform cursor-pointer" title="SHA-256 history verification note">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1">
              <button onClick={() => setActiveView('admin')} className="text-[#1a73e8] dark:text-[#8ab4f8] hover:underline transition-colors font-medium cursor-pointer">
                Admin Portal (/admin)
              </button>
              <button onClick={() => openFeatureNote('admin')} className="p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:scale-110 transition-transform cursor-pointer" title="Admin portal verification note">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <button
              onClick={() => openFeatureNote('dtls')}
              className="flex items-center gap-1 text-[#137333] dark:text-[#81c995] hover:underline cursor-pointer"
              title="Click to view DTLS 1.2 encryption notes"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> DTLS 1.2
            </button>

            <button
              onClick={() => openFeatureNote('zerocloud')}
              className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer"
              title="Click to view Zero Cloud Storage notes"
            >
              Zero Cloud Storage
            </button>

            <button onClick={() => setIsSecurityOpen(true)} className="hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors cursor-pointer">
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

      <OfflineDirectModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        webrtc={webrtcRef.current}
        mode={offlineModalMode}
        stagedFiles={stagedFiles}
      />

      {/* Pop-up Feature Notes Bubble */}
      <FooterFeatureBubble
        note={activeFeatureNote}
        onClose={() => setActiveFeatureNote(null)}
      />
    </div>
  );
}
