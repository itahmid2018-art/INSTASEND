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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transfer History</h3>
              <p className="text-[11px] text-slate-400">Log of peer-to-peer transfers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Clear all records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-slate-400 font-medium">No transfer history yet</p>
            <p className="text-[11px] text-slate-500">Transferred files and integrity hashes will show up here.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {history.map(record => (
              <div
                key={record.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1.5 rounded-lg ${
                      record.direction === 'sent' 
                        ? 'bg-cyan-500/10 text-cyan-400' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {record.direction === 'sent' ? <Upload className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 font-semibold truncate">{record.fileName}</p>
                      <p className="text-[10px] text-slate-500">
                        {record.direction === 'sent' ? 'Sent to' : 'Received from'}{' '}
                        <strong className="text-slate-400">{record.peerDeviceName}</strong> • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-slate-300 font-medium text-xs">
                    {formatBytes(record.fileSize)}
                  </span>
                </div>

                {record.sha256 && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>SHA-256: {record.sha256.slice(0, 16)}...</span>
                    </div>
                    <button
                      onClick={() => copyHash(record.sha256!)}
                      className="text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedHash === record.sha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash === record.sha256 ? 'Copied' : 'Copy Hash'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-[11px] text-slate-500 text-center">
          Records are stored exclusively in your local browser storage.
        </div>
      </div>
    </div>
  );
};
