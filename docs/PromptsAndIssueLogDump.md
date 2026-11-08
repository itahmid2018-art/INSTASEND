# InstaSend / HexaSend — Project History, Prompts & Issue Log Dump

**Generated Date:** November 8, 2026  
**Project:** InstaSend / HexaSend (P2P Encrypted File & Data Sharing via WebRTC)  
**Location:** `/docs/PromptsAndIssueLogDump.md`  

---

## 1. Executive Summary

This document provides a comprehensive chronological record of all prompts, development milestones, bugs, runtime errors, dependency conflicts, build pipeline issues, and technical solutions encountered from project initialization to the present date.

Each log entry includes:
- **Timestamp** (ISO and Local time)
- **User Prompt / Request** (Exact text)
- **Problem Statement & Root Cause Analysis**
- **Changes & Code Modifications Applied**
- **Outcome & Verification Status**

---

## 2. Chronological Prompt & Issue Log

### 📌 Milestone 0: Project Initialization & Core Architecture
* **Timestamp:** `2026-11-02T00:00:00Z`
* **Objective:** Establish the foundational architecture for HexaSend / InstaSend.
* **Scope Delivered:**
  1. **WebRTC P2P DataChannels:** Direct browser-to-browser streaming via SCTP/DTLS 1.2 with public STUN servers (`stun.l.google.com:19302`, `stun.cloudflare.com:3478`).
  2. **Signaling Server:** Dual-mode server in `server/index.ts` utilizing Express and `ws` WebSocket library on port 3000.
  3. **Frontend Application:** React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Canvas Confetti.
  4. **Security & Cryptography:** Zero cloud storage guarantee, ephemeral 6-character room codes, bit-for-bit SHA-256 Web Crypto API hash integrity check, text deflation compression using `pako`.
  5. **Persistence Layer:** Embedded SQLite database (`node:sqlite`) with `scrypt` password hashing and unique 16-byte cryptographic salts; pre-seeded administrative (`admin` / `1@3$5^7*9`) and demo accounts.
  6. **Capacitor Mobile Setup:** Android dual-launcher configs supporting mobile smartphones, tablets, and Android TV / Google TV Leanback navigation.
  7. **Automated Verification:** Comprehensive test suites in `scripts/`:
     - `test-diagnostics-ttl.mjs`
     - `test-lan-transfer.mjs`
     - `test-auto-reconnect.mjs`
     - `test-secret-code-and-expiry.mjs`

---

### 📌 Milestone 1: Terminal Restart Loop & Dependency Vulnerabilities
* **Timestamp:** `2026-11-02T22:34:26-08:00`
* **User Prompt:**
  > *"The app keeps opening and closing the terminal continuously when I ran the 'npm run dev', I have SQLite3 installed and available in through the environment variables."*

#### Issues & Errors Faced:
1. **Continuous File-Watcher Restart Loop:**
   - **Symptom:** Running `npm run dev` (`tsx watch server.ts`) caused the Node.js process to continuously terminate and restart in an endless loop.
   - **Root Cause:** SQLite Write-Ahead Logging (WAL) writes to `data/instasend.db`, `data/instasend.db-wal`, and `data/instasend.db-shm` on every transaction or connection. `tsx watch` monitored the workspace root without exclusion patterns, detecting SQLite database file updates as code modifications and triggering immediate server restarts.
2. **Audit Vulnerabilities:**
   - Transitive vulnerabilities reported by `npm audit` in `deepmerge`, `glob`, `minimatch`, `ejs`, and `esbuild`.
3. **PWA Bundle Transpile Failure:**
   - `Transforming destructuring to the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari14" + 2 overrides) is not supported yet` during production build on `virtual:pwa-register`.

#### Resolution & Fixes:
1. **Watcher Exclusions in `package.json`:**
   ```json
   "dev": "tsx watch --ignore \"data/**\" --ignore \"dist/**\" server.ts"
   ```
