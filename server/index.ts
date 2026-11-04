import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import jwt from 'jsonwebtoken';
import { requireAdmin, JWT_SECRET } from './middleware/auth.ts';
import { sqliteAuth } from './db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const isProduction = process.env.NODE_ENV === 'production';
export const PORT = 3000;
export const BIND_HOST = '0.0.0.0';

export const app = express();
export const server = http.createServer(app);

// WebSocket Server for WebRTC signaling and presence (isolated from Vite HMR)
export const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const protocol = request.headers['sec-websocket-protocol'];
  const reqUrl = request.url || '';
  // Gracefully accept Vite HMR WebSockets without aborting socket to prevent "WebSocket closed without opened" errors
  if (protocol === 'vite-hmr' || reqUrl.includes('vite')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.on('error', () => {});
      ws.on('message', () => {});
    });
    return;
  }

  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Accept signaling connections on /ws or root / or /signaling
    if (pathname === '/ws' || pathname === '/' || pathname === '/signaling') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(1000, 'Normal Closure');
      });
    }
  } catch {
    socket.destroy();
  }
});

export interface Peer {
  id: string;
  ws: WebSocket;
  roomCode?: string;
  role?: 'sender' | 'receiver';
  deviceInfo?: {
    name: string;
    browser: string;
    os: string;
    type: 'desktop' | 'mobile' | 'tablet';
  };
}

export interface RelayFile {
  id: string;
  name: string;
  size: number;
  type: string;
  relativePath?: string;
  chunks: Buffer[];
  receivedBytes: number;
  sha256?: string;
  isComplete: boolean;
}

export const ROOM_TTL_SECONDS = 600; // 10 minutes default Time-To-Live
export const ROOM_TTL_MS = ROOM_TTL_SECONDS * 1000;

export interface Room {
  code: string;
  sender?: Peer;
  receiver?: Peer;
  createdAt: number;
  expiresAt: number;
  ttlSeconds: number;
  disconnectedAt?: number;
  disconnectTimeout?: NodeJS.Timeout;
  filesMeta?: {
    id?: string;
    name: string;
    size: number;
    type: string;
    relativePath?: string;
  }[];
  relayFiles?: Map<string, RelayFile>;
  secretCode?: string;
  requiresSecretCode?: boolean;
  expiresOnSenderClose?: boolean;
}

export const peers = new Map<string, Peer>();
export const rooms = new Map<string, Room>();

// Helper to normalize room code (remove spaces, symbols, uppercase)
export function cleanCode(code: string): string {
  return (code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

// Helper to generate a friendly 6-character room code (e.g. HEX729 or 6 alphanumeric)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Clean up stale rooms past TTL or older than 4 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now > room.expiresAt || now - room.createdAt > 4 * 60 * 60 * 1000) {
      if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
      rooms.delete(code);
    }
  }
}, 30 * 1000);

