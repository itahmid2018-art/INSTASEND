# InstaSend Production Server & Database Setup Guide

Welcome to the **InstaSend** Server Operations and Administration Guide. This document provides step-by-step instructions for runtime dependencies, SQLite database initialization, user role testing, admin portal configuration (`/admin`), active LAN peer monitoring, and production deployment.

---

## 1. System Requirements & Runtime Dependencies

### 1.1 Minimum Hardware & Network Requirements
* **CPU**: 1 vCPU (x86_64 or ARM64)
* **RAM**: 256 MB minimum (512 MB recommended)
* **Disk**: 100 MB available storage (for SQLite WAL database and logs)
* **Network Port**: Port `3000` (supports HTTP REST requests and WebSocket connections)
* **Protocols**: WebRTC DataChannels (SCTP over DTLS 1.2), WebSockets (`ws://` / `wss://`), HTTP/1.1 or HTTP/2

### 1.2 Software Dependencies
* **Node.js**: v22.0.0 or higher (required for native Node.js SQLite support via `node:sqlite`).
* **Package Manager**: `npm` (v10+).
* **TypeScript Runtime**: `tsx` (TypeScript Execute) for zero-compilation server execution.
* **Database Engine**: Embedded SQLite3 via Node.js native `DatabaseSync` class (no external SQLite CLI or binaries required).
* **Client Dependencies**: `recharts` (for live transfer speed visualization), `pako` (for streaming Deflate text compression), `canvas-confetti`, `qrcode`, `jszip`, `lucide-react`, `tailwindcss`.

---

## 2. Server & Database Architecture

InstaSend operates as a full-stack Node.js server where Express handles HTTP REST endpoints and Vite middleware, while Node's native `ws` WebSocket library powers WebRTC signaling, device radar presence, and fallback relaying.

```
                           +-------------------------------------+
                           |      Client Browsers (WebRTC)       |
                           +------------------+------------------+
                                              |
                          Direct DataChannel  |  Signaling & Radar
                          (Encrypted P2P)     |  (WebSockets on :3000)
                                              v
                           +-------------------------------------+
                           |      InstaSend Node.js Server       |
                           |   (Express + Vite + WebSocket)      |
                           +------------------+------------------+
                                              |
                                              | Local Persistence
                                              v
                           +-------------------------------------+
                           |     Embedded SQLite Database        |
                           |      (data/instasend.db - WAL)      |
                           +-------------------------------------+
```

### 2.1 SQLite WAL Journal Mode & Persistence
The database file is stored at `data/instasend.db` with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) enabled for high-concurrency read and write throughput.

### 2.2 Secure Credentials & Password Hashing
User passwords are never stored in plaintext. They are encrypted using Node's cryptographic `scrypt` key derivation function:
* **Algorithm**: `crypto.scryptSync(password, salt, 64)`
* **Salt**: 16 random hex bytes (32 characters) per account
* **Verification**: Constant-time verification using `crypto.timingSafeEqual` to prevent timing attacks.

---

## 3. Pre-seeded Accounts & SQL Import File

InstaSend automatically seeds the administrative account and a demo user upon initial boot. Additional test users can be imported via the provided SQL script.

### 3.1 Default Pre-seeded Accounts

| Role | Username / Email | Password | Plan | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` (or `admin@instasend.io`) | `1@3$5^7*9` | Pro | Full system administration, telemetry, user management |
| **User (Demo)** | `alex.rivera@instasend.io` | `InstaSend2026!` | Pro | Pre-seeded user account for instant testing |
| **User (Test A)** | `sarah.chen@techcorp.local` | `TestPass2026!` | Pro | Pre-deployment corporate test account |
| **User (Test B)** | `david.lan@home.net` | `TestPass2026!` | Free | Pre-deployment free tier test account |
| **Admin (QA)** | `qa.tester@instasend.io` | `TestPass2026!` | Pro | QA testing administrator account |

### 3.2 Importing `admin_and_test_users.sql` via Command Line

An SQL seed script with pre-computed scrypt password hashes is provided at `/docs/admin_and_test_users.sql` (and `/server/seeds/admin_and_test_users.sql`).

To import or reset the database via SQLite CLI:
```bash
# Navigate to workspace root
cd /app/applet

