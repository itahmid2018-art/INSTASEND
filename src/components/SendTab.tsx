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
  Maximize2
} from 'lucide-react';
import { FileItem, TransferMetrics, DeviceInfo, ChatMessage, TransferSettings } from '../types.ts';
import { formatBytes, formatDuration } from '../services/device.ts';
import { sound } from '../services/sound.ts';
import { WebRTCManager } from '../services/webrtc.ts';
import { extractFilesAndFoldersFromDataTransfer } from '../services/folderDrop.ts';
import { QRCodeModal } from './QRCodeModal.tsx';
import { isCompressibleTextFile } from '../services/compression.ts';
import { SpeedChart } from './SpeedChart.tsx';

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
  onSelectRadarPeer
}) => {
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textSnippet, setTextSnippet] = useState('');
  const [mode, setMode] = useState<'files' | 'text'>('files');
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
      const updated = prev.filter(f => f.id !== id);
      onFilesStaged?.(updated);
      return updated;
    });
  };

  const clearAllFiles = () => {
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
      const virtualFile = new File([blob], 'encrypted-note.txt', { type: 'text/plain' });
      const item: FileItem = {
        id: Math.random().toString(36).substring(2, 11),
        name: 'encrypted-note.txt',
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

  // 1. Initial State: Staging Files or Text
  if (!roomCode) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Google Style Mode Selector */}
        <div className="flex items-center justify-center p-1 bg-[#f8f9fa] rounded-full border border-[#dadce0] max-w-xs mx-auto">
          <button
            onClick={() => setMode('files')}
            className={`flex-1 py-1.5 px-4 text-xs rounded-full font-medium transition-all ${
              mode === 'files'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            Files & Folders
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 py-1.5 px-4 text-xs rounded-full font-medium transition-all ${
              mode === 'text'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            Encrypted Note
          </button>
        </div>

        {mode === 'files' ? (
          <div>
            {/* Google Style Drag & Drop Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#4285F4] bg-blue-50/60 scale-[1.01]'
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
                  <h3 className="text-base sm:text-lg font-medium text-[#202124]">
                    {isScanningFolders ? 'Reading folder hierarchy...' : 'Drop files or folders here'}
                  </h3>
                  <p className="text-xs text-[#5f6368] mt-1">
                    Drag and drop local files, folders, or click to browse.
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
                    className="px-4 py-2 rounded-full text-xs font-medium bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Select Files
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-full text-xs font-medium bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#5f6368]" />
                    <span>Upload Folder</span>
                  </button>
                </div>

                <span className="text-[11px] text-[#70757a] mt-1 font-mono">
                  Recursive subdirectories & multi-file drop supported
                </span>
              </div>
            </div>

            {/* Folder Drop Alert Banner */}
            {folderDropNotice && (
              <div className="mt-4 p-3 rounded-xl bg-green-50 border border-[#ceead6] text-xs text-[#137333] flex items-center gap-2 animate-in fade-in">
                <Folder className="w-4 h-4 text-[#34a853] shrink-0" />
                <span className="font-medium">{folderDropNotice}</span>
              </div>
            )}

            {/* Staged Files List */}
            {stagedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#5f6368] px-1">
                  <span>Selected ({stagedFiles.length} items • {formatBytes(totalSize)})</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#1a73e8] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Files
                    </button>
                    <button
                      onClick={() => folderInputRef.current?.click()}
                      className="text-[#1a73e8] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Add Folder
                    </button>
                    <button
                      onClick={clearAllFiles}
                      className="text-[#d93025] hover:underline transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {stagedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(file.type)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[#202124] font-medium truncate">{file.name}</p>
                            {isCompressibleTextFile(file.name, file.type) && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-[#1a73e8] border border-[#d2e3fc] font-medium">
                                Text • pako ready
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#5f6368]">
                            <span>{formatBytes(file.size)}</span>
                            {file.relativePath && file.relativePath !== file.name && (
                              <span className="text-[10px] text-[#1a73e8] flex items-center gap-1 font-mono truncate max-w-[200px]" title={file.relativePath}>
                                <Folder className="w-3 h-3 shrink-0" />
                                {file.relativePath}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        className="p-1.5 rounded-full text-[#5f6368] hover:text-[#d93025] hover:bg-[#f1f3f4] transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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

                {/* Generate Code CTA */}
                <button
                  onClick={handleCreateCode}
                  className="w-full py-3.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Generate Code & QR</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Text Snippet / Secure Note Mode */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0]">
              <label className="block text-xs font-medium text-[#202124] mb-2">
                Secure Note or URL Link
              </label>
              <textarea
                value={textSnippet}
                onChange={(e) => setTextSnippet(e.target.value)}
                rows={6}
                placeholder="Paste confidential credentials, API keys, WiFi password, or long links here. Delivered directly browser-to-browser via WebRTC without hitting any database."
                className="w-full bg-white border border-[#dadce0] rounded-xl p-3 text-xs sm:text-sm text-[#202124] placeholder-[#70757a] focus:outline-none focus:border-[#1a73e8] font-mono resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-[#5f6368] mt-2">
                <span>Direct end-to-end P2P delivery</span>
                <span>{textSnippet.length} characters</span>
              </div>
            </div>

            <button
              onClick={handleCreateCode}
              disabled={!textSnippet.trim()}
              className="w-full py-3.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <span>Share Secure Snippet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
          {/* 6-Character Code */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-[#188038]">
                Session Active • Ready to Transfer
              </span>
            </div>

            <h3 className="text-sm font-medium text-[#5f6368]">
              Recipient can enter this 6-character code or scan the QR:
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
                onClick={copyRoomCode}
                className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-[#1a73e8] hover:bg-blue-100 transition-colors cursor-pointer"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-[#34a853]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {/* Share Link Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 justify-center sm:justify-start">
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 text-xs text-[#3c4043] hover:text-[#202124] bg-[#f8f9fa] hover:bg-[#f1f3f4] px-3.5 py-1.5 rounded-full border border-[#dadce0] transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Share2 className="w-3.5 h-3.5 text-[#5f6368]" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Share Link'}</span>
              </button>

              <button
                onClick={() => setIsQRModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:bg-blue-50 px-3.5 py-1.5 rounded-full border border-[#1a73e8]/30 transition-colors cursor-pointer font-medium"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand QR</span>
              </button>
            </div>
          </div>

          {/* QR Code Card */}
          {qrCodeDataUrl && (
            <div 
              onClick={() => setIsQRModalOpen(true)}
              className="flex flex-col items-center text-center cursor-pointer group"
              title="Click to view full QR code modal"
            >
              <div className="p-2 bg-white rounded-2xl border border-[#dadce0] shadow-xs group-hover:border-[#1a73e8] transition-colors">
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code for ${roomCode}`}
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-lg"
                />
              </div>
              <span className="text-[11px] text-[#1a73e8] group-hover:underline mt-2 flex items-center gap-1 font-medium">
                <QrCode className="w-3.5 h-3.5" /> Scan on phone
              </span>
            </div>
          )}
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

          {/* Recharts Live Mbps Speed Line Chart */}
          <SpeedChart
            speedBytesPerSec={metrics.speedBytesPerSec}
            bytesTransferred={metrics.bytesTransferred}
            totalBytes={metrics.totalBytes}
            isActive={state === 'transferring'}
            isCompleted={state === 'completed'}
            speedType="upload"
          />
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
    </div>
  );
};
