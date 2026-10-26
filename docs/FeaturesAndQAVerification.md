# InstaSend Complete Features & QA Verification Guide

This document provides a comprehensive specification of all product features, user flows, build processes, and QA testing suites for **InstaSend**.

---

## 1. Product Feature Overview & Architecture Matrix

InstaSend is a modern high-speed WebRTC peer-to-peer file transfer suite supporting Web, Mobile (Android APK), and Android TV / Google TV.

| Feature Module | Key Functionality | Primary Components / Files |
| :--- | :--- | :--- |
| **Peer-to-Peer File Transfer** | Direct RAM-to-RAM streaming via WebRTC DataChannels. Zero cloud file storage. | `src/services/webrtc.ts`, `SendTab.tsx`, `ReceiveTab.tsx` |
| **Visual Sending Queue & Drop Zone** | Interactive visual staging engine with multi-file drag-and-drop, image thumbnail previews, lightbox inspector, category breakdown, queue clearing, and DTLS pre-flight diagnostic indicators before transfer initiation. | `SendTab.tsx`, `src/types.ts` |
| **6-Box Session Codes** | Friendly 6-character transfer codes with auto-focus, paste auto-fill, and QR code generation. | `SendTab.tsx`, `ReceiveTab.tsx`, `QRCodeModal.tsx` |
| **Folder & Directory Import** | Drag and drop multi-file directories with recursive directory structure preservation. | `src/services/folderDrop.ts`, `SendTab.tsx` |
| **On-the-Fly Text Compression** | Automatic pako Deflate compression for text-based files (`.txt`, `.json`, `.md`), slashing transfer times. | `src/services/compression.ts`, `SendTab.tsx` |
| **Recharts Live Speed Visualizer** | Live Mbps speedometers and Recharts line charts for upload/download throughput. | `SpeedChart.tsx`, `SpeedGauge.tsx` |
| **Cryptographic Hash Verification** | SHA-256 Web Crypto API integrity checking on every transferred file payload. | `src/services/device.ts`, `ReceiveTab.tsx` |
| **Audio Notification Feedback** | Web Audio API sound synthesis providing subtle 'ping' chime on transfer start, 4-note victory chime on completion, and warning tone on errors. | `src/services/sound.ts`, `SendTab.tsx`, `ReceiveTab.tsx` |
| **PWA Splash Screen & Native TV Shell** | Animated paper-plane splash sequence for installable PWA and Android TV Leanback launcher with D-Pad accessibility. | `SplashScreen.tsx`, `capacitor.config.json` |
| **Serverless Local Wi-Fi Mode** | 100% offline WebRTC offer/answer handshake via QR Code / text string for local Wi-Fi & Hotspots. | `OfflineDirectModal.tsx`, `src/services/webrtc.ts` |
| **Local Radar Peer Discovery** | Automatic discovery of active local network peers on signaling mesh. | `RadarModal.tsx`, `server.ts` |
| **File Manager & Storage Hub** | Staged, uploaded, and received file dashboard with storage usage counters and direct re-sharing. | `FileManager.tsx` |
| **History Log** | Comprehensive transfer history with SHA-256 checksums and timing metrics. | `HistoryModal.tsx` |
| **SQLite Account Authentication** | Full user auth with scrypt password hashing, session tokens, and cumulative transfer statistics. | `server/db.ts`, `AuthModal.tsx` |
| **Admin Portal (`/admin`)** | Real-time system telemetry, active LAN peer radar tracking, user account management, and SQL seed viewer. | `AdminPortal.tsx`, `server.ts` |

---

## 2. Complete Build & Deployment Guidelines

### 2.1 Web Development Server
```bash
# Install dependencies
npm install

# Start full-stack development server (Express + Vite + WebSocket on port 3000)
npm run dev
```

### 2.2 Web Production Build
```bash
# Compile frontend with Vite & backend with esbuild
npm run build

# Start production server
npm run start
```

### 2.3 Android Mobile & Android TV Native Build
```bash
# Compile web bundle and sync Capacitor Android project
npm run build:android

# Build Debug APK via Gradle
cd android && ./gradlew assembleDebug

# Output APK path: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. Comprehensive QA Test Case Suite

### Test Suite 1: Core File Transfer & WebRTC Connection

#### Test Case TC-01: Single & Multi-File Drag-and-Drop into Visual Queued Files List
- **Preconditions**: Two browser windows open at `http://localhost:3000`.
- **Execution Steps**:
  1. Window 1 (Sender): Drag and drop multiple individual files (or click "Browse Files") into the drop zone.
  2. Verify the **Queued Files Preview Board** displays:
     - Active pulsing green queue status indicator.
     - Total items count badge and aggregated byte size.
     - Thumbnail previews for image files and formatted icons for documents.
     - Sequential item indexing (`#1`, `#2`, etc.).
     - Interactive **"Remove"** button on each queued file to remove individual files before triggering WebRTC.
     - DTLS 1.2 pre-flight diagnostics and estimated local Wi-Fi transmission time.
  3. Click the thumbnail or "Eye" preview icon on an image file to trigger the full-screen Lightbox modal. Confirm filename, dimensions, and clear view. Click "Done" or backdrop to close.
  4. Click individual "Remove" buttons to remove a file from queue or drag more files into the compact append drop banner.
  5. Click **"Initiate WebRTC Transfer"**. Note the 6-character code (e.g., `TEST01`).
  6. Window 2 (Receiver): Switch to **Receive** tab and enter `TEST01`.
  7. Click **"Connect & Receive"**.
