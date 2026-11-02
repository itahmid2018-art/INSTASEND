# InstaSend File Transfer Workflow

This document details the functional workflow of the InstaSend P2P file transfer process and identifies critical failure points and performance bottlenecks.

## 1. Functional Workflow

### Sender Flow
1. **Room Initiation:** The sender opens the application. The client requests a new 6-character room code from the signaling server.
2. **File Selection:** The sender selects files to share. Files are staged for transfer (local metadata is indexed).
3. **Connection Sharing:** The sender displays the generated room code or a QR code.
4. **Signaling:** The sender establishes a WebSocket connection with the signaling server to await peer connection.
5. **Transfer/Fallback:**
   - **WebRTC P2P:** A WebRTC connection is negotiated with the receiver. Data is streamed directly between peers.
   - **Direct LAN Fallback:** If WebRTC is blocked (e.g., symmetric NAT), the sender initiates a local HTTP fallback server to allow direct transfer over the local network.

### Receiver Flow
1. **Room Access:** The receiver navigates to the application and enters the 6-character code or scans the QR code.
2. **Handshake:** The receiver connects to the signaling server using the room code to locate the sender's signaling session.
3. **Connection:** The receiver initiates a WebRTC peer connection request to the sender.
4. **File Receipt:** Files are received, reconstructed from chunks, and processed for local download.

---

## 2. Key Features
- **WebRTC Data Channels:** Enables direct, end-to-end encrypted transfer without relaying data through the server.
- **Direct LAN Fallback:** Provides a robust backup for restrictive network environments.
- **Session Persistence:** Room codes remain active for a specified TTL (Time-To-Live) as long as the sender’s signaling session is active.
- **Auto-Reconnect:** Signaling layer attempts to restore WebRTC connectivity if a temporary network flicker occurs.

---

## 3. Hiccups, Bottlenecks, and Failure Points

### A. Network & Connectivity (The "NAT Traversal" Problem)
- **Bottleneck:** Symmetric NATs often block WebRTC peer-to-peer connections.
- **Hiccup:** If STUN/TURN servers are not optimally configured or reachable, WebRTC will fail to establish a direct path.
- **Failure:** Complete connection failure forcing the reliance on the LAN fallback. If both peers are on different subnets and WebRTC fails, the transfer cannot proceed.

### B. Signaling Server Stability
- **Bottleneck:** Signaling server capacity during high-concurrency room creation.
- **Hiccup:** Latency in code lookup or room metadata synchronization.
- **Failure:** If the WebSocket signaling connection is dropped and the auto-reconnect logic fails, the session is orphaned.

### C. Resource Constraints (Browser/Device)
- **Bottleneck:** Browser memory limits (RAM) when handling extremely large files or thousands of small files.
- **Hiccup:** Large file encoding/decoding overhead causing temporary UI freezes during chunk processing.
- **Failure:** Browser process termination (crash) due to memory exhaustion when loading large files into the `File` API.

### D. Network Stability
- **Bottleneck:** Fluctuating bandwidth leading to stalled WebRTC streams.
- **Hiccup:** Temporary signaling disconnection; although the app attempts auto-reconnect, a total loss of network during a transfer will break the stream.
- **Failure:** Total transfer abortion if the network is lost for a duration exceeding the auto-reconnect and grace period.

### E. User Experience Issues
- **Hiccup:** Receiver closing the browser window or navigating away during an active transfer.
- **Bottleneck:** The "first byte" latency, where users feel the app is unresponsive while WebRTC ICE gathering is underway.
- **Failure:** Missing or misconfigured browser permissions (e.g., blocking local network discovery).
