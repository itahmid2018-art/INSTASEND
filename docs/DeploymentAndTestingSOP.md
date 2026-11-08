# InstaSend Deployment Guidelines & Standard Operating Procedure (SOP)
### Complete Operational SOP: Dependencies, Cloud/VPS Deployment, Admin Verification & User Acceptance Testing

* **Document ID**: `SOP-INSTASEND-DEPLOY-001`
* **Classification**: Technical & Operational Standard Operating Procedure (SOP)
* **Target Audience**: DevOps Engineers, System Administrators, Security Auditors, QA Engineers, Release Managers
* **Applies To**: Local Bare-Metal, Linux VPS (DigitalOcean/Hetzner/Linode/OVH), Docker Containers, Cloud Platforms (GCP, AWS, Azure)

---

## 📋 Table of Contents
1. [SOP Overview & Purpose](#1-sop-overview--purpose)
2. [Section A: Pre-Flight Dependency Verification SOP](#2-section-a-pre-flight-dependency-verification-sop)
3. [Section B: Step-by-Step Deployment Guidelines SOP](#3-section-b-step-by-step-deployment-guidelines-sop)
   * [B.1 Automated 1-Command Pipeline (`setup.sh` / `setup.bat`)](#b1-automated-1-command-pipeline)
   * [B.2 Production Docker & Docker Compose Deployment](#b2-production-docker--docker-compose-deployment)
   * [B.3 Linux VPS Production Deployment (PM2 + Nginx SSL)](#b3-linux-vps-production-deployment-pm2--nginx-ssl)
   * [B.4 Cloud Platforms Quick Deployment (GCP Cloud Run, AWS App Runner, Azure Container Apps)](#b4-cloud-platforms-quick-deployment)
4. [Section C: Admin Testing & Verification SOP](#4-section-c-admin-testing--verification-sop)
   * [Test Case AT-01: Admin Portal Access & Authentication](#test-case-at-01-admin-portal-access--authentication)
   * [Test Case AT-02: SQLite Database Health & Table Inspection](#test-case-at-02-sqlite-database-health--table-inspection)
   * [Test Case AT-03: Real-Time LAN Peer Radar & Signaling Diagnostics](#test-case-at-03-real-time-lan-peer-radar--signaling-diagnostics)
   * [Test Case AT-04: User Account & Transfer Quota Management](#test-case-at-04-user-account--transfer-quota-management)
   * [Test Case AT-05: Production Password Hardening & Secret Rotation](#test-case-at-05-production-password-hardening--secret-rotation)
5. [Section D: User Acceptance Testing (UAT) SOP](#5-section-d-user-acceptance-testing-uat-sop)
   * [Test Case UT-01: Standard P2P Transfer via 6-Character Code](#test-case-ut-01-standard-p2p-transfer-via-6-character-code)
   * [Test Case UT-02: Mobile Camera QR Code Instant Auto-Connect](#test-case-ut-02-mobile-camera-qr-code-instant-auto-connect)
   * [Test Case UT-03: Interactive Sending Queue & Lightbox Previews](#test-case-ut-03-interactive-sending-queue--lightbox-previews)
   * [Test Case UT-04: JSZip Multi-File Archive & Batch Download](#test-case-ut-04-jszip-multi-file-archive--batch-download)
   * [Test Case UT-05: Folder & Directory Recursive Drop](#test-case-ut-05-folder--directory-recursive-drop)
   * [Test Case UT-06: Text Compression (pako Deflate) Wire Verification](#test-case-ut-06-text-compression-pako-deflate-wire-verification)
   * [Test Case UT-07: Passcode Protection & Ephemeral Self-Destruction](#test-case-ut-07-passcode-protection--ephemeral-self-destruction)
   * [Test Case UT-08: Bit-for-Bit SHA-256 Web Crypto Verification](#test-case-ut-08-bit-for-bit-sha-256-web-crypto-verification)
   * [Test Case UT-09: 100% Offline Wi-Fi / Hotspot Mode (Zero Signaling)](#test-case-ut-09-100-offline-wi-fi--hotspot-mode-zero-signaling)
   * [Test Case UT-10: Optional User Registration, Auth & Stats Sync](#test-case-ut-10-optional-user-registration-auth--stats-sync)
6. [Section E: Production Release Sign-Off Checklist](#6-section-e-production-release-sign-off-checklist)

---

## 1. SOP Overview & Purpose

This Standard Operating Procedure (SOP) establishes the mandatory verification protocol required before promoting an **InstaSend** instance to production. It guarantees that:
1. All system and runtime dependencies are verified and validated.
2. The production build compiles cleanly without transpilation or bundle errors.
3. System administrators can monitor, audit, and configure the host server via the Admin Portal (`/admin`).
4. End users experience reliable, encrypted, high-speed peer-to-peer file sharing across web, desktop, and mobile devices.

---

## 2. Section A: Pre-Flight Dependency Verification SOP

Before executing any deployment steps, verify each dependency against the required specification:

### Pre-Flight Dependency Checklist
| Dependency | Required Specification | Verification Shell Command | Expected Output |
| :--- | :--- | :--- | :--- |
| **Node.js Runtime** | `v22.5.0` or higher | `node -v` | `v22.x.x` (or higher) |
| **Node Package Manager** | `v9.0.0` or higher | `npm -v` | `10.x.x` (or higher) |
| **Native SQLite Engine** | Built-in `node:sqlite` (`DatabaseSync`) | `node -e "const { DatabaseSync } = require('node:sqlite'); console.log('SQLite OK');"` | `SQLite OK` |
| **Operating System** | Linux (Ubuntu 22/24), macOS 12+, Windows 10/11 / Server 2022 | `uname -a` or `ver` | Host OS details |
| **Available Memory** | Min 512 MB RAM (1 GB+ recommended) | `free -m` | ≥ 512 MB free / swap available |
| **Network Port 3000** | Available (not bound by another process) | `lsof -i :3000` or `netstat -ano \| findstr 3000` | Empty (no conflicting process) |

### Step A.1: Validate Node.js 22 LTS
InstaSend leverages the native Node.js SQLite module (`node:sqlite`). Do **NOT** install or rely on `better-sqlite3`.
```bash
node -e "
const major = parseInt(process.versions.node.split('.')[0], 10);
const minor = parseInt(process.versions.node.split('.')[1], 10);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error('FAIL: Node.js version must be >= 22.5.0. Current: ' + process.version);
  process.exit(1);
} else {
  console.log('PASS: Node.js version meets requirements (' + process.version + ')');
}
"
```

### Step A.2: Verify SQLite Native Engine
```bash
node -e "
try {
  const { DatabaseSync } = require('node:sqlite');
  console.log('PASS: node:sqlite DatabaseSync engine is available.');
} catch (e) {
  console.error('FAIL: node:sqlite is not available: ' + e.message);
  process.exit(1);
}
"
```

### Step A.3: Verify Environment Template
Ensure a valid `.env` file exists:
```bash
if [ ! -f .env ]; then
  cp .env.example .env
  echo "PASS: Initialized .env from template."
else
  echo "PASS: .env configuration file already exists."
fi
```

### Step A.4: Verify Database Schema Initialization
Test database creation, table creation, and seed data initialization:
```bash
npx tsx -e "
import('./server/db.ts').then(() => {
  console.log('PASS: Database schema initialized and pre-seeded successfully.');
  process.exit(0);
}).catch(err => {
  console.error('FAIL: Database initialization error:', err);
  process.exit(1);
});
"
```

### Step A.5: Run Pre-Flight Test Suites (100% Pass Required)
```bash
npm test
```
* **Acceptance Criteria**: 4 test suites passed, 41/41 unit/integration tests passing (0 failures).

---

## 3. Section B: Step-by-Step Deployment Guidelines SOP

### B.1 Automated 1-Command Pipeline

#### For Linux, macOS, and Cloud VPS:
```bash
chmod +x setup.sh
# Standard complete automated build and test:
./setup.sh

# Or build and launch production server immediately:
./setup.sh --start

# Or rapid CI/CD build (skipping test suite):
./setup.sh --skip-tests --start
```

#### For Windows:
```cmd
:: Run setup script:
setup.bat

:: Or rapid deployment:
setup.bat --skip-tests --start
```

---

### B.2 Production Docker & Docker Compose Deployment
Docker provides an immutable container environment with multi-stage compilation and healthchecks.

```bash
# 1. Build and launch container in background:
docker compose up -d --build

# 2. Verify container status:
docker compose ps

# 3. Check live logs:
docker compose logs -f

# 4. Verify automated healthcheck:
curl -s http://localhost:3000/api/db/status | grep '"success":true'
```
* **Container Storage**: SQLite database files are mounted to the Docker named volume `instasend-data` (`/app/data/instasend.db`).

---

### B.3 Linux VPS Production Deployment (PM2 + Nginx SSL)

#### 1. Build Production Bundle
```bash
npm run build
```

#### 2. Configure PM2 Process Manager
```bash
sudo npm install -g pm2
pm2 start dist/server.js --name "instasend" --env NODE_ENV=production
pm2 startup systemd
pm2 save
```

#### 3. Configure Nginx Reverse Proxy with WebSocket Upgrades
Create `/etc/nginx/sites-available/instasend`:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name send.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable site and acquire free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/instasend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d send.yourdomain.com
```

---

### B.4 Cloud Platforms Quick Deployment

* **Google Cloud Run**:
  ```bash
  gcloud run deploy instasend \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3000 \
    --session-affinity \
    --min-instances 1 \
    --set-env-vars NODE_ENV=production,DATA_DIR=/tmp/instasend_data
  ```
  *(Crucial: `--session-affinity` ensures WebSockets persist to the same container instance).*

* **AWS Lightsail / EC2**:
  Launch Ubuntu 24.04 instance, open ports 80/443, run `./setup.sh --start`, and configure Nginx + Certbot.

* **Azure Container Apps**:
  ```bash
  az containerapp up \
    --name instasend-app \
    --source . \
    --target-port 3000 \
    --ingress external
  az containerapp ingress sticky-sessions set \
    --name instasend-app \
    --affinity sticky
  ```

---

## 4. Section C: Admin Testing & Verification SOP

The Admin Portal enables operators to inspect system health, verify peer discovery, manage user roles, and monitor storage footprints.

### Test Case AT-01: Admin Portal Access & Authentication
* **Objective**: Confirm the protected Admin Portal is accessible and rejects unauthenticated users.
* **Preconditions**: Server running at `http://localhost:3000` (or production domain).
* **Procedure**:
  1. Open a browser and navigate to `/admin` (e.g. `http://localhost:3000/admin`).
  2. Verify an authentication modal or login dialog appears.
  3. Attempt login with invalid credentials (`baduser` / `wrongpass`).
     - **Expected**: Login rejected with error alert.
  4. Enter pre-seeded administrative credentials:
     - **Username**: `admin`
     - **Password**: `1@3$5^7*9`
  5. Click **"Sign In"**.
* **Pass Criteria**:
  - JWT token is issued and stored in browser memory/storage.
  - User is granted access to the Admin Dashboard showing header badge: **"Admin Portal (Super Admin)"**.

---

### Test Case AT-02: SQLite Database Health & Table Inspection
* **Objective**: Confirm database engine telemetry and table records via API and UI.
* **Procedure**:
  1. From terminal, issue a GET request to `/api/db/status`:
     ```bash
     curl -s http://localhost:3000/api/db/status | jq .
     ```
  2. In the Admin Portal UI, navigate to the **"System Health"** / **"Database"** card.
* **Pass Criteria**:
  - Response returns `"success": true`.
  - `"engine"` is `"node:sqlite"`.
  - Tables listed: `users`, `managed_files`, `transfer_history`, `sessions`.
  - WAL journal mode is reported as active.

---

### Test Case AT-03: Real-Time LAN Peer Radar & Signaling Diagnostics
* **Objective**: Verify that active signaling rooms and connected peers are tracked.
* **Procedure**:
  1. Open a second browser tab and stage a file to generate a 6-character room code (e.g., `RAD777`).
  2. In the Admin Portal tab, observe the **"Active Mesh & Connected Peers"** widget.
  3. Observe latency / ping-pong telemetry.
* **Pass Criteria**:
  - The staged room code (`RAD777`) appears with active sender status.
  - Signaling latency is reported (< 50ms locally, < 150ms on cloud).

---

### Test Case AT-04: User Account & Transfer Quota Management
* **Objective**: Validate user accounts, role badges, and cumulative transfer stat tracking.
* **Procedure**:
  1. In the Admin Portal, open the **"User Accounts"** tab.
  2. Verify pre-seeded demo accounts exist:
     - `admin` (Role: `admin`, Plan: `pro`)
     - `demo@instasend.io` (Role: `user`, Plan: `free`)
     - `alice@example.com` (Role: `user`, Plan: `pro`)
  3. Verify that total uploads, bytes sent, and bytes received counters are displayed.
* **Pass Criteria**:
  - All accounts render with accurate badges.
  - Passwords are encrypted as `scrypt` hashes and salts (never shown in plaintext).

---

### Test Case AT-05: Production Password Hardening & Secret Rotation
* **Objective**: Ensure the default admin password is changed prior to public launch.
* **Procedure**:
  1. In the Admin Portal, click **"Account Settings"** > **"Change Password"**.
  2. Enter current password (`1@3$5^7*9`).
  3. Enter a strong, 16+ character production password.
  4. Submit change.
  5. Sign out and sign in with the new password.
* **Pass Criteria**:
  - Old password is rejected.
  - New password successfully generates a new session token.

---

## 5. Section D: User Acceptance Testing (UAT) SOP

### Test Case UT-01: Standard P2P Transfer via 6-Character Code
* **Objective**: Complete end-to-end peer-to-peer file transfer over WebRTC.
* **Procedure**:
  1. Open **Sender** browser (`Tab A`) and **Receiver** browser (`Tab B`).
  2. On **Tab A (Send)**: Drag & drop a 10MB test file (e.g., image or PDF).
  3. Click **"Initiate WebRTC Transfer"** to generate 6-character code (e.g. `FAST99`).
  4. On **Tab B (Receive)**: Enter `FAST99` into the 6 code boxes.
  5. Click **"Connect & Receive"**.
* **Pass Criteria**:
  - Audio chime sounds on transfer start.
  - Live upload & download speed charts update in real time.
  - File completes with 100% progress.
  - Final audio victory chime plays.
  - Downloaded file opens and matches original byte-for-byte.

---

### Test Case UT-02: Mobile Camera QR Code Instant Auto-Connect
* **Objective**: Verify mobile device pairing without manual code entry.
* **Procedure**:
  1. On Sender desktop: Click **"Show QR Code"** in the session banner.
  2. On Receiver mobile phone: Open camera and scan the QR code.
  3. Tap the scanned URL (`https://<domain>/?code=FAST99`).
* **Pass Criteria**:
  - Mobile browser opens InstaSend with the 6 code boxes pre-filled.
  - Connection establishes automatically; file download commences.

---

### Test Case UT-03: Interactive Sending Queue & Lightbox Previews
* **Objective**: Test multi-file staging, queue removal, and preview lightbox.
* **Procedure**:
  1. Drag 5 mixed files (images, documents, archives) into the Send tab.
  2. Verify each file displays a file size badge, category icon, and remove button.
  3. Click the preview thumbnail on an image. Confirm full-screen lightbox displays.
  4. Click the "Remove" button on file #3.
* **Pass Criteria**:
  - File #3 is cleanly removed from the queue.
  - Aggregated byte count and item counter update dynamically.

---

### Test Case UT-04: JSZip Multi-File Archive & Batch Download
* **Objective**: Test automatic bundling of multiple files into a single `.zip` file.
* **Procedure**:
  1. On Send tab: Add 3 different files.
  2. Toggle **"Auto-Zip Archive"** switch to **ON**.
  3. Initiate transfer.
  4. Receiver downloads the resulting payload.
* **Pass Criteria**:
  - In-browser JSZip compresses files with progress display.
  - Receiver receives a single `.zip` archive containing all 3 original files uncorrupted.

---

### Test Case UT-05: Folder & Directory Recursive Drop
* **Objective**: Ensure recursive folder structures are preserved across transfer.
* **Procedure**:
  1. Drag and drop a folder containing nested subdirectories into the Send tab.
  2. Initiate transfer and accept on receiver.
* **Pass Criteria**:
  - Receiver receives all files with relative paths intact (e.g., `folder/subfolder/file.png`).

---

### Test Case UT-06: Text Compression (pako Deflate) Wire Verification
* **Objective**: Confirm text files are compressed on the wire to save bandwidth.
* **Procedure**:
  1. Stage a 1MB `.txt` or `.json` file.
  2. Observe the wire size indicator.
* **Pass Criteria**:
  - Pako Deflate compresses the wire payload (up to 70-85% size reduction).
  - Receiver decompresses payload in RAM to reconstruct the exact original file.

---

### Test Case UT-07: Passcode Protection & Ephemeral Self-Destruction
* **Objective**: Verify transfer security controls (PIN passcode and self-destruct).
* **Procedure**:
  1. On Send tab: Expand **Security Options**.
  2. Set a 4-digit secret passcode (e.g., `4829`).
  3. Enable **"Self-Destruct after single download"**.
  4. Initiate transfer.
  5. Receiver connects using the 6-character room code.
  6. Receiver enters incorrect passcode `0000`, then correct passcode `4829`.
  7. Receiver completes download.
  8. Receiver refreshes and attempts to connect again.
* **Pass Criteria**:
  - Incorrect passcode is rejected.
  - Correct passcode allows transfer.
  - Room code immediately self-destructs after download; subsequent attempts return expired/invalid code error.

---

### Test Case UT-08: Bit-for-Bit SHA-256 Web Crypto Verification
* **Objective**: Verify that cryptographic checksum matches on sender and receiver.
* **Procedure**:
  1. Perform file transfer of an executable or image.
  2. Inspect the completion screen on both sender and receiver.
* **Pass Criteria**:
  - Both screens show matching green **"SHA-256 Verified"** badge with identical 64-character hexadecimal hash strings.

---

### Test Case UT-09: 100% Offline Wi-Fi / Hotspot Mode (Zero Signaling)
* **Objective**: Test file transfer on local networks with no internet access.
* **Procedure**:
  1. Disconnect server from external internet (local LAN only).
  2. Click **"Offline Direct / Hotspot Mode"**.
  3. Complete direct SDP handshake via local QR code or copy-paste.
* **Pass Criteria**:
  - WebRTC DataChannel connects directly over local Wi-Fi IP; file transfers without internet access.

---

### Test Case UT-10: Optional User Registration, Auth & Stats Sync
* **Objective**: Test authenticated user accounts and stats tracking.
* **Procedure**:
  1. Click **"Sign In / Sign Up"** in the top navigation.
  2. Create a new account with email `testuser@example.com` and password.
  3. Perform a 5MB file transfer while logged in.
  4. Navigate to user profile.
* **Pass Criteria**:
  - Transfer is credited to cumulative stats (total uploads incremented, total bytes updated).

---

## 6. Section E: Production Release Sign-Off Checklist

Before releasing to production, the Release Engineer and QA Lead must verify and check off all items:

| # | Check Item | Verification Command / URL | Responsible Role | Pass / Fail |
| :---: | :--- | :--- | :---: | :---: |
| 1 | Node.js v22.5+ verified | `node -v` | DevOps | [ ] PASS |
| 2 | Native `node:sqlite` verified | `node -e "require('node:sqlite')"` | DevOps | [ ] PASS |
| 3 | Automated test suite passes 100% | `npm test` (41 tests) | QA Engineer | [ ] PASS |
| 4 | TypeScript check passes (0 errors) | `npm run lint` (`tsc --noEmit`) | Developer | [ ] PASS |
| 5 | Production bundle builds cleanly | `npm run build` | Release Eng | [ ] PASS |
| 6 | Database status endpoint returns 200 OK | `GET /api/db/status` | DevOps | [ ] PASS |
| 7 | Reverse proxy configures WebSocket Upgrade | `curl -i /ws` | DevOps | [ ] PASS |
| 8 | Valid SSL/TLS certificate installed | `https://yourdomain.com` | DevOps | [ ] PASS |
| 9 | Default admin password rotated | `/admin` > Settings | Security Lead | [ ] PASS |
| 10 | Live P2P file transfer verified | Test Case UT-01 | QA Engineer | [ ] PASS |
| 11 | SHA-256 cryptographic check verified | Test Case UT-08 | QA Engineer | [ ] PASS |
| 12 | Automated daily backup cron scheduled | `crontab -l` | SysAdmin | [ ] PASS |

---

**Sign-Off Approvals:**
* **Lead Engineer**: _______________________ Date: ____________
* **QA / Test Lead**: _______________________ Date: ____________
* **Release Manager**: _____________________ Date: ____________
