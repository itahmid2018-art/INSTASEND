import React, { useState } from 'react';
import JSZip from 'jszip';
import { 
  FolderArchive, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  Download, 
  Trash2, 
  Share2, 
  Copy, 
  Check, 
  Search, 
  Upload, 
  Eye, 
  HardDrive, 
  ShieldCheck, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2,
  ExternalLink,
  Plus,
  Folder,
  RefreshCw,
  PackageCheck,
  ArrowDown
} from 'lucide-react';
import { ManagedFile, TransferMetrics } from '../types.ts';
import { formatBytes } from '../services/device.ts';

interface FileManagerProps {
  files: ManagedFile[];
  onDeleteFile: (id: string) => void;
  onDownloadFile: (file: ManagedFile) => void;
  onShareFile: (file: ManagedFile) => void;
  onUploadClick: () => void;
  metrics: TransferMetrics | null;
  activeRole: 'sender' | 'receiver' | null;
  transferState: string;
}

export const FileManager: React.FC<FileManagerProps> = ({
  files,
  onDeleteFile,
  onDownloadFile,
  onShareFile,
  onUploadClick,
  metrics,
  activeRole,
  transferState
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'doc' | 'archive' | 'media'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ManagedFile | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const copyLink = (file: ManagedFile) => {
    const code = file.roomCode;
    const url = code ? `${window.location.origin}/?code=${code}` : window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#4285F4]" />;
    if (type.startsWith('video/')) return <Film className="w-5 h-5 text-[#EA4335]" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-[#FBBC05]" />;
    if (type.includes('zip') || type.includes('compressed')) return <Archive className="w-5 h-5 text-[#34A853]" />;
    return <FileText className="w-5 h-5 text-[#5f6368]" />;
  };

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'image') return f.type.startsWith('image/');
    if (filterType === 'media') return f.type.startsWith('video/') || f.type.startsWith('audio/');
    if (filterType === 'archive') return f.type.includes('zip') || f.type.includes('tar') || f.type.includes('compressed');
    if (filterType === 'doc') return !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/');
    return true;
  });

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const downloadableFiles = files.filter(f => f.blob);

  const downloadAllAsZip = async (targetFiles: ManagedFile[] = downloadableFiles) => {
    if (targetFiles.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const item of targetFiles) {
        if (item.blob) {
          const path = item.relativePath || item.name;
          zip.file(path, item.blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instasend-files-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Error generating ZIP in FileManager:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Google Card Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Managed Files Count */}
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] google-card-shadow flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5f6368]">Total Uploaded Files</p>
            <h4 className="text-xl font-bold text-[#202124] mt-0.5">{files.length}</h4>
            <span className="text-[11px] text-[#70757a] font-mono">{formatBytes(totalSize)} stored/active</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        {/* Sender Upload Speed Indicator */}
        <div className={`p-4 rounded-2xl border transition-all ${
          activeRole === 'sender' && transferState === 'transferring'
            ? 'bg-blue-50/50 border-[#4285F4] shadow-xs'
            : 'bg-white border-[#dadce0] google-card-shadow'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5f6368] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                activeRole === 'sender' && transferState === 'transferring' ? 'bg-[#1a73e8] animate-ping' : 'bg-gray-300'
              }`} />
              Upload Speed
            </p>
            <span className="text-[10px] uppercase font-bold text-[#70757a]">Sender</span>
          </div>
          <h4 className="text-xl font-mono font-bold text-[#1a73e8] mt-0.5">
            {activeRole === 'sender' && metrics?.formattedSpeed ? metrics.formattedSpeed : '0 B/s'}
          </h4>
          <span className="text-[11px] text-[#70757a]">
            {activeRole === 'sender' && transferState === 'transferring' ? 'Live stream to peer' : 'Idle / Ready'}
          </span>
        </div>

        {/* Receiver Download Speed Indicator */}
        <div className={`p-4 rounded-2xl border transition-all ${
          activeRole === 'receiver' && transferState === 'transferring'
            ? 'bg-green-50/50 border-[#34A853] shadow-xs'
            : 'bg-white border-[#dadce0] google-card-shadow'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5f6368] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                activeRole === 'receiver' && transferState === 'transferring' ? 'bg-[#34A853] animate-ping' : 'bg-gray-300'
              }`} />
              Download Speed
            </p>
            <span className="text-[10px] uppercase font-bold text-[#70757a]">Receiver</span>
          </div>
          <h4 className="text-xl font-mono font-bold text-[#34A853] mt-0.5">
            {activeRole === 'receiver' && metrics?.formattedSpeed ? metrics.formattedSpeed : '0 B/s'}
          </h4>
          <span className="text-[11px] text-[#70757a]">
            {activeRole === 'receiver' && transferState === 'transferring' ? 'Bit-stream arriving' : 'Idle / Ready'}
          </span>
        </div>
      </div>

      {/* Prominent Google Style 'Download All' Banner When Multiple Files Are Available */}
      {downloadableFiles.length > 1 && (
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] google-card-shadow flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#34A853]" />

          <div className="flex items-center gap-3 pl-1">
            <div className="w-10 h-10 rounded-full bg-green-50 text-[#34A853] flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#202124] flex items-center gap-2">
                <span>Multiple Files Available ({downloadableFiles.length})</span>
                {activeRole === 'receiver' && transferState === 'transferring' && (
                  <span className="text-[10px] text-[#137333] bg-green-50 px-2 py-0.5 rounded-full border border-[#ceead6] animate-pulse flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" /> Receiving Simultaneously
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-[#5f6368]">
                Download all {downloadableFiles.length} files bundled together into an organized ZIP archive.
              </p>
            </div>
          </div>

          <button
            onClick={() => downloadAllAsZip(downloadableFiles)}
            disabled={isZipping}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
          >
            {isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isZipping ? 'Packaging ZIP...' : `Download All (${downloadableFiles.length}) as ZIP`}</span>
          </button>
        </div>
      )}

      {/* Google Style Search & Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#dadce0] google-card-shadow">
        {/* Google Style Search Pill */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#5f6368] absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-[#f8f9fa] focus:bg-white border border-[#dadce0] focus:border-[#1a73e8] rounded-full pl-9 pr-3 py-1.5 text-xs text-[#202124] placeholder-[#70757a] focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          {(['all', 'image', 'doc', 'media', 'archive'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                filterType === type
                  ? 'bg-blue-50 text-[#1a73e8] font-semibold border border-[#d2e3fc]'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {downloadableFiles.length > 1 && (
            <button
              onClick={() => downloadAllAsZip(downloadableFiles)}
              disabled={isZipping}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#1a73e8] font-medium text-xs flex items-center justify-center gap-1.5 border border-[#dadce0] transition-colors cursor-pointer"
            >
              {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              <span>Download All</span>
            </button>
          )}

          <button
            onClick={onUploadClick}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2">
        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-[#dadce0] google-card-shadow space-y-3">
            <FolderArchive className="w-12 h-12 text-[#9aa0a6] mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-[#202124]">No files found</h4>
              <p className="text-xs text-[#5f6368] mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No uploaded files match your search criteria.'
                  : 'Select files or drop folders to create secure P2P sharing sessions.'}
              </p>
            </div>
            <button
              onClick={onUploadClick}
              className="mt-2 px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select Files or Folders</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="p-3.5 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs google-card-shadow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-full bg-[#f8f9fa] border border-[#dadce0] shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#202124] truncate">{file.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5f6368] mt-0.5">
                      <span className="font-mono text-[#3c4043]">{formatBytes(file.size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                      {file.relativePath && file.relativePath !== file.name && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] text-[#1a73e8] flex items-center gap-1 font-mono truncate max-w-[180px]">
                            <Folder className="w-3 h-3 shrink-0" />
                            {file.relativePath}
                          </span>
                        </>
                      )}
                      {file.roomCode && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[#1a73e8] font-bold">Code: {file.roomCode}</span>
                        </>
                      )}
                      {file.isCompressed && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#34A853] border border-emerald-200 font-medium">
                            pako Deflated (-{file.savedPercentage || 0}%)
                          </span>
                        </>
                      )}
                      {file.sha256 && (
                        <>
                          <span>•</span>
                          <span className="text-[#137333] flex items-center gap-1 font-mono text-[10px]">
                            <ShieldCheck className="w-3 h-3" /> SHA-256 Verified
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Row Actions */}
                <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                  {(file.previewUrl || file.type.startsWith('image/')) && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
                      title="Preview File"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => copyLink(file)}
                    className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
                    title="Copy Share Link"
                  >
                    {copiedId === file.id ? <Check className="w-4 h-4 text-[#34A853]" /> : <Share2 className="w-4 h-4" />}
                  </button>

                  {file.blob && (
                    <button
                      onClick={() => onDownloadFile(file)}
                      className="p-2 rounded-full text-[#1a73e8] hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Download Locally"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="p-2 rounded-full text-[#5f6368] hover:text-[#d93025] hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#dadce0] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dadce0] pb-2">
              <h4 className="text-sm font-bold text-[#202124] truncate">{previewFile.name}</h4>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-[#5f6368] hover:text-[#202124] text-xs px-2.5 py-1 rounded-full bg-[#f1f3f4]"
              >
                Close
              </button>
            </div>
            {previewFile.previewUrl && (
              <div className="flex justify-center bg-[#f8f9fa] rounded-xl p-2 border border-[#dadce0]">
                <img src={previewFile.previewUrl} alt={previewFile.name} className="max-h-80 object-contain rounded-lg" />
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-[#5f6368] pt-2 border-t border-[#dadce0]">
              <span>{formatBytes(previewFile.size)}</span>
              {previewFile.blob && (
                <button
                  onClick={() => onDownloadFile(previewFile)}
                  className="px-4 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs"
                >
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
