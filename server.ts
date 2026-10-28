import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
const server = http.createServer(app);

// WebSocket Server for WebRTC signaling and presence (isolated from Vite HMR)
const wss = new WebSocketServer({ noServer: true });

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

    // Accept signaling connections on /ws or root /
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

interface Peer {
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
const ROOM_TTL_MS = ROOM_TTL_SECONDS * 1000;

interface Room {
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
}

const peers = new Map<string, Peer>();
const rooms = new Map<string, Room>();

// Helper to normalize room code (remove spaces, symbols, uppercase)
function cleanCode(code: string): string {
  return (code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

// Helper to generate a friendly 6-character room code (e.g. HEX729 or 6 alphanumeric)
function generateRoomCode(): string {
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

          const now = Date.now();
          const expiresAt = now + ROOM_TTL_MS;

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
            peer.roomCode = actualCode;
            peer.role = 'sender';

            const ttlRemaining = Math.max(0, Math.floor((existingRoom.expiresAt - now) / 1000));

            ws.send(JSON.stringify({
              type: 'room-created',
              roomCode: actualCode,
              filesMeta: existingRoom.filesMeta || [],
              createdAt: existingRoom.createdAt,
              expiresAt: existingRoom.expiresAt,
              ttlSeconds: existingRoom.ttlSeconds || ROOM_TTL_SECONDS,
              ttlRemainingSeconds: ttlRemaining
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
            ttlSeconds: ROOM_TTL_SECONDS,
            filesMeta: message.filesMeta || [],
            relayFiles: new Map()
          });

          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode: actualCode,
            filesMeta: message.filesMeta || [],
            createdAt: now,
            expiresAt,
            ttlSeconds: ROOM_TTL_SECONDS,
            ttlRemainingSeconds: ROOM_TTL_SECONDS
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
              ttlRemainingSeconds: ttlRemaining
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
              relayFiles: new Map()
            });

            ws.send(JSON.stringify({
              type: 'room-created',
              roomCode: code,
              filesMeta: message.filesMeta || [],
              createdAt: now,
              expiresAt,
              ttlSeconds: ROOM_TTL_SECONDS,
              ttlRemainingSeconds: ROOM_TTL_SECONDS
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
            ttlRemainingSeconds: ttlRemaining
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

function leaveRoom(peer: Peer, isExplicitLeave = false) {
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (!room) return;

  const otherPeer = peer.role === 'sender' ? room.receiver : room.sender;
  if (otherPeer && otherPeer.ws.readyState === WebSocket.OPEN) {
    otherPeer.ws.send(JSON.stringify({
      type: 'peer-left',
      role: peer.role,
      isTemporary: !isExplicitLeave && peer.role === 'sender'
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
          rooms.delete(codeToDelete);
        }
      }, 120 * 1000);
    }
  } else if (room.receiver === peer) {
    room.receiver = undefined;
  }
  peer.roomCode = undefined;
}

function sendRadarList(targetPeer: Peer) {
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

function broadcastRadarPeers() {
  for (const peer of peers.values()) {
    if (peer.deviceInfo && !peer.roomCode) {
      sendRadarList(peer);
    }
  }
}

import { sqliteAuth } from './server/db.ts';

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
    relayFilesCount: room.relayFiles ? room.relayFiles.size : 0
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
    const { id, name, size, type, relativePath, base64Data, sha256 } = req.body;
    if (!id || !name || !base64Data) {
      return res.status(400).json({ success: false, message: 'Missing file payload data' });
    }

    if (!room.relayFiles) room.relayFiles = new Map();
    const buffer = Buffer.from(base64Data, 'base64');

    room.relayFiles.set(id, {
      id,
      name,
      size: Number(size) || buffer.length,
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

// Admin APIs (/admin support)
app.get('/api/admin/overview', (req, res) => {
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

app.get('/api/admin/users', (req, res) => {
  try {
    const users = sqliteAuth.getAllUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const { name, email, password, role, plan } = req.body;
    const result = sqliteAuth.registerUser(name, email, password, role || 'user', plan || 'free');
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    sqliteAuth.deleteUser(id);
    res.json({ success: true, message: `User ${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/seed-sql', (req, res) => {
  try {
    const sqlPath = path.resolve(process.cwd(), 'docs/admin_and_test_users.sql');
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

async function startServer() {
  if (!isProduction) {
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
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server Error] Port ${PORT} is already in use by another process.`);
      console.error(`Please terminate any existing Node process running on port ${PORT} (e.g., npx kill-port ${PORT} or stop the background dev process) and try running 'npm run dev' again.\n`);
      process.exit(1);
    } else {
      console.error('[Server Error]', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`InstaSend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
