import { DeviceInfo, FileItem, TransferMetrics, ChatMessage } from '../types.ts';
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
};

export class WebRTCManager {
  private ws: WebSocket | null = null;
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
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Announce local device info for radar & identification
        const deviceInfo = getLocalDeviceInfo();
        this.sendWs({
          type: 'device-announce',
          deviceInfo
        });

        // Query active radar peers
        this.sendWs({ type: 'device-radar-query' });

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

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
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
    }
  }

  // Handle incoming signaling messages
  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'connected':
        this.peerId = msg.peerId;
        break;

      case 'radar-list':
        this.events.onRadarUpdate?.(msg.peers || []);
        break;

      case 'direct-invite-received':
        this.events.onDirectInvite?.(msg);
        break;

      case 'room-created':
        this.roomCode = msg.roomCode;
        this.role = 'sender';
        this.events.onRoomCreated?.(msg.roomCode);
        this.events.onStateChange?.('waiting_for_peer');
        break;

      case 'room-joined':
        this.roomCode = msg.roomCode;
        this.role = 'receiver';
        this.remotePeerInfo = msg.senderInfo;
        this.events.onRoomJoined?.(msg.roomCode, msg.filesMeta);
        this.events.onStateChange?.('connecting_webrtc');
        // Initialize PeerConnection as answerer
        this.initPeerConnection();
        break;

      case 'peer-joined':
        // Receiver arrived! As sender, initiate WebRTC offer
        this.remotePeerInfo = msg.receiverInfo;
        this.events.onPeerConnected?.({ id: msg.peerId, deviceInfo: msg.receiverInfo });
        this.events.onStateChange?.('connecting_webrtc');
        await this.initiateOffer();
        break;

      case 'peer-left':
        this.events.onPeerDisconnected?.();
        this.events.onStateChange?.('waiting_for_peer', 'Peer disconnected');
        this.cleanupPeerConnection();
        break;

      case 'signal':
        await this.handleWebRTCSignal(msg.signal);
        break;

      case 'error':
        this.events.onError?.(msg.message || 'Error occurred');
        break;
    }
  }

  // Create room as Sender
  public createRoom(files: FileItem[], customCode?: string) {
    this.filesToSend = files;
    this.role = 'sender';
    this.sendWs({
      type: 'create-room',
      customCode,
      filesMeta: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });
  }

  // Join room as Receiver
  public joinRoom(roomCode: string) {
    this.role = 'receiver';
    this.sendWs({
      type: 'join-room',
      roomCode: roomCode.trim().toUpperCase()
    });
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

    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWs({
          type: 'signal',
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.events.onStateChange?.('peer_connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.events.onStateChange?.('disconnected', 'WebRTC connection interrupted');
      }
    };

    // If receiver, handle incoming data channel
    if (this.role === 'receiver') {
      this.pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }
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

    if (timeDelta >= 0.3) {
      const bytesSinceLast = totalBytesTransferred - this.lastTransferredBytes;
      const currentSpeed = bytesSinceLast / timeDelta;
      // Exponential moving average for smooth display
      this.smoothedSpeed = this.smoothedSpeed === 0 
        ? currentSpeed 
        : 0.7 * this.smoothedSpeed + 0.3 * currentSpeed;

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

    this.events.onTransferProgress?.({
      speedBytesPerSec: speed,
      formattedSpeed,
      bytesTransferred: totalBytesTransferred,
      totalBytes,
      percent,
      etaSeconds,
      chunksCompleted,
      totalChunks,
      speedType: this.role === 'sender' ? 'upload' : 'download'
    }, activeFileId);
  }

  // Send real-time chat/text snippet message
  public sendChatMessage(text: string): ChatMessage | null {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return null;

    const chatMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'self',
      text: text.trim(),
      timestamp: Date.now()
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