2. **Database Path Isolation (`server/db.ts`):**
   - Updated `server/db.ts` to respect environment variables `DATA_DIR` and `SQLITE_PATH`, falling back to `os.tmpdir()/instasend_data` during local execution:
   ```typescript
   const DATA_DIR = process.env.DATA_DIR || process.env.SQLITE_DIR || path.resolve(os.tmpdir(), 'instasend_data');
   const DB_PATH = process.env.SQLITE_PATH || process.env.DB_PATH || path.resolve(DATA_DIR, 'instasend.db');
   ```
3. **Dependency Overrides:**
   - Added `overrides` in `package.json` for `deepmerge`, `ejs`, `glob`, `minimatch`, `uuid`, and upgraded `esbuild` to `^0.28.2` and `vite` to `^6.2.0`.
4. **Vite Target Configuration:**
   - Configured `build: { target: 'esnext' }` in `vite.config.ts`.

---

### 📌 Milestone 2: Build Transpile Destructuring Error in `d3-array`
* **Timestamp:** `2026-11-03T00:16:31-08:00`
* **User Prompt:**
  > *"Fix the errors in the app"*
  ```
  error 0: ✘ [ERROR] Transforming destructuring to the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari14" + 2 overrides) is not supported yet
  error 1: let error = new Error(text);
  error 2: Error: Build failed with 46 errors:
  error 3: node_modules/d3-array/dist/d3-array.mjs:115:8: ERROR: Transforming destructuring to the configured target environment...
  ```

#### Issues & Errors Faced:
- Rollup/Vite build encountered destructuring syntax in `d3-array` (a dependency of `recharts`) during the production build step.
- Esbuild lacked lowering rules for certain destructuring patterns when targeting legacy browser targets.

#### Resolution & Fixes:
- Added explicit `esbuild: { target: 'esnext' }` in `vite.config.ts`:
  ```typescript
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
  ```
- Verified `npm run build` completed successfully.

---

### 📌 Milestone 3: Documentation Refresh
* **Timestamp:** `2026-11-03T03:49:06-08:00`
* **User Prompt:**
  > *"Please update all the documents with the recent changes, features, setuup instructions and all other respective updates."*

#### Actions Taken:
- Updated root `README.md` and `docs/README.md` to reflect all newly incorporated features:
  - Interactive file queue with thumbnail previews and modal lightbox.
  - Live Recharts speed meters and dynamic transfer gauges.
  - On-the-fly `pako` text deflation.
  - SQLite authentication using `node:sqlite` and `scrypt`.
  - Secret passcode session locking (`requiresSecretCode`, `secretCode`).
  - Temporary URL auto-expiration upon sender session close (`expiresOnSenderClose`).
- Updated `docs/ServerSetup.md` detailing the `DATA_DIR` and `SQLITE_PATH` environment variables and `os.tmpdir()` fallback.
- Validated all 41 test cases across 4 test suites.

---

### 📌 Milestone 4: Database Driver Inquiries & Verification
* **Timestamp:** `2026-11-04T00:36:28-08:00`
* **User Prompt:**
  > *"Could you check if "better-sqlite3" package is being used to connect to the SQLite3 db?"*

#### Findings & Verification:
- Verified that `better-sqlite3` is **not** present in `package.json` and is **not** imported.
- The project exclusively utilizes Node.js built-in `node:sqlite` via `DatabaseSync`:
  ```typescript
  import { DatabaseSync } from 'node:sqlite';
  this.db = new DatabaseSync(DB_PATH);
  ```
- This avoids native C++ binary compilation issues on various operating systems.

---

### 📌 Milestone 5: Destructuring Error Recurrence in `d3-scale` & `fast-equals`
* **Timestamp:** `2026-11-04T00:37:01-08:00` & `2026-11-04T10:03:07-08:00`
* **User Prompt:**
  > *"Fix the errors in the app"*
  ```
  error 0: Transforming destructuring to the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari14" + 2 overrides) is not supported yet node_modules/d3-scale/src/log.js:76:12
  ```