wss.on('connection', (ws: WebSocket) => {
  const peerId = Math.random().toString(36).substring(2, 10);
  const peer: Peer = { id: peerId, ws };
  peers.set(peerId, peer);

  // Send peer their assigned ID
  ws.send(JSON.stringify({
    type: 'connected',
    peerId
  }));

  ws.on('message', (data: string | Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping': {
          // Rolling TTL renewal for active rooms while sender stays connected
          if (peer.roomCode) {
            const room = rooms.get(peer.roomCode);
            if (room && peer.role === 'sender') {
              room.expiresAt = Date.now() + ROOM_TTL_MS;
            }
          }
          // Echo back client timestamp 't' for signal round-trip latency measurement
          ws.send(JSON.stringify({ 
            type: 'pong', 
            t: message.t, 
            serverTime: Date.now() 
          }));
          break;
        }

        case 'device-announce': {
          peer.deviceInfo = message.deviceInfo;
          // Broadcast to other radar peers
          broadcastRadarPeers();
          break;
        }

        case 'device-radar-query': {
          sendRadarList(peer);
          break;
        }

        case 'create-room': {
          const requestedCode = cleanCode(message.customCode);
          let actualCode = requestedCode || generateRoomCode();
          const secretCode = message.secretCode ? String(message.secretCode).trim() : undefined;
          const requiresSecretCode = message.requiresSecretCode !== undefined 
            ? !!message.requiresSecretCode 
            : !!(secretCode && secretCode.length > 0);
          const expiresOnSenderClose = message.expiresOnSenderClose !== undefined ? !!message.expiresOnSenderClose : false;

          const now = Date.now();
          // If expiresOnSenderClose is active, set a 24-hour safety window that expires when sender closes
          const roomTtl = expiresOnSenderClose ? 24 * 3600 : (message.ttlSeconds || ROOM_TTL_SECONDS);
          const expiresAt = now + (roomTtl * 1000);

          const existingRoom = rooms.get(actualCode);
          if (existingRoom && now <= existingRoom.expiresAt) {
            // If sender is re-creating their room or reclaiming after brief disconnect
            if (existingRoom.disconnectTimeout) {
              clearTimeout(existingRoom.disconnectTimeout);
              existingRoom.disconnectTimeout = undefined;
            }
            delete existingRoom.disconnectedAt;
            existingRoom.sender = peer;
            if (message.filesMeta && message.filesMeta.length > 0) {
              existingRoom.filesMeta = message.filesMeta;
            }
            if (secretCode !== undefined) existingRoom.secretCode = secretCode;
            if (requiresSecretCode !== undefined) existingRoom.requiresSecretCode = requiresSecretCode;
            if (expiresOnSenderClose !== undefined) existingRoom.expiresOnSenderClose = expiresOnSenderClose;
            peer.roomCode = actualCode;
            peer.role = 'sender';

            const ttlRemaining = Math.max(0, Math.floor((existingRoom.expiresAt - now) / 1000));

            ws.send(JSON.stringify({
              type: 'room-created',
              roomCode: actualCode,
              filesMeta: existingRoom.filesMeta || [],
              createdAt: existingRoom.createdAt,
              expiresAt: existingRoom.expiresAt,
              ttlSeconds: existingRoom.ttlSeconds || roomTtl,
              ttlRemainingSeconds: ttlRemaining,
              requiresSecretCode: !!existingRoom.requiresSecretCode,
              secretCode: existingRoom.secretCode,
              expiresOnSenderClose: !!existingRoom.expiresOnSenderClose
            }));

            if (existingRoom.receiver && existingRoom.receiver.ws.readyState === WebSocket.OPEN) {
              existingRoom.receiver.ws.send(JSON.stringify({
                type: 'sender-reconnected',
                roomCode: actualCode
              }));
              peer.ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: existingRoom.receiver.id,
                receiverInfo: existingRoom.receiver.deviceInfo || { name: 'Receiver Device' }
              }));
            }
            break;
          }

          peer.roomCode = actualCode;
          peer.role = 'sender';

          rooms.set(actualCode, {
            code: actualCode,
            sender: peer,
            createdAt: now,
            expiresAt,
            ttlSeconds: roomTtl,
            filesMeta: message.filesMeta || message.files || [],
            relayFiles: new Map(),
            secretCode,
            requiresSecretCode,
            expiresOnSenderClose
          });

          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode: actualCode,
            filesMeta: message.filesMeta || message.files || [],
            createdAt: now,
            expiresAt,
            ttlSeconds: roomTtl,
            ttlRemainingSeconds: roomTtl,
            requiresSecretCode,
            secretCode,
            expiresOnSenderClose
          }));
          break;
        }

        case 'refresh-room': {
          if (message.oldRoomCode) {
            const oldCode = cleanCode(message.oldRoomCode);
            const oldRoom = rooms.get(oldCode);
            if (oldRoom) {
              if (oldRoom.receiver && oldRoom.receiver.ws.readyState === WebSocket.OPEN) {
                oldRoom.receiver.ws.send(JSON.stringify({
                  type: 'peer-left',
                  message: 'Sender refreshed the session and generated a new 6-character code'
                }));
              }
              if (oldRoom.disconnectTimeout) clearTimeout(oldRoom.disconnectTimeout);
              rooms.delete(oldCode);
            }
          }

          const newCode = generateRoomCode();
          const now = Date.now();
          const secretCode = message.secretCode ? String(message.secretCode).trim() : undefined;
          const requiresSecretCode = message.requiresSecretCode !== undefined 
            ? !!message.requiresSecretCode 
            : !!(secretCode && secretCode.length > 0);
          const expiresOnSenderClose = message.expiresOnSenderClose !== undefined ? !!message.expiresOnSenderClose : false;
          const roomTtl = expiresOnSenderClose ? 24 * 3600 : (message.ttlSeconds || ROOM_TTL_SECONDS);
          const expiresAt = now + (roomTtl * 1000);

          peer.roomCode = newCode;
          peer.role = 'sender';

          rooms.set(newCode, {
            code: newCode,
            sender: peer,
            createdAt: now,
            expiresAt,
            ttlSeconds: roomTtl,
            filesMeta: message.filesMeta || message.files || [],
            relayFiles: new Map(),
            secretCode,
            requiresSecretCode,
            expiresOnSenderClose
          });

          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode: newCode,
            filesMeta: message.filesMeta || message.files || [],
            createdAt: now,
            expiresAt,
            ttlSeconds: roomTtl,
            ttlRemainingSeconds: roomTtl,
            requiresSecretCode,
            secretCode,
            expiresOnSenderClose
          }));
          break;
        }

        case 'stop-transfer': {
          const code = cleanCode(message.roomCode);
          const room = rooms.get(code);
          if (room) {
            if (room.receiver && room.receiver.ws.readyState === WebSocket.OPEN) {
              room.receiver.ws.send(JSON.stringify({
                type: 'session-expired',
                message: 'Sender closed the transfer session. The temporary URL has expired.',
                sessionExpired: true
              }));
            }
            if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
            rooms.delete(code);
          }
          peer.roomCode = undefined;
          peer.role = undefined;
          ws.send(JSON.stringify({
            type: 'transfer-stopped',
            roomCode: code
          }));
          break;
        }

        case 'reclaim-room': {
          const code = cleanCode(message.roomCode);
          let room = rooms.get(code);
          const now = Date.now();

          if (room && now <= room.expiresAt) {
            if (room.disconnectTimeout) {
              clearTimeout(room.disconnectTimeout);
              room.disconnectTimeout = undefined;
            }
            delete room.disconnectedAt;
            room.sender = peer;
            peer.roomCode = code;
            peer.role = 'sender';
            if (message.filesMeta && message.filesMeta.length > 0) {
              room.filesMeta = message.filesMeta;
            }

            const ttlRemaining = Math.max(0, Math.floor((room.expiresAt - now) / 1000));

            ws.send(JSON.stringify({
              type: 'room-created',
              roomCode: code,
              filesMeta: room.filesMeta || [],
              createdAt: room.createdAt,
              expiresAt: room.expiresAt,
              ttlSeconds: room.ttlSeconds || ROOM_TTL_SECONDS,
              ttlRemainingSeconds: ttlRemaining,
              requiresSecretCode: !!room.requiresSecretCode,
              secretCode: room.secretCode,
              expiresOnSenderClose: !!room.expiresOnSenderClose
            }));

            if (room.receiver && room.receiver.ws.readyState === WebSocket.OPEN) {
              room.receiver.ws.send(JSON.stringify({
                type: 'sender-reconnected',
                roomCode: code
              }));
              peer.ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: room.receiver.id,
                receiverInfo: room.receiver.deviceInfo || { name: 'Receiver Device' }
              }));
            }
          } else if (code) {
            // Re-create room with the same code so sender's QR code & links stay valid
            peer.roomCode = code;
            peer.role = 'sender';
            const expiresAt = now + ROOM_TTL_MS;
            rooms.set(code, {
              code,
              sender: peer,
              createdAt: now,
              expiresAt,
              ttlSeconds: ROOM_TTL_SECONDS,
              filesMeta: message.filesMeta || [],
              relayFiles: new Map(),
              requiresSecretCode: !!message.requiresSecretCode,
              secretCode: message.secretCode,
              expiresOnSenderClose: !!message.expiresOnSenderClose
            });

            ws.send(JSON.stringify({
              type: 'room-created',
              roomCode: code,
              filesMeta: message.filesMeta || [],
              createdAt: now,
              expiresAt,
              ttlSeconds: ROOM_TTL_SECONDS,
              ttlRemainingSeconds: ROOM_TTL_SECONDS,
              requiresSecretCode: !!message.requiresSecretCode,
              secretCode: message.secretCode,
              expiresOnSenderClose: !!message.expiresOnSenderClose
            }));
          }
          break;
        }

        case 'join-room': {
          const code = cleanCode(message.roomCode);
          let room = rooms.get(code);
          const now = Date.now();

          if (!room || now > room.expiresAt) {
            if (room && now > room.expiresAt) {
              if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
              rooms.delete(code);
            }
            // Auto-create pending room session so joining with any code (e.g. HTTP19) always succeeds
            const expiresAt = now + ROOM_TTL_MS;
            room = {
              code,
              createdAt: now,
              expiresAt,
              ttlSeconds: ROOM_TTL_SECONDS,
              filesMeta: [],
              relayFiles: new Map()
            };
            rooms.set(code, room);
          }

          // Secret passcode protection check
          if (room.requiresSecretCode && room.secretCode) {
            const clientSecret = message.secretCode ? String(message.secretCode).trim() : '';
            if (clientSecret !== room.secretCode) {
              ws.send(JSON.stringify({
                type: 'secret-code-required',
                code: 'SECRET_CODE_REQUIRED',
                roomCode: code,
                message: 'This session is protected with a secret code. Please enter the passcode to access files.'
              }));
              break;
            }
          }

          const senderOnline = !!(room.sender && room.sender.ws.readyState === WebSocket.OPEN);
          const ttlRemaining = Math.max(0, Math.floor((room.expiresAt - now) / 1000));

          peer.roomCode = code;
          peer.role = 'receiver';
          room.receiver = peer;

          // Notify receiver they joined
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomCode: code,
            senderOnline,
            senderInfo: room.sender?.deviceInfo || { name: 'Sender Device' },
            filesMeta: room.filesMeta || [],
            createdAt: room.createdAt,
            expiresAt: room.expiresAt,
            ttlSeconds: room.ttlSeconds || ROOM_TTL_SECONDS,
            ttlRemainingSeconds: ttlRemaining,
            requiresSecretCode: !!room.requiresSecretCode,
            expiresOnSenderClose: !!room.expiresOnSenderClose
          }));

          // Notify sender that receiver has arrived (if online)
          if (senderOnline && room.sender) {
            room.sender.ws.send(JSON.stringify({
              type: 'peer-joined',
              peerId: peer.id,
              receiverInfo: peer.deviceInfo || { name: 'Receiver Device' }
            }));
          }
          break;
        }

        case 'signal': {
          // Relay WebRTC signaling: offer, answer, ice-candidate
          const room = peer.roomCode ? rooms.get(peer.roomCode) : undefined;
          if (!room) return;

          const target = peer.role === 'sender' ? room.receiver : room.sender;
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'signal',
              signal: message.signal,
              from: peer.id
            }));
          }
          break;
        }

        case 'direct-invite': {
          // P2P invite from radar
          const targetPeer = peers.get(message.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(JSON.stringify({
              type: 'direct-invite-received',
              fromPeerId: peer.id,
              fromDeviceInfo: peer.deviceInfo,
              roomCode: message.roomCode,
              filesMeta: message.filesMeta
            }));
          }
          break;
        }

        case 'relay-chunk': {
          // Fallback relay if WebRTC is blocked on restrictive networks
          const room = peer.roomCode ? rooms.get(peer.roomCode) : undefined;
          if (!room) return;
          const target = peer.role === 'sender' ? room.receiver : room.sender;
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'relay-chunk',
              payload: message.payload
            }));
          }
          break;
        }

        case 'leave-room': {
          leaveRoom(peer, true); // Explicit user leave -> clean immediately
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    leaveRoom(peer, false); // Transient disconnect -> 120s grace period for sender
    peers.delete(peerId);
    broadcastRadarPeers();
  });
});

