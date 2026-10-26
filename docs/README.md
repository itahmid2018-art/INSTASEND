# InstaSend Technical & Security Documentation Index

Welcome to the **InstaSend** Documentation Hub. This directory contains detailed guides covering system architecture, server deployment, security audit procedures, QA test suites, and native mobile build instructions.

---

## 📚 Documentation Index

### 1. 🛡️ [Security Architecture, Testing & Verification Guide](./SecurityTestingAndVerification.md)
* **Audience**: Security Auditors, QA Engineers, Developers, Users
* **Topics Covered**:
  - Zero-Cloud Storage & Zero-Trust Architecture
  - WebRTC DTLS 1.2 End-to-End Encryption
  - Bit-for-Bit SHA-256 Web Crypto API Integrity Verification
  - `scrypt` Password Hashing with unique 16-byte hex salts & constant-time timing-safe comparison
  - Content Security Policy (CSP), XSS prevention & SQL injection mitigation
  - Step-by-Step Security Test Verification Procedures (Tests 1 through 7)
  - Security Audit Test Report Template

### 2. 🧪 [Complete Features & QA Verification Guide](./FeaturesAndQAVerification.md)
* **Audience**: QA Testers, Product Managers, Users
* **Topics Covered**:
  - Full Product Feature Matrix (P2P Transfer, Encrypted Notes, Folder Dropping, Text Deflate Compression, Recharts Speed Visualizer, Serverless Local Wi-Fi Mode, Local Radar, Admin Portal, Android Apps)
  - Step-by-Step QA Test Cases (TC-01 through TC-08)
  - End-to-End QA Release Verification Checklist

### 3. 🖥️ [Production Server & Database Setup Guide](./ServerSetup.md)
* **Audience**: System Administrators, DevOps Engineers, Backend Developers
* **Topics Covered**:
  - Node.js native SQLite database (`node:sqlite`) with Write-Ahead Logging (`WAL`)
  - Server architecture & WebSocket signaling
  - Pre-seeded admin (`admin` / `1@3$5^7*9`) & test user accounts
  - Admin Portal (`/admin`) telemetry, active LAN peer radar tracking, user management
  - REST API endpoint specifications (`/api/db/status`, `/api/auth/signin`, `/api/admin/*`)
  - Production deployment via PM2, systemd service, and Nginx reverse proxy

### 4. 📱 [Android Mobile & Android TV Build Guide](./AndroidBuildGuide.md)
* **Audience**: Mobile Developers, QA Testers, Release Engineers
* **Topics Covered**:
  - Capacitor hybrid architecture (`capacitor.config.json`)
  - Android Mobile (Phones & Tablets) and Android TV / Google TV Leanback dual-launchers
  - Step-by-step Gradle build commands (`assembleDebug`, `assembleRelease`, `bundleRelease`)
  - Keystore generation & APK / AAB cryptographic signing (`zipalign`, `apksigner`)
  - Wireless ADB debugging for Android TV devices & TV D-Pad focus indicators
  - Play Store Pre-flight Security Checklist & Serverless Offline Wi-Fi Mode

### 5. 🗄️ [Pre-seeded SQL Database File (`admin_and_test_users.sql`)](./admin_and_test_users.sql)
* **Audience**: Database Administrators, Testers
* **Topics Covered**:
  - Schema definitions for `users`, `managed_files`, and `transfer_history` tables
  - Pre-computed `scrypt` password hashes and salts for admin and demo accounts

---

## 🚀 Quick Reference Commands

```bash
# Start Development Environment (Express + Vite + WebSockets on port 3000)
npm run dev

# Run Production Build
npm run build && npm run start

# Build Native Android Project & Sync Capacitor
npm run build:android

# Import Pre-seeded Database via SQLite CLI
sqlite3 data/instasend.db < docs/admin_and_test_users.sql
```
