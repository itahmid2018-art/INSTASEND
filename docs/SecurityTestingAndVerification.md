# InstaSend Security Architecture, Testing & Verification Guide

This document provides a comprehensive security specification, threat model analysis, and step-by-step verification procedures for security auditors, QA testers, developers, and end-users.

---

## 1. Executive Summary & Security Philosophy

**InstaSend** is engineered around a **Zero-Trust, Zero-Cloud Storage** architecture. Unlike traditional file-sharing services that store files on third-party cloud servers (S3 buckets, databases, or temporary blob stores), InstaSend transfers file data directly between peer devices (**RAM-to-RAM**) over WebRTC DataChannels encrypted with **DTLS 1.2** (Datagram Transport Layer Security).

### Core Security Principles:
1. **Zero Data Residue**: File payloads never touch disk or memory on the signaling server.
2. **End-to-End Encryption**: DataChannels use DTLS 1.2 with AES-GCM ciphers negotiated directly between client peers via ephemeral Diffie-Hellman keys.
3. **Cryptographic Integrity**: SHA-256 hashes are computed on both sender and receiver devices using Web Crypto API to ensure zero data corruption or tampering.
4. **Strong Credential Hashing**: User authentication passwords are encrypted using `scrypt` with individual random 16-byte hex salts and verified via constant-time comparison.
5. **Defensive Web Security**: Strict Content Security Policy (CSP), HTML escaping, CORS restrictions, and parameter binding prevent XSS, SQL injection, and clickjacking attacks.

---

## 2. Threat Model & Security Controls Matrix

| Threat / Risk | Mitigation Control | Verification Method |
| :--- | :--- | :--- |
| **Cloud File Storage Leakage** | Files stream direct browser-to-browser via WebRTC DataChannels. Server only handles JSON signaling. | Inspect server RAM/disk and network payloads during active transfer. |
| **Man-in-the-Middle (MitM) Eavesdropping** | Mandatory DTLS 1.2 transport layer encryption with AES-128-GCM / AES-256-GCM cipher suites. | Inspect WebRTC `RTCDataChannel` security parameters in `chrome://webrtc-internals`. |
| **Signaling Packet Tampering** | Ephemeral Diffie-Hellman key exchange ensures signaling server cannot decrypt payload even if compromised. | Attempt to reconstruct file payload from WebSocket traffic captures. |
| **File Tampering / Packet Loss** | SHA-256 checksum calculated on sender source and receiver assembled Blob. | Modify 1 byte in stream and verify SHA-256 hash mismatch alert. |
| **Brute-Force Session Interception** | Random 6-character entropy codes + auto-expiration (1h/24h/7d) + room destruction on disconnect. | Rate-limit test API & attempt room code enumeration. |
| **Password Database Breach** | Password hashes stored in SQLite using `crypto.scryptSync` with 16-byte hex salts. | Inspect SQLite `users` table password hash format. |
| **Timing Attacks on Password Verification** | Auth endpoint uses `crypto.timingSafeEqual` for constant-time hash verification. | Measure authentication response timing variance under load. |
| **Cross-Site Scripting (XSS)** | React JSX auto-escaping, strict CSP headers in `index.html`, and sanitized user inputs. | Inject `<script>alert(1)</script>` into usernames, file names, and chats. |
| **SQL Injection** | Parameterized SQL statements (`db.prepare('...').run(param)`) across all SQLite queries. | Inject `' OR '1'='1` in login/signup inputs. |

---

## 3. Step-by-Step Security Verification Procedures for Testers & Users

### Test 1: Verification of Zero Cloud Storage & Zero Server Payload Leakage

**Objective**: Confirm that file contents never pass through or get saved onto the backend server.

**Procedure**:
1. Open terminal on the server machine or inside the applet environment:
   ```bash
   # Check disk space / directory structure before transfer
   ls -la /app/applet/data/
   ```
2. Open Browser A (Sender) at `http://localhost:3000` and stage a large file (e.g., 50MB PDF or Video file).
3. Open Browser B (Receiver) in Incognito mode and enter the 6-character room code.
4. Initiate and complete the transfer.
5. In terminal, inspect the server directory and database:
   ```bash
   # Verify no temporary files or binary blobs exist on server disk
   ls -la /app/applet/data/
   
   # Check SQLite database size (database stores ONLY user accounts & stats, NO files)
   sqlite3 /app/applet/data/instasend.db "SELECT count(*) FROM users;"
   ```
6. **Pass Criteria**: Server disk storage remains completely unchanged during and after transfer. SQLite database size reflects zero file payload storage.

---

### Test 2: WebRTC DTLS 1.2 End-to-End Encryption Verification

**Objective**: Verify that the browser establishes a DTLS-encrypted WebRTC connection directly to the peer.

**Procedure**:
1. Open Google Chrome on both Sender and Receiver devices.
2. In a new tab on Chrome, navigate to `chrome://webrtc-internals`.
3. Open InstaSend in another tab and initiate a file transfer.
4. Switch back to `chrome://webrtc-internals` and select the active `RTCPeerConnection`.
5. Inspect the stats graph and connection properties:
   - Look for `dtlsState: connected`
   - Look for `srtpCipher: TLS_ECDHE_ECDSA_WITH_AES_128_GCM` or `TLS_ECDHE_RSA_WITH_AES_256_GCM`.
6. **Pass Criteria**: `dtlsState` must show `connected` with valid DTLS cipher suite negotiation.

---

### Test 3: Bit-for-Bit SHA-256 Cryptographic Hash Verification

