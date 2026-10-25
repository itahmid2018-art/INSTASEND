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
  Plus
} from 'lucide-react';
import { FileItem, TransferMetrics, DeviceInfo, ChatMessage } from '../types.ts';
import { formatBytes, formatDuration } from '../services/device.ts';
import { sound } from '../services/sound.ts';
import { WebRTCManager } from '../services/webrtc.ts';

interface SendTabProps {
  webrtc: WebRTCManager | null;
  state: string;
  roomCode: string | null;
  remotePeerInfo: DeviceInfo | null;
  metrics: TransferMetrics | null;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onReset: () => void;
}

export const SendTab: React.FC<SendTabProps> = ({
  webrtc,
  state,
  roomCode,
  remotePeerInfo,
  metrics,
  chatMessages,
  onSendChat,
  onReset
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate QR code whenever roomCode is set
  useEffect(() => {
    if (roomCode) {
      const shareUrl = `${window.location.origin}/?code=${roomCode}`;
      QRCode.toDataURL(shareUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
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
      file,
      progress: 0,
      bytesTransferred: 0,
      status: 'pending'
    }));

    setStagedFiles(prev => [...prev, ...newFiles]);
    sound.playStart();
  };

  const removeFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setStagedFiles([]);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-purple-400" />;
    if (type.startsWith('video/')) return <Film className="w-5 h-5 text-rose-400" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-amber-400" />;
    if (type.includes('zip') || type.includes('tar') || type.includes('rar') || type.includes('compressed')) {
      return <Archive className="w-5 h-5 text-yellow-400" />;
    }
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  const handleCreateCode = () => {
    if (mode === 'text' && textSnippet.trim()) {
      // Create a virtual text file from the snippet
      const blob = new Blob([textSnippet], { type: 'text/plain;charset=utf-8' });
      const virtualFile = new File([blob], 'note-snippet.txt', { type: 'text/plain' });
      const item: FileItem = {
        id: Math.random().toString(36).substring(2, 11),
        name: 'note-snippet.txt',
        size: blob.size,
        type: 'text/plain',
        file: virtualFile,
        progress: 0,
        bytesTransferred: 0,
        status: 'pending'
      };
      setStagedFiles([item]);
      webrtc?.createRoom([item]);
    } else {
      if (stagedFiles.length === 0) return;
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
      <div className="space-y-6">
        {/* Mode Selector */}
        <div className="flex items-center justify-center p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 max-w-sm mx-auto">
          <button
            onClick={() => setMode('files')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'files'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Files & Folders
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'text'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Encrypted Note / Link
          </button>
        </div>

        {mode === 'files' ? (
          <div>
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelection(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-950/20 scale-[1.01]'
                  : 'border-slate-700/80 hover:border-emerald-500/60 bg-slate-900/40 hover:bg-slate-900/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files)}
              />

              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-xl group-hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Choose files or drop them here
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Send photos, documents, videos, or archives of any size.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
                    Unlimited Size
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
                    Zero Cloud Storage
                  </span>
                </div>
              </div>
            </div>

            {/* Staged Files List */}
            {stagedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Selected ({stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'}, {formatBytes(totalSize)})</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add More
                    </button>
                    <button
                      onClick={clearAllFiles}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {stagedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(file.type)}
                        <div className="min-w-0">
                          <p className="text-slate-200 font-medium truncate text-xs sm:text-sm">{file.name}</p>
                          <p className="text-[11px] text-slate-500">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Generate Code CTA */}
                <button
                  onClick={handleCreateCode}
                  className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>Generate Transfer Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Text Snippet / Secure Note Mode */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Secure Note, Link, or Secret Snippet
              </label>
              <textarea
                value={textSnippet}
                onChange={(e) => setTextSnippet(e.target.value)}
                rows={6}
                placeholder="Paste confidential credentials, API keys, WiFi password, or long links here. Delivered directly browser-to-browser via WebRTC without hitting any database."
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2">
                <span>Direct end-to-end P2P delivery</span>
                <span>{textSnippet.length} characters</span>
              </div>
            </div>

            <button
              onClick={handleCreateCode}
              disabled={!textSnippet.trim()}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>Share Secure Snippet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Room Created: Waiting for Receiver or In Transfer
  return (
    <div className="space-y-6">
      {/* Code & QR Hero Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* 6-Character Code */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                Session Active • Ready to Transfer
              </span>
            </div>

            <h3 className="text-sm font-semibold text-slate-400">
              Tell the recipient to enter this 6-character code:
            </h3>

            {/* Code Box */}
            <div className="inline-flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-emerald-500/40 shadow-inner">
              <div className="flex gap-1.5 px-2">
                {roomCode.split('').map((char, idx) => (
                  <span
                    key={idx}
                    className="w-8 sm:w-10 h-10 sm:h-12 flex items-center justify-center text-lg sm:text-2xl font-extrabold font-mono text-emerald-400 bg-slate-900 rounded-lg border border-slate-800"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={copyRoomCode}
                className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-colors"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {/* Share Link Row */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Share Link'}</span>
              </button>
            </div>
          </div>

          {/* QR Code */}
          {qrCodeDataUrl && (
            <div className="flex flex-col items-center text-center">
              <div className="p-2 bg-white rounded-xl shadow-lg border border-slate-700">
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code for ${roomCode}`}
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-medium">
                <QrCode className="w-3.5 h-3.5 text-slate-500" /> Scan with camera
              </span>
            </div>
          )}
        </div>

        {/* Peer Connection Status */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {remotePeerInfo ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Connected to <strong>{remotePeerInfo.name}</strong> ({remotePeerInfo.browser})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                <span>Waiting for recipient to connect...</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {remotePeerInfo && state !== 'transferring' && state !== 'completed' && (
              <button
                onClick={handleStartTransfer}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Start Transfer Now</span>
              </button>
            )}

            {remotePeerInfo && (
              <button
                onClick={() => setShowChat(!showChat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                  showChat 
                    ? 'bg-slate-800 border-slate-700 text-white' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                {chatMessages.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            )}

            <button
              onClick={onReset}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Live Transfer Progress Card */}
      {(state === 'transferring' || state === 'completed') && metrics && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {state === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Transfer Complete!</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>Streaming via WebRTC DataChannel</span>
                  </>
                )}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatBytes(metrics.bytesTransferred)} of {formatBytes(metrics.totalBytes)} ({metrics.percent}%)
              </p>
            </div>

            {state === 'transferring' && (
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-emerald-400">{metrics.formattedSpeed}</span>
                <p className="text-[11px] text-slate-500">ETA: {formatDuration(metrics.etaSeconds)}</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-[1px]">
            <div
              className="bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Chunks: {metrics.chunksCompleted} / {metrics.totalChunks} (64KB chunks)</span>
            <span className="flex items-center gap-1 text-emerald-400/90">
              <ShieldCheck className="w-3.5 h-3.5" /> DTLS 1.2 End-to-End
            </span>
          </div>
        </div>
      )}

      {/* Completed Success Action */}
      {state === 'completed' && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-300">All files sent successfully</p>
              <p className="text-[11px] text-slate-400">The recipient has verified and downloaded your files.</p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Send More
          </button>
        </div>
      )}

      {/* Chat / Instant Messaging Drawer */}
      {showChat && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              Direct Peer Chat
            </h5>
            <span className="text-[10px] text-slate-500">Encrypted via WebRTC</span>
          </div>

          <div className="h-40 overflow-y-auto space-y-2 pr-1 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-center text-slate-500 py-6">No messages yet. Send a quick note or link!</p>
            ) : (
              chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'self' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.sender === 'self'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none'
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
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
            >
              <SendIcon className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Staged Files Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-400 px-1">Files in Session</h4>
        <div className="space-y-2">
          {stagedFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(file.type)}
                <div className="min-w-0">
                  <p className="text-slate-200 font-medium truncate">{file.name}</p>
                  <p className="text-[11px] text-slate-500">{formatBytes(file.size)}</p>
                </div>
              </div>
              <span className={`text-[11px] font-semibold ${
                file.status === 'completed'
                  ? 'text-emerald-400'
                  : file.status === 'transferring'
                  ? 'text-cyan-400'
                  : 'text-slate-500'
              }`}>
                {file.status === 'completed' ? 'Sent' : file.status === 'transferring' ? `${file.progress}%` : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
