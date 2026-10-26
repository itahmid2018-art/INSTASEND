import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  Trash2, 
  Copy, 
  Check, 
  QrCode, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  Share2, 
  Zap, 
  Send as SendIcon,
  MessageSquare,
  Lock,
  Plus,
  FolderPlus,
  ArrowUp,
  Clock,
  Radio,
  Sliders,
  Sparkles,
  Folder,
  Maximize2,
  Wifi,
  Eye,
  Layers,
  ListChecks,
  Download,
  Smartphone
} from 'lucide-react';
import { FileItem, TransferMetrics, DeviceInfo, ChatMessage, TransferSettings } from '../types.ts';
import { formatBytes, formatDuration } from '../services/device.ts';
import { sound } from '../services/sound.ts';
import { WebRTCManager } from '../services/webrtc.ts';
import { extractFilesAndFoldersFromDataTransfer } from '../services/folderDrop.ts';
import { QRCodeModal } from './QRCodeModal.tsx';
import { isCompressibleTextFile } from '../services/compression.ts';
import { SpeedChart } from './SpeedChart.tsx';
import { SpeedGauge } from './SpeedGauge.tsx';

interface SendTabProps {
  webrtc: WebRTCManager | null;
  state: string;
  roomCode: string | null;
  remotePeerInfo: DeviceInfo | null;
  metrics: TransferMetrics | null;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onReset: () => void;
  onFilesStaged?: (files: FileItem[]) => void;
  radarPeers?: { id: string; deviceInfo: DeviceInfo }[];
  onSelectRadarPeer?: (peerId: string) => void;
  onOpenOfflineModal?: () => void;
  mode?: 'files' | 'text';
}

