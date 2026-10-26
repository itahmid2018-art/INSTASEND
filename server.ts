import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
  // Gracefully accept Vite HMR WebSockets without aborting socket to prevent "WebSocket closed without opened" errors
  if (protocol === 'vite-hmr') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.on('error', () => {});
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

interface Room {
  code: string;
  sender?: Peer;
  receiver?: Peer;
  createdAt: number;
  filesMeta?: {
    name: string;
    size: number;
    type: string;
  }[];
}

const peers = new Map<string, Peer>();
const rooms = new Map<string, Room>();

// Helper to generate a friendly 6-character room code (e.g. HEX729 or 6 alphanumeric)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Clean up stale rooms older than 4 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 4 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

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
          ws.send(JSON.stringify({ type: 'pong' }));
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
          const roomCode = message.customCode ? message.customCode.toUpperCase().trim() : generateRoomCode();
          
          // If code already taken and active sender exists, generate new
          const actualCode = (rooms.has(roomCode) && rooms.get(roomCode)?.sender) ? generateRoomCode() : roomCode;
          
          peer.roomCode = actualCode;
          peer.role = 'sender';

          rooms.set(actualCode, {
            code: actualCode,
            sender: peer,
            createdAt: Date.now(),
            filesMeta: message.filesMeta || []
          });

          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode: actualCode,
            filesMeta: message.filesMeta || []
          }));
          break;
        }

        case 'join-room': {
          const code = (message.roomCode || '').toUpperCase().trim();
          const room = rooms.get(code);

          if (!room) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'ROOM_NOT_FOUND',
              message: `Session code ${code} was not found or has expired.`
            }));
            return;
          }

          if (!room.sender || room.sender.ws.readyState !== WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'SENDER_DISCONNECTED',
              message: 'The sender is no longer connected to this session.'
            }));
            return;
          }

          peer.roomCode = code;
          peer.role = 'receiver';
          room.receiver = peer;

          // Notify receiver they joined
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomCode: code,
            senderInfo: room.sender.deviceInfo || { name: 'Sender Device' },
            filesMeta: room.filesMeta || []
          }));

          // Notify sender that receiver has arrived
          room.sender.ws.send(JSON.stringify({
            type: 'peer-joined',
            peerId: peer.id,
            receiverInfo: peer.deviceInfo || { name: 'Receiver Device' }
          }));
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
          leaveRoom(peer);
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    leaveRoom(peer);
    peers.delete(peerId);
    broadcastRadarPeers();
  });
});

function leaveRoom(peer: Peer) {
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (!room) return;

  const otherPeer = peer.role === 'sender' ? room.receiver : room.sender;
  if (otherPeer && otherPeer.ws.readyState === WebSocket.OPEN) {
    otherPeer.ws.send(JSON.stringify({
      type: 'peer-left',
      role: peer.role
    }));
  }

  if (peer.role === 'sender') {
    rooms.delete(peer.roomCode);
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

// Express App APIs
app.use(express.json());

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
    const sqlPath = path.resolve(__dirname, 'docs/admin_and_test_users.sql');
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
        hmr: process.env.ENABLE_HMR === 'true' ? true : false
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`InstaSend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
