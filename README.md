# InstaSend ⚡
### Secure, Browser-to-Browser Peer-to-Peer File Transfer via WebRTC

InstaSend is a modern, privacy-first web application for transferring files, folders, and encrypted text snippets directly between devices using **WebRTC DataChannels**. There are no intermediate cloud storage buckets, no file size caps, and zero tracking.

---

## 🚀 Key Features

* **True Peer-to-Peer (P2P)**: Data streams directly from the sender's browser memory to the receiver's browser memory via encrypted WebRTC DataChannels.
* **Visual Sending Queue & Drag-and-Drop Staging**: Drag and drop individual files and folders into an interactive preview queue before initiating transfer. Includes image thumbnails, hover zoom, full-screen lightbox preview modals, pre-flight DTLS 1.2 readiness indicators, queue clearing, and single-item removal.
* **Zero Cloud Storage**: Files never touch any backend server, third-party database, or storage bucket.
* **HexaSend-Style 6-Character Codes**: Sender generates a friendly 6-character session code (e.g. `WORK88`, `HEX729`); receiver types it into 6 discrete input blocks to connect instantly.
* **Instant QR Code Sharing**: Built-in QR code generation allows seamless desktop-to-mobile or mobile-to-desktop handoffs with phone cameras.
* **Direct Clickable Links**: One-click share URLs (`https://<app-url>/?code=XYZ123`) that automatically populate the receiver's session and initiate handshake.
* **Audio Notification Feedback**: Subtle 'ping' sound on transfer commencement, 4-note victory chime on completion, and alert tone on transfer errors.
* **Live Speed Meters**:
  * **Sender's System**: Live real-time **Upload Speed** (exponentially smoothed MB/s / KB/s), elapsed time, chunk packets sent, and ETA countdown.
  * **Receiver's System**: Live real-time **Download Speed**, incoming byte counter, and interactive progress bars.
* **Multi-File & Folder Support**: Drag and drop single files, select dozens of files at once, or upload entire directories.
* **On-the-Fly Text Compression (pako Deflate)**: Dedicated toggle in the SendTab to automatically compress text-based files (`.txt`, `.json`, `.md`, `.csv`, `.log`, etc.) using `pako` Deflate before streaming over WebRTC, slashing wire transfer size by up to 80% with transparent in-memory decompression on the receiving peer.
* **In-Browser Previews**:
  * Image lightbox preview (PNG, JPG, SVG, WebP, GIF)
  * Text / Markdown / Code snippet reader with one-click clipboard copy
  * Audio player for sound files
* **Batch ZIP Download**: Receiver can download files individually or bundle all received files into a single `.zip` archive via client-side JSZip.
* **Bit-for-Bit SHA-256 Verification**: Both sender and receiver calculate cryptographic hashes using the Web Crypto API to ensure 100% data integrity with zero corruption.
* **Local Network Radar**: Automatically discovers other active devices on the same local network or signaling mesh for one-tap direct sharing without typing codes.
* **Built-in Peer Chat**: Encrypted instant messaging and clipboard sync between connected peers.
* **File Manager ("Files" Tab)**: Keep track of staged, uploaded, and received files, view storage footprints, re-share active sessions, and search by filename or file type.
* **Secure SQLite User Authentication**: Built-in SQLite database engine running on the server (`node:sqlite`) with `scrypt` password hashing and cryptographic salts. Supports user sign-up, sign-in, persistent session tokens, and cumulative transfer stat tracking. Quick one-click demo login (`Alex Rivera`) is pre-seeded. Basic transfers remain 100% anonymous without requiring an account.

---

## 🏗️ Architecture & Technology Stack

```
   ┌────────────────────────────────────────────────────────┐
   │                    Signaling Server                    │
   │               (Express + ws WebSocket)                │
   │      Relays Session Codes, SDP Offers & ICE Candidates │
   └──────────────▲──────────────────────────▲──────────────┘
                  │                          │
        1. Signal Handshake        1. Signal Handshake
                  │                          │
┌─────────────────┴───────┐        ┌─────────┴──────────────┐
│      Sender Device      │        │    Receiver Device     │
│   (Browser A / Client)  │◄──────►│  (Browser B / Client)  │
└─────────────────────────┘        └────────────────────────┘
          ▲                                    ▲
          └──────── WebRTC DataChannel ────────┘
               (DTLS 1.2 / SCTP Binary Stream)
                  * Zero Server Storage *
```

