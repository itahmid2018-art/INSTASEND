import { 
  DeviceInfo, 
  FileItem, 
  TransferMetrics, 
  ChatMessage,
  DiagnosticReport,
  DiagnosticLogEntry,
  CandidateInfo,
  RoomValidityInfo
} from '../types.ts';
import { getLocalDeviceInfo, computeSHA256 } from './device.ts';
import { 
  isCompressibleTextFile, 
  compressData, 
  decompressData, 
  calculateSavedPercentage 
} from './compression.ts';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const BUFFER_HIGH_WATERMARK = 1.5 * 1024 * 1024; // 1.5 MB
const BUFFER_LOW_WATERMARK = 256 * 1024; // 256 KB

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

export type WebRTCEvents = {
  onStateChange: (state: string, details?: string) => void;
  onRoomCreated: (code: string) => void;
  onRoomJoined: (code: string, filesMeta: any[]) => void;
  onPeerConnected: (peerInfo: { id: string; deviceInfo?: DeviceInfo }) => void;
  onPeerDisconnected: () => void;
  onFilesMetadataReceived: (files: FileItem[]) => void;
  onTransferProgress: (metrics: TransferMetrics, fileId?: string) => void;
  onFileReceived: (fileItem: FileItem) => void;
  onTransferComplete: (files: FileItem[]) => void;
  onChatMessage: (message: ChatMessage) => void;
  onRadarUpdate: (peers: { id: string; deviceInfo: DeviceInfo }[]) => void;
  onDirectInvite: (invite: { fromPeerId: string; fromDeviceInfo?: DeviceInfo; roomCode: string; filesMeta?: any[] }) => void;
  onError: (errorMsg: string) => void;
  onDiagnosticUpdate?: (report: DiagnosticReport) => void;
  onRoomValidityUpdate?: (validity: RoomValidityInfo) => void;
};

export class WebRTCManager {
  private ws: WebSocket | null = null;
  private wsQueue: any[] = [];
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private role: 'sender' | 'receiver' | null = null;
  private roomCode: string | null = null;
  private peerId: string | null = null;
  private remotePeerInfo: DeviceInfo | null = null;

  private filesToSend: FileItem[] = [];
  private receivedFiles: Map<string, { meta: FileItem; chunks: ArrayBuffer[]; receivedBytes: number }> = new Map();
  private isTransferring = false;
  private isCancelled = false;
  private compressTextFiles = true; // Enabled by default for .txt, .json, .md

  private events: Partial<WebRTCEvents> = {};
  private pingInterval: any = null;
  private transferStartTime = 0;
  private lastTransferredBytes = 0;
  private lastSpeedSampleTime = 0;
  private smoothedSpeed = 0;
  private chatMessageTimestamps: number[] = [];
  private lastBufferWarningTime = 0;

  // Connection Diagnostics Engine (30-second window, ICE monitoring, signal latency)
  private diagnosticSessionId = '';
  private diagnosticStartedAt = 0;
  private diagnosticWindowDurationMs = 30000; // 30 seconds initial diagnostic window
  private isDiagnosticActive = false;
  private diagnosticTimer: any = null;
  private diagnosticLogs: DiagnosticLogEntry[] = [];
  private candidates: CandidateInfo[] = [];
  private gatheringStartTime: number | null = null;
  private gatheringCompleteTime: number | null = null;
  private signalLatencyHistory: { timestamp: number; latencyMs: number }[] = [];
  private pendingPings = new Map<number, number>();
  private roomValidity: RoomValidityInfo | null = null;
  private diagnosticListeners: ((report: DiagnosticReport) => void)[] = [];

  constructor(events: Partial<WebRTCEvents>) {
    this.events = events;
    this.connectSignaling();
  }

  public updateEvents(events: Partial<WebRTCEvents>) {
    this.events = { ...this.events, ...events };
  }

  public setCompressTextFiles(enabled: boolean) {
    this.compressTextFiles = enabled;
  }

  public getCompressTextFiles(): boolean {
    return this.compressTextFiles;
  }

  // Connect to Signaling Server via WebSockets
  private connectSignaling() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Flush any messages queued before WebSocket opened (e.g. joinRoom called on page mount)
        while (this.wsQueue.length > 0) {
          const queued = this.wsQueue.shift();
          try {
            this.ws?.send(JSON.stringify(queued));
          } catch {}
        }

        // Announce local device info for radar & identification
        const deviceInfo = getLocalDeviceInfo();
        this.sendWs({
          type: 'device-announce',
          deviceInfo
        });

        // Query active radar peers
        this.sendWs({ type: 'device-radar-query' });

        // If this peer was an active sender before disconnect, reclaim the room!
        if (this.role === 'sender' && this.roomCode) {
          this.sendWs({
            type: 'reclaim-room',
            roomCode: this.roomCode,
            filesMeta: this.filesToSend.map(f => ({
              id: f.id,
              name: f.name,
              size: f.size,
              type: f.type,
              relativePath: f.relativePath
            }))
          });
        }

