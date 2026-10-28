import React, { useState } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Wifi, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  Radio, 
  ShieldCheck, 
  Info,
  Server,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DiagnosticReport, RoomValidityInfo } from '../types.ts';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiagnosticReport | null;
  roomValidity?: RoomValidityInfo | null;
  onRunDiagnostics: () => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  report,
  roomValidity,
  onRunDiagnostics
}) => {
  const [copiedLog, setCopiedLog] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'ice' | 'gathering' | 'latency' | 'room'>('all');
  const [showFaq, setShowFaq] = useState(false);

  if (!isOpen) return null;

  const logs = report?.logs || [];
  const filteredLogs = logFilter === 'all' 
    ? logs 
    : logs.filter(l => l.category === logFilter);

  const copyDiagnosticLogs = () => {
    if (!report) return;
    const exportData = {
      sessionId: report.sessionId,
      startedAt: new Date(report.startedAt).toISOString(),
      elapsedMs: report.elapsedMs,
      iceConnectionState: report.iceConnectionState,
      iceGatheringState: report.iceGatheringState,
      signalLatency: {
        current: report.signalLatencyMs,
        avg: report.avgSignalLatencyMs,
        min: report.minSignalLatencyMs,
        max: report.maxSignalLatencyMs
      },
      candidateCounts: report.candidateCounts,
      roomValidity: roomValidity || null,
      summaryDiagnosis: report.summaryDiagnosis,
      logs: report.logs
    };

    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const status = report?.summaryDiagnosis?.status || 'investigating';
  const statusColor = 
    status === 'healthy' 
      ? 'text-[#188038] bg-emerald-50 border-emerald-200' 
      : status === 'warning' 
        ? 'text-amber-800 bg-amber-50 border-amber-200' 
        : status === 'critical' 
          ? 'text-[#d93025] bg-red-50 border-red-200' 
          : 'text-[#1a73e8] bg-blue-50 border-blue-200';

  const windowProgressPercent = Math.min(100, Math.round(((report?.elapsedMs || 0) / 30000) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#202124] rounded-3xl border border-[#dadce0] dark:border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between bg-[#f8f9fa] dark:bg-[#303134]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1a73e8]/10 dark:bg-blue-900/30 flex items-center justify-center text-[#1a73e8] dark:text-[#8ab4f8]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#202124] dark:text-[#e8eaed]">
                  Connection Diagnostics & ICE Monitor
                </h3>
                {report?.isWindowActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1a73e8] border border-blue-200 animate-pulse">
                    30s Window Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                Real-time ICE state transitions, candidate gathering cycles, and signal latency
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* 30-Second Diagnostic Window Progress Bar */}
          <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#202124] dark:text-[#e8eaed]">
                <Clock className="w-3.5 h-3.5 text-[#1a73e8]" />
                <span>Initial 30-Second Connection Evaluation Window</span>
              </div>
              <span className="font-mono text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                {report?.isWindowActive ? `${report.remainingWindowSeconds}s remaining` : 'Evaluation complete'}
              </span>
            </div>
            
            <div className="w-full h-2 bg-[#e8eaed] dark:bg-[#3c4043] rounded-full overflow-hidden">
              <div 
                className="h-full bg-linear-to-r from-[#1a73e8] to-[#34A853] transition-all duration-500 rounded-full"
                style={{ width: `${windowProgressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#70757a] dark:text-[#9aa0a6]">
              {report?.isWindowActive 
                ? 'Actively logging ICE connection state transitions, gathering candidate pairs, and polling signal latency...' 
                : 'Initial 30s evaluation window finished. Metrics finalized below.'}
            </p>
          </div>

          {/* Diagnostic Summary Diagnosis Card */}
          {report?.summaryDiagnosis && (
            <div className={`p-4 rounded-2xl border ${statusColor} space-y-1.5`}>
              <div className="flex items-center gap-2 font-bold text-xs">
                {status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#34A853]" />
                ) : status === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-[#FBBC05]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#EA4335]" />
                )}
                <span>{report.summaryDiagnosis.title}</span>
              </div>
              <p className="text-xs leading-relaxed opacity-95">
                {report.summaryDiagnosis.description}
              </p>
              <div className="pt-1.5 border-t border-black/10 dark:border-white/10 text-[11px] font-medium flex items-start gap-1">
                <span className="font-bold shrink-0">Recommendation:</span>
                <span>{report.summaryDiagnosis.actionableAdvice}</span>
              </div>
            </div>
          )}

          {/* Core Metrics 3-Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Signal Latency */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-medium flex items-center gap-1">
                  <Radio className="w-3 h-3 text-[#1a73e8]" />
                  Signal Latency
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  (report?.signalLatencyMs || 0) > 300 
                    ? 'bg-[#EA4335]' 
                    : (report?.signalLatencyMs || 0) > 120 
                      ? 'bg-[#FBBC05]' 
                      : 'bg-[#34A853]'
                }`} />
              </div>
              <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#e8eaed]">
                {report?.signalLatencyMs !== null ? `${report?.signalLatencyMs} ms` : 'Measuring...'}
              </div>
              <div className="text-[10px] text-[#70757a] dark:text-[#9aa0a6] flex justify-between font-mono">
                <span>Avg: {report?.avgSignalLatencyMs ?? '—'}ms</span>
                <span>Min: {report?.minSignalLatencyMs ?? '—'}ms</span>
              </div>
            </div>

            {/* 2. ICE Connection State */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#34A853]" />
                  ICE Connection
                </span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  report?.iceConnectionState === 'connected' || report?.iceConnectionState === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : report?.iceConnectionState === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {report?.iceConnectionState || 'new'}
                </span>
              </div>
              <div className="text-sm font-semibold text-[#202124] dark:text-[#e8eaed] capitalize pt-1">
                {report?.iceConnectionState === 'connected' ? 'P2P Established' : report?.iceConnectionState === 'checking' ? 'Testing Pairs' : report?.iceConnectionState === 'failed' ? 'NAT Blocked' : 'Initializing'}
              </div>
              <div className="text-[10px] text-[#70757a] dark:text-[#9aa0a6] truncate">
                DTLS 1.2 / SCTP DataChannel
              </div>
            </div>

            {/* 3. Candidate Gathering */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-medium flex items-center gap-1">
                  <Server className="w-3 h-3 text-[#EA4335]" />
                  Gathered Candidates
                </span>
                <span className="text-[10px] font-mono text-[#5f6368] dark:text-[#9aa0a6]">
                  {report?.gatheringDurationMs ? `${report.gatheringDurationMs}ms` : 'Gathering'}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#e8eaed]">
                {report?.candidateCounts.total || 0}
              </div>
              <div className="text-[10px] text-[#70757a] dark:text-[#9aa0a6] flex items-center gap-1.5">
                <span className="px-1 py-0.2 bg-[#f1f3f4] dark:bg-[#3c4043] rounded">Host: {report?.candidateCounts.host || 0}</span>
                <span className="px-1 py-0.2 bg-[#f1f3f4] dark:bg-[#3c4043] rounded">STUN: {report?.candidateCounts.srflx || 0}</span>
              </div>
            </div>
          </div>

          {/* Root Cause Analysis: Why do some 6-digit codes appear expired? */}
          <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] space-y-3">
            <div 
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowFaq(!showFaq)}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#202124] dark:text-[#e8eaed]">
                <HelpCircle className="w-4 h-4 text-[#1a73e8]" />
                <span>Why might a 6-digit code appear as "expired" or fail to connect?</span>
              </div>
              <button type="button" className="text-[#5f6368] dark:text-[#9aa0a6]">
                {showFaq ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showFaq && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-[#3c4043] dark:text-[#bdc1c6] border-t border-[#dadce0] dark:border-[#3c4043]">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] space-y-1">
                  <div className="font-semibold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
                    <span>1. 10-Minute Room TTL Elapsed</span>
                  </div>
                  <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                    Rooms have a 10-minute validity to prevent stale sessions. If the receiver inputs the code after 10 minutes, the signaling server rejects it.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] space-y-1">
                  <div className="font-semibold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FBBC05]" />
                    <span>2. High Signal Latency / Jitter</span>
                  </div>
                  <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                    If signaling ping exceeds 300ms, join messages or SDP offer/answer exchanges may time out, making the session appear expired before handshake completes.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] space-y-1">
                  <div className="font-semibold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
                    <span>3. Cross-Subnet / Wi-Fi Isolation</span>
                  </div>
                  <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                    Guest Wi-Fi or AP client isolation blocks local UDP broadcast. If STUN reflexive candidates are also firewalled, peers cannot discover each other.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] space-y-1">
                  <div className="font-semibold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
                    <span>4. Sender Mobile Backgrounding</span>
                  </div>
                  <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                    Mobile OS browsers throttle background tabs. InstaSend includes a 120-second disconnect grace period, but prolonged screen lock drops the room.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostic Event Log Stream */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#202124] dark:text-[#e8eaed]">
                  Diagnostic Event Log ({filteredLogs.length})
                </span>
                <span className="text-[10px] text-[#70757a] dark:text-[#9aa0a6]">
                  Initial 30s session timeline
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
                {(['all', 'ice', 'gathering', 'latency', 'room'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setLogFilter(cat)}
                    className={`px-2 py-0.5 rounded-full capitalize font-medium transition-colors cursor-pointer ${
                      logFilter === cat 
                        ? 'bg-[#1a73e8] text-white font-semibold' 
                        : 'bg-[#f1f3f4] dark:bg-[#3c4043] text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Log Stream Box */}
            <div className="max-h-56 overflow-y-auto rounded-2xl bg-[#202124] text-white p-3 font-mono text-[11px] space-y-1.5 shadow-inner">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">
                  No diagnostic events logged yet for category "{logFilter}".
                </div>
              ) : (
                filteredLogs.map(log => {
                  const badgeColor = 
                    log.level === 'error' 
                      ? 'text-[#f28b82] bg-red-950/60 border border-red-800' 
                      : log.level === 'warn' 
                        ? 'text-[#fdd663] bg-amber-950/60 border border-amber-800' 
                        : log.level === 'success' 
                          ? 'text-[#81c995] bg-emerald-950/60 border border-emerald-800' 
                          : 'text-[#8ab4f8] bg-blue-950/60 border border-blue-800';

                  return (
                    <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 p-1 rounded transition-colors leading-tight">
                      <span className="text-gray-500 shrink-0 select-none">
                        +{(log.elapsedMs / 1000).toFixed(2)}s
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${badgeColor}`}>
                        {log.category}
                      </span>
                      <span className="text-gray-200 flex-1 break-words">
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#303134] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={copyDiagnosticLogs}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-full bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] text-xs font-medium text-[#3c4043] dark:text-[#e8eaed] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLog ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#34A853]" />
                  <span>Log Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#5f6368]" />
                  <span>Copy Diagnostic Log</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRunDiagnostics}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-full bg-[#1a73e8]/10 hover:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-run 30s Check</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