* **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Lucide Icons, Canvas Confetti.
* **Signaling Backend**: Node.js, Express, WebSocket (`ws`), TSX.
* **Transport**: WebRTC `RTCDataChannel` (SCTP over DTLS over UDP) with public STUN fallbacks (`stun.l.google.com:19302`, `stun.cloudflare.com:3478`).
* **Chunking Engine**: 64 KB chunk size with backpressure queue control (`bufferedAmountLowThreshold` at 256 KB) to prevent browser buffer overflow during high-speed multi-gigabyte transfers.

---

## 💻 Local Setup & Quick Start

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### 2. Installation
Clone the repository and install all required dependencies:

```bash
# Clone the repository
git clone https://github.com/your-username/instasend.git
cd instasend

# Install dependencies
npm install
```

### 3. Start Development Server
Run the unified full-stack server (serves the Express API, WebSocket signaling server, and Vite dev server):

```bash
npm run dev
```

The application will start on **http://localhost:3000** (or `http://0.0.0.0:3000`).

### 4. Build for Production
To bundle the frontend with Vite and transpile the backend server with esbuild:

```bash
# Run production build
npm run build

# Start production server
npm run start
```

---

## 🧪 Testing Guide

### 1. Testing as a Server

The backend (`server.ts`) handles HTTP requests, static assets, and WebSocket signaling for WebRTC peer coordination.

* **Health Check API**:
  Verify the server is running and inspect active peer and room counts:
  ```bash
  curl http://localhost:3000/api/health
  ```
  Expected response:
  ```json
  {
    "status": "ok",
    "activePeers": 0,
    "activeRooms": 0,
    "timestamp": "2026-10-25T09:49:25.096Z"
  }
  ```

* **WebSocket Signaling**:
  The WebSocket server binds directly to the HTTP server on `ws://localhost:3000`. You can test connection and message routing using `wscat` or your browser's DevTools:
  ```bash
  npx wscat -c ws://localhost:3000
  ```
  Upon connection, the server sends:
  ```json
  {"type":"connected","peerId":"3a8f9c1b"}
  ```

---

### 2. Testing as a Client (Browser Support)

InstaSend is tested and supported across modern WebRTC-compliant browsers:
* **Desktop**: Google Chrome, Mozilla Firefox, Microsoft Edge, Apple Safari, Brave, Opera.
* **Mobile / Tablet**: Safari on iOS/iPadOS 14+, Chrome on Android, Firefox Mobile.
* **Camera Scanning**: Requires HTTPS or `localhost` to allow camera permissions for QR scanning.

---

### 3. Testing as a Sender

1. Open `http://localhost:3000` in your browser.
2. Ensure the **"Send Files"** tab is active.
3. Select files using one of the following methods:
   * **Drag and Drop**: Drag one or multiple files into the dashed upload area.
   * **File Browser**: Click **"Select Multiple Files"** to pick multiple files.
   * **Folder Upload**: Click **"Upload Folder"** to stage an entire directory.
   * **Encrypted Note**: Switch to the **"Encrypted Note / Link"** toggle to paste text or secrets.
4. (Optional) Click **"Transfer Preferences"** to set custom expiration (1h, 24h, 7d) or toggle self-destruct after download.
5. Click **"Generate Transfer Code & Share Link"**:
   * A 6-character code (e.g. `WORK88`) will appear in large font.
   * A dynamic QR code will be generated for mobile recipients.
   * A direct share link (`http://localhost:3000/?code=WORK88`) is ready to copy.
6. When the receiver connects:
   * The status changes to **"Connected to [Receiver Name]"**.
   * Click **"Start Transfer Now"** (or auto-starts).
   * Observe the **Live Upload Speed** indicator (e.g. `18.5 MB/s`), chunk packet counter, and animated progress bar.
   * Send test messages in the direct peer chat drawer.

---

### 4. Testing as a Receiver