#### Deep Technical Root Cause:
- Although `build: { target: 'esnext' }` was applied to the Rollup production bundling phase, Vite's internal dependency pre-bundler (`optimizeDeps`) runs a distinct esbuild process on `node_modules`.
- Vite hardcodes `ESBUILD_MODULES_TARGET` (`["chrome87", "edge88", "es2020", "firefox78", "safari14"]` plus 2 overrides: `dynamic-import` and `import-meta`) in `node_modules/vite/dist/node/constants.js`.
- When esbuild processed dependencies with destructuring assignments (e.g., `([u, v] = [v, u])`), it threw the transpile error.

#### Resolution & Fixes:
- Added `optimizeDeps.esbuildOptions` in `vite.config.ts`:
  ```typescript
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      supported: {
        destructuring: true,
      },
    },
    exclude: ['virtual:pwa-register', 'virtual:pwa-register/react'],
  },
  ```
- Also set `supported: { destructuring: true }` in top-level `esbuild`.
- Verified with `npx vite optimize --force` and `npm run build`.

---

### 📌 Milestone 6: Multi-Platform Setup Automation Scripts
* **Timestamp:** `2026-11-04T10:05:44-08:00`
* **User Prompt:**
  > *"Could you please build a batch script (windows) and a shell script (linux) to setup the app locally that includes the npm commands, database (SQLite) while checking for the dependencies if they are all available or not, then install the required software to locally or on cloud run, test and deploy."*

#### Actions Taken:
- Created `setup.bat` for Windows environments.
- Created `setup.sh` for Linux and macOS environments.
- Automated prerequisite checks (Node.js v22+, npm), SQLite availability, dependency installation (`npm install`), running automated test suites (`npm test`), and production bundling (`npm run build`).

---

### 📌 Milestone 7: JSZip File Staging Integration
* **Timestamp:** `2026-11-04T10:07:28-08:00`
* **User Prompt:**
  > *"Integrate the JSZip library into the file staging process. Add a toggle in the SendTab to automatically zip multiple files into a single archive before starting the WebRTC transfer to reduce overhead and improve multi-file transfer management."*

#### Actions Taken:
1. Imported `JSZip` into `src/components/SendTab.tsx`.
2. Created an interactive toggle in `SendTab.tsx`:
   - *"Automatically zip multiple files into a single archive"* (with badge `JSZip Archive`).
   - Appears dynamically whenever more than 1 file is staged (`stagedFiles.length > 1`).
3. Implemented in-flight archive bundling in `handleCreateCode()`:
   - Compresses all queued files with DEFLATE (compression level 6).
   - Displays real-time compression progress (`Zipping archive: X%`).
   - Generates `InstaSend_Archive_YYYY-MM-DD.zip` and streams it as a single unit over WebRTC.

---

### 📌 Milestone 8: Setup Script SQLite Pre-flight & Schema Seeding
* **Timestamp:** `2026-11-04T10:11:49-08:00`
* **User Prompt:**
  > *"I did not find the dependency checks for the database platform (SQLite3) in the setup scripts, could you verify and check if those are fixed to ensure that the db scripts are executed while the setup is running and everything is well checked, installed and the app runs exactly as expected.."*

#### Actions Taken:
- Enhanced `setup.bat` and `setup.sh` to a 7-step automated sequence:
  - **Step 3/7:** Explicit test importing `DatabaseSync` from `node:sqlite`. Exits with an actionable error if Node.js version is under v22.5.
  - **Step 5/7:** Direct schema initialization and seed execution test:
    ```bash
    npx tsx -e "import('./server/db.ts').then(() => console.log('SQLite database initialized and pre-seeded successfully.'))"
    ```

---