export function leaveRoom(peer: Peer, isExplicitLeave = false) {
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (!room) return;

  const otherPeer = peer.role === 'sender' ? room.receiver : room.sender;
  if (otherPeer && otherPeer.ws.readyState === WebSocket.OPEN) {
    otherPeer.ws.send(JSON.stringify({
      type: isExplicitLeave && peer.role === 'sender' ? 'session-expired' : 'peer-left',
      role: peer.role,
      isTemporary: !isExplicitLeave && peer.role === 'sender',
      message: isExplicitLeave && peer.role === 'sender' 
        ? 'Sender closed the transfer session. The temporary URL has expired.'
        : undefined
    }));
  }

  if (peer.role === 'sender') {
    if (isExplicitLeave) {
      if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
      rooms.delete(peer.roomCode);
    } else {
      // 120-second Grace Period: keep room alive so receiver or reconnected sender can use it!
      room.disconnectedAt = Date.now();
      if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
      const codeToDelete = peer.roomCode;
      room.disconnectTimeout = setTimeout(() => {
        const currentRoom = rooms.get(codeToDelete);
        if (currentRoom && currentRoom.disconnectedAt && (!currentRoom.sender || currentRoom.sender.ws.readyState !== WebSocket.OPEN)) {
          if (currentRoom.receiver && currentRoom.receiver.ws.readyState === WebSocket.OPEN) {
            currentRoom.receiver.ws.send(JSON.stringify({
              type: 'session-expired',
              message: 'Sender disconnected and session closed. The temporary URL has expired.'
            }));
          }
          rooms.delete(codeToDelete);
        }
      }, 120 * 1000);
    }
  } else if (room.receiver === peer) {
    room.receiver = undefined;
  }
  peer.roomCode = undefined;
}

