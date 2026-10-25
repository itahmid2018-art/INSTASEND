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

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={copyLink}
                className="py-2.5 px-3 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>

              <button
                onClick={downloadQR}
                className="py-2.5 px-3 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#5f6368]" />
                <span>Save QR Image</span>
              </button>
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