### 📌 Milestone 9: Unhandled HTML Response in `fetchNetworkInfo`
* **Timestamp:** `2026-11-04T10:14:46-08:00`
* **User Prompt:**
  > *"Please check this error "Failed to fetch network info: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON " check through the error logs"*

#### Issues & Errors Faced:
- **Error:** `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON` logged in browser console.
- **Root Cause:**
  1. `fetchNetworkInfo()` in `src/services/network.ts` performed `fetch('/api/network-info').then(res => res.json())` without checking `res.ok` or verifying that the response `Content-Type` was `application/json`.
  2. When the application started up in cloud environments (e.g., Cloud Run, proxy gateways) or while the backend server was restarting, the gateway/server returned an HTML error or fallback page (`<!doctype html>...`).
  3. In `server/index.ts`, unhandled `/api/*` endpoints fell through to Express's default HTML 404 handler (`<pre>Cannot GET /api/...</pre>`) or Vite dev server's HTML catch-all.

#### Resolution & Fixes:
1. **Hardened Client Network Service (`src/services/network.ts`):**
   ```typescript
   const res = await fetch('/api/network-info');
   const contentType = res.headers.get('content-type') || '';
   if (!res.ok || !contentType.includes('application/json')) {
     const fallback: NetworkInfo = {
       success: true,
       lanIp: window.location.hostname || '127.0.0.1',
       addresses: [window.location.hostname || '127.0.0.1'],
       port: Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80),
       hostname: window.location.hostname
     };
     cachedNetworkInfo = fallback;
     return fallback;
   }
   ```
2. **Explicit API JSON 404 Handler (`server/index.ts`):**
   - Added an explicit `app.all('/api/*', ...)` route ensuring unhandled API routes return JSON instead of HTML:
   ```typescript
   app.all('/api/*', (req, res) => {
     res.status(404).json({
       success: false,
       error: 'API endpoint not found',
       path: req.originalUrl
     });
   });
   ```
3. **Guarded Other Client Fetches:**
   - Updated `src/components/ReceiveTab.tsx` (`checkRoomStatus`) and `src/components/AuthModal.tsx` (`/api/db/status`) to inspect `res.headers.get('content-type')` before invoking `.json()`.

---

### Prompt 11
* **Date & Timestamp:** 2026-11-08 16:51:04 UTC
* **User Request:**
  > "Please create a new document to help install the app on GCP, AWS, Azure, Vercel or on any VPS that includes all the dependencies, update the setup files if required if they can ease out the process of deployment and update other relevant documents that are dependent on this update."
* **Milestone / Action Taken:**
  1. **New Deployment Master Document (`docs/CloudAndVpsDeploymentGuide.md`):**
     - Authored exhaustive, step-by-step production deployment manual covering Google Cloud Platform (Cloud Run with `--session-affinity` & Compute Engine GCE), Amazon Web Services (App Runner, EC2, Lightsail $3.50 VPS, ECS/Fargate + ALB with sticky sessions), Microsoft Azure (Container Apps & Linux App Service with WebSockets enabled), Vercel (detailed architecture analysis explaining why pure serverless edge cannot maintain persistent WebSockets, and providing the decoupled hybrid architecture: Vercel static CDN frontend + containerized signaling backend), and Generic Linux VPS (DigitalOcean, Hetzner, Linode, OVH, Vultr) with PM2, Systemd, Nginx SSL, and Caddy.
     - Documented `node:sqlite` WAL persistence, zero-downtime hot backup crons, environment variables reference, and enterprise Coturn STUN/TURN server installation.
  2. **Production Containerization Assets:**
     - Created multi-stage `Dockerfile` (Node 22 Alpine, build & runner stages, health checks).
     - Created `.dockerignore` for clean build contexts.
     - Created `docker-compose.yml` for 1-command containerized deployment with volume persistence.
  3. **Setup Script Enhancements (`setup.sh` & `setup.bat`):**
     - Added automated `.env` initialization from `.env.example` if `.env` does not exist.
     - Added CLI flag support: `--skip-tests` (for rapid CI/CD container builds), `--start` / `--deploy` (immediate production server start), `--dev`, and `--docker`.
     - Validated Node.js v22+ and `node:sqlite` database initialization pre-flights.
  4. **Server Cloud Port Compatibility (`server/index.ts`):**
     - Updated port binding to dynamically respect `PORT = Number(process.env.PORT) || 3000`, enabling seamless deployment on Cloud Run, AWS App Runner, Azure Container Apps, and Heroku.
  5. **Cross-Referenced Documentation:**
     - Updated `docs/README.md`, root `README.md`, and `docs/ServerSetup.md` with links and reference commands.

