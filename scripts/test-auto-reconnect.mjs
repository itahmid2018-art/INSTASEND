import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

async function runReconnectTests() {
  console.log('🧪 Starting InstaSend Signaling Auto-Reconnect & Network Flicker Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Sender Room Creation and Reclaiming after Network Disconnection
  console.log('--- Test 1: Sender Room Reclaiming after Network Disconnect ---');
  let roomCode = '';
  let initialExpiresAt = 0;

  // Step 1: Sender creates a room
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'create-room',
        filesMeta: [{ id: 'f-rec-1', name: 'report-2026.pdf', size: 2048, type: 'application/pdf' }]
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-created') {
        roomCode = msg.roomCode;
        initialExpiresAt = msg.expiresAt;
        assert(typeof roomCode === 'string' && roomCode.length === 6, `Sender established room with code: ${roomCode}`);
        // Simulate network flicker: abrupt WebSocket close
        ws.close();
        resolve();
      }
    });
  });

  // Step 2: Sender reconnects after network flicker and reclaims room
  console.log('  -> Simulating sender reconnecting and sending reclaim-room...');
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'reclaim-room',
        roomCode,
        filesMeta: [{ id: 'f-rec-1', name: 'report-2026.pdf', size: 2048, type: 'application/pdf' }]
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-created') {
        assert(msg.roomCode === roomCode, `Sender successfully reclaimed room code: ${msg.roomCode}`);
        assert(msg.filesMeta && msg.filesMeta.length === 1, 'Reclaimed room preserved files metadata');
        assert(msg.expiresAt === initialExpiresAt || msg.expiresAt > Date.now(), 'Room expiration validity preserved');
        ws.close();
        resolve();
      }
    });
  });

  // TEST 2: Receiver Re-joining Room after Network Disconnect
  console.log('\n--- Test 2: Receiver Re-joining Room after Network Disconnect ---');
  let senderWs = null;

  // Keep sender connected so receiver can join
  await new Promise((resolve) => {
    senderWs = new WebSocket(WS_URL);
    senderWs.on('open', () => {
      senderWs.send(JSON.stringify({
        type: 'reclaim-room',
        roomCode,
        filesMeta: [{ id: 'f-rec-1', name: 'report-2026.pdf', size: 2048, type: 'application/pdf' }]
      }));
    });
    senderWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-created') {
        resolve();
      }
    });
  });

  // Receiver joins room
  await new Promise((resolve) => {
    const receiverWs = new WebSocket(WS_URL);
    receiverWs.on('open', () => {
      receiverWs.send(JSON.stringify({
        type: 'join-room',
        roomCode
      }));
    });
    receiverWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-joined') {
        assert(msg.roomCode === roomCode, `Receiver joined room: ${msg.roomCode}`);
        assert(msg.senderOnline === true, 'Receiver detected sender is online');
        assert(msg.filesMeta.length === 1, 'Receiver received files metadata');
        // Simulate receiver network drop
        receiverWs.close();
        resolve();
      }
    });
  });

  // Receiver auto-reconnects after network drop
  console.log('  -> Simulating receiver reconnecting and re-joining room...');
  await new Promise((resolve) => {
    const receiverWs = new WebSocket(WS_URL);
    receiverWs.on('open', () => {
      receiverWs.send(JSON.stringify({
        type: 'join-room',
        roomCode
      }));
    });
    receiverWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-joined') {
        assert(msg.roomCode === roomCode, `Receiver successfully re-joined room: ${msg.roomCode}`);
        assert(msg.senderOnline === true, 'Receiver confirmed sender still connected');
        receiverWs.close();
        resolve();
      }
    });
  });

  // TEST 3: Temporary Sender Disconnect and Reconnection Notice
  console.log('\n--- Test 3: Temporary Sender Disconnect Notice to Receiver ---');
  let receiver2Ws = null;

  await new Promise((resolve) => {
    receiver2Ws = new WebSocket(WS_URL);
    receiver2Ws.on('open', () => {
      receiver2Ws.send(JSON.stringify({
        type: 'join-room',
        roomCode
      }));
    });
    receiver2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-joined') {
        resolve();
      }
    });
  });

  // Temporarily close senderWs to trigger graceful peer-left with isTemporary: true
  const temporaryLeftReceived = new Promise((resolve) => {
    receiver2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'peer-left') {
        assert(msg.isTemporary === true, 'Receiver received peer-left with isTemporary === true (grace period)');
        resolve();
      }
    });
    senderWs.close();
  });
  await temporaryLeftReceived;

  // Sender reconnects and reclaims room
  console.log('  -> Sender reconnects, receiver should receive sender-reconnected notice...');
  const reconnectedNoticeReceived = new Promise((resolve) => {
    receiver2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'sender-reconnected') {
        assert(msg.roomCode === roomCode, `Receiver received sender-reconnected for room ${msg.roomCode}`);
        resolve();
      }
    });

    const newSenderWs = new WebSocket(WS_URL);
    newSenderWs.on('open', () => {
      newSenderWs.send(JSON.stringify({
        type: 'reclaim-room',
        roomCode,
        filesMeta: [{ id: 'f-rec-1', name: 'report-2026.pdf', size: 2048, type: 'application/pdf' }]
      }));
    });
  });
  await reconnectedNoticeReceived;

  receiver2Ws.close();

  console.log('\n========================================');
  console.log(`Auto-Reconnect Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReconnectTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
