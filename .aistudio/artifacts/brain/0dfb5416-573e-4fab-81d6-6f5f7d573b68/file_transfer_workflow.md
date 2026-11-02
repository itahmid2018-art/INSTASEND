# InstaSend File Transfer Workflow

This document details the functional workflow of the InstaSend P2P file transfer process, flexible receiver security policies, and session lifecycle controls.

## 1. Functional Workflow

### Sender Flow
1. **File Staging & Security Selection:**
   - The sender selects files or folders to share.
   - **Receiver Access Mode:** Sender chooses between **Without Secret Code** (open 1-click access) or **With Secret Code** (requires PIN/passcode).
   - **Temporary URL Expiry Policy:** Sender toggles `Temporary URL: Active only until sender closes session` (default enabled) or fixed fallback TTL.
2. **Room Initiation:**
   - The client requests a 6-character room code from the signaling server.
   - If a secret code is specified, client derives an AES-256-GCM encryption key using Web Crypto PBKDF2/SHA-256.
3. **Link & QR Distribution:**
   - **1-Click Direct Link:** Appends `#secret=<passcode>`, auto-unlocking for recipient without manual entry.
   - **Protected Link:** Omits `#secret=`, prompting recipient with a passcode unlock modal.
   - **Copy Passcode Only:** Quick PIN copy button.
   - **WhatsApp / QR Scan:** Includes one-click join and clear security instructions.
4. **Signaling & Transfer:**
   - WebRTC connection negotiated with receiver via WebSocket signaling.
   - Direct LAN HTTP fallback prepared in background for restrictive NAT networks.

### Receiver Flow
1. **Room Access:** The receiver joins via 6-character code, QR scan, or shared link.
2. **Access Control Check:**
   - If the room requires a secret code and no secret was embedded in the URL `#secret=`, the server returns `secret-code-required`.
   - The UI displays an interactive Passcode Unlock modal.
   - Upon submitting the valid PIN, the receiver joins the session and initializes the decryption key.
3. **Session Expiry Enforcement:**
   - If the session is configured to expire when the sender closes, the UI displays `🟢 Live Session • Active until sender closes`.
   - When the sender closes their tab or clicks `Stop Transfer & Expire URL`, the signaling server sends a `session-expired` event to the receiver and immediately deletes the room.
   - Receiver UI updates to `Temporary URL Expired` and prompts to return home.

---

## 2. Key Features
- **Flexible Receiver Security:** Open access or protected passcode access per transfer.
- **Temporary URL Auto-Destruction:** Temporary URLs stay alive as long as sender keeps the session open, expiring immediately upon closing.
- **Zero Cloud Storage:** Data channels operate browser-to-browser via WebRTC (RAM-to-RAM).
- **Grace Period Protection:** 120-second tolerance for transient Wi-Fi flickers with auto-reclaim and auto-reconnect.