export function sendRadarList(targetPeer: Peer) {
  const radarList = Array.from(peers.values())
    .filter(p => p.id !== targetPeer.id && p.deviceInfo && !p.roomCode && p.ws.readyState === WebSocket.OPEN)
    .map(p => ({
      id: p.id,
      deviceInfo: p.deviceInfo
    }));

  if (targetPeer.ws.readyState === WebSocket.OPEN) {
    targetPeer.ws.send(JSON.stringify({
      type: 'radar-list',
      peers: radarList
    }));
  }
}

export function broadcastRadarPeers() {
  for (const peer of peers.values()) {
    if (peer.deviceInfo && !peer.roomCode) {
      sendRadarList(peer);
    }
  }
}

// Express App APIs - increase json payload limit for fallback relay
app.use(express.json({ limit: '100mb' }));

// Network LAN Discovery API
app.get('/api/network-info', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }

    // Prefer private local network IPv4 ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    const lanIp = addresses.find(ip => 
      ip.startsWith('192.168.') || 
      ip.startsWith('10.') || 
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    ) || addresses[0] || '127.0.0.1';

    res.json({
      success: true,
      lanIp,
      addresses,
      port: PORT,
      hostname: os.hostname()
    });
  } catch (err: any) {
    res.json({ success: false, lanIp: '127.0.0.1', addresses: ['127.0.0.1'], port: PORT });
  }
});

