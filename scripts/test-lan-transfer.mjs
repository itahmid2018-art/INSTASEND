import { WebSocket } from 'ws';
import crypto from 'crypto';

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

async function runTests() {
  console.log('=== Starting LAN & Code Resolution Tests ===\n');

  // Test 1: Network info API
  console.log('Test 1: Querying /api/network-info...');
  const netRes = await fetch(`${SERVER_URL}/api/network-info`);
  const netData = await netRes.json();
  console.log('  -> Success:', netData.success);
  console.log('  -> Detected LAN IP:', netData.lanIp);
  console.log('  -> Available Addresses:', netData.addresses);
  if (!netData.lanIp) throw new Error('Failed to resolve LAN IP');

  // Test 2: Sender creates a 6-digit code via WebSocket
  console.log('\nTest 2: Sender WebSocket connecting and creating room...');
  const senderWs = new WebSocket(WS_URL);
  
  const roomCode = await new Promise((resolve, reject) => {
    senderWs.on('open', () => {
      console.log('  -> Sender WS connected');
      senderWs.send(JSON.stringify({
        type: 'create-room',
        customCode: 'TST999',
        filesMeta: [
          { id: 'f-1', name: 'lan-document.pdf', size: 1048576, type: 'application/pdf' },
          { id: 'f-2', name: 'photo-holiday.jpg', size: 204800, type: 'image/jpeg' }
        ]
      }));
    });

    senderWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'room-created') {
        console.log('  -> Room created successfully! Code:', msg.roomCode);
        resolve(msg.roomCode);
      }
    });

    senderWs.on('error', reject);
    setTimeout(() => reject(new Error('Timeout waiting for room-created')), 5000);
  });

  // Test 3: Check /api/room/:code HTTP endpoint (used by QR scanner / code entry)
  console.log(`\nTest 3: Checking /api/room/${roomCode} HTTP status endpoint...`);
  const roomRes = await fetch(`${SERVER_URL}/api/room/${roomCode}`);
  const roomData = await roomRes.json();
  console.log('  -> Exists:', roomData.exists);
  console.log('  -> Sender online:', roomData.senderOnline);
  console.log('  -> Files meta count:', roomData.filesMeta?.length);
  if (!roomData.exists || !roomData.senderOnline || roomData.filesMeta?.length !== 2) {
    throw new Error('Room status verification failed');
  }

  // Test 4: Receiver connects with the 6-digit code
  console.log('\nTest 4: Receiver connecting via WebSocket and joining room...');
  const receiverWs = new WebSocket(WS_URL);

  const receiverJoined = await new Promise((resolve, reject) => {
    receiverWs.on('open', () => {
      console.log('  -> Receiver WS connected');
      receiverWs.send(JSON.stringify({
        type: 'join-room',
        roomCode: roomCode
      }));
    });

    receiverWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'room-joined') {
        console.log('  -> Receiver successfully joined room:', msg.roomCode);
        console.log('  -> Files received by receiver:', msg.filesMeta?.map(f => f.name));
        resolve(true);
      } else if (msg.type === 'error') {
        reject(new Error(`Receiver error: ${msg.message}`));
      }
    });

    receiverWs.on('error', reject);
    setTimeout(() => reject(new Error('Timeout waiting for room-joined')), 5000);
  });

  if (!receiverJoined) throw new Error('Receiver could not join room');

  // Test 5: Sender disconnect grace period test
  console.log('\nTest 5: Testing sender temporary disconnect grace period...');
  senderWs.close(); // Simulates sender screen lock / brief Wi-Fi disconnect
  await new Promise(r => setTimeout(r, 600));

  console.log('  -> Querying room status while sender is disconnected...');
  const roomWhileDisconn = await fetch(`${SERVER_URL}/api/room/${roomCode}`).then(r => r.json());
  console.log('  -> Room still exists in grace period:', roomWhileDisconn.exists);
  console.log('  -> Sender online status correctly flagged:', roomWhileDisconn.senderOnline);
  if (!roomWhileDisconn.exists) {
    throw new Error('Room was prematurely deleted during disconnect grace period!');
  }

  // Test 6: Fallback direct LAN file upload and download
  console.log('\nTest 6: Testing Direct LAN HTTP file transfer fallback...');
  const testPayload = Buffer.from('INSTASEND_LAN_HIGH_SPEED_CHUNK_DATA_TEST_VERIFIED_123456');
  const base64Data = testPayload.toString('base64');
  const testSha256 = crypto.createHash('sha256').update(testPayload).digest('hex');

  console.log('  -> Uploading file payload to /api/transfer/:code/upload...');
  const uploadRes = await fetch(`${SERVER_URL}/api/transfer/${roomCode}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'f-lan-test',
      name: 'network-test.dat',
      size: testPayload.length,
      type: 'application/octet-stream',
      base64Data,
      sha256: testSha256
    })
  });
  const uploadResult = await uploadRes.json();
  console.log('  -> Upload response success:', uploadResult.success);

  console.log('  -> Querying files list on LAN...');
  const filesList = await fetch(`${SERVER_URL}/api/transfer/${roomCode}/files`).then(r => r.json());
  console.log('  -> Files available on LAN:', filesList.files?.map(f => f.name));

  console.log('  -> Downloading file via /api/transfer/:code/download/f-lan-test...');
  const downloadRes = await fetch(`${SERVER_URL}/api/transfer/${roomCode}/download/f-lan-test`);
  const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
  const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuf).digest('hex');

  console.log('  -> Downloaded byte length:', downloadedBuf.length);
  console.log('  -> SHA-256 match:', downloadedSha256 === testSha256);
  if (downloadedSha256 !== testSha256) {
    throw new Error('Downloaded file payload checksum mismatch');
  }

  // Cleanup
  receiverWs.close();
  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
