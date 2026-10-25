import React from 'react';
import { 
  History, 
  X, 
  Trash2, 
  Download, 
  Upload, 
  ShieldCheck, 
  Check, 
  Copy,
  FileText
} from 'lucide-react';
import { HistoryRecord } from '../types.ts';
import { formatBytes } from '../services/device.ts';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryRecord[];
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory
}) => {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative overflow-hidden">
        {/* Google 4-Color Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">Transfer History</h3>
              <p className="text-xs text-[#5f6368]">Recent peer-to-peer file transfers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-[#d93025] hover:bg-red-50 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 font-medium"
                title="Clear all records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div className="p-8 text-center text-[#5f6368] text-xs space-y-2">
            <FileText className="w-8 h-8 mx-auto text-[#9aa0a6]" />
            <p className="text-[#202124] font-medium">No transfer history yet</p>
            <p className="text-[11px] text-[#5f6368]">Transferred files and SHA-256 hashes will show up here.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {history.map(record => (
              <div
                key={record.id}
                className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1.5 rounded-full ${
                      record.direction === 'sent' 
                        ? 'bg-blue-50 text-[#1a73e8]' 
                        : 'bg-green-50 text-[#34A853]'
                    }`}>
                      {record.direction === 'sent' ? <Upload className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[#202124] font-medium truncate">{record.fileName}</p>
                      <p className="text-[10px] text-[#5f6368]">
                        {record.direction === 'sent' ? 'Sent to' : 'Received from'}{' '}
                        <strong className="text-[#3c4043]">{record.peerDeviceName}</strong> • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-[#202124] font-medium text-xs">
                    {formatBytes(record.fileSize)}
                  </span>
                </div>

                {record.sha256 && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#dadce0] text-[10px] font-mono text-[#5f6368]">
                    <div className="flex items-center gap-1 text-[#137333]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>SHA-256: {record.sha256.slice(0, 16)}...</span>
                    </div>
                    <button
                      onClick={() => copyHash(record.sha256!)}
                      className="text-[#1a73e8] hover:underline flex items-center gap-1"
                    >
                      {copiedHash === record.sha256 ? <Check className="w-3 h-3 text-[#34A853]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash === record.sha256 ? 'Copied' : 'Copy Hash'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-[11px] text-[#5f6368] text-center">
          Records are stored exclusively in your local browser storage.
        </div>
      </div>
    </div>
  );
};
