import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  ArrowDown,
  Camera,
  QrCode
} from 'lucide-react';
import { FileItem, TransferMetrics, DeviceInfo, ChatMessage } from '../types.ts';
import { formatBytes, formatDuration } from '../services/device.ts';
import { sound } from '../services/sound.ts';
import { WebRTCManager } from '../services/webrtc.ts';
import { QRCodeModal } from './QRCodeModal.tsx';
import { SpeedChart } from './SpeedChart.tsx';

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
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // 6 discrete character input boxes
  const [charBoxes, setCharBoxes] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-fill from URL param if available
  useEffect(() => {
    if (initialCode && !roomCode) {
      const clean = initialCode.toUpperCase().slice(0, 6);
      setInputCode(clean);
      const parts = clean.split('');
      const boxes = ['', '', '', '', '', ''];
      parts.forEach((c, i) => { if (i < 6) boxes[i] = c; });
      setCharBoxes(boxes);
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

  const handleBoxChange = (index: number, val: string) => {
    if (val.length > 1) {
      handlePastedCode(val);
      return;
    }

    const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const newBoxes = [...charBoxes];
    newBoxes[index] = clean;
    setCharBoxes(newBoxes);

    const fullCode = newBoxes.join('');
    setInputCode(fullCode);

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (fullCode.length === 6 && state === 'idle') {
      sound.playConnect();
      webrtc?.joinRoom(fullCode);
    }
  };

  const handleBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !charBoxes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePastedCode = (pastedText: string) => {
    let code = pastedText;
    if (code.includes('code=')) {
      const match = code.match(/code=([A-Za-z0-9]{4,8})/);
      if (match) code = match[1];
    }
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    const newBoxes = ['', '', '', '', '', ''];
    for (let i = 0; i < clean.length; i++) {
      newBoxes[i] = clean[i];
    }
    setCharBoxes(newBoxes);
    setInputCode(clean);

    if (clean.length === 6 && state === 'idle') {
      sound.playConnect();
      webrtc?.joinRoom(clean);
    }
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = charBoxes.join('');
    if (fullCode.length < 4) return;
    sound.playConnect();
    webrtc?.joinRoom(fullCode);
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
          const zipPath = item.relativePath || item.name;
          zip.file(zipPath, item.blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instasend-bundle-${new Date().toISOString().slice(0, 10)}.zip`;
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
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#4285F4]" />;
    if (type.startsWith('video/')) return <Film className="w-5 h-5 text-[#EA4335]" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-[#FBBC05]" />;
    if (type.includes('zip') || type.includes('compressed')) return <Archive className="w-5 h-5 text-[#34A853]" />;
    return <FileText className="w-5 h-5 text-[#5f6368]" />;
  };

  // 1. Initial State: Code Entry
  if (!roomCode) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1a73e8] mx-auto shadow-xs">
            <Download className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-[#202124]">Receive Files</h3>
          <p className="text-xs sm:text-sm text-[#5f6368]">
            Enter the 6-character code or scan the QR code to connect directly.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#d93025] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#5f6368] text-center uppercase tracking-wider">
              6-Character Transfer Code
            </label>

            {/* Google Style 6 Segmented Character Boxes */}
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {charBoxes.map((char, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleBoxChange(index, e.target.value)}
                  onKeyDown={(e) => handleBoxKeyDown(index, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handlePastedCode(e.clipboardData.getData('text'));
                  }}
                  className="w-11 sm:w-13 h-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-black uppercase text-[#1a73e8] bg-white border-2 border-[#dadce0] focus:border-[#1a73e8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-all shadow-xs"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <p className="text-[11px] text-[#70757a] text-center">
              Paste code or URL directly into any box
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={charBoxes.join('').length < 4}
              className="w-full py-3.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Connect & Receive</span>
            </button>

            {/* Scan QR with Camera Button */}
            <button
              type="button"
              onClick={() => setIsQRScannerOpen(true)}
              className="w-full py-2.5 px-4 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#1a73e8]" />
              <span>Scan QR Code with Camera</span>
            </button>
          </div>
        </form>

        <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#3c4043] space-y-1.5">
          <div className="flex items-center gap-2 text-[#202124] font-medium">
            <ShieldCheck className="w-4 h-4 text-[#34A853]" />
            <span>Direct P2P WebRTC Transfer</span>
          </div>
          <p className="text-[11px] text-[#5f6368] leading-relaxed">
            Data flows directly from the sender's device to yours via encrypted WebRTC DataChannels. Nothing is stored on any cloud server.
          </p>
        </div>

        {/* QR Scanner Modal */}
        <QRCodeModal
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          roomCode={charBoxes.join('') || 'SCAN'}
          onCodeScanned={(scannedCode) => {
            handlePastedCode(scannedCode);
          }}
        />
      </div>
    );
  }

  // 2. Active Session: Connecting, Receiving, or Completed
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Session Status Banner */}
      <div className="p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-[#188038]">
                Connected • Code: <strong className="font-mono text-[#1a73e8]">{roomCode}</strong>
              </span>
            </div>
            <p className="text-xs text-[#5f6368] mt-1">
              Sender: <strong className="text-[#202124]">{remotePeerInfo?.name || 'Sender Device'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            <button
              onClick={onReset}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* RECEIVER'S SYSTEM: Live Download Speed & Metrics */}
        {metrics && (state === 'transferring' || state === 'completed') && (
          <div className="space-y-4 pt-3 border-t border-[#dadce0]">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#202124] font-medium flex items-center gap-1.5">
                  {state === 'completed' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#34A853]" />
                      <span>Download complete!</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4 text-[#1a73e8] animate-bounce" />
                      <span>Receiving data stream...</span>
                    </>
                  )}
                </span>

                {/* Download Speed Display on Receiver's System */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs text-[#5f6368]">
                    <span className="w-2 h-2 rounded-full bg-[#34A853] animate-ping" />
                    <span>Download Speed</span>
                  </div>
                  <span className="font-mono text-[#34A853] font-bold text-sm sm:text-base">
                    {state === 'transferring' ? metrics.formattedSpeed : `${formatBytes(metrics.totalBytes)} total`}
                  </span>
                </div>
              </div>

              {/* Google Green Progress Bar */}
              <div className="w-full bg-[#f1f3f4] rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#34A853] h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#5f6368] font-mono">
                <span>{formatBytes(metrics.bytesTransferred)} / {formatBytes(metrics.totalBytes)} ({metrics.percent}%)</span>
                {state === 'transferring' && <span>ETA: {formatDuration(metrics.etaSeconds)}</span>}
              </div>
            </div>

            {/* Recharts Live Mbps Speed Line Chart */}
            <SpeedChart
              speedBytesPerSec={metrics.speedBytesPerSec}
              bytesTransferred={metrics.bytesTransferred}
              totalBytes={metrics.totalBytes}
              isActive={state === 'transferring'}
              isCompleted={state === 'completed'}
              speedType="download"
            />
          </div>
        )}
      </div>

      {/* Completed Success Action Toolbar */}
      {state === 'completed' && receivedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-green-50 border border-[#ceead6] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-[#34A853] flex items-center justify-center border border-[#ceead6]">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#137333]">
                {receivedFiles.length} {receivedFiles.length === 1 ? 'file' : 'files'} received & verified
              </p>
              <p className="text-[11px] text-[#5f6368]">
                Bit-for-bit SHA-256 cryptographic integrity confirmed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {receivedFiles.length > 1 && (
              <button
                onClick={downloadAllAsZip}
                disabled={isZipping}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                <span>{isZipping ? 'Zipping...' : 'Download All as ZIP'}</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
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
              <p className="text-center text-[#5f6368] py-6">No messages yet. Say hello to sender!</p>
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
              placeholder="Type message to sender..."
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

      {/* Files List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-[#5f6368] px-1">
          Incoming Files ({receivedFiles.length})
        </h4>

        {receivedFiles.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#f8f9fa] border border-[#dadce0] space-y-2">
            <RefreshCw className="w-6 h-6 text-[#1a73e8] animate-spin mx-auto" />
            <p className="text-xs text-[#5f6368]">Waiting for sender to initialize the file stream...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receivedFiles.map(file => (
              <div
                key={file.id}
                className="p-4 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] transition-all space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[#202124] font-medium text-xs sm:text-sm truncate">{file.name}</p>
                        {file.isCompressed && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#34A853] border border-emerald-200 font-medium">
                            pako Decompressed (-{file.savedPercentage || 0}%)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#5f6368] flex-wrap">
                        <span>{formatBytes(file.size)}</span>
                        {file.relativePath && file.relativePath !== file.name && (
                          <span className="text-[10px] text-[#1a73e8] font-mono truncate max-w-[150px]">
                            {file.relativePath}
                          </span>
                        )}
                        {file.sha256 && (
                          <span className="text-[#137333] flex items-center gap-1 font-mono text-[10px]" title={`SHA-256: ${file.sha256}`}>
                            <ShieldCheck className="w-3 h-3" /> SHA-256 Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.blob && (file.type.startsWith('image/') || file.type.startsWith('text/') || file.name.endsWith('.txt')) && (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-2 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] transition-colors text-xs flex items-center gap-1 cursor-pointer"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                    )}

                    {file.blob ? (
                      <button
                        onClick={() => downloadFile(file)}
                        className="px-3.5 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-[#1a73e8] font-bold">
                        {file.progress}%
                      </span>
                    )}
                  </div>
                </div>

                {file.status === 'transferring' && (
                  <div className="w-full bg-[#f1f3f4] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#34A853] h-full rounded-full transition-all duration-200"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#dadce0] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(previewFile.type)}
                <h4 className="text-sm font-bold text-[#202124] truncate">{previewFile.name}</h4>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-[#5f6368] hover:text-[#202124] text-xs px-2.5 py-1 rounded-full bg-[#f1f3f4]"
              >
                Close
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {previewFile.type.startsWith('image/') && previewFile.previewUrl && (
                <div className="flex justify-center bg-[#f8f9fa] rounded-xl p-2 border border-[#dadce0]">
                  <img
                    src={previewFile.previewUrl}
                    alt={previewFile.name}
                    className="max-h-80 object-contain rounded-lg"
                  />
                </div>
              )}

              {previewTextContent && (
                <div className="relative">
                  <pre className="bg-[#f8f9fa] rounded-xl p-4 text-xs font-mono text-[#202124] whitespace-pre-wrap break-words border border-[#dadce0]">
                    {previewTextContent}
                  </pre>
                  <button
                    onClick={() => copyTextSnippet(previewTextContent)}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-white hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] rounded-full text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet ? <Check className="w-3 h-3 text-[#34A853]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#dadce0]">
              <span className="text-xs text-[#5f6368]">{formatBytes(previewFile.size)}</span>
              <button
                onClick={() => downloadFile(previewFile)}
                className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center gap-1.5"
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