1. Open `http://localhost:3000` in a second browser window (or open the direct link with `?code=WORK88`).
2. Switch to the **"Receive Files"** tab.
3. Enter the 6-character code into the discrete boxes:
   * Typing letters or numbers automatically jumps to the next box.
   * Pasting the code (or the full share URL) into any box automatically fills all 6 boxes.
4. Click **"Connect & Receive"** (or auto-connects upon entering the 6th character).
5. Watch the **Live Download Speed** meter (e.g. `18.5 MB/s`) and the per-file incoming progress bars.
6. Once transfer completes:
   * Enjoy the completion chime sound and confetti!
   * Verify the **SHA-256 Verified** badge with the cryptographic checksum.
   * Click **"Preview"** on images or text files to view them in-browser without saving to disk first.
   * Click **"Download"** to save an individual file, or **"Download All as ZIP"** to download all received files packaged together.

---

### 5. Two-Window / Multi-Device Testing Walkthrough

To test the complete end-to-end peer-to-peer flow on a single machine:

1. **Window 1 (Sender)**:
   * Open regular Chrome at `http://localhost:3000`.
   * Drag a sample image or a 10MB test file into the Send box.
   * Click **"Generate Transfer Code & Share Link"**.
   * Note the 6-character code displayed (e.g. `A7B9C2`).

2. **Window 2 (Receiver)**:
   * Open an **Incognito / Private window** (or a different browser such as Firefox) at `http://localhost:3000`.
   * Click the **"Receive Files"** tab.
   * Enter the code `A7B9C2`.

3. **Verify Connection & Transfer**:
   * Both windows immediately notify that peers have connected.
   * Click **"Start Transfer Now"** in Window 1.
   * Observe **Upload Speed** updating in Window 1 and **Download Speed** updating in Window 2.
   * Both windows show progress in real-time.
   * Upon completion, Window 2 shows the preview and download buttons.
   * Open the **"Files"** tab in either window to verify that files are tracked in the File Manager with speed meters.

---

## 🔒 Security Scenarios & Threat Model

### 1. Zero Cloud Storage & Zero Data Residue
* **Traditional Cloud Sharing** (e.g. WeTransfer, Dropbox, Google Drive): Files are uploaded to third-party servers, stored unencrypted or with server-side keys on Amazon S3 or Google Cloud Storage, and remain there until deleted.
* **InstaSend Model**: Binary file data **never touches any server**. The server only relays lightweight SDP (Session Description Protocol) offers, answers, and ICE candidate network routing metadata. As soon as the WebRTC DataChannel opens, file packets stream directly browser-to-browser. If the sender closes their tab before the transfer finishes, no data remains anywhere in the cloud.

### 2. End-to-End Encryption via DTLS 1.2 / SCTP
* All WebRTC DataChannels are cryptographically encrypted by specification using **DTLS 1.2** (Datagram Transport Layer Security) with **AES-128-GCM** or **AES-256-GCM** cipher suites.
* Even if an attacker monitors or intercepts WebSocket signaling traffic, they cannot decrypt the file payload because DTLS encryption keys are negotiated directly between the two peer browsers using ephemeral Diffie-Hellman key exchanges.

### 3. Bit-for-Bit SHA-256 Cryptographic Integrity Check
* File corruption over networks or dropped packets is an inherent risk. InstaSend computes a **SHA-256 cryptographic digest** using the native Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) on both the sender's file and the assembled receiver's Blob.
* If a single byte is missing, tampered with, or corrupted, the SHA-256 hash will not match, alerting both peers immediately.

### 4. Ephemeral Session Lifecycles & Self-Destruction
* Session codes are randomly generated from an unambiguous alphanumeric character set (`A-Z, 2-9`, omitting `0, O, 1, I` to prevent transcription errors).
* Senders can configure:
  * **Self-Destruct**: Automatically closes the session and invalidates the room code after a single recipient completes the download.
  * **Auto-Expiration**: Rooms automatically expire after 1 hour, 24 hours, or 7 days.
  * **Immediate Clean-Up**: When the sender disconnects, the signaling server purges the room code from memory.

