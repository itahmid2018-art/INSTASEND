import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  Eye, 
  MessageSquare, 
  Send as SendIcon,
  PackageCheck,
  AlertCircle
} from 'lucide-react';
import { FileItem, TransferMetrics, DeviceInfo, ChatMessage } from '../types.ts';
import { formatBytes, formatDuration } from '../services/device.ts';
import { sound } from '../services/sound.ts';
import { WebRTCManager } from '../services/webrtc.ts';

interface ReceiveTabProps {
  webrtc: WebRTCManager | null;
  state: string;
  roomCode: string | null;
  remotePeerInfo: DeviceInfo | null;
  metrics: TransferMetrics | null;
  receivedFiles: FileItem[];
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onReset: () => void;
  initialCode?: string;
  errorMessage?: string | null;
}

export const ReceiveTab: React.FC<ReceiveTabProps> = ({
  webrtc,
  state,
  roomCode,
  remotePeerInfo,
  metrics,
  receivedFiles,
  chatMessages,
  onSendChat,
  onReset,
  initialCode = '',
  errorMessage
}) => {
  const [inputCode, setInputCode] = useState(initialCode.toUpperCase());
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string>('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Auto-fill from URL param if available
  useEffect(() => {
    if (initialCode && !roomCode) {
      setInputCode(initialCode.toUpperCase());
    }
  }, [initialCode, roomCode]);

  // Confetti on completed
  useEffect(() => {
    if (state === 'completed' && receivedFiles.length > 0) {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 }
      });
      sound.playSuccess();
    }
  }, [state, receivedFiles]);

  // Load preview text if text file selected
  useEffect(() => {
    if (previewFile?.blob && (previewFile.type.startsWith('text/') || previewFile.name.endsWith('.txt'))) {
      previewFile.blob.text().then(text => {
        setPreviewTextContent(text);
      });
    } else {
      setPreviewTextContent('');
    }
  }, [previewFile]);

  const handleCodeChange = (val: string) => {
    // If user pasted a full URL like https://.../?code=HEX89A
    if (val.includes('code=')) {
      const match = val.match(/code=([A-Za-z0-9]{4,8})/);
      if (match) {
        val = match[1];
      }
    }
    const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setInputCode(clean);

    // Auto submit if 6 characters
    if (clean.length === 6 && state === 'idle') {
      sound.playConnect();
      webrtc?.joinRoom(clean);
    }
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputCode.length < 4) return;
    sound.playConnect();
    webrtc?.joinRoom(inputCode);
  };

  const downloadFile = (fileItem: FileItem) => {
    if (!fileItem.blob) return;
    const url = URL.createObjectURL(fileItem.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadAllAsZip = async () => {
    if (receivedFiles.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const item of receivedFiles) {
        if (item.blob) {
          zip.file(item.name, item.blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hexasend-bundle-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const copyTextSnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-purple-400" />;
    if (type.startsWith('video/')) return <Film className="w-5 h-5 text-rose-400" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-amber-400" />;
    if (type.includes('zip') || type.includes('compressed')) return <Archive className="w-5 h-5 text-yellow-400" />;
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  // 1. Initial State: Code Entry
  if (!roomCode) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mx-auto shadow-xl">
            <Download className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white">Receive Files</h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Enter the 6-character code from the sender to connect directly.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 text-center uppercase tracking-wider">
              6-Character Transfer Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="E.G. HEX729"
                maxLength={6}
                autoFocus
                className="w-full bg-slate-900/90 border-2 border-slate-700/80 focus:border-emerald-500 text-center text-2xl sm:text-3xl font-mono font-black tracking-widest text-emerald-400 rounded-2xl py-4 uppercase focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Letters and numbers are automatically capitalized
            </p>
          </div>

          <button
            type="submit"
            disabled={inputCode.length < 4}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Connect & Receive</span>
          </button>
        </form>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Direct P2P Transfer</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Data flows directly from the sender's browser to yours via WebRTC DataChannels. Nothing is stored on any cloud server.
          </p>
        </div>
      </div>
    );
  }

  // 2. Active Session: Connecting, Receiving, or Completed
  return (
    <div className="space-y-6">
      {/* Session Status Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                Connected • Code: <strong className="font-mono text-white">{roomCode}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sender: <strong className="text-slate-200">{remotePeerInfo?.name || 'Sender Device'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
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

            <button
              onClick={onReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Live Transfer Metrics */}
        {metrics && (state === 'transferring' || state === 'completed') && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                {state === 'completed' ? 'Transfer complete!' : 'Receiving data stream...'}
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {state === 'transferring' ? metrics.formattedSpeed : `${formatBytes(metrics.totalBytes)} total`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-[1px]">
              <div
                className="bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${metrics.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>{formatBytes(metrics.bytesTransferred)} / {formatBytes(metrics.totalBytes)} ({metrics.percent}%)</span>
              {state === 'transferring' && <span>ETA: {formatDuration(metrics.etaSeconds)}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Completed Success Action Toolbar */}
      {state === 'completed' && receivedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">
                {receivedFiles.length} {receivedFiles.length === 1 ? 'file' : 'files'} received and verified
              </p>
              <p className="text-[11px] text-slate-400">
                All chunks validated with SHA-256 integrity checksums.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {receivedFiles.length > 1 && (
              <button
                onClick={downloadAllAsZip}
                disabled={isZipping}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                <span>{isZipping ? 'Zipping...' : 'Download All as ZIP'}</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Chat Drawer */}
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
              <p className="text-center text-slate-500 py-6">No messages yet. Say hello to the sender!</p>
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
              placeholder="Type message to sender..."
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

      {/* Files List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-400 px-1">
          Incoming Files ({receivedFiles.length})
        </h4>

        {receivedFiles.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Waiting for sender to initialize the file stream...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receivedFiles.map(file => (
              <div
                key={file.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="min-w-0">
                      <p className="text-slate-200 font-medium text-xs sm:text-sm truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{formatBytes(file.size)}</span>
                        {file.sha256 && (
                          <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]" title={`SHA-256: ${file.sha256}`}>
                            <ShieldCheck className="w-3 h-3" /> SHA-256 Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Preview Button */}
                    {file.blob && (file.type.startsWith('image/') || file.type.startsWith('text/') || file.name.endsWith('.txt')) && (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                    )}

                    {/* Download Button */}
                    {file.blob ? (
                      <button
                        onClick={() => downloadFile(file)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-cyan-400 font-semibold">
                        {file.progress}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar per file if transferring */}
                {file.status === 'transferring' && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-200"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(previewFile.type)}
                <h4 className="text-sm font-bold text-white truncate">{previewFile.name}</h4>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            {/* Content Preview */}
            <div className="max-h-96 overflow-y-auto">
              {previewFile.type.startsWith('image/') && previewFile.previewUrl && (
                <div className="flex justify-center bg-slate-950 rounded-xl p-2">
                  <img
                    src={previewFile.previewUrl}
                    alt={previewFile.name}
                    className="max-h-80 object-contain rounded-lg"
                  />
                </div>
              )}

              {previewTextContent && (
                <div className="relative">
                  <pre className="bg-slate-950 rounded-xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap break-words border border-slate-800">
                    {previewTextContent}
                  </pre>
                  <button
                    onClick={() => copyTextSnippet(previewTextContent)}
                    className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">{formatBytes(previewFile.size)}</span>
              <button
                onClick={() => downloadFile(previewFile)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Disk</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