**Objective**: Verify cryptographic integrity check on transferred files.

**Procedure**:
1. Select a file on Sender device (e.g., `sample.zip`).
2. Generate transfer code and receive the file on Receiver device.
3. Upon transfer completion, inspect the file card in `ReceiveTab.tsx` or `HistoryModal.tsx`.
4. Confirm the presence of the green **SHA-256 Verified** badge.
5. Manually verify the SHA-256 hash using CLI:
   - Linux/macOS: `shasum -a 256 sample.zip`
   - Windows PowerShell: `Get-FileHash sample.zip -Algorithm SHA256`
   - Compare the output with the SHA-256 string shown in InstaSend's History modal.
6. **Pass Criteria**: SHA-256 digest calculated by browser Web Crypto API matches local OS file checksum exactly.

---

### Test 4: Password Hashing & Timing Attack Verification

**Objective**: Confirm that user passwords are securely hashed with scrypt and protected against timing attacks.

**Procedure**:
1. Run a test POST request to `/api/auth/signin` with invalid credentials:
   ```bash
   curl -i -X POST http://localhost:3000/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin","password":"WrongPassword123"}'
   ```
2. Inspect the response headers and HTTP status (`401 Unauthorized`).
3. Query the SQLite database to verify password storage:
   ```bash
   sqlite3 /app/applet/data/instasend.db "SELECT id, email, password_hash, salt FROM users WHERE email='admin';"
   ```
4. **Pass Criteria**: `password_hash` column contains a 128-character hex scrypt hash. `salt` column contains a unique 32-character hex salt. Password is NEVER stored in plaintext.

---

### Test 5: Content Security Policy (CSP) & XSS Penetration Testing

**Objective**: Verify that script injection vectors are sanitized and blocked.

**Procedure**:
1. Attempt to create a user account or change device name using XSS payloads:
   - Payload: `<script>alert('XSS-TEST')</script>`
   - Payload: `<img src=x onerror=alert('XSS')>`
2. Stage a file with an XSS name: `"><img src=x onerror=alert(1)>.png`.
3. Send a message in Peer Chat containing script tags.
4. Observe application behavior in all views (Header, TransferTab, ReceiveTab, Chat, HistoryModal, AdminPortal).
5. Open Browser DevTools Console to check CSP violation reporting.
6. **Pass Criteria**: No scripts execute. All input strings render safely as plain text. Zero unexpected popup alerts.

---

### Test 6: Offline Local Wi-Fi / Hotspot Serverless Handshake Verification

**Objective**: Confirm that mobile devices can transfer files 100% offline without any signaling server or internet connection.

**Procedure**:
1. Turn off external internet / Wi-Fi router internet connection (or connect two devices to a standalone Wi-Fi Hotspot with no WAN internet).
2. Open InstaSend on Device 1 (Sender) and click **"Serverless Local Wi-Fi / Hotspot Mode (100% Offline)"**.
3. Observe Step 1: An `INSTASEND_OFFLINE_OFFER:...` code string and QR code is displayed.
4. Open InstaSend on Device 2 (Receiver), click **"Serverless Local Wi-Fi Mode (100% Offline)"**, paste the offer code, and click **"Accept Offer & Generate Return Code"**.
5. Observe Step 2: An `INSTASEND_OFFLINE_ANSWER:...` return code is generated on Device 2.
6. Paste the return code into Device 1 and click **"Connect Serverless P2P Now"**.
7. Observe transfer: File data streams directly RAM-to-RAM over local Wi-Fi.
8. **Pass Criteria**: File transfer succeeds with 0% server connectivity.

---

## 4. Play Store & Mobile Security Compliance Checklist

Before publishing InstaSend native Android APK/AAB packages to Google Play Store:

- [x] **Network Security Config**: `network_security_config.xml` enforces TLS/HTTPS traffic for all remote API calls and WebSockets.
- [x] **Android Manifest Permissions**: Only required permissions requested (`INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA`).
- [x] **Cleartext Traffic Disabled**: Cleartext HTTP traffic disabled in production builds.
- [x] **FileProvider Protection**: Temporary file sharing uses secure `FileProvider` (`file_paths.xml`) without exposing internal paths.
- [x] **Android TV Leanback Hardware Declarations**: `touchscreen` set to `android:required="false"`.
- [x] **Dependency Audit**: Zero vulnerable third-party native binaries.

---

## 5. Security Testing Report Template for QA Testers

When completing a QA security cycle, testers should record results using the following template:

```
====================================================================
INSTASEND SECURITY AUDIT TEST REPORT
====================================================================
Date: YYYY-MM-DD
Tester Name: 
Environment: [ ] Local Dev  [ ] Android Mobile APK  [ ] Android TV APK
Version / Commit: 

TEST RESULTS MATRIX:
--------------------------------------------------------------------
[PASS/FAIL] Test 1: Zero Cloud File Payload Leakage
[PASS/FAIL] Test 2: WebRTC DTLS 1.2 End-to-End Encryption
[PASS/FAIL] Test 3: Bit-for-Bit SHA-256 Cryptographic Hash Check
[PASS/FAIL] Test 4: Password Hashing (scrypt + salt) Verification
[PASS/FAIL] Test 5: Content Security Policy & XSS Testing
[PASS/FAIL] Test 6: Offline Local Wi-Fi Serverless P2P Handshake
[PASS/FAIL] Test 7: Mobile APK Network Security & Android Permissions

COMMENTS / AUDIT NOTES:
--------------------------------------------------------------------

====================================================================
```