### 5. NAT Traversal & Network Topologies
* **Local Wi-Fi / LAN**: If both devices are on the same Wi-Fi network, WebRTC resolves local IP addresses and transfers data at **local line-rate speeds** (100MB/s+ on modern 5GHz Wi-Fi / Wi-Fi 6), bypassing your ISP and external internet bottlenecks.
* **WAN / Cross-Network**: When devices are on different networks, public STUN servers resolve external IP/port mappings (ICE candidates) to negotiate a direct peer connection.
* **Corporate / Symmetric NAT**: If symmetric NATs block direct UDP connections, InstaSend includes fallback WebSocket relay chunking so transfers succeed reliably without breaking.

---

## 🛠️ Project Structure

```
instasend/
├── index.html                   # HTML entry point with modern typography & meta
├── server.ts                    # Express + WebSocket signaling server (port 3000)
├── server/
│   └── db.ts                    # Embedded SQLite database (node:sqlite) + scrypt hashing
├── data/
│   └── instasend.db             # Local SQLite database file (WAL mode)
├── vite.config.ts               # Vite configuration with Tailwind CSS & aliases
├── tsconfig.json                # TypeScript compiler configuration
├── package.json                 # Scripts and dependencies
└── src/
    ├── main.tsx                 # React entry point
    ├── App.tsx                  # Main controller, navigation & state hub
    ├── index.css                # Global Tailwind styles & Google-themed aesthetics
    ├── types.ts                 # TypeScript interfaces for files, peers & metrics
    ├── services/
    │   ├── webrtc.ts            # WebRTC connection, 64KB chunking & backpressure
    │   ├── compression.ts       # pako Deflate/Inflate engine for text-based files
    │   ├── device.ts            # Device detection, byte formatters & SHA-256
    │   ├── folderDrop.ts        # Recursive directory drag-and-drop parsing
    │   └── sound.ts             # Web Audio API procedural sound synthesizer
    └── components/
        ├── Header.tsx           # Brand header, radar status & auth trigger
        ├── SendTab.tsx          # Multi-file upload, text compression checkbox & upload speed
        ├── ReceiveTab.tsx       # 6-box code input, camera scanner & download speed
        ├── FileManager.tsx      # Uploaded files dashboard & live speed gauges
        ├── AuthModal.tsx        # Sign-in, sign-up, demo account & SQLite status
        ├── QRCodeModal.tsx      # High-res session QR generator & camera scanner
        ├── RadarModal.tsx       # Local network device discovery radar
        ├── HistoryModal.tsx     # Transfer log with SHA-256 hashes
        └── SecurityModal.tsx    # Interactive security architecture breakdown
```

---

## 📚 Technical Documentation & Guides

Comprehensive technical guides are available in the [`/docs`](./docs) directory:

- 🛡️ **[Security Architecture, Testing & Verification Guide (docs/SecurityTestingAndVerification.md)](./docs/SecurityTestingAndVerification.md)**: Zero-cloud storage model, WebRTC DTLS 1.2 encryption, bit-for-bit SHA-256 hash verification, scrypt password hashing, CSP/XSS testing, Play Store security compliance, and step-by-step security audit test cases.
- 🧪 **[Complete Features & QA Verification Guide (docs/FeaturesAndQAVerification.md)](./docs/FeaturesAndQAVerification.md)**: Product feature matrix, build instructions, step-by-step QA test case suite (TC-01 to TC-08), and release verification checklist.
- 📖 **[Server & Database Setup Guide (docs/ServerSetup.md)](./docs/ServerSetup.md)**: Runtime dependencies, SQLite database initialization, `/admin` portal configuration (`admin` / `1@3$5^7*9`), pre-seeded test accounts (`admin_and_test_users.sql`), active peer telemetry, and production systemd/Nginx deployment.
- 📱 **[Android Mobile & TV Build Guide (docs/AndroidBuildGuide.md)](./docs/AndroidBuildGuide.md)**: Step-by-step guidelines to compile, build, sign, and test native Android APKs for mobile phones, tablets, and Android TV / Google TV devices, including 100% offline serverless Wi-Fi mode.

---

## 📄 License
This project is licensed under the Apache 2.0 License.