# Import the pre-encrypted SQL seed file into SQLite
sqlite3 data/instasend.db < docs/admin_and_test_users.sql
```

Alternatively, administrators can copy or download the script directly from the `/admin` portal UI under the **SQL Seed File** tab.

---

## 4. Administration Functionalities & `/admin` Portal

The `/admin` portal provides real-time system monitoring, user administration, active peer radar tracking, and database diagnostics.

### 4.1 Accessing the Admin Console
1. Open the application in your browser.
2. Navigate directly to `http://localhost:3000/admin` (or click **Admin Portal (/admin)** in the footer or header navigation).
3. If not signed in as an administrator, enter the admin credentials:
   * **Username**: `admin`
   * **Password**: `1@3$5^7*9`

### 4.2 Key Features in `/admin`
* **System & Telemetry Dashboard**: Real-time Node.js process RSS memory, heap total, heap used, server uptime, Node.js version, and SQLite database file size.
* **Connected LAN Systems & Radar**: Live table displaying all active WebRTC peers, their assigned peer IDs, connected browser/OS, device type (desktop/mobile/tablet), active room codes, and signaling status.
* **User Account Management**: View all registered user accounts, filter by role (`admin` / `user`) or plan (`pro` / `free`), create test accounts, and delete user accounts.
* **SQL Seed Generator**: Copy or inspect raw SQL table schema and pre-encrypted credentials.

---

## 5. Live Speed Chart (Recharts Mbps Telemetry)

Both `SendTab` and `ReceiveTab` feature a live speed line chart powered by **Recharts**:
* **Metric Conversion**: Calculates throughput in Megabits per second (`Mbps = (bytesPerSec * 8) / 1,000,000`).
* **Visual Themes**:
  * **Sender**: Google Blue (`#1a73e8`) smooth monotone gradient area chart.
  * **Receiver**: Google Green (`#34A853`) smooth monotone gradient area chart.
* **Metrics Tracked**: Live Mbps, Peak Mbps, Average Mbps, and Total Data Transferred.

---

## 6. Testing Application User Roles & API Endpoints

You can verify server operations and user authentication using `curl` or Postman.

### 6.1 Test Database Status Endpoint
```bash
curl -s http://localhost:3000/api/db/status
```
**Response:**
```json
{
  "status": "ok",
  "sqlite": {
    "status": "operational",
    "engine": "SQLite3 (node:sqlite)",
    "databaseFile": "/app/applet/data/instasend.db",
    "fileSizeFormatted": "80.0 KB",
    "isInitialized": true,
    "userCount": 5,
    "activeSessionCount": 1
  }
}
```

### 6.2 Test Admin Authentication (`admin` / `1@3$5^7*9`)
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin", "password": "1@3$5^7*9", "deviceName": "CLI Test"}'
```

### 6.3 Test Admin Telemetry Overview
```bash
curl -s http://localhost:3000/api/admin/overview
```

### 6.4 Create a New Test User via Admin API
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dev Ops Tester",
    "email": "devops@instasend.io",
    "password": "TestPass2026!",
    "role": "user",
    "plan": "pro"
  }'
```

---

## 7. Production Deployment Instructions

### 7.1 Option A: PM2 Process Manager
```bash
# Install PM2 globally if not present
npm install -g pm2

# Build frontend assets
npm run build

# Start server process with PM2
pm2 start server.ts --name instasend --interpreter ./node_modules/.bin/tsx

# Save PM2 process list for auto-boot
pm2 save
pm2 startup
```

### 7.2 Option B: Systemd Service (`/etc/systemd/system/instasend.service`)
```ini
[Unit]
Description=InstaSend WebRTC & Express Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/instasend
ExecStart=/usr/bin/node --import tsx/esm server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
```

### 7.3 Nginx Reverse Proxy with WebSocket Support
```nginx
server {
    listen 80;
    server_name instasend.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

---

## 9. Native Android Mobile & Android TV Compilation

InstaSend supports cross-platform native compilation for **Android Mobile (Phones & Tablets)** and **Android TV / Google TV** using Capacitor.

For detailed prerequisites, Gradle compilation commands, keystore signing, ADB wireless installation, and Play Store pre-flight security checklists, refer to the dedicated guide:
👉 **[docs/AndroidBuildGuide.md](./AndroidBuildGuide.md)**

```bash
# Build web bundle and sync native Capacitor Android project
npm run build:android

# Open in Android Studio
npm run cap:open
```

