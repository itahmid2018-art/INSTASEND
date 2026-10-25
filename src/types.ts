export interface DeviceInfo {
  name: string;
  browser: string;
  os: string;
  type: 'desktop' | 'mobile' | 'tablet';
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  blob?: Blob;
  previewUrl?: string;
  progress: number; // 0 to 100
  bytesTransferred: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  sha256?: string;
  error?: string;
}

export interface TransferMetrics {
  speedBytesPerSec: number;
  formattedSpeed: string;
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  etaSeconds: number;
  chunksCompleted: number;
  totalChunks: number;
}

export interface PeerInfo {
  id: string;
  deviceInfo: DeviceInfo;
}

export interface ChatMessage {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  timestamp: number;
}

export interface HistoryRecord {
  id: string;
  direction: 'sent' | 'received';
  fileName: string;
  fileSize: number;
  fileType: string;
  timestamp: number;
  roomCode: string;
  peerDeviceName: string;
  sha256?: string;
  durationMs: number;
  avgSpeedBytesPerSec: number;
}

export type TransferRole = 'sender' | 'receiver';

export type SessionState = 
  | 'idle' 
  | 'preparing'
  | 'waiting_for_peer' 
  | 'peer_connected'
  | 'connecting_webrtc' 
  | 'transferring' 
  | 'completed' 
  | 'error';
