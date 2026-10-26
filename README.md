# InstaSend ⚡
### Secure, Browser-to-Browser Peer-to-Peer File Transfer via WebRTC

InstaSend is a modern, privacy-first web application for transferring files, folders, and encrypted text snippets directly between devices using **WebRTC DataChannels**. There are no intermediate cloud storage buckets, no file size caps, and zero telemetry.

---

## 🚀 Key Features & Enhancements

* **True Peer-to-Peer (P2P) Streaming**: Data streams directly from the sender's browser memory to the receiver's browser memory via encrypted WebRTC DataChannels.
* **Interactive Sending Queue**: Drag and drop individual files and folders into an interactive preview queue before initiating transfer. Includes image thumbnails, hover zoom, full-screen lightbox previews, pre-flight DTLS 1.2 readiness indicators, queue clearing, and single-item removal.
* **Zero Cloud Storage Guarantee**: Files never touch any backend server, third-party database, or cloud storage bucket.
* **HexaSend-Style 6-Character Codes**: Sender generates a friendly 6-character session code (e.g. `WORK88`, `HEX729`); receiver types it into 6 discrete input blocks to connect instantly.
* **QR Code Generator & Instant Mobile Connect**: Generates a high-contrast QR code encoding the session deep link. Scanning with a mobile camera automatically opens the receiver view and connects without manual typing.
* **Multi-Channel Social Sharing**: One-click sharing via **WhatsApp**, **Telegram**, system **Web Share API** (AirDrop, email, messaging), or direct copyable link (`https://<app-url>/?code=XYZ123`).
* **Audio Notification Feedback**: Subtle 'ping' sound on transfer commencement, 4-note victory chime on completion, and alert tones on errors.
* **Live Speed Meters & Charts**:
  * **Sender's System**: Live real-time **Upload Speed** (exponentially smoothed MB/s / KB/s), elapsed time, chunk packets sent, and ETA countdown.
  * **Receiver's System**: Live real-time **Download Speed**, incoming byte counter, and interactive progress bars.
* **Multi-File & Folder Support**: Drag and drop single files, select dozens of files at once, or upload entire directories recursively.
* **On-the-Fly Text Compression (pako Deflate)**: Automatically compresses text-based files (`.txt`, `.json`, `.md`, `.csv`, `.log`, etc.) using `pako` Deflate before streaming over WebRTC, slashing wire transfer size by up to 80% with transparent in-memory decompression on the receiving peer.
* **In-Browser Previews**: Image lightbox (PNG, JPG, SVG, WebP), Markdown/Code snippet reader with clipboard copy, and audio playback.
* **Batch ZIP Download**: Receiver can download files individually or bundle all received files into a single `.zip` archive via client-side JSZip.
* **Bit-for-Bit SHA-256 Verification**: Both sender and receiver calculate cryptographic hashes using the Web Crypto API to ensure 100% data integrity with zero corruption.
* **Local Network Radar**: Automatically discovers other active devices on the same local network or signaling mesh for one-tap direct sharing without typing codes.
* **Built-In Peer Chat**: Encrypted instant messaging and clipboard sync between connected peers.
* **File Manager ("Files" Tab)**: Keep track of staged, uploaded, and received files, view storage footprints, re-share active sessions, and search by filename or file type.
* **Secure SQLite User Authentication**: Built-in SQLite database engine running on the server (`node:sqlite`) with `scrypt` password hashing and cryptographic salts. Supports user sign-up, sign-in, persistent session tokens, and cumulative transfer stat tracking. Basic transfers remain 100% anonymous without requiring an account.
* **Serverless Local Wi-Fi / Hotspot Mode**: 100% offline direct transfer support for local networks without internet connectivity.

---

## 🌟 How InstaSend is Unique & Secure

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

---

## 🛡️ Privacy and Guarantee (GDPR Compliance Statement)

InstaSend is built from the ground up to strictly comply with the **General Data Protection Regulation (GDPR)** and international data privacy standards:

1. **Data Minimization (Article 5.1.c)**: InstaSend collects zero personal data for anonymous file transfers. Account creation is strictly optional and collects only an email address and hashed password (`scrypt`) solely for authenticated statistics tracking.
2. **Privacy by Design & Default (Article 25)**: Because file transfers occur directly peer-to-peer (RAM-to-RAM) over encrypted WebRTC DataChannels, **no personal data, file payloads, or metadata ever pass through or reside on server disk storage**.
3. **Right to Erasure / "Right to be Forgotten" (Article 17)**: Users maintaining optional accounts can delete their account and associated historical statistics at any time. All local session data, history logs, and file caches stored in the client browser's `localStorage` or `IndexedDB` can be instantly wiped by clearing browser site data or clicking "Clear History".
4. **Encryption & Security of Processing (Article 32)**: All network communications are protected by TLS for signaling and DTLS 1.2 / AES-GCM for peer-to-peer data streams, ensuring complete confidentiality and integrity.
5. **No Third-Party Trackers**: InstaSend includes zero third-party advertising cookies, zero analytics trackers, and zero external telemetry scripts.

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

## 📄 License

This application is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.