// Room Existence & State Query API
app.get('/api/room/:code', (req, res) => {
  const code = cleanCode(req.params.code);
  const room = rooms.get(code);
  const now = Date.now();

  if (!room || now > room.expiresAt) {
    if (room && now > room.expiresAt) {
      if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
      rooms.delete(code);
    }
    return res.json({
      success: false,
      exists: false,
      expired: true,
      code,
      message: `Session code ${code} was not found or has expired.`
    });
  }

  const senderOnline = !!(room.sender && room.sender.ws.readyState === WebSocket.OPEN);
  const ttlRemaining = Math.max(0, Math.floor((room.expiresAt - now) / 1000));

  res.json({
    success: true,
    exists: true,
    code: room.code,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    ttlSeconds: room.ttlSeconds || ROOM_TTL_SECONDS,
    ttlRemainingSeconds: ttlRemaining,
    senderOnline,
    disconnectedAt: room.disconnectedAt || null,
    senderInfo: room.sender?.deviceInfo || { name: 'Sender Device' },
    filesMeta: room.filesMeta || [],
    relayFilesCount: room.relayFiles ? room.relayFiles.size : 0,
    requiresSecretCode: !!room.requiresSecretCode,
    expiresOnSenderClose: !!room.expiresOnSenderClose
  });
});

