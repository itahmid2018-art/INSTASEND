import WebSocket from 'ws';

const WS_URL = 'ws://127.0.0.1:3000';

function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function waitMessage(ws, filterFn, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message (${timeoutMs}ms)`));
    }, timeoutMs);

    const onMsg = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!filterFn || filterFn(msg)) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          resolve(msg);
        }
      } catch (e) {}
    };

    ws.on('message', onMsg);
  });
}

async function runTests() {
  console.log('🧪 Starting InstaSend Secret Code & Temporary URL Expiry Test Suite...');
  let passed = 0;

  // Test 1: Room creation with secret passcode
  console.log('\n--- Test 1: Room Creation with Secret Passcode Protection ---');
  const senderWs = await connectWs();
  senderWs.send(JSON.stringify({
    type: 'create-room',
    files: [{ id: 'f1', name: 'secret_contract.pdf', size: 1024, type: 'application/pdf' }],
    secretCode: '7788',
    requiresSecretCode: true,
    expiresOnSenderClose: true
  }));

  const createdMsg = await waitMessage(senderWs, m => m.type === 'room-created');
  const roomCode = createdMsg.roomCode;
  console.log(`  ✅ PASS: Room created with code: ${roomCode}`);
  passed++;

  // Verify room status endpoint reflects requiresSecretCode & expiresOnSenderClose without leaking code
  const statusRes = await fetch(`http://127.0.0.1:3000/api/room/${roomCode}`).then(r => r.json());
  if (statusRes.requiresSecretCode === true && statusRes.expiresOnSenderClose === true && !statusRes.secretCode) {
    console.log('  ✅ PASS: /api/room/:code confirms requiresSecretCode and expiresOnSenderClose without leaking secretCode');
    passed++;
  } else {
    throw new Error('Failed: status API leaked secretCode or failed flags');
  }

  // Test 2: Receiver joins with NO secret code
  console.log('\n--- Test 2: Receiver Joining Without Secret Code ---');
  const receiverWs = await connectWs();
  receiverWs.send(JSON.stringify({
    type: 'join-room',
    roomCode
  }));

  const requiredMsg = await waitMessage(receiverWs, m => m.type === 'secret-code-required');
  if (requiredMsg.code === 'SECRET_CODE_REQUIRED') {
    console.log('  ✅ PASS: Server blocked join and sent secret-code-required message');
    passed++;
  } else {
    throw new Error('Failed: Server did not require secret code');
  }

  // Test 3: Receiver joins with WRONG secret code
  console.log('\n--- Test 3: Receiver Joining With Wrong Secret Code ---');
  receiverWs.send(JSON.stringify({
    type: 'join-room',
    roomCode,
    secretCode: '0000'
  }));

  const wrongCodeMsg = await waitMessage(receiverWs, m => m.type === 'secret-code-required');
  if (wrongCodeMsg.code === 'SECRET_CODE_REQUIRED') {
    console.log('  ✅ PASS: Server rejected wrong passcode and requested valid secret code');
    passed++;
  } else {
    throw new Error('Failed: Server did not reject wrong code');
  }

  // Test 4: Receiver joins with CORRECT secret code
  console.log('\n--- Test 4: Receiver Joining With Correct Secret Code ---');
  receiverWs.send(JSON.stringify({
    type: 'join-room',
    roomCode,
    secretCode: '7788'
  }));

  const joinedMsg = await waitMessage(receiverWs, m => m.type === 'room-joined');
  console.log('joinedMsg:', JSON.stringify(joinedMsg));
  const files = joinedMsg.filesMeta || joinedMsg.files || [];
  if (files.length === 1 && files[0].name === 'secret_contract.pdf') {
    console.log('  ✅ PASS: Receiver successfully joined and received files metadata with valid secret code');
    passed++;
  } else {
    throw new Error(`Failed: Receiver could not join with valid secret code. Files: ${JSON.stringify(files)}`);
  }

  // Test 5: Sender closes session -> Temporary URL immediately expires
  console.log('\n--- Test 5: Sender Closes Session -> Temporary URL Expiry ---');
  const expiredPromise = waitMessage(receiverWs, m => m.type === 'session-expired');
  senderWs.send(JSON.stringify({
    type: 'stop-transfer',
    roomCode
  }));

  const expiredMsg = await expiredPromise;
  if (expiredMsg.sessionExpired === true) {
    console.log(`  ✅ PASS: Receiver received session-expired notice: "${expiredMsg.message}"`);
    passed++;
  } else {
    throw new Error('Failed: Receiver did not receive session-expired');
  }

  // Verify room is immediately deleted from server
  const afterCloseRes = await fetch(`http://127.0.0.1:3000/api/room/${roomCode}`).then(r => r.json());
  if (afterCloseRes.exists === false) {
    console.log('  ✅ PASS: Room and temporary URL immediately deleted and destroyed upon sender session close');
    passed++;
  } else {
    throw new Error('Failed: Room still existed after stop-transfer');
  }

  senderWs.close();
  receiverWs.close();

  console.log('\n========================================');
  console.log(`Secret Code & Expiry Test Results: ${passed} Passed, 0 Failed`);
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