        // Keepalive ping
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendWs({ type: 'ping' });
          }
        }, 15000);
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await this.handleSignalingMessage(msg);
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      this.ws.onerror = () => {
        // Handle transient signaling WebSocket disconnects gracefully without unhandled error logs
      };

      this.ws.onclose = () => {
        clearInterval(this.pingInterval);
        // Attempt reconnect after 2 seconds if not intentionally closed
        setTimeout(() => {
          if (!this.roomCode || this.ws?.readyState !== WebSocket.OPEN) {
            this.connectSignaling();
          }
        }, 2500);
      };
    } catch (err: any) {
      this.events.onError?.('Could not connect to signaling server: ' + err.message);
    }
  }

  private sendWs(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message so it is guaranteed to be sent once connected
      this.wsQueue.push(data);
    }
  }

  // Handle incoming signaling messages
  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'connected':
        this.peerId = msg.peerId;
        this.logDiagnostic('signaling', 'info', `Connected to signaling server with Peer ID: ${msg.peerId}`);
        break;

      case 'pong': {
        if (msg.t && typeof msg.t === 'number') {
          const sentAt = this.pendingPings.get(msg.t) || msg.t;
          this.pendingPings.delete(msg.t);
          const rtt = Math.max(1, Date.now() - sentAt);
          this.signalLatencyHistory.push({ timestamp: Date.now(), latencyMs: rtt });
          if (this.signalLatencyHistory.length > 50) {
            this.signalLatencyHistory.shift();
          }
          const level: 'info' | 'warn' = rtt > 350 ? 'warn' : 'info';
          this.logDiagnostic(
            'latency',
            level,
            `Signaling server round-trip latency: ${rtt}ms (avg: ${this.getAverageLatency()}ms)`,
            { rtt, avg: this.getAverageLatency() }
          );
          this.emitDiagnosticUpdate();
        }
        break;
      }

      case 'radar-list':
        this.events.onRadarUpdate?.(msg.peers || []);
        break;

      case 'direct-invite-received':
        this.events.onDirectInvite?.(msg);
        break;

      case 'room-created':
      case 'room-reclaimed': {
        this.roomCode = msg.roomCode;
        this.role = 'sender';

        const totalTtl = msg.ttlSeconds || 600;
        const ttlRemaining = msg.ttlRemainingSeconds !== undefined ? msg.ttlRemainingSeconds : totalTtl;
        const expiresAt = msg.expiresAt || (Date.now() + totalTtl * 1000);

        this.roomValidity = {
          code: msg.roomCode,
          totalTtlSeconds: totalTtl,
          ttlRemainingSeconds: ttlRemaining,
          expiresAt,
          createdAt: msg.createdAt || Date.now(),
          isExpired: false,
          senderOnline: true
        };

        this.events.onRoomCreated?.(msg.roomCode);
        this.events.onRoomValidityUpdate?.(this.roomValidity);
        this.events.onStateChange?.('waiting_for_peer');

        this.logDiagnostic(
          'room',
          'success',
          `Session room ${msg.roomCode} active with ${Math.round(totalTtl / 60)}m validity (${ttlRemaining}s remaining until expiration)`,
          { roomCode: msg.roomCode, expiresAt, ttlRemaining }
        );
        this.emitDiagnosticUpdate();
        break;
      }

      case 'room-joined': {
        this.roomCode = msg.roomCode;
        this.role = 'receiver';
        this.remotePeerInfo = msg.senderInfo;

        const totalTtl = msg.ttlSeconds || 600;
        const ttlRemaining = msg.ttlRemainingSeconds !== undefined ? msg.ttlRemainingSeconds : totalTtl;
        const expiresAt = msg.expiresAt || (Date.now() + totalTtl * 1000);

        this.roomValidity = {
          code: msg.roomCode,
          totalTtlSeconds: totalTtl,
          ttlRemainingSeconds: ttlRemaining,
          expiresAt,
          createdAt: msg.createdAt || Date.now(),
          isExpired: false,
          senderOnline: msg.senderOnline
        };

        this.events.onRoomJoined?.(msg.roomCode, msg.filesMeta);
        this.events.onRoomValidityUpdate?.(this.roomValidity);
        this.events.onStateChange?.('connecting_webrtc');

        this.logDiagnostic(
          'room',
          'success',
          `Successfully verified session ${msg.roomCode} on signaling server. Sender is ${msg.senderOnline ? 'ONLINE' : 'reconnecting'}. TTL remaining: ${ttlRemaining}s.`,
          { roomCode: msg.roomCode, expiresAt, senderOnline: msg.senderOnline }
        );

        // Initialize PeerConnection as answerer
        this.initPeerConnection();
        break;
      }

      case 'sender-reconnected':
        this.logDiagnostic('signaling', 'info', `Sender reconnected to room ${msg.roomCode}`);
        this.events.onStateChange?.('connecting_webrtc', 'Sender reconnected');
        break;

      case 'peer-joined':
        // Receiver arrived! As sender, initiate WebRTC offer
        this.remotePeerInfo = msg.receiverInfo;
        this.logDiagnostic('signaling', 'success', `Peer connected to session: ${msg.receiverInfo?.name || 'Receiver Device'}`);
        this.events.onPeerConnected?.({ id: msg.peerId, deviceInfo: msg.receiverInfo });
        this.events.onStateChange?.('connecting_webrtc');
        await this.initiateOffer();
        break;

      case 'peer-left':
        if (msg.isTemporary) {
          this.logDiagnostic('signaling', 'warn', 'Sender temporarily disconnected. Waiting 120s grace period...');
          this.events.onStateChange?.('connecting_webrtc', 'Sender temporarily reconnecting...');
        } else {
          this.logDiagnostic('signaling', 'warn', 'Peer disconnected from session');
          this.events.onPeerDisconnected?.();
          this.events.onStateChange?.('waiting_for_peer', 'Peer disconnected');
          this.cleanupPeerConnection();
        }
        break;

      case 'signal':
        await this.handleWebRTCSignal(msg.signal);
        break;

      case 'error': {
        const isExpired = msg.code === 'ROOM_EXPIRED' || msg.message?.toLowerCase().includes('expired');
        if (isExpired && this.roomValidity) {
          this.roomValidity.isExpired = true;
          this.roomValidity.ttlRemainingSeconds = 0;
          this.events.onRoomValidityUpdate?.(this.roomValidity);
        }
        this.logDiagnostic(
          isExpired ? 'room' : 'signaling',
          'error',
          `Signaling error (${msg.code || 'UNKNOWN'}): ${msg.message || 'Error occurred'}`
        );
        this.events.onError?.(msg.message || 'Error occurred');
        this.emitDiagnosticUpdate();
        break;
      }
    }
  }

  // Create room as Sender
  public createRoom(files: FileItem[], customCode?: string) {
    this.filesToSend = files;
    this.role = 'sender';
    this.startDiagnostics('Sender initiated transfer session');
    this.sendWs({
      type: 'create-room',
      customCode,
      filesMeta: files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        relativePath: f.relativePath
      }))
    });
  }

  // Refresh / Generate a new 6-character room code as Sender
  public refreshRoomCode() {
    this.cleanupPeerConnection();
    const oldCode = this.roomCode;
    this.roomCode = null;
    this.logDiagnostic('room', 'info', `Refreshing session code... invalidating previous code ${oldCode || ''}`);
    this.sendWs({
      type: 'refresh-room',
      oldRoomCode: oldCode,
      filesMeta: this.filesToSend.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        relativePath: f.relativePath
      }))
    });
  }

  // Stop transfer & close session code
  public stopTransfer() {
    const code = this.roomCode;
    this.isTransferring = false;
    this.isCancelled = true;
    this.cleanupPeerConnection();
    if (code) {
      this.sendWs({
        type: 'stop-transfer',
        roomCode: code
      });
      this.logDiagnostic('room', 'warn', `Sender stopped transfer and closed session code ${code}`);
    }
    this.roomCode = null;
    this.role = null;
    this.roomValidity = null;
    this.events.onStateChange?.('idle', 'Transfer stopped by user');
  }

  // Join room as Receiver
  public joinRoom(roomCode: string) {
    this.role = 'receiver';
    const clean = roomCode.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    this.roomCode = clean;
    this.startDiagnostics(`Receiver joining session ${clean}`);
    this.sendWs({
      type: 'join-room',
      roomCode: clean
    });
  }

  // Fallback LAN HTTP file upload helper for sender
  public async uploadToLANRelay(roomCode: string, onProgress?: (fileIndex: number, totalFiles: number) => void): Promise<boolean> {
    try {
      const code = roomCode.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
      let index = 0;
      for (const item of this.filesToSend) {
        if (!item.file) continue;
        const arrayBuf = await item.file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        // Convert to base64
        let binary = '';
        const len = uint8.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const slice = uint8.subarray(i, Math.min(i + chunkSize, len));
          binary += String.fromCharCode.apply(null, slice as unknown as number[]);
        }
        const base64Data = btoa(binary);

        await fetch(`/api/transfer/${code}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
            relativePath: item.relativePath,
            base64Data,
            sha256: item.sha256
          })
        });
        index++;
        onProgress?.(index, this.filesToSend.length);
      }
      return true;
    } catch (e) {
      console.warn('Fallback LAN relay upload failed:', e);
      return false;
    }
  }

  // Send direct invite from radar
  public sendDirectInvite(targetPeerId: string, files: FileItem[]) {
    this.filesToSend = files;
    this.role = 'sender';
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.createRoom(files, code);
    this.sendWs({
      type: 'direct-invite',
      targetPeerId,
      roomCode: code,
      filesMeta: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });
  }

  // Initialize WebRTC PeerConnection
  private initPeerConnection() {
    this.cleanupPeerConnection();

    this.logDiagnostic('ice', 'info', 'Initializing RTCPeerConnection with STUN configuration...');
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    // ICE Candidate Gathering listener
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const c = event.candidate;
        let candidateType: 'host' | 'srflx' | 'relay' | 'prflx' | 'unknown' = 'unknown';
        if (c.type) {
          candidateType = c.type as any;
        } else if (c.candidate) {
          const match = c.candidate.match(/typ\s+(\w+)/);
          if (match) candidateType = match[1] as any;
        }

        const candidateInfo: CandidateInfo = {
          id: Math.random().toString(36).substring(2, 9),
          type: candidateType,
          protocol: ((c.protocol || 'udp') as string).toLowerCase() as any,
          address: c.address || (c as any).ip,
          port: c.port || undefined,
          priority: c.priority || undefined,
          timestamp: Date.now()
        };

        this.candidates.push(candidateInfo);

        this.logDiagnostic(
          'gathering',
          'info',
          `Gathered ${candidateType.toUpperCase()} candidate (${(c.protocol || 'UDP').toUpperCase()}${c.port ? ` port ${c.port}` : ''})`,
          { type: candidateType, protocol: c.protocol, port: c.port }
        );

        this.sendWs({
          type: 'signal',
          signal: { type: 'candidate', candidate: event.candidate }
        });
        this.emitDiagnosticUpdate();
      } else {
        this.logDiagnostic('gathering', 'info', 'ICE candidate gathering received end-of-candidates null marker.');
        this.emitDiagnosticUpdate();
      }
    };

    // ICE Gathering State Transitions
    this.pc.onicegatheringstatechange = () => {
      const state = this.pc?.iceGatheringState || 'new';
      let level: 'info' | 'warn' | 'error' | 'success' = 'info';
      let desc = `ICE Gathering state: ${state}`;

      if (state === 'gathering') {
        this.gatheringStartTime = Date.now();
        level = 'info';
        desc = 'ICE Gathering Cycle Active: Querying local network interfaces and STUN servers...';
      } else if (state === 'complete') {
        this.gatheringCompleteTime = Date.now();
        const duration = this.gatheringStartTime 
          ? (this.gatheringCompleteTime - this.gatheringStartTime) 
          : 0;
        level = 'success';
        desc = `ICE Gathering Cycle Complete in ${duration}ms (${this.candidates.length} total candidates discovered).`;
      }

      this.logDiagnostic('gathering', level, desc, { gatheringState: state, candidatesCount: this.candidates.length });
      this.emitDiagnosticUpdate();
    };

    // ICE Connection State Transitions
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState || 'new';
      let level: 'info' | 'warn' | 'error' | 'success' = 'info';
      let desc = `ICE Connection state changed to: ${state}`;

      switch (state) {
        case 'checking':
          level = 'info';
          desc = 'ICE Checking: Verifying candidate connectivity pairs with remote peer...';
          break;
        case 'connected':
          level = 'success';
          desc = 'ICE Connected: Transport pathway established. Direct P2P packet exchange active!';
          break;
        case 'completed':
          level = 'success';
          desc = 'ICE Completed: Peer candidate pair finalized.';
          break;
        case 'failed':
          level = 'error';
          desc = 'ICE Failed: No viable candidate pair found. NAT traversal was blocked (symmetric NAT, guest isolation, or firewall).';
          break;
        case 'disconnected':
          level = 'warn';
          desc = 'ICE Disconnected: Network connectivity temporarily interrupted.';
          break;
        case 'closed':
          level = 'info';
          desc = 'ICE Closed.';
          break;
      }

      this.logDiagnostic('ice', level, desc, { iceConnectionState: state });
      this.emitDiagnosticUpdate();
    };

    // Peer Connection State Transitions
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      const level = state === 'connected' ? 'success' : (state === 'failed' || state === 'disconnected') ? 'error' : 'info';
      this.logDiagnostic('ice', level, `PeerConnection state: ${state}`);

      if (state === 'connected') {
        this.events.onStateChange?.('peer_connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.events.onStateChange?.('disconnected', 'WebRTC connection interrupted');
      }
      this.emitDiagnosticUpdate();
    };

    // If receiver, handle incoming data channel
    if (this.role === 'receiver') {
      this.pc.ondatachannel = (event) => {
        this.logDiagnostic('datachannel', 'success', `Received incoming DataChannel: ${event.channel.label}`);
        this.setupDataChannel(event.channel);
      };
    }
  }

  // ==========================================
  // CONNECTION DIAGNOSTICS & ICE MONITORING (INITIAL 30s)
  // ==========================================

  public startDiagnostics(reason = 'Initial 30s connection evaluation') {
    if (this.diagnosticTimer) {
      clearInterval(this.diagnosticTimer);
    }
    this.diagnosticSessionId = `diag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.diagnosticStartedAt = Date.now();
    this.isDiagnosticActive = true;
    this.diagnosticLogs = [];
    this.candidates = [];
    this.gatheringStartTime = null;
    this.gatheringCompleteTime = null;
    this.pendingPings.clear();

    this.logDiagnostic(
      'signaling',
      'info',
      `Diagnostic monitoring started (${reason}). Measuring ICE connection state transitions, gathering cycles, and signal latency.`,
      { sessionId: this.diagnosticSessionId, role: this.role, roomCode: this.roomCode }
    );

    // Initial ping probe for immediate signal latency measurement
    this.sendPingProbe();

    // 1-second interval for 30s diagnostic window
    this.diagnosticTimer = setInterval(() => {
      const elapsed = Date.now() - this.diagnosticStartedAt;
      if (elapsed >= this.diagnosticWindowDurationMs) {
        if (this.isDiagnosticActive) {
          this.isDiagnosticActive = false;
          const avg = this.getAverageLatency();
          this.logDiagnostic(
            'ice',
            'info',
            `Completed 30-second initial connection diagnostic window. Final state: ICE=${this.pc?.iceConnectionState || 'none'}, Candidates=${this.candidates.length}, Avg signal latency=${avg !== null ? `${avg}ms` : 'N/A'}.`
          );
        }
        clearInterval(this.diagnosticTimer);
        this.diagnosticTimer = null;
      } else {
        // Send a ping probe every 2 seconds during the initial 30s window
        if (Math.floor(elapsed / 1000) % 2 === 0) {
          this.sendPingProbe();
        }
      }
      this.emitDiagnosticUpdate();
    }, 1000);

    this.emitDiagnosticUpdate();
  }

  public logDiagnostic(
    category: 'ice' | 'gathering' | 'latency' | 'signaling' | 'datachannel' | 'room',
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
    details?: Record<string, any>
  ) {
    const elapsed = this.diagnosticStartedAt > 0 ? Date.now() - this.diagnosticStartedAt : 0;
    const entry: DiagnosticLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      elapsedMs: elapsed,
      category,
      level,
      message,
      details
    };

    this.diagnosticLogs.push(entry);
    if (this.diagnosticLogs.length > 250) {
      this.diagnosticLogs.shift();
    }

    const color = level === 'error' ? '#EA4335' : level === 'warn' ? '#FBBC05' : level === 'success' ? '#34A853' : '#1a73e8';
    console.log(
      `%c[InstaSend Diag +${(elapsed / 1000).toFixed(1)}s] [${category.toUpperCase()}] ${message}`,
      `color: ${color}; font-weight: bold;`,
      details || ''
    );
  }

  public sendPingProbe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const t = Date.now();
    this.pendingPings.set(t, t);
    // Cleanup old pings older than 10 seconds
    const cutoff = t - 10000;
    for (const [key] of this.pendingPings) {
      if (key < cutoff) this.pendingPings.delete(key);
    }
    this.sendWs({ type: 'ping', t });
  }

  public getAverageLatency(): number | null {
    if (this.signalLatencyHistory.length === 0) return null;
    const sum = this.signalLatencyHistory.reduce((acc, cur) => acc + cur.latencyMs, 0);
    return Math.round(sum / this.signalLatencyHistory.length);
  }

  public getCandidateCounts() {
    let host = 0;
    let srflx = 0;
    let relay = 0;
    let prflx = 0;

    for (const c of this.candidates) {
      if (c.type === 'host') host++;
      else if (c.type === 'srflx') srflx++;
      else if (c.type === 'relay') relay++;
      else if (c.type === 'prflx') prflx++;
    }

    return {
      host,
      srflx,
      relay,
      prflx,
      total: this.candidates.length
    };
  }

  public getDiagnosticReport(): DiagnosticReport {
    const now = Date.now();
    const elapsed = this.diagnosticStartedAt > 0 ? now - this.diagnosticStartedAt : 0;
    const remainingSeconds = Math.max(0, Math.ceil((this.diagnosticWindowDurationMs - elapsed) / 1000));
    const isWindowActive = this.diagnosticStartedAt > 0 && elapsed < this.diagnosticWindowDurationMs;

    const latencies = this.signalLatencyHistory.map(h => h.latencyMs);
    const avgLatency = this.getAverageLatency();
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;
    const currentLatency = latencies.length > 0 ? latencies[latencies.length - 1] : null;

    const candidateCounts = this.getCandidateCounts();
    const gatheringDuration = (this.gatheringCompleteTime && this.gatheringStartTime)
      ? (this.gatheringCompleteTime - this.gatheringStartTime)
      : null;

    const summaryDiagnosis = this.computeDiagnosis(
      candidateCounts,
      avgLatency,
      this.pc?.iceConnectionState || 'new',
      isWindowActive
    );

    return {
      sessionId: this.diagnosticSessionId || 'init',
      startedAt: this.diagnosticStartedAt,
      elapsedMs: elapsed,
      isWindowActive,
      remainingWindowSeconds: remainingSeconds,
      iceConnectionState: this.pc?.iceConnectionState || 'new',
      iceGatheringState: this.pc?.iceGatheringState || 'new',
      peerConnectionState: (this.pc?.connectionState as any) || 'uninitialized',
      signalLatencyMs: currentLatency,
      avgSignalLatencyMs: avgLatency,
      minSignalLatencyMs: minLatency,
      maxSignalLatencyMs: maxLatency,
      signalLatencyHistory: [...this.signalLatencyHistory],
      candidates: [...this.candidates],
      candidateCounts,
      gatheringDurationMs: gatheringDuration,
      logs: [...this.diagnosticLogs],
      summaryDiagnosis
    };
  }

  private computeDiagnosis(
    candidateCounts: { host: number; srflx: number; relay: number; total: number },
    avgLatency: number | null,
    iceState: RTCIceConnectionState,
    isWindowActive: boolean
  ) {
    if (this.roomValidity?.isExpired || (this.roomValidity && this.roomValidity.ttlRemainingSeconds <= 0)) {
      return {
        status: 'critical' as const,
        title: 'Session Code Expired',
        description: 'The 10-minute session validity period has ended. The signaling server has freed this 6-digit code.',
        actionableAdvice: 'Ask the sender to generate a fresh 6-digit code or link.'
      };
    }

    if (iceState === 'connected' || iceState === 'completed') {
      return {
        status: 'healthy' as const,
        title: 'WebRTC P2P Connection Established',
        description: `Direct encrypted SCTP data channel active over DTLS. Signal latency is optimal (${avgLatency !== null ? `${avgLatency}ms` : '<20ms'}).`,
        actionableAdvice: 'Transfer streams directly browser-to-browser with zero server intermediation.'
      };
    }

    if (iceState === 'failed') {
      return {
        status: 'critical' as const,
        title: 'Direct P2P Connectivity Blocked',
        description: 'ICE candidate negotiation failed. Both peers attempted to connect, but symmetric NAT, carrier-grade NAT, or enterprise firewall prevented direct UDP packet exchange.',
        actionableAdvice: 'Ensure both devices are connected to the same local Wi-Fi SSID, or use the direct LAN file fallback download button.'
      };
    }

    if (avgLatency !== null && avgLatency > 300) {
      return {
        status: 'warning' as const,
        title: 'High Signaling Latency Detected',
        description: `Signaling server round-trip latency is high (${avgLatency}ms). Slow signaling handshakes may cause room join requests to time out before candidates can pair, making codes appear as expired.`,
        actionableAdvice: 'Check for network congestion, VPN interference, or weak Wi-Fi signal.'
      };
    }

    if (this.pc?.iceGatheringState === 'complete' && candidateCounts.srflx === 0 && candidateCounts.host > 0) {
      return {
        status: 'warning' as const,
        title: 'Local-Only Host Candidates Gathered',
        description: 'No STUN reflexive (public IP) candidates were gathered. If devices are on different subnets (e.g. mobile 4G/5G vs home Wi-Fi), direct connection cannot be established.',
        actionableAdvice: 'Connect both devices to the same Wi-Fi network, or verify public internet access to STUN servers.'
      };
    }

    if (isWindowActive) {
      return {
        status: 'investigating' as const,
        title: '30-Second Diagnostic Analysis Active',
        description: `Evaluating ICE gathering cycles (${candidateCounts.total} candidates discovered), signaling latency (${avgLatency !== null ? `${avgLatency}ms` : 'sampling'}), and peer handshake.`,
        actionableAdvice: 'Keep this browser tab in the foreground while the WebRTC handshake completes.'
      };
    }

    return {
      status: 'investigating' as const,
      title: 'Awaiting Peer Connection',
      description: 'Listening for incoming peer signaling messages or candidate exchanges.',
      actionableAdvice: 'Verify the sender has this tab open and the room code matches.'
    };
  }

  private emitDiagnosticUpdate() {
    const report = this.getDiagnosticReport();
    this.events.onDiagnosticUpdate?.(report);
    for (const listener of this.diagnosticListeners) {
      try {
        listener(report);
      } catch (e) {
        console.error('Error in diagnostic listener:', e);
      }
    }
  }

  public subscribeDiagnostics(listener: (report: DiagnosticReport) => void): () => void {
    this.diagnosticListeners.push(listener);
    listener(this.getDiagnosticReport());
    return () => {
      this.diagnosticListeners = this.diagnosticListeners.filter(l => l !== listener);
    };
  }

  public setRoomValidity(validity: RoomValidityInfo) {
    this.roomValidity = validity;
    this.events.onRoomValidityUpdate?.(validity);
    this.emitDiagnosticUpdate();
  }

  public getRoomValidity(): RoomValidityInfo | null {
    return this.roomValidity;
  }

  // Sender creates Offer
  private async initiateOffer() {
    this.initPeerConnection();
    if (!this.pc) return;

    // Create reliable data channel for transfers
    const channel = this.pc.createDataChannel('hexasend-data', {
      ordered: true
    });
    this.setupDataChannel(channel);

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.sendWs({
        type: 'signal',
        signal: { type: 'offer', sdp: offer }
      });
    } catch (err: any) {
      this.events.onError?.('Failed to create WebRTC offer: ' + err.message);
    }
  }

  // Handle incoming signaling: offer, answer, ice-candidate
  private async handleWebRTCSignal(signal: any) {
    if (!signal) return;

    try {
      if (signal.type === 'offer') {
        if (!this.pc) this.initPeerConnection();
        await this.pc?.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.pc?.createAnswer();
        if (answer) {
          await this.pc?.setLocalDescription(answer);
          this.sendWs({
            type: 'signal',
            signal: { type: 'answer', sdp: answer }
          });
        }
      } else if (signal.type === 'answer') {
        await this.pc?.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await this.pc?.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error('Error handling WebRTC signal:', err);
    }
  }

  // Setup DataChannel listeners
  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      this.events.onStateChange?.('peer_connected');
      // If sender, we can send files metadata to receiver
      if (this.role === 'sender' && this.filesToSend.length > 0) {
        this.sendFilesMetadata();
      }
    };

    this.dataChannel.onclose = () => {
      this.events.onPeerDisconnected?.();
    };

    this.dataChannel.onerror = (err) => {
      console.error('DataChannel error:', err);
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
  }

  // Send metadata about files to be transferred
  private sendFilesMetadata() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    const payload = {
      action: 'FILES_METADATA',
      files: this.filesToSend.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        relativePath: f.relativePath
      }))
    };

    this.dataChannel.send(JSON.stringify(payload));
  }

  // Handle incoming messages over WebRTC DataChannel
  private async handleDataChannelMessage(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        switch (msg.action) {
          case 'FILES_METADATA': {
            const incomingFiles: FileItem[] = msg.files.map((f: any) => ({
              id: f.id,
              name: f.name,
              size: f.size,
              type: f.type || 'application/octet-stream',
              relativePath: f.relativePath,
              progress: 0,
              bytesTransferred: 0,
              status: 'pending'
            }));

            // Prepare local buffers for incoming files
            this.receivedFiles.clear();
            incomingFiles.forEach(f => {
              this.receivedFiles.set(f.id, {
                meta: f,
                chunks: [],
                receivedBytes: 0
              });
            });

            this.events.onFilesMetadataReceived?.(incomingFiles);
            break;
          }

          case 'START_FILE_TRANSFER': {
            let fileEntry = this.receivedFiles.get(msg.fileId);
            if (fileEntry) {
              fileEntry.meta.status = 'transferring';
              if (msg.isCompressed) {
                fileEntry.meta.isCompressed = true;
                fileEntry.meta.compressedSize = msg.compressedSize || msg.size;
                fileEntry.meta.originalSize = msg.originalSize || fileEntry.meta.size;
              }
            } else {
              const newFileItem: FileItem = {
                id: msg.fileId,
                name: msg.name,
                size: msg.originalSize || msg.size,
                type: msg.type || 'application/octet-stream',
                progress: 0,
                bytesTransferred: 0,
                status: 'transferring',
                isCompressed: msg.isCompressed,
                compressedSize: msg.compressedSize,
                originalSize: msg.originalSize
              };
              fileEntry = {
                meta: newFileItem,
                chunks: [],
                receivedBytes: 0
              };
              this.receivedFiles.set(msg.fileId, fileEntry);
            }
            this.events.onStateChange?.('transferring');
            if (this.transferStartTime === 0) {
              this.transferStartTime = Date.now();
              this.lastSpeedSampleTime = Date.now();
            }
            break;
          }

          case 'END_FILE_TRANSFER': {
            const fileEntry = this.receivedFiles.get(msg.fileId);
            if (fileEntry) {
              const isCompressed = !!(msg.isCompressed || fileEntry.meta.isCompressed);
              let blob: Blob;

              if (isCompressed && fileEntry.chunks.length > 0) {
                try {
                  const totalCompressedLen = fileEntry.chunks.reduce((acc, c) => acc + c.byteLength, 0);
                  const mergedUint8 = new Uint8Array(totalCompressedLen);
                  let offset = 0;
                  for (const chunk of fileEntry.chunks) {
                    mergedUint8.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                  }

                  const decompressed = decompressData(mergedUint8);
                  blob = new Blob([decompressed as unknown as BlobPart], { type: fileEntry.meta.type });

                  fileEntry.meta.isCompressed = true;
                  fileEntry.meta.compressedSize = totalCompressedLen;
                  const finalSize = (msg.originalSize || decompressed.byteLength) ?? 0;
                  fileEntry.meta.originalSize = finalSize;
                  fileEntry.meta.size = finalSize;
                  fileEntry.meta.savedPercentage = calculateSavedPercentage(fileEntry.meta.size, totalCompressedLen);
                } catch (decompErr) {
                  console.warn('Decompression failed, falling back to raw chunks:', decompErr);
                  blob = new Blob(fileEntry.chunks, { type: fileEntry.meta.type });
                }
              } else {
                blob = new Blob(fileEntry.chunks, { type: fileEntry.meta.type });
              }

              const sha256 = await computeSHA256(blob);

              let previewUrl: string | undefined = undefined;
              if (fileEntry.meta.type.startsWith('image/')) {
                previewUrl = URL.createObjectURL(blob);
              }

              fileEntry.meta.blob = blob;
              fileEntry.meta.previewUrl = previewUrl;
              fileEntry.meta.progress = 100;
              fileEntry.meta.bytesTransferred = fileEntry.meta.size;
              fileEntry.meta.status = 'completed';
              fileEntry.meta.sha256 = sha256;

              this.events.onFileReceived?.(fileEntry.meta);

              // Check if all files have completed
              const allDone = Array.from(this.receivedFiles.values()).every(
                f => f.meta.status === 'completed'
              );

              if (allDone) {
                this.events.onStateChange?.('completed');
                this.events.onTransferComplete?.(
                  Array.from(this.receivedFiles.values()).map(f => f.meta)
                );
              }
            }
            break;
          }

          case 'CHAT_MESSAGE': {
            this.events.onChatMessage?.({
              id: msg.id || Math.random().toString(),
              sender: 'peer',
              text: msg.text,
              timestamp: msg.timestamp || Date.now()
            });
            break;
          }

          case 'CANCEL_TRANSFER': {
            this.isCancelled = true;
            this.events.onError?.('Peer cancelled the transfer.');
            this.events.onStateChange?.('error', 'Transfer cancelled');
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing JSON message on data channel:', err);
      }
    } else if (data instanceof ArrayBuffer) {
      // Binary chunk packet:
      // Byte 0-35: 36-char UTF-8 string FileID
      // Byte 36+: File chunk content
      const fileIdBytes = new Uint8Array(data, 0, 36);
      const fileId = new TextDecoder().decode(fileIdBytes).trim();
      const chunkData = data.slice(36);

      const fileEntry = this.receivedFiles.get(fileId);
      if (fileEntry) {
        fileEntry.chunks.push(chunkData);
        fileEntry.receivedBytes += chunkData.byteLength;
        fileEntry.meta.bytesTransferred = fileEntry.receivedBytes;
        const totalExpected = fileEntry.meta.compressedSize || fileEntry.meta.size || 1;
        fileEntry.meta.progress = Math.min(100, Math.round((fileEntry.receivedBytes / totalExpected) * 100));

        this.calculateMetrics(fileId);
      }
    }
  }

  // Sender starts the transfer of queued files
  public async startTransfer(): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.events.onError?.('Peer connection is not open yet.');
      return;
    }

    this.isTransferring = true;
    this.isCancelled = false;
    this.events.onStateChange?.('transferring');
    this.transferStartTime = Date.now();
    this.lastSpeedSampleTime = Date.now();
    this.lastTransferredBytes = 0;

    // Set low watermark for backpressure
    this.dataChannel.bufferedAmountLowThreshold = BUFFER_LOW_WATERMARK;

    const encoder = new TextEncoder();

    for (const fileItem of this.filesToSend) {
      if (this.isCancelled) break;
      if (!fileItem.file) continue;

      fileItem.status = 'transferring';

      const file = fileItem.file;
      const isEligible = this.compressTextFiles && isCompressibleTextFile(file.name, file.type);
      let isCompressed = false;
      let dataToStream: Uint8Array | null = null;
      let totalStreamBytes = file.size;

      if (isEligible) {
        try {
          const rawBuffer = await file.arrayBuffer();
          const rawUint8 = new Uint8Array(rawBuffer);
          const compressed = compressData(rawUint8);
          // Only use compression if it genuinely reduces file size
          if (compressed.byteLength < rawUint8.byteLength) {
            isCompressed = true;
            dataToStream = compressed;
            totalStreamBytes = compressed.byteLength;
            fileItem.isCompressed = true;
            fileItem.originalSize = file.size;
            fileItem.compressedSize = compressed.byteLength;
            fileItem.savedPercentage = calculateSavedPercentage(file.size, compressed.byteLength);
          }
        } catch (e) {
          console.warn('Error compressing text file, streaming uncompressed:', e);
        }
      }

      // Signal start of this file
      this.dataChannel.send(JSON.stringify({
        action: 'START_FILE_TRANSFER',
        fileId: fileItem.id,
        name: fileItem.name,
        size: totalStreamBytes,
        originalSize: file.size,
        type: fileItem.type,
        isCompressed,
        compressedSize: isCompressed ? totalStreamBytes : undefined
      }));

      // Stream file in chunks
      let offset = 0;
      const fileIdPadded = fileItem.id.padEnd(36, ' ').substring(0, 36);
      const fileIdHeader = encoder.encode(fileIdPadded);

      while (offset < totalStreamBytes && !this.isCancelled) {
        // Backpressure check: if buffer is high, wait for low watermark
        if (this.dataChannel.bufferedAmount > BUFFER_HIGH_WATERMARK) {
          await this.waitForBufferDrain();
        }

        let chunkByteLength: number;
        let packet: Uint8Array;

        if (isCompressed && dataToStream) {
          const chunkSlice = dataToStream.subarray(offset, Math.min(totalStreamBytes, offset + CHUNK_SIZE));
          chunkByteLength = chunkSlice.byteLength;
          packet = new Uint8Array(36 + chunkByteLength);
          packet.set(fileIdHeader, 0);
          packet.set(chunkSlice, 36);
        } else {
          const chunkSlice = file.slice(offset, offset + CHUNK_SIZE);
          const chunkBuffer = await chunkSlice.arrayBuffer();
          chunkByteLength = chunkBuffer.byteLength;
          packet = new Uint8Array(36 + chunkByteLength);
          packet.set(fileIdHeader, 0);
          packet.set(new Uint8Array(chunkBuffer), 36);
        }

        this.dataChannel.send((packet.buffer as unknown) as ArrayBuffer);

        offset += chunkByteLength;
        fileItem.bytesTransferred = offset;
        fileItem.progress = Math.min(100, Math.round((offset / totalStreamBytes) * 100));

        this.calculateMetrics(fileItem.id);
      }

      if (this.isCancelled) break;

      // Calculate SHA256 of sent file
      const sha256 = await computeSHA256(file);
      fileItem.sha256 = sha256;
      fileItem.status = 'completed';
      fileItem.progress = 100;

      // Signal end of this file
      this.dataChannel.send(JSON.stringify({
        action: 'END_FILE_TRANSFER',
        fileId: fileItem.id,
        isCompressed,
        originalSize: file.size,
        compressedSize: isCompressed ? totalStreamBytes : undefined,
        sha256
      }));
    }

    if (!this.isCancelled) {
      this.isTransferring = false;
      this.events.onStateChange?.('completed');
      this.events.onTransferComplete?.(this.filesToSend);
    }
  }

  // Wait for WebRTC buffer to drain
  private waitForBufferDrain(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.dataChannel || this.dataChannel.bufferedAmount <= BUFFER_LOW_WATERMARK) {
        resolve();
        return;
      }

      const onLow = () => {
        if (this.dataChannel) {
          this.dataChannel.removeEventListener('bufferedamountlow', onLow);
        }
        resolve();
      };

      this.dataChannel.addEventListener('bufferedamountlow', onLow);
    });
  }

  // Calculate live transfer metrics (speed, eta, percent)
  private calculateMetrics(activeFileId?: string) {
    const now = Date.now();
    const timeDelta = (now - this.lastSpeedSampleTime) / 1000;

    let totalBytesTransferred = 0;
    let totalBytes = 0;

    if (this.role === 'sender') {
      this.filesToSend.forEach(f => {
        totalBytesTransferred += f.bytesTransferred;
        totalBytes += f.size;
      });
    } else {
      this.receivedFiles.forEach(f => {
        totalBytesTransferred += f.meta.bytesTransferred;
        totalBytes += f.meta.size;
      });
    }

    if (timeDelta >= 0.15) {
      const bytesSinceLast = totalBytesTransferred - this.lastTransferredBytes;
      const currentSpeed = bytesSinceLast / timeDelta;
      // Exponential moving average for smooth, responsive display
      this.smoothedSpeed = this.smoothedSpeed === 0 
        ? currentSpeed 
        : 0.5 * this.smoothedSpeed + 0.5 * currentSpeed;

      this.lastTransferredBytes = totalBytesTransferred;
      this.lastSpeedSampleTime = now;
    }

    const speed = Math.max(0, this.smoothedSpeed);
    const percent = totalBytes > 0 ? Math.min(100, Math.round((totalBytesTransferred / totalBytes) * 100)) : 0;
    const remainingBytes = Math.max(0, totalBytes - totalBytesTransferred);
    const etaSeconds = speed > 0 ? remainingBytes / speed : 0;

    let formattedSpeed = '0 B/s';
    if (speed > 1024 * 1024) {
      formattedSpeed = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (speed > 1024) {
      formattedSpeed = `${(speed / 1024).toFixed(1)} KB/s`;
    } else {
      formattedSpeed = `${Math.round(speed)} B/s`;
    }

    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    const chunksCompleted = Math.min(totalChunks, Math.ceil(totalBytesTransferred / CHUNK_SIZE));
    const bufferedAmount = this.dataChannel ? this.dataChannel.bufferedAmount : 0;
    let networkStatus: 'optimal' | 'congested' | 'throttling' = 'optimal';

    if (bufferedAmount > 3 * 1024 * 1024) {
      networkStatus = 'throttling';
      if (now - this.lastBufferWarningTime > 5000) {
        this.lastBufferWarningTime = now;
        this.events.onError?.(`Network Congestion Warning: DataChannel buffer is heavily loaded (~${(bufferedAmount / 1024 / 1024).toFixed(1)}MB pending). Throttling transmission to prevent packet loss.`);
      }
    } else if (bufferedAmount > 1.5 * 1024 * 1024) {
      networkStatus = 'congested';
    }

    this.events.onTransferProgress?.({
      speedBytesPerSec: speed,
      formattedSpeed,
      bytesTransferred: totalBytesTransferred,
      totalBytes,
      percent,
      etaSeconds,
      chunksCompleted,
      totalChunks,
      speedType: this.role === 'sender' ? 'upload' : 'download',
      bufferedAmount,
      networkStatus
    }, activeFileId);
  }

  // Send real-time chat/text snippet message with rate limiting
  public sendChatMessage(text: string): ChatMessage | null {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return null;

    const now = Date.now();
    this.chatMessageTimestamps = this.chatMessageTimestamps.filter(t => now - t < 3000);
    if (this.chatMessageTimestamps.length >= 5) {
      this.events.onError?.('Rate Limit Exceeded: You are sending chat messages too quickly (max 5 per 3 seconds). Please wait before sending more.');
      return null;
    }
    this.chatMessageTimestamps.push(now);

    const chatMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'self',
      text: text.trim(),
      timestamp: now
    };

    this.dataChannel.send(JSON.stringify({
      action: 'CHAT_MESSAGE',
      ...chatMsg
    }));

    return chatMsg;
  }

  // Cancel current transfer
  public cancelTransfer() {
    this.isCancelled = true;
    this.isTransferring = false;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ action: 'CANCEL_TRANSFER' }));
    }
    this.events.onStateChange?.('idle');
  }

  // Reset and leave session
  public resetSession() {
    this.cancelTransfer();
    this.sendWs({ type: 'leave-room' });
    this.cleanupPeerConnection();
    this.roomCode = null;
    this.role = null;
    this.remotePeerInfo = null;
    this.filesToSend = [];
    this.receivedFiles.clear();
    this.transferStartTime = 0;
    this.lastTransferredBytes = 0;
    this.smoothedSpeed = 0;
    this.events.onStateChange?.('idle');
  }

  private cleanupPeerConnection() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  public destroy() {
    this.resetSession();
    clearInterval(this.pingInterval);
    if (this.diagnosticTimer) {
      clearInterval(this.diagnosticTimer);
      this.diagnosticTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ==========================================
  // SERVERLESS OFFLINE DIRECT WEBRTC MODES
  // (Works 100% serverless over Wi-Fi / Hotspot)
  // ==========================================

  public async createOfflineDirectOffer(files: FileItem[]): Promise<string> {
    this.filesToSend = files;
    this.role = 'sender';
    this.initPeerConnection();

    if (!this.pc) throw new Error('Could not initialize local WebRTC connection');

    const channel = this.pc.createDataChannel('hexasend-data', { ordered: true });
    this.setupDataChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for local ICE candidate gathering
    await new Promise<void>((resolve) => {
      if (this.pc?.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        this.pc?.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1200);
      }
    });

    const localDesc = this.pc.localDescription;
    const rawSdp = localDesc ? localDesc.sdp : offer.sdp;
    
    const compactOffer = {
      type: 'OFFLINE_OFFER',
      sdp: rawSdp,
      filesMeta: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    };

    return 'INSTASEND_OFFLINE_OFFER:' + btoa(JSON.stringify(compactOffer));
  }

  public async acceptOfflineDirectOffer(encodedOfferStr: string): Promise<string> {
    this.role = 'receiver';
    this.initPeerConnection();

    if (!this.pc) throw new Error('Could not initialize local WebRTC connection');

    let offerSdp = '';
    let filesMeta: any[] = [];

    if (encodedOfferStr.startsWith('INSTASEND_OFFLINE_OFFER:')) {
      const base64Data = encodedOfferStr.replace('INSTASEND_OFFLINE_OFFER:', '');
      const parsed = JSON.parse(atob(base64Data));
      offerSdp = parsed.sdp;
      filesMeta = parsed.filesMeta || [];
    } else {
      offerSdp = encodedOfferStr;
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerSdp
    }));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (this.pc?.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        this.pc?.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1200);
      }
    });

    const localAnswerDesc = this.pc.localDescription;
    const rawAnswerSdp = localAnswerDesc ? localAnswerDesc.sdp : answer.sdp;

    const compactAnswer = {
      type: 'OFFLINE_ANSWER',
      sdp: rawAnswerSdp
    };

    if (filesMeta.length > 0) {
      this.events.onRoomJoined?.('OFFLINE', filesMeta);
    }

    return 'INSTASEND_OFFLINE_ANSWER:' + btoa(JSON.stringify(compactAnswer));
  }

  public async completeOfflineDirectHandshake(encodedAnswerStr: string): Promise<void> {
    if (!this.pc) throw new Error('No active WebRTC session found');

    let answerSdp = '';
    if (encodedAnswerStr.startsWith('INSTASEND_OFFLINE_ANSWER:')) {
      const base64Data = encodedAnswerStr.replace('INSTASEND_OFFLINE_ANSWER:', '');
      const parsed = JSON.parse(atob(base64Data));
      answerSdp = parsed.sdp;
    } else {
      answerSdp = encodedAnswerStr;
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp
    }));

    this.events.onStateChange?.('connecting_webrtc');
  }
}
