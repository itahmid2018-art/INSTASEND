import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

async function runTests() {
  console.log('🧪 Starting InstaSend Diagnostic & Room TTL Test Suite...\n');
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

  // TEST 1: Ping / Pong Signal Latency Echo
  console.log('--- Test 1: Signaling Server Ping-Pong Latency Echo ---');
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      const pingTime = Date.now();
      ws.send(JSON.stringify({ type: 'ping', t: pingTime }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'pong') {
        const rtt = Date.now() - msg.t;
        assert(msg.t !== undefined, 'Pong response echoes back client timestamp t');
        assert(rtt >= 0 && rtt < 100, `RTT is accurate and fast (${rtt}ms)`);
        assert(msg.serverTime !== undefined, 'Pong includes serverTime timestamp');
        ws.close();
        resolve();
      }
    });
  });

  // TEST 2: Room Creation with TTL & Expiration Timestamps
  console.log('\n--- Test 2: Room Creation with 10-Minute TTL ---');
  let createdRoomCode = '';
  let roomExpiresAt = 0;
  let roomTtlSeconds = 0;

  await new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'create-room',
        filesMeta: [{ id: 'f1', name: 'diag-test.txt', size: 1024, type: 'text/plain' }]
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-created') {
        createdRoomCode = msg.roomCode;
        roomExpiresAt = msg.expiresAt;
        roomTtlSeconds = msg.ttlSeconds;
        assert(typeof msg.roomCode === 'string' && msg.roomCode.length === 6, `Room created with 6-char code: ${msg.roomCode}`);
        assert(msg.ttlSeconds === 600, `TTL is 600 seconds (10 minutes): ${msg.ttlSeconds}s`);
        assert(msg.expiresAt > Date.now() + 590000, `expiresAt timestamp set 10 minutes into the future`);
        assert(msg.ttlRemainingSeconds >= 598 && msg.ttlRemainingSeconds <= 600, `ttlRemainingSeconds is initialized correctly: ${msg.ttlRemainingSeconds}s`);
        ws.close();
        resolve();
      }
    });
  });

  // TEST 3: Room Existence & Validity Query API (/api/room/:code)
  console.log('\n--- Test 3: HTTP Room Query API (/api/room/:code) ---');
  const queryRes = await fetch(`${BASE_URL}/api/room/${createdRoomCode}`);
  const queryData = await queryRes.json();
  assert(queryData.success === true && queryData.exists === true, 'Room query succeeds');
  assert(queryData.ttlSeconds === 600, 'API returns ttlSeconds === 600');
  assert(queryData.ttlRemainingSeconds > 590, `API returns active ttlRemainingSeconds: ${queryData.ttlRemainingSeconds}s`);
  assert(queryData.expiresAt === roomExpiresAt, 'API returns consistent expiresAt');

  // TEST 4: Receiver Joins Room & Receives Room Validity Info
  console.log('\n--- Test 4: Receiver Joins Room with Room Validity ---');
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join-room',
        roomCode: createdRoomCode
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-joined') {
        assert(msg.roomCode === createdRoomCode, 'Receiver joined correct room');
        assert(msg.ttlSeconds === 600, `Receiver received ttlSeconds = 600`);
        assert(msg.ttlRemainingSeconds > 590, `Receiver received remaining TTL: ${msg.ttlRemainingSeconds}s`);
        assert(msg.expiresAt > Date.now(), `Receiver received valid expiresAt`);
        ws.close();
        resolve();
      }
    });
  });

  // TEST 5: Non-existent or Expired Code Handling
  console.log('\n--- Test 5: Expired / Invalid Room Code Handling ---');
  const invalidRes = await fetch(`${BASE_URL}/api/room/EXPIRE`);
  const invalidData = await invalidRes.json();
  assert(invalidData.exists === false, 'Invalid/expired code returns exists: false');
  assert(invalidData.message.includes('expired'), 'Response message explains code not found or expired');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
