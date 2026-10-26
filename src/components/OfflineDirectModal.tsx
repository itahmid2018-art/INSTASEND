import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Wifi, 
  WifiOff, 
  QrCode, 
  Camera, 
  Check, 
  Copy, 
  X, 
  ArrowRight, 
  ShieldCheck,
  Zap,
  Smartphone
} from 'lucide-react';
import { WebRTCManager } from '../services/webrtc.ts';
import { FileItem } from '../types.ts';
import { sound } from '../services/sound.ts';

interface OfflineDirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  webrtc: WebRTCManager | null;
  mode: 'send' | 'receive';
  stagedFiles?: FileItem[];
}

export const OfflineDirectModal: React.FC<OfflineDirectModalProps> = ({
  isOpen,
  onClose,
  webrtc,
  mode,
  stagedFiles = []
}) => {
  const [step, setStep] = useState<number>(1);
  const [offerQrUrl, setOfferQrUrl] = useState<string>('');
  const [offerPayload, setOfferPayload] = useState<string>('');
  const [answerPayloadInput, setAnswerPayloadInput] = useState<string>('');
  
  const [receiverOfferInput, setReceiverOfferInput] = useState<string>('');
  const [answerQrUrl, setAnswerQrUrl] = useState<string>('');
  const [answerPayload, setAnswerPayload] = useState<string>('');

  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sender: Generate offline direct WebRTC offer
  useEffect(() => {
    if (isOpen && mode === 'send' && stagedFiles.length > 0 && webrtc) {
      setIsProcessing(true);
      webrtc.createOfflineDirectOffer(stagedFiles)
        .then((offerStr) => {
          setOfferPayload(offerStr);
          return QRCode.toDataURL(offerStr, { width: 300, margin: 2 });
        })
        .then((url) => {
          setOfferQrUrl(url);
          setIsProcessing(false);
        })
        .catch((err) => {
          console.error('Error creating offline offer:', err);
          setIsProcessing(false);
        });
    }
  }, [isOpen, mode, stagedFiles, webrtc]);

  if (!isOpen) return null;

  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReceiverSubmitOffer = async () => {
    if (!receiverOfferInput.trim() || !webrtc) return;
    setIsProcessing(true);
    try {
      const answerStr = await webrtc.acceptOfflineDirectOffer(receiverOfferInput.trim());
      setAnswerPayload(answerStr);
      const url = await QRCode.toDataURL(answerStr, { width: 300, margin: 2 });
      setAnswerQrUrl(url);
      setStep(2);
      sound.playConnect();
    } catch (err) {
      console.error('Error accepting offline offer:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSenderSubmitAnswer = async () => {
    if (!answerPayloadInput.trim() || !webrtc) return;
    setIsProcessing(true);
    try {
      await webrtc.completeOfflineDirectHandshake(answerPayloadInput.trim());
      sound.playConnect();
      onClose();
    } catch (err) {
      console.error('Error completing offline handshake:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#34A853] flex items-center justify-center border border-[#ceead6]">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#202124] flex items-center gap-1.5">
                <span>Serverless Wi-Fi / Hotspot Mode</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-[#137333]">
                  100% Offline
                </span>
              </h3>
              <p className="text-xs text-[#5f6368]">
                Direct RAM-to-RAM WebRTC transfer with zero server dependency
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender Flow */}
        {mode === 'send' ? (
          <div className="space-y-4">
            {step === 1 ? (
              <div className="space-y-4 text-center">
                <div className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#3c4043] space-y-1">
                  <p className="font-semibold text-[#202124]">Step 1: Recipient scans this Serverless Offer QR Code</p>
                  <p className="text-[11px] text-[#5f6368]">
                    Recipient can scan this QR code using their camera or paste the direct code string on their mobile device or TV.
                  </p>
                </div>

                {offerQrUrl ? (
                  <div className="p-3 bg-white rounded-2xl border border-[#dadce0] shadow-xs inline-block">
                    <img src={offerQrUrl} alt="Offline Offer QR" className="w-56 h-56 mx-auto object-contain" />
                  </div>
                ) : (
                  <div className="w-56 h-56 mx-auto bg-[#f8f9fa] rounded-2xl border border-dashed border-[#dadce0] flex items-center justify-center">
                    <span className="text-xs text-[#5f6368]">Generating Serverless Offer...</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(offerPayload)}
                    className="flex-1 py-2 px-3 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Offer Code' : 'Copy Direct Offer Code'}</span>
                  </button>

                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-2 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <span>Next: Recipient's Return Answer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Sender Step 2: Input Return Answer from Recipient */
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#3c4043] space-y-1">
                  <p className="font-semibold text-[#202124]">Step 2: Paste or Scan Recipient's Return Answer Code</p>
                  <p className="text-[11px] text-[#5f6368]">
                    Paste the return answer code string generated by the recipient's device to complete direct Wi-Fi pairing.
                  </p>
                </div>

                <textarea
                  value={answerPayloadInput}
                  onChange={(e) => setAnswerPayloadInput(e.target.value)}
                  rows={4}
                  placeholder="Paste INSTASEND_OFFLINE_ANSWER:... code here"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3 text-xs font-mono text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleSenderSubmitAnswer}
                    disabled={!answerPayloadInput.trim() || isProcessing}
                    className="flex-1 py-2.5 px-4 rounded-full bg-[#34A853] hover:bg-[#188038] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Connect Serverless P2P Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Receiver Flow */
          <div className="space-y-4">
            {step === 1 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#3c4043] space-y-1">
                  <p className="font-semibold text-[#202124]">Step 1: Paste Sender's Serverless Offer Code</p>
                  <p className="text-[11px] text-[#5f6368]">
                    Paste the INSTASEND_OFFLINE_OFFER:... code provided by the sender.
                  </p>
                </div>

                <textarea
                  value={receiverOfferInput}
                  onChange={(e) => setReceiverOfferInput(e.target.value)}
                  rows={4}
                  placeholder="Paste INSTASEND_OFFLINE_OFFER:... code here"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3 text-xs font-mono text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />

                <button
                  onClick={handleReceiverSubmitOffer}
                  disabled={!receiverOfferInput.trim() || isProcessing}
                  className="w-full py-3 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Accept Offer & Generate Return Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Receiver Step 2: Display Return Answer QR Code for Sender */
              <div className="space-y-4 text-center">
                <div className="p-3 rounded-2xl bg-green-50 border border-[#ceead6] text-xs text-[#137333] space-y-1">
                  <p className="font-bold">Step 2: Show this Return Code to Sender</p>
                  <p className="text-[11px]">
                    The sender scans or pastes this code to establish the direct Wi-Fi RAM-to-RAM connection.
                  </p>
                </div>

                {answerQrUrl && (
                  <div className="p-3 bg-white rounded-2xl border border-[#dadce0] shadow-xs inline-block">
                    <img src={answerQrUrl} alt="Return Answer QR" className="w-56 h-56 mx-auto object-contain" />
                  </div>
                )}

                <button
                  onClick={() => copyText(answerPayload)}
                  className="w-full py-2.5 px-4 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Return Code' : 'Copy Return Code for Sender'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between text-[11px] text-[#5f6368]">
          <span className="flex items-center gap-1 text-[#137333] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34A853]" /> DTLS 1.2 Local Wi-Fi Stream
          </span>
          <span>Zero Internet / Cloud Required</span>
        </div>

      </div>
    </div>
  );
};