// Fallback direct LAN file upload & download
app.post('/api/transfer/:code/upload', (req, res) => {
  try {
    const code = cleanCode(req.params.code);
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    // Security: Limit total files/size in relay to prevent memory exhaustion
    const MAX_RELAY_FILES = 5;
    const MAX_RELAY_SIZE = 50 * 1024 * 1024; // 50MB per room
    
    const currentSize = room.relayFiles ? Array.from(room.relayFiles.values()).reduce((sum, f) => sum + f.size, 0) : 0;

    const { id, name, size, type, relativePath, base64Data, sha256 } = req.body;
    if (!id || !name || !base64Data) {
      return res.status(400).json({ success: false, message: 'Missing file payload data' });
    }
    
    const fileSize = Number(size) || Buffer.byteLength(base64Data, 'base64');
    
    if (room.relayFiles && room.relayFiles.size >= MAX_RELAY_FILES) {
      return res.status(400).json({ success: false, message: 'Room relay limit reached (too many files)' });
    }
    
    if (currentSize + fileSize > MAX_RELAY_SIZE) {
      return res.status(400).json({ success: false, message: 'Room relay limit reached (size exceeded)' });
    }

    if (!room.relayFiles) room.relayFiles = new Map();
    const buffer = Buffer.from(base64Data, 'base64');

    room.relayFiles.set(id, {
      id,
      name,
      size: fileSize,
      type: type || 'application/octet-stream',
      relativePath: relativePath || name,
      chunks: [buffer],
      receivedBytes: buffer.length,
      sha256,
      isComplete: true
    });

    res.json({ success: true, fileId: id, size: buffer.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/transfer/:code/files', (req, res) => {
  const code = cleanCode(req.params.code);
  const room = rooms.get(code);
  if (!room || !room.relayFiles) {
    return res.json({ success: true, files: [] });
  }

  const files = Array.from(room.relayFiles.values()).map(f => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    relativePath: f.relativePath,
    sha256: f.sha256,
    isComplete: f.isComplete
  }));

  res.json({ success: true, files });
});

app.get('/api/transfer/:code/download/:fileId', (req, res) => {
  const code = cleanCode(req.params.code);
  const { fileId } = req.params;
  const room = rooms.get(code);

  if (!room || !room.relayFiles) {
    return res.status(404).send('Session or file not found');
  }

  const file = room.relayFiles.get(fileId);
  if (!file || !file.chunks || file.chunks.length === 0) {
    return res.status(404).send('File not found or not yet uploaded to relay');
  }

  const combined = Buffer.concat(file.chunks);
  res.setHeader('Content-Type', file.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Content-Length', combined.length);
  res.send(combined);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activePeers: peers.size,
    activeRooms: rooms.size,
    sqlite: sqliteAuth.getDbStatus(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/db/status', (req, res) => {
  res.json({
    status: 'ok',
    sqlite: sqliteAuth.getDbStatus()
  });
});

app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = sqliteAuth.registerUser(name, email, password);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/signin', (req, res) => {
  try {
    const { email, password, deviceName } = req.body;
    const result = sqliteAuth.loginUser(email, password, deviceName);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }
    const user = sqliteAuth.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid' });
    }
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body.token;
    if (token) {
      sqliteAuth.revokeSession(token);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/admin-login', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const user = sqliteAuth.getUserByToken(token);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const jwtToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ success: true, token: jwtToken });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/user/stats', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const user = sqliteAuth.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }
    const { uploads, bytesSent, bytesReceived } = req.body;
    const updated = sqliteAuth.updateUserStats(user.id, {
      uploads: Number(uploads) || 0,
      bytesSent: Number(bytesSent) || 0,
      bytesReceived: Number(bytesReceived) || 0
    });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin APIs (/admin support) - Protected by JWT
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  try {
    const activePeersList = Array.from(peers.values()).map(p => ({
      id: p.id,
      roomCode: p.roomCode || null,
      role: p.role || null,
      deviceInfo: p.deviceInfo || { name: 'Unknown Device', browser: 'Browser', os: 'OS', type: 'desktop' }
    }));

    const activeRoomsList = Array.from(rooms.values()).map(r => ({
      code: r.code,
      createdAt: r.createdAt,
      sender: r.sender ? { id: r.sender.id, deviceInfo: r.sender.deviceInfo } : null,
      receiver: r.receiver ? { id: r.receiver.id, deviceInfo: r.receiver.deviceInfo } : null,
      filesCount: r.filesMeta?.length || 0
    }));

    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      stats: {
        activePeersCount: peers.size,
        activeRoomsCount: rooms.size,
        activePeers: activePeersList,
        activeRooms: activeRoomsList,
        memoryUsage: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
        },
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        sqlite: sqliteAuth.getDbStatus()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const users = sqliteAuth.getAllUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { name, email, password, role, plan } = req.body;
    const result = sqliteAuth.registerUser(name, email, password, role || 'user', plan || 'free');
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    sqliteAuth.deleteUser(id);
    res.json({ success: true, message: `User ${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/seed-sql', requireAdmin, (req, res) => {
  try {
    const sqlPath = path.resolve(projectRoot, 'docs/admin_and_test_users.sql');
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      res.type('text/plain').send(sqlContent);
    } else {
      res.status(404).send('-- SQL seed file not found');
    }
  } catch (err: any) {
    res.status(500).send(`-- Error loading SQL file: ${err.message}`);
  }
});

/**
 * Explicitly logs all network interfaces and addresses the server is binding to.
 * This lets developers immediately confirm:
 * - Localhost loopback (127.0.0.1 and localhost)
 * - LAN / Wi-Fi IP addresses (e.g., 192.168.x.x, 10.x.x.x)
 * - Configured port and binding host (0.0.0.0)
 */
export function logServerNetworkAddresses(port = PORT, host = BIND_HOST) {
  const interfaces = os.networkInterfaces();
  
  console.log('\n[Network Discovery] Detected network interface addresses via os.networkInterfaces():');
  for (const [name, ifaces] of Object.entries(interfaces)) {
    console.log(`  Interface: ${name}`);
    for (const iface of ifaces || []) {
      console.log(`    - IP: ${iface.address.padEnd(16)} | Family: ${iface.family} | Internal: ${iface.internal}`);
    }
  }

  const addressList: { name: string; address: string; family: string; isInternal: boolean }[] = [];
  for (const [name, ifaces] of Object.entries(interfaces)) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4') {
        addressList.push({
          name,
          address: iface.address,
          family: iface.family,
          isInternal: iface.internal
        });
      }
    }
  }

  const lanAddresses = addressList.filter(a => !a.isInternal);
  const loopbackAddresses = addressList.filter(a => a.isInternal);

  // Group and highlight private LAN subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const privateLanIps = lanAddresses.filter(a =>
    a.address.startsWith('192.168.') ||
    a.address.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(a.address)
  );

  console.log('\n======================================================');
  console.log('  🚀 InstaSend Signaling & P2P Web Server');
  console.log('======================================================');
  console.log(`  > Confirmed Binding Address: ${host}:${port} (Listening on ALL interfaces)`);
  console.log(`  > Configured Port:           ${port} (explicitly set to 3000)`);
  console.log('------------------------------------------------------');
  console.log('  🌐 Local Loopback Addresses (This Machine Only):');
  console.log(`     - http://localhost:${port}`);
  console.log(`     - http://127.0.0.1:${port}`);
  for (const lb of loopbackAddresses) {
    if (lb.address !== '127.0.0.1') {
      console.log(`     - http://${lb.address}:${port} (${lb.name})`);
    }
  }
  console.log('------------------------------------------------------');
  console.log('  📡 Available Local LAN IP Addresses (e.g. 192.168.x.x):');
  if (privateLanIps.length === 0) {
    console.log('     (No 192.168.x.x or 10.x.x.x private LAN interfaces found)');
  } else {
    for (const lan of privateLanIps) {
      console.log(`     - Local IP:     http://${lan.address}:${port}/ [Interface: ${lan.name}]`);
      console.log(`     - Admin Portal: http://${lan.address}:${port}/admin`);
    }
  }
  if (lanAddresses.length > privateLanIps.length) {
    console.log('  📡 Other Non-Loopback Network Interfaces:');
    for (const lan of lanAddresses.filter(a => !privateLanIps.includes(a))) {
      console.log(`     - IP:           http://${lan.address}:${port}/ [Interface: ${lan.name}]`);
    }
  }
  console.log('------------------------------------------------------');
  console.log(`  🔌 WebSocket Signaling: ws://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ws`);
  console.log(`  🛡️  Admin Console:       http://localhost:${port}/admin`);
  console.log(`  🩺 Health Check:        http://localhost:${port}/api/health`);
  console.log('======================================================\n');
}

export async function startServer() {
  const distPath = path.resolve(projectRoot, 'dist');

  // Natively serve static files from dist directory if it exists
  if (fs.existsSync(distPath)) {
    console.log(`[Server] Serving production static assets natively from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) {
        return next();
      }
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  } else if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          host: '0.0.0.0',
          port: PORT,
          hmr: false
        },
        appType: 'spa'
      });

      app.use(vite.middlewares);

      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.startsWith('/ws')) {
          return next();
        }
        try {
          let template = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
      console.log('[Server] Vite middleware mounted for live development compilation.');
    } catch (viteErr: any) {
      console.warn(`\n[Server Notice] Vite middlewareMode could not be initialized in this process: ${viteErr.message}`);
      console.warn(`[Server Notice] The backend API and WebRTC signaling server will continue running on port ${PORT}.`);
      console.warn(`[Server Notice] If you are running Vite in a separate client process (e.g. port 5173), API proxying is supported.\n`);

      app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) {
          return next();
        }
        const indexPath = path.resolve(projectRoot, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send('InstaSend backend API and WebSocket server is running. Run `npm run build` to generate the frontend assets.');
        }
      });
    }
  } else {
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) {
        return next();
      }
      res.status(404).send('Static assets not found. Please run "npm run build" first.');
    });
  }

  // Explicit JSON 404 handler: ensure /api/* calls never return HTML 404 pages
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server Error] Port ${PORT} is already in use by another process.`);
      console.error(`Please terminate any existing Node process running on port ${PORT} (e.g. npx kill-port ${PORT} or check background tasks) and try running 'npm run dev' again.\n`);
      process.exit(1);
    } else {
      console.error('[Server Error]', err);
    }
  });

  server.listen(PORT, BIND_HOST, () => {
    console.log('Server running at http://0.0.0.0:3000');

    const addr = server.address();
    const actualHost = typeof addr === 'object' && addr ? addr.address : BIND_HOST;
    const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
    const actualFamily = typeof addr === 'object' && addr ? addr.family : 'IPv4';

    const localUrl = `http://localhost:${actualPort}`;
    const networkUrl = `http://${actualHost}:${actualPort}`;
    const adminUrl = `http://localhost:${actualPort}/admin`;

    console.log(`\n======================================================`);
    console.log(`Server running at http://0.0.0.0:3000`);
    console.log(`[Server URL] Exact Local URL:   ${localUrl}`);
    console.log(`[Server URL] Exact Network URL: ${networkUrl}`);
    console.log(`[Server URL] Admin Portal URL:  ${adminUrl}`);
    console.log(`[Server] Successfully bound to ${actualHost}:${actualPort} (${actualFamily}) on all network interfaces.`);
    console.log(`[Server] Explicitly listening on 0.0.0.0:3000.`);
    console.log(`[Server] Remote devices can connect to Admin Portal at: http://<LAN_IP>:${actualPort}/admin`);
    console.log(`======================================================\n`);

    logServerNetworkAddresses(actualPort, actualHost);
  });
}

// Auto-start if run directly
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