---

## 3. Comprehensive Error & Issue Matrix

| # | Issue / Error Message | Component | Root Cause | Permanent Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Continuous terminal restart loop on `npm run dev` | `server.ts`, `server/db.ts` | `tsx watch` monitored directory containing SQLite WAL and journal files (`data/instasend.db-wal`), triggering infinite restart cycles on DB writes. | Added `--ignore "data/**" --ignore "dist/**"` to dev script; redirected DB location to `os.tmpdir()` during dev. |
| **2** | `Transforming destructuring to configured target... not supported yet` (PWA Chunks) | `vite.config.ts`, `vite-plugin-pwa` | Vite production build defaulted to older browser target list where esbuild did not transpile destructuring. | Set `build: { target: 'esnext' }` in `vite.config.ts`. |
| **3** | `Transforming destructuring to configured target... not supported yet` (46 errors in `d3-array`) | `vite.config.ts`, `recharts` | Top-level esbuild transform lacked explicit `esnext` target flag. | Added `esbuild: { target: 'esnext' }` to `vite.config.ts`. |
| **4** | `Transforming destructuring to configured target ("chrome87"...)` in `d3-scale` & `fast-equals` | `vite.config.ts`, `node_modules` | Vite's dependency optimizer (`optimizeDeps`) runs an independent esbuild instance defaulting to `ESBUILD_MODULES_TARGET`. | Configured `optimizeDeps.esbuildOptions.target = 'esnext'` and `supported: { destructuring: true }` in `vite.config.ts`. |
| **5** | Missing SQLite3 dependency checks in local setup scripts | `setup.bat`, `setup.sh` | Setup scripts did not validate that Node.js supported native `node:sqlite` or test table initialization. | Added dedicated `[3/7]` Node.js SQLite validation and `[5/7]` database schema & seed testing. |
| **6** | `Failed to fetch network info: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON` | `src/services/network.ts`, `server/index.ts` | Client fetched `/api/network-info` and called `.json()` on HTML responses returned by proxy/server fallbacks; Express lacked JSON 404 handler for `/api/*`. | Added content-type checks & client fallback in `network.ts`; added explicit `app.all('/api/*', ...)` JSON 404 handler in `server/index.ts`. |
| **7** | Hardcoded Port 3000 in cloud serverless container environments | `server/index.ts` | Cloud Run, AWS App Runner, and Azure pass dynamic `$PORT` environment variable. | Updated to `PORT = Number(process.env.PORT) || 3000`. |

---

## 4. Current Verification & Build Health

- **TypeScript Typecheck (`tsc --noEmit`):** ✅ Passed (0 errors)
- **Vite Production Compilation (`npm run build`):** ✅ Succeeded (Zero warnings/errors)
- **Dependency Pre-bundling (`vite optimize --force`):** ✅ Succeeded
- **Automated Test Suites (`npm test`):**
  - `scripts/test-diagnostics-ttl.mjs`: **17 / 17 Passed**
  - `scripts/test-lan-transfer.mjs`: **6 / 6 Passed**
  - `scripts/test-auto-reconnect.mjs`: **11 / 11 Passed**
  - `scripts/test-secret-code-and-expiry.mjs`: **7 / 7 Passed**
  - **Total:** **41 / 41 Automated Tests Passing (100%)**