- **Expected Result**:
  - Audible 'ping' sound notification plays on transfer start.
  - Connection status changes to **"Connected"**.
  - Live upload speed chart updates in Window 1 (Google Blue theme).
  - Live download speed chart updates in Window 2 (Google Green theme).
  - File transfers with 100% progress, victory audio chime plays, and green **SHA-256 Verified** badge displays.

---

#### Test Case TC-02: Folder & Directory Upload into Sending Queue
- **Preconditions**: Sender has a local folder with subdirectories and multi-extension files.
- **Execution Steps**:
  1. Window 1 (Sender): Drag and drop the folder into the Send upload area (or click **"Upload Folder"**).
  2. Verify folder scanning notice: `📁 Folder imported: X directories (Y files)`.
  3. Verify relative file paths are accurately tagged with folder icons inside the Sending Queue cards.
  4. Generate transfer code and receive on Window 2.
- **Expected Result**:
  - Relative file paths are preserved across all queued items.
  - Receiver can click **"Download All as ZIP"** to download the entire directory structure intact.

---

#### Test Case TC-03: On-the-Fly Text Deflate Compression (pako)
- **Preconditions**: A large text file (e.g., 2MB `.json` or `.txt` log file).
- **Execution Steps**:
  1. Window 1 (Sender): Ensure **"Compress text files before sending"** checkbox is enabled.
  2. Stage the 2MB `.txt` file. Notice the `Text • pako ready` badge.
  3. Transfer to Receiver.
- **Expected Result**:
  - Wire transfer payload size is reduced by up to 80%.
  - Receiver displays `pako Decompressed (-X%)` badge.
  - File content is 100% identical upon download or preview.

---

### Test Suite 2: Serverless Offline & Mobile Verification

#### Test Case TC-04: Serverless Local Wi-Fi Mode (100% Offline)
- **Preconditions**: Server turned off or devices connected to a local Wi-Fi Hotspot without internet.
- **Execution Steps**:
  1. Sender: Click **"Serverless Local Wi-Fi / Hotspot Mode (100% Offline)"** in Send tab.
  2. Copy or present the generated `INSTASEND_OFFLINE_OFFER:...` QR code / string.
  3. Receiver: Click **"Serverless Local Wi-Fi Mode (100% Offline)"** in Receive tab, paste offer, and generate return answer code.
  4. Sender: Paste return answer code and click **"Connect Serverless P2P Now"**.
- **Expected Result**: Direct WebRTC DataChannel connection establishes 100% offline without central signaling server.

---

#### Test Case TC-05: Android Mobile & TV D-Pad Navigation
- **Preconditions**: APK installed on Android Mobile phone and Android TV / Google TV device.
- **Execution Steps**:
  1. Launch InstaSend APK on Android TV.
  2. Use TV Remote D-Pad (Up/Down/Left/Right/Select) to navigate header, tabs, buttons, and input fields.
- **Expected Result**:
  - High-contrast `:focus-visible` blue outline highlights active TV focus state.
  - TV keyboard opens when selecting 6-character code input boxes.

---

### Test Suite 3: Admin Portal & System Management

#### Test Case TC-06: Admin Portal Access & Telemetry Overview
- **Preconditions**: Admin credentials (`admin` / `1@3$5^7*9`).
- **Execution Steps**:
  1. Navigate to `http://localhost:3000/admin`.
  2. Sign in as Admin.
  3. Inspect telemetry dashboard, RSS memory usage, active peer table, and user account management.
- **Expected Result**:
  - Real-time Node.js process statistics and SQLite file size display accurately.
  - Admin can create new users and view system logs.

---

## 4. End-to-End QA Verification Checklist

Print or copy this checklist during release verification:

- [ ] **TC-01**: Single file WebRTC transfer passes with SHA-256 hash match.
- [ ] **TC-02**: Folder drop with subdirectories preserves relative paths and ZIP export works.
- [ ] **TC-03**: Text file Deflate compression reduces transfer size and decompresses cleanly.
- [ ] **TC-04**: Serverless local Wi-Fi mode connects and streams files 100% offline.
- [ ] **TC-05**: Android TV Leanback launcher and D-Pad focus indicators operate smoothly.
- [ ] **TC-06**: Admin portal `/admin` authenticates admin user and displays active telemetry.
- [ ] **TC-07**: SQLite authentication login (`Alex Rivera` demo user) restores session state.
- [ ] **TC-08**: Security audit tests (XSS, SQL injection, CSP, zero file cloud storage) pass without issues.
