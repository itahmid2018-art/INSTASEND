import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  X, 
  Copy, 
  Check, 
  Download, 
  Smartphone, 
  Share2, 
  Camera, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  onCodeScanned?: (code: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  onCodeScanned
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const shareUrl = `${window.location.origin}/?code=${roomCode}`;

  // Generate QR Code
  useEffect(() => {
    if (roomCode) {
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#202124',
          light: '#ffffff'
        }
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('Error generating QR code:', err);
      });
    }
  }, [roomCode, shareUrl]);

  // Clean up camera stream when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `instasend-qr-${roomCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareOnWhatsApp = () => {
    const text = `⚡ *InstaSend Peer-to-Peer Transfer*\nJoin my session to receive files directly via WebRTC:\n\n🔑 *Room Code:* ${roomCode}\n👉 *Tap to join:* ${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareOnTelegram = () => {
    const text = `⚡ InstaSend Transfer Session (Code: ${roomCode})`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    const title = 'InstaSend - Join File Transfer';
    const text = `Join my InstaSend transfer session (Room Code: ${roomCode}) to receive files directly:`;
    
    if (navigator.share) {
      if (qrDataUrl && navigator.canShare) {
        try {
          const res = await fetch(qrDataUrl);
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
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // If BarcodeDetector is available in browser
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code']
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                handleDetectedQR(rawValue);
              }
            } catch (e) {
              // Ignore frame detection errors
            }
          }
        }, 300);
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable: ' + err.message);
    }
  };

  const handleDetectedQR = (value: string) => {
    let code = value;
    if (code.includes('code=')) {
      const match = code.match(/code=([A-Za-z0-9]{4,8})/);
      if (match) code = match[1];
    }
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    if (clean) {
      stopCamera();
      onCodeScanned?.(clean);
      onClose();
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
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
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">
                {isScanning ? 'Scan Session QR' : 'Join via QR Code'}
              </h3>
              <p className="text-xs text-[#5f6368]">
                {isScanning ? 'Point camera at sender\'s screen' : 'Scan with mobile camera to transfer instantly'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isScanning ? (
          /* Camera Scanner Mode */
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-8 border-2 border-[#1a73e8] rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">
                  Align QR Code inside box
                </span>
              </div>
            </div>

            {cameraError && (
              <div className="p-3 bg-red-50 text-[#d93025] rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <button
              onClick={stopCamera}
              className="w-full py-2.5 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] font-medium text-xs transition-colors"
            >
              Back to Display QR Code
            </button>
          </div>
        ) : (
          /* QR Code Display Mode */
          <div className="space-y-4 text-center">
            {/* 6-Character Code Display */}
            <div>
              <p className="text-xs text-[#5f6368] font-medium mb-1">Session Code</p>
              <div className="inline-flex items-center gap-2 p-1.5 px-3 rounded-full bg-[#f8f9fa] border border-[#dadce0]">
                <span className="text-xl font-mono font-black tracking-widest text-[#1a73e8]">
                  {roomCode}
                </span>
                <button
                  onClick={copyCode}
                  className="p-1 rounded-full text-[#5f6368] hover:text-[#1a73e8] hover:bg-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-[#34a853]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* QR Image Box */}
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-2xl border border-[#dadce0] shadow-sm inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`InstaSend QR for code ${roomCode}`}
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-xs text-[#5f6368]">
                    Generating QR code...
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Instructions Card */}
            <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center gap-2.5 text-left text-xs text-[#3c4043]">
              <Smartphone className="w-5 h-5 text-[#1a73e8] shrink-0" />
              <div>
                <p className="font-semibold text-[#202124]">Open camera on iPhone or Android</p>
                <p className="text-[#5f6368] text-[11px] mt-0.5">
                  Point at this screen to open the session link directly in your mobile browser.
                </p>
              </div>
            </div>

            {/* Action Buttons: WhatsApp & Native Apps */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  className="py-2.5 px-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  title="Share session invite on WhatsApp"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Share via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-2.5 px-3 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Share QR and link via system apps"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Share via Apps...</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="py-2 px-2.5 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
                  title="Copy direct join link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Copy className="w-3.5 h-3.5 text-[#5f6368]" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={downloadQR}
                  className="py-2 px-2.5 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
                  title="Download PNG QR image"
                >
                  <Download className="w-3.5 h-3.5 text-[#5f6368]" />
                  <span>Save QR</span>
                </button>

                <button
                  type="button"
                  onClick={shareOnTelegram}
                  className="py-2 px-2.5 rounded-full bg-[#f8f9fa] hover:bg-[#0088cc]/10 hover:text-[#0088cc] hover:border-[#0088cc]/40 text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
                  title="Share session on Telegram"
                >
                  <svg className="w-3.5 h-3.5 fill-current shrink-0 text-[#0088cc]" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.923z"/>
                  </svg>
                  <span>Telegram</span>
                </button>
              </div>
            </div>

            {/* Camera Scanner Trigger */}
            <button
              onClick={startCamera}
              className="text-xs text-[#1a73e8] hover:underline font-medium inline-flex items-center gap-1 pt-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Or scan another device's QR code using camera</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