export const SendTab: React.FC<SendTabProps> = ({
  webrtc,
  state,
  roomCode,
  remotePeerInfo,
  metrics,
  chatMessages,
  onSendChat,
  onReset,
  onFilesStaged,
  radarPeers = [],
  onSelectRadarPeer,
  onOpenOfflineModal,
  mode = 'files'
}) => {
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textSnippet, setTextSnippet] = useState('');
  const [previewModalFile, setPreviewModalFile] = useState<FileItem | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [folderDropNotice, setFolderDropNotice] = useState<string | null>(null);
  const [isScanningFolders, setIsScanningFolders] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [compressTextFiles, setCompressTextFiles] = useState(true);

  // Sync compression flag to WebRTC service
  useEffect(() => {
    if (webrtc) {
      webrtc.setCompressTextFiles(compressTextFiles);
    }
  }, [webrtc, compressTextFiles]);

  // Transfer Settings
  const [settings, setSettings] = useState<TransferSettings>({
    expirationHours: 24,
    selfDestructAfterDownload: false,
    compressTextFiles: true,
    password: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Generate QR code whenever roomCode is set
  useEffect(() => {
    if (roomCode) {
      const shareUrl = `${window.location.origin}/?code=${roomCode}`;
      QRCode.toDataURL(shareUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#202124',
          light: '#ffffff'
        }
      }).then(url => {
        setQrCodeDataUrl(url);
      }).catch(err => {
        console.error('Error generating QR code:', err);
      });
    }
  }, [roomCode]);

  // Trigger celebration confetti when transfer is complete
  useEffect(() => {
    if (state === 'completed') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      sound.playSuccess();
    }
  }, [state]);

  const handleFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: FileItem[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      relativePath: (file as any).webkitRelativePath || file.name,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      bytesTransferred: 0,
      status: 'pending'
    }));

    setStagedFiles(prev => {
      const updated = [...prev, ...newFiles];
      onFilesStaged?.(updated);
      return updated;
    });
    sound.playStart();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsScanningFolders(true);

    try {
      const { results, folderCount } = await extractFilesAndFoldersFromDataTransfer(e.dataTransfer);
      if (results.length === 0) return;

      const newFiles: FileItem[] = results.map(r => ({
        id: Math.random().toString(36).substring(2, 11),
        name: r.file.name,
        size: r.file.size,
        type: r.file.type || 'application/octet-stream',
        relativePath: r.relativePath,
        file: r.file,
        previewUrl: r.file.type.startsWith('image/') ? URL.createObjectURL(r.file) : undefined,
        progress: 0,
        bytesTransferred: 0,
        status: 'pending'
      }));

      setStagedFiles(prev => {
        const updated = [...prev, ...newFiles];
        onFilesStaged?.(updated);
        return updated;
      });

      if (folderCount > 0) {
        setFolderDropNotice(`📁 Folder imported: ${folderCount} ${folderCount === 1 ? 'directory' : 'directories'} (${newFiles.length} files)`);
        setTimeout(() => setFolderDropNotice(null), 5000);
      }
      sound.playStart();
    } catch (err) {
      console.error('Error scanning folder drop:', err);
    } finally {
      setIsScanningFolders(false);
    }
  };

  const removeFile = (id: string) => {
    setStagedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl) {
        try { URL.revokeObjectURL(target.previewUrl); } catch {}
      }
      const updated = prev.filter(f => f.id !== id);
      onFilesStaged?.(updated);
      return updated;
    });
  };

  const clearAllFiles = () => {
    stagedFiles.forEach(f => {
      if (f.previewUrl) {
        try { URL.revokeObjectURL(f.previewUrl); } catch {}
      }
    });
    setStagedFiles([]);
    onFilesStaged?.([]);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#4285F4]" />;
    if (type.startsWith('video/')) return <Film className="w-5 h-5 text-[#EA4335]" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-[#FBBC05]" />;
    if (type.includes('zip') || type.includes('tar') || type.includes('compressed')) {
      return <Archive className="w-5 h-5 text-[#34A853]" />;
    }
    return <FileText className="w-5 h-5 text-[#5f6368]" />;
  };

  const handleCreateCode = () => {
    if (mode === 'text' && textSnippet.trim()) {
      const blob = new Blob([textSnippet], { type: 'text/plain;charset=utf-8' });
      const virtualFile = new File([blob], 'secure-note.txt', { type: 'text/plain' });
      const item: FileItem = {
        id: Math.random().toString(36).substring(2, 11),
        name: 'secure-note.txt',
        size: blob.size,
        type: 'text/plain',
        file: virtualFile,
        progress: 0,
        bytesTransferred: 0,
        status: 'pending'
      };
      setStagedFiles([item]);
      onFilesStaged?.([item]);
      webrtc?.createRoom([item]);
    } else {
      if (stagedFiles.length === 0) return;
      onFilesStaged?.(stagedFiles);
      webrtc?.createRoom(stagedFiles);
    }
    sound.playConnect();
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?code=${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareOnWhatsApp = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?code=${roomCode}`;
    const fileCount = stagedFiles.length;
    const totalBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    const summary = fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'} (${formatBytes(totalBytes)})` : 'files';
    const text = `⚡ *InstaSend Peer-to-Peer Transfer*\nI'm sharing ${summary} with you via encrypted WebRTC.\n\n🔑 *Room Code:* ${roomCode}\n👉 *Tap to join & receive instantly:* ${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareOnTelegram = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?code=${roomCode}`;
    const text = `⚡ InstaSend File Transfer (Room Code: ${roomCode})`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?code=${roomCode}`;
    const fileCount = stagedFiles.length;
    const totalBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    const summary = fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'} (${formatBytes(totalBytes)})` : 'files';
    const title = 'InstaSend - Join File Transfer';
    const text = `Join my InstaSend transfer session (Room Code: ${roomCode}) to receive ${summary} directly via WebRTC:`;

    if (navigator.share) {
      if (qrCodeDataUrl && navigator.canShare) {
        try {
          const res = await fetch(qrCodeDataUrl);
          const blob = await res.blob();
          const file = new File([blob], `instasend-qr-${roomCode}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title,
              text,
              url: shareUrl,
              files: [file]
            });
            return;
          }
        } catch (e) {
          console.warn('File share fallback:', e);
        }
      }

      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyShareLink();
        }
      }
    } else {
      copyShareLink();
    }
  };

  const downloadQR = () => {
    if (!qrCodeDataUrl || !roomCode) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `instasend-qr-${roomCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleStartTransfer = () => {
    webrtc?.startTransfer();
    sound.playStart();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  // 1. Initial State: Staging Files or SecureNote Text
  if (!roomCode) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {mode === 'files' ? (
          <div>
            {/* Enhanced Google Style Drag & Drop Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl transition-all cursor-pointer ${
                stagedFiles.length === 0 ? 'p-8 sm:p-12 text-center' : 'p-4 sm:p-5 text-center'
              } ${
                isDragging
                  ? 'border-[#4285F4] bg-blue-50/70 scale-[1.01]'
                  : 'border-[#dadce0] hover:border-[#4285F4] bg-[#f8f9fa] hover:bg-white google-card-shadow'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-ignore
                webkitdirectory=""
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files)}
              />

              {stagedFiles.length === 0 ? (
                /* Initial Empty Queue Drop Zone */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-white border border-[#dadce0] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform relative">
                    {isScanningFolders ? (
                      <RefreshCw className="w-7 h-7 text-[#1a73e8] animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-[#1a73e8]" />
                        <Folder className="w-3.5 h-3.5 text-[#34A853] absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-[#dadce0]" />
                      </>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-[#202124]">
                      {isScanningFolders ? 'Reading folder hierarchy...' : 'Drop files or folders here'}
                    </h3>
                    <p className="text-xs text-[#5f6368] mt-1">
                      Drag and drop local files, folders, or browse to add to the Sending Queue.
                    </p>
                  </div>

                  {/* Google Style Button Row */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-xs transition-colors cursor-pointer"
                    >
                      Browse Files
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-[#5f6368]" />
                      <span>Upload Folder</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-[#70757a] mt-1 font-mono">
                    Zero cloud storage • Direct peer-to-peer transmission
                  </span>
                </div>
              ) : (
                /* Active Queue Append Drop Zone */
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center shrink-0 border border-blue-100">
                      {isScanningFolders ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#202124]">
                        {isDragging ? 'Drop to Add to Sending Queue' : 'Drop more files or folders to append'}
                      </p>
                      <p className="text-[11px] text-[#5f6368]">
                        Drag files directly here or click to browse additional items
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#f1f3f4] text-[#1a73e8] border border-[#dadce0] transition-colors cursor-pointer"
                    >
                      + Add Files
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                      className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-[#5f6368]" />
                      <span>+ Folder</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Folder Drop Alert Banner */}
            {folderDropNotice && (
              <div className="mt-4 p-3 rounded-xl bg-green-50 border border-[#ceead6] text-xs text-[#137333] flex items-center gap-2 animate-in fade-in">
                <Folder className="w-4 h-4 text-[#34a853] shrink-0" />
                <span className="font-medium">{folderDropNotice}</span>
              </div>
            )}

            {/* Interactive Queued Files List Preview Board */}
            {stagedFiles.length > 0 && (
              <div className="mt-6 p-5 sm:p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-4 animate-in fade-in">
                {/* Queued Files Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dadce0] pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
                      <h4 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-[#1a73e8]" />
                        <span>Queued Files</span>
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#1a73e8] border border-[#d2e3fc]">
                        {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#5f6368]">
                        {formatBytes(totalSize)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5f6368]">
                      Review or remove individual files below before triggering the WebRTC connection
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-[#1a73e8] hover:bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                      title="Add more files to queue"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearAllFiles}
                      className="text-xs font-semibold text-[#d93025] hover:bg-red-50 px-3 py-1.5 rounded-full border border-red-200 transition-colors cursor-pointer"
                      title="Clear entire queue"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Queued Files Interactive Cards */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {stagedFiles.map((file, idx) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] hover:border-[#1a73e8] hover:bg-white transition-all flex items-center justify-between gap-3 text-xs group"
                    >
                      {/* Left: Thumbnail Preview or File Icon & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {file.previewUrl ? (
                          <div 
                            onClick={() => setPreviewModalFile(file)}
                            className="w-11 h-11 rounded-xl overflow-hidden border border-[#dadce0] shrink-0 bg-white relative cursor-pointer group-hover:ring-2 group-hover:ring-[#1a73e8]/30 transition-all"
                            title="Click to preview image"
                          >
                            <img
                              src={file.previewUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-white border border-[#dadce0] flex items-center justify-center shrink-0 shadow-2xs">
                            {getFileIcon(file.type)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-[#70757a] bg-white px-1.5 py-0.5 rounded border border-[#dadce0]">
                              #{idx + 1}
                            </span>
                            <p className="text-[#202124] font-semibold truncate max-w-[180px] sm:max-w-xs" title={file.name}>
                              {file.name}
                            </p>
                            {isCompressibleTextFile(file.name, file.type) && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-[#1a73e8] border border-[#d2e3fc] font-medium">
                                Text • pako ready
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-[#5f6368] mt-0.5">
                            <span className="font-mono">{formatBytes(file.size)}</span>
                            {file.relativePath && file.relativePath !== file.name && (
                              <span className="text-[10px] text-[#1a73e8] flex items-center gap-1 font-mono truncate max-w-[150px]" title={file.relativePath}>
                                <Folder className="w-3 h-3 shrink-0" />
                                {file.relativePath}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Interactive Actions (Preview + Prominent Remove) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {file.previewUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile(file)}
                            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#1a73e8] hover:bg-white border border-transparent hover:border-[#dadce0] transition-colors cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#d93025] bg-red-50 hover:bg-red-100 hover:text-[#b31412] border border-red-200 active:scale-95 transition-all cursor-pointer"
                          title={`Remove ${file.name} from selection`}
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pre-flight Transmission Diagnostics Banner */}
                <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs text-[#3c4043]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#34A853] shrink-0" />
                    <span>
                      RAM-to-RAM DataChannel Ready • <strong className="text-[#1a73e8]">DTLS 1.2 Encrypted</strong>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#5f6368]">
                    Est. delivery: {totalSize < 20 * 1024 * 1024 ? '< 1 sec' : `~${Math.max(1, Math.round(totalSize / (50 * 1024 * 1024)))}s`} on local Wi-Fi
                  </span>
                </div>

                {/* File Compression Setting Checkbox */}
                <div className="p-3.5 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] transition-colors flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="compress-text-files"
                    checked={compressTextFiles}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCompressTextFiles(checked);
                      webrtc?.setCompressTextFiles(checked);
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-[#dadce0] text-[#1a73e8] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="compress-text-files" className="flex-1 cursor-pointer select-none">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#202124]">
                        Compress text files before sending
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#34A853] border border-emerald-200">
                        pako Deflate
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5f6368] mt-0.5">
                      Automatically compresses text-based files (.txt, .json, .md) to speed up transfer times. Decompressed seamlessly on recipient device.
                    </p>
                  </label>
                </div>

                {/* Transfer Security & Expiration Options */}
                <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] text-xs space-y-2">
                  <div 
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <div className="flex items-center gap-2 text-[#202124] font-medium">
                      <Sliders className="w-3.5 h-3.5 text-[#1a73e8]" />
                      <span>Transfer Preferences</span>
                    </div>
                    <span className="text-[11px] text-[#1a73e8] font-medium">
                      {showSettings ? 'Hide Options' : 'Configure Expiry'}
                    </span>
                  </div>

                  {showSettings && (
                    <div className="pt-2 border-t border-[#dadce0] space-y-3">
                      <div>
                        <label className="block text-[#5f6368] text-[11px] mb-1">Session Expiration</label>
                        <select
                          value={settings.expirationHours}
                          onChange={(e) => setSettings({ ...settings, expirationHours: Number(e.target.value) })}
                          className="w-full bg-white border border-[#dadce0] rounded-lg p-2 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                        >
                          <option value={1}>Auto-expire after 1 hour</option>
                          <option value={24}>Auto-expire after 24 hours (Default)</option>
                          <option value={168}>Auto-expire after 7 days</option>
                          <option value={0}>Never expire (until session closed)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="destruct-cb"
                          checked={settings.selfDestructAfterDownload}
                          onChange={(e) => setSettings({ ...settings, selfDestructAfterDownload: e.target.checked })}
                          className="rounded text-[#1a73e8] border-[#dadce0] focus:ring-0"
                        />
                        <label htmlFor="destruct-cb" className="text-[#3c4043] text-[11px] cursor-pointer">
                          Self-destruct link immediately after 1 successful download
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Code & Serverless Local Wi-Fi Mode CTAs */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleCreateCode}
                    className="w-full py-3.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Initiate WebRTC Transfer ({stagedFiles.length} Queued {stagedFiles.length === 1 ? 'File' : 'Files'} • {formatBytes(totalSize)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#5f6368] py-0.5">
                    <QrCode className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
                    <span>Generates instant mobile scan QR code & WhatsApp share link</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenOfflineModal?.()}
                    className="w-full py-2.5 px-4 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#137333] border border-[#ceead6] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Wifi className="w-4 h-4 text-[#34A853]" />
                    <span>Serverless Local Wi-Fi / Hotspot Mode (100% Offline)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Text Snippet / SecureNote Mode */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0]">
              <label className="block text-xs font-semibold text-[#202124] mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#EA4335]" />
                <span>SecureNote & Confidential Snippet</span>
              </label>
              <textarea
                value={textSnippet}
                onChange={(e) => setTextSnippet(e.target.value)}
                rows={6}
                placeholder="Paste confidential credentials, API keys, Wi-Fi passwords, or sensitive links here. Delivered directly browser-to-browser via WebRTC without touching any server."
                className="w-full bg-white border border-[#dadce0] rounded-xl p-3 text-xs sm:text-sm text-[#202124] placeholder-[#70757a] focus:outline-none focus:border-[#1a73e8] font-mono resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-[#5f6368] mt-2">
                <span>Direct end-to-end P2P delivery</span>
                <span>{textSnippet.length} characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleCreateCode}
                disabled={!textSnippet.trim()}
                className="w-full py-3.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>Share SecureNote Snippet</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onOpenOfflineModal?.()}
                className="w-full py-2.5 px-4 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#137333] border border-[#ceead6] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Wifi className="w-4 h-4 text-[#34A853]" />
                <span>Serverless Local Wi-Fi / Hotspot Mode (100% Offline)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Room Created: Active Session & QR Code View
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Google Style Session Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#dadce0] google-card-shadow relative overflow-hidden">
        {/* Google 4-Color Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pt-2">
          {/* Left: 6-Character Code & Share Link */}
          <div className="flex-1 text-center md:text-left space-y-3 w-full">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-[#188038]">
                Session Active • Ready to Transfer
              </span>
            </div>

            <h3 className="text-sm font-medium text-[#5f6368]">
              Recipient can enter this 6-character code or scan the QR code to connect:
            </h3>

            {/* Code Box */}
            <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-[#f8f9fa] border border-[#dadce0]">
              <div className="flex gap-1.5 px-2">
                {roomCode.split('').map((char, idx) => (
                  <span
                    key={idx}
                    className="w-8 sm:w-10 h-10 sm:h-12 flex items-center justify-center text-lg sm:text-2xl font-black font-mono text-[#1a73e8] bg-white rounded-xl border border-[#dadce0] shadow-2xs"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={copyRoomCode}
                className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-[#1a73e8] hover:bg-blue-100 transition-colors cursor-pointer"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-[#34a853]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {/* Direct Link & Expand Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1 justify-center md:justify-start">
              <button
                type="button"
                onClick={copyShareLink}
                className="flex items-center gap-2 text-xs text-[#3c4043] hover:text-[#202124] bg-[#f8f9fa] hover:bg-[#f1f3f4] px-3.5 py-1.5 rounded-full border border-[#dadce0] transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Share2 className="w-3.5 h-3.5 text-[#5f6368]" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQRModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:bg-blue-50 px-3.5 py-1.5 rounded-full border border-[#1a73e8]/30 transition-colors cursor-pointer font-medium"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand Fullscreen QR</span>
              </button>
            </div>
          </div>

          {/* Right: QR Code Generator & Instant Mobile Share Hub */}
          <div className="flex flex-col items-center text-center w-full md:w-auto shrink-0 bg-[#f8f9fa] p-4 rounded-2xl border border-[#dadce0] shadow-2xs">
            <div className="flex items-center justify-between w-full mb-2.5 px-1 gap-2">
              <span className="text-[11px] font-bold text-[#202124] flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#1a73e8]" />
                Mobile QR Connect
              </span>
              <span className="text-[10px] text-[#137333] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                Instant Auto-Join
              </span>
            </div>

            {/* QR Image Frame */}
            {qrCodeDataUrl ? (
              <div 
                onClick={() => setIsQRModalOpen(true)}
                className="p-2.5 bg-white rounded-xl border border-[#dadce0] shadow-2xs hover:border-[#1a73e8] transition-all cursor-pointer group relative"
                title="Click to expand fullscreen QR"
              >
                <img
                  src={qrCodeDataUrl}
                  alt={`InstaSend QR Code for room ${roomCode}`}
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg"
                />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                  <span className="bg-black/75 text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" /> Tap to Expand
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-36 h-36 flex items-center justify-center text-xs text-[#5f6368]">
                Generating QR...
              </div>
            )}

            <p className="text-[11px] text-[#5f6368] mt-2 max-w-[200px] leading-tight">
              Scan with mobile camera to connect and receive files instantly
            </p>

            {/* Direct WhatsApp Share Button */}
            <div className="w-full mt-3 space-y-1.5">
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="w-full py-2 px-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Share session invite on WhatsApp"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>Share on WhatsApp</span>
              </button>

              {/* Multi-App Share, Save Image, and Telegram row */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex-1 py-1.5 px-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] active:scale-95 text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                  title="Share to installed apps"
                >
                  <Share2 className="w-3 h-3 shrink-0" />
                  <span>Share App...</span>
                </button>

                <button
                  type="button"
                  onClick={downloadQR}
                  className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Download PNG QR image"
                >
                  <Download className="w-3 h-3 text-[#5f6368]" />
                  <span>Save QR</span>
                </button>

                <button
                  type="button"
                  onClick={shareOnTelegram}
                  className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#0088cc]/10 hover:text-[#0088cc] hover:border-[#0088cc]/30 text-[#3c4043] border border-[#dadce0] text-[11px] font-medium flex items-center justify-center transition-colors cursor-pointer"
                  title="Share on Telegram"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-[#0088cc]" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.923z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Peer Connection Status */}
        <div className="mt-6 pt-6 border-t border-[#dadce0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {remotePeerInfo ? (
              <div className="flex items-center gap-2 text-xs text-[#137333] bg-green-50 border border-[#ceead6] px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-[#34a853]" />
                <span>Connected to <strong>{remotePeerInfo.name}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#5f6368]">
                <RefreshCw className="w-3.5 h-3.5 text-[#1a73e8] animate-spin" />
                <span>Waiting for recipient to connect...</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {remotePeerInfo && state !== 'transferring' && state !== 'completed' && (
              <button
                onClick={handleStartTransfer}
                className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Start Transfer Now</span>
              </button>
            )}

            {remotePeerInfo && (
              <button
                onClick={() => setShowChat(!showChat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                  showChat 
                    ? 'bg-[#f1f3f4] border-[#dadce0] text-[#202124]' 
                    : 'bg-white border-[#dadce0] text-[#5f6368] hover:text-[#202124]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                {chatMessages.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#34A853]" />
                )}
              </button>
            )}

            <button
              onClick={onReset}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* SENDER'S SYSTEM: Live Upload Speed & Progress Card */}
      {(state === 'transferring' || state === 'completed') && metrics && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                  {state === 'completed' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#34A853]" />
                      <span>Upload Complete!</span>
                    </>
                  ) : (
                    <>
                      <ArrowUp className="w-4 h-4 text-[#1a73e8] animate-bounce" />
                      <span>Sending Files via WebRTC</span>
                    </>
                  )}
                </h4>
                <p className="text-xs text-[#5f6368] mt-0.5">
                  {formatBytes(metrics.bytesTransferred)} of {formatBytes(metrics.totalBytes)} ({metrics.percent}%)
                </p>
              </div>

              {/* Upload Speed Display on Sender's System */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-xs text-[#5f6368]">
                  <span className="w-2 h-2 rounded-full bg-[#1a73e8] animate-ping" />
                  <span>Upload Speed</span>
                </div>
                <span className="text-lg font-mono font-bold text-[#1a73e8]">
                  {state === 'completed' ? 'Done' : metrics.formattedSpeed}
                </span>
                {state === 'transferring' && (
                  <p className="text-[11px] text-[#70757a]">ETA: {formatDuration(metrics.etaSeconds)}</p>
                )}
              </div>
            </div>

            {/* Google Blue Progress Bar */}
            <div className="w-full bg-[#f1f3f4] rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#1a73e8] h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#5f6368] font-mono">
              <span>Chunks: {metrics.chunksCompleted} / {metrics.totalChunks} (64KB packets)</span>
              <span className="flex items-center gap-1 text-[#188038]">
                <ShieldCheck className="w-3.5 h-3.5" /> DTLS 1.2 Encrypted
              </span>
            </div>
          </div>

          {/* Live Mbps Speedometer Gauge & Recharts Line Chart Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <SpeedGauge
                speedBytesPerSec={metrics.speedBytesPerSec}
                isActive={state === 'transferring'}
                isCompleted={state === 'completed'}
                speedType="upload"
              />
            </div>
            <div className="md:col-span-3">
              <SpeedChart
                speedBytesPerSec={metrics.speedBytesPerSec}
                bytesTransferred={metrics.bytesTransferred}
                totalBytes={metrics.totalBytes}
                isActive={state === 'transferring'}
                isCompleted={state === 'completed'}
                speedType="upload"
              />
            </div>
          </div>
        </div>
      )}

      {/* Completed Success Action */}
      {state === 'completed' && (
        <div className="p-4 rounded-2xl bg-green-50 border border-[#ceead6] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-[#34A853] flex items-center justify-center border border-[#ceead6]">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#137333]">All files sent successfully</p>
              <p className="text-[11px] text-[#5f6368]">The recipient has downloaded and validated your files.</p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Send More Files
          </button>
        </div>
      )}

      {/* Chat Drawer */}
      {showChat && (
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#dadce0] pb-2">
            <h5 className="text-xs font-semibold text-[#202124] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#1a73e8]" />
              Peer Chat
            </h5>
            <span className="text-[10px] text-[#5f6368]">Encrypted via WebRTC</span>
          </div>

          <div className="h-40 overflow-y-auto space-y-2 pr-1 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-center text-[#5f6368] py-6">No messages yet. Send a note or link!</p>
            ) : (
              chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'self' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      msg.sender === 'self'
                        ? 'bg-[#1a73e8] text-white rounded-br-xs'
                        : 'bg-[#f1f3f4] text-[#202124] rounded-bl-xs'
                    }`}
                  >
                    <p className="break-words">{msg.text}</p>
                    <span className="text-[9px] opacity-70 block text-right mt-0.5">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message to recipient..."
              className="flex-1 bg-[#f8f9fa] border border-[#dadce0] rounded-full px-4 py-1.5 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
            />
            <button
              type="submit"
              className="p-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors"
            >
              <SendIcon className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Staged Files Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[#5f6368] px-1">Files in Session</h4>
        <div className="space-y-2">
          {stagedFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#dadce0] text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(file.type)}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[#202124] font-medium truncate">{file.name}</p>
                    {file.isCompressed && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#34A853] border border-emerald-200 font-medium">
                        Deflated (-{file.savedPercentage || 0}%)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5f6368]">{formatBytes(file.size)}</p>
                </div>
              </div>
              <span className={`text-[11px] font-semibold ${
                file.status === 'completed'
                  ? 'text-[#34A853]'
                  : file.status === 'transferring'
                  ? 'text-[#1a73e8]'
                  : 'text-[#5f6368]'
              }`}>
                {file.status === 'completed' ? 'Sent' : file.status === 'transferring' ? `${file.progress}%` : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomCode={roomCode}
      />

      {/* Sending Queue File Preview Modal */}
      {previewModalFile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalFile(null)}
        >
          <div 
            className="bg-white border border-[#dadce0] rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(previewModalFile.type)}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#202124] truncate">
                    {previewModalFile.name}
                  </h4>
                  <p className="text-[11px] text-[#5f6368] font-mono">
                    {formatBytes(previewModalFile.size)} • {previewModalFile.type || 'Binary'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="text-[#5f6368] hover:text-[#202124] text-xs px-3 py-1.5 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto flex items-center justify-center p-2 bg-[#f8f9fa] rounded-2xl border border-[#dadce0]">
              {previewModalFile.previewUrl ? (
                <img
                  src={previewModalFile.previewUrl}
                  alt={previewModalFile.name}
                  className="max-h-80 object-contain rounded-xl shadow-xs"
                />
              ) : (
                <div className="py-12 text-center text-xs text-[#5f6368] space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-[#1a73e8]" />
                  <p>Preview ready for WebRTC transmission</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-[#137333] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853]" /> Staged in Sending Queue
              </span>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="px-4 py-1.5 rounded-full bg-[#1a73e8] text-white font-medium hover:bg-[#1557b0] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
