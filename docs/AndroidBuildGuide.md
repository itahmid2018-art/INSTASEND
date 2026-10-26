# InstaSend Android Mobile & Android TV Build & Compilation Guide

This document provides complete, step-by-step instructions for compiling, building, testing, and publishing **InstaSend** as a native Android APK and App Bundle (AAB) for both **Android Mobile (Phones & Tablets)** and **Android TV / Google TV** devices using Capacitor.

---

## 1. System Requirements & Build Dependencies

To compile and build native Android APKs for InstaSend, ensure your development workstation meets the following prerequisites:

### 1.1 Software & Toolchain Requirements

| Dependency | Required Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | v22.0.0 or higher | JavaScript runtime & build server |
| **npm** | v10.0.0 or higher | Node package manager |
| **JDK (Java Development Kit)** | JDK 17 or JDK 21 (OpenJDK / Temurin) | Android Java compilation |
| **Android Studio** | Koala / Ladybug / Jellyfish (2024.1+) | Native IDE, Gradle builder & ADB tools |
| **Android SDK** | API Level 34 / 35 (Android 14 / 15) | Target Android framework SDK |
| **Android SDK Build-Tools** | v34.0.0 or higher | `aapt2`, `zipalign`, `apksigner` binaries |
| **Capacitor CLI** | v8.0.0 or higher (`@capacitor/cli`) | Native cross-platform bridge sync |

---

## 2. Project Architecture for Native Android

InstaSend uses a Capacitor hybrid bridge architecture that packages the compiled Vite React Single-Page Application (SPA) inside a native Android Web Chrome shell.

```
                           +---------------------------------------+
                           |        InstaSend Web App (React)      |
                           +-------------------+-------------------+
                                               |
                                        Vite Production
                                        Build (`/dist`)
                                               v
                           +---------------------------------------+
                           |    Capacitor Android Project Shell    |
                           |       (`/android` directory)          |
                           +-------------------+-------------------+
                                               |
                          +--------------------+--------------------+
                          |                                         |
                          v                                         v
            +---------------------------+             +---------------------------+
            |  Android Mobile Launcher  |             |  Android TV Leanback      |
            |   (Phones & Tablets)      |             |  (Smart TVs & Set-Tops)   |
            +---------------------------+             +---------------------------+
```

### Key Native Configuration Files
* **`capacitor.config.json`**: App ID (`io.instasend.p2p`), app name (`InstaSend`), web directory (`dist`), and HTTPS scheme settings.
* **`android/app/src/main/AndroidManifest.xml`**: Dual launcher filters (`LAUNCHER` & `LEANBACK_LAUNCHER`), network permissions, and TV banner support.
* **`android/app/src/main/res/xml/network_security_config.xml`**: Enforces TLS/HTTPS & WSS WebSocket encryption required by Google Play Store.

---

## 3. Step-by-Step Compilation & Build Guidelines

### Step 1: Install Dependencies
Open your terminal in the application root directory (`/app/applet`) and verify Node dependencies:
```bash
npm install
```

### Step 2: Build Web Production Distribution
Compile the Vite React frontend into the `/dist` bundle:
```bash
npm run build
```

### Step 3: Synchronize Assets with Native Android Project
Run the automated Capacitor build and sync command to transfer the compiled web assets into the Android native project folder:
```bash
npm run build:android
```
*(This command internally executes `npm run build && npx cap sync android`)*.

---

## 4. Building APKs via Command Line (Gradle)

If you prefer building directly from the command line without opening Android Studio UI:

### 4.1 Build Debug APK (For Local Device Testing)
```bash
cd android
./gradlew assembleDebug
```
The output APK file will be created at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 4.2 Build Release Unsigned APK
```bash
cd android
./gradlew assembleRelease
```
The output unsigned APK file will be created at:
`android/app/build/outputs/apk/release/app-release-unsigned.apk`

### 4.3 Build Android App Bundle (AAB for Google Play Store)
```bash
cd android
./gradlew bundleRelease
```
The output AAB file will be created at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Signing Release APK / AAB for Play Store & Local Installation

Google Play Store and Android devices require release packages to be digitally signed with a cryptographic private key.

### Step 5.1: Generate a Keystore Private Key
Run `keytool` (included with JDK) to generate a 2048-bit RSA keystore file:
```bash
keytool -genkey -v \
  -keystore instasend-release.keystore \
  -alias instasend \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Step 5.2: Align & Sign Release APK
Use `zipalign` and `apksigner` from Android SDK Build-Tools:

1. **Align the APK**:
   ```bash
   $ANDROID_HOME/build-tools/34.0.0/zipalign -v -p 4 \
     android/app/build/outputs/apk/release/app-release-unsigned.apk \
     InstaSend-aligned.apk
   ```

2. **Sign the APK**:
   ```bash
   $ANDROID_HOME/build-tools/34.0.0/apksigner sign \
     --ks instasend-release.keystore \
     --ks-key-alias instasend \
     --out InstaSend-signed-release.apk \
     InstaSend-aligned.apk
   ```

3. **Verify Signature Integrity**:
   ```bash
   $ANDROID_HOME/build-tools/34.0.0/apksigner verify InstaSend-signed-release.apk
   ```

---

## 6. Testing on Android Mobile & Android TV Devices

### 6.1 Testing on Android Mobile via USB Debugging (ADB)
1. Enable **Developer Options** and **USB Debugging** on your Android smartphone or tablet.
2. Connect the mobile device to your workstation via USB cable.
3. Verify ADB detects the device:
   ```bash
   adb devices
   ```
4. Install and run the debug APK on the phone:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

### 6.2 Testing on Android TV / Google TV via Wireless ADB
1. On your Android TV, navigate to **Settings > System > About > Build** and press the Select button 7 times to unlock **Developer Options**.
2. Go to **Settings > Network & Internet** and note the TV's local IP address (e.g. `192.168.1.150`).
3. Enable **ADB Debugging** and **Wireless Debugging** under Developer Options.
4. Connect to Android TV wirelessly from your terminal:
   ```bash
   adb connect 192.168.1.150:5555
   ```
5. Install the APK on the TV:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
6. **TV D-Pad Navigation Verification**:
   * Use the TV Remote D-Pad (Up, Down, Left, Right, Select) to navigate UI buttons.
   * Confirm high-visibility focus indicators (`:focus-visible`) highlight active buttons clearly on the big screen.

---

## 7. Play Store Security & Pre-flight Checklist

Before uploading `app-release.aab` to Google Play Console:

- [x] **Content Security Policy (CSP)**: `index.html` includes CSP meta tags preventing raw script injection.
- [x] **Cleartext Traffic Disabled**: `network_security_config.xml` enforces TLS/HTTPS traffic for WebSockets & API calls.
- [x] **Android TV Leanback Banner**: Android TV banner artwork added to manifest.
- [x] **FileProvider Security**: `file_paths.xml` handles secure temporary file cache sharing without exposing absolute paths.
- [x] **Hardware Dependency Flags**: `leanback` and `touchscreen` set to `required="false"`.
- [x] **Zero Unsafe InnerHTML**: Pure React JSX escaping prevents DOM XSS flaws.

---

## 8. Serverless Local Wi-Fi & Hotspot Offline P2P Mode

InstaSend mobile apps (Android Mobile & Android TV) feature complete independence from central signaling servers:

1. **Service Worker Offline Cache (`virtual:pwa-register`)**:
   - The app's web assets are cached offline via `vite-plugin-pwa`. When an Android device opens the APK without active internet, the app boots and renders 100% offline.
2. **Serverless Local WebRTC Handshake**:
   - Devices on the same local Wi-Fi, LAN, or Wi-Fi Hotspot can initiate a transfer without any cloud server.
   - **Step 1 (Sender Offer)**: Click "Serverless Local Wi-Fi / Hotspot Mode (100% Offline)". The sender's device generates a compressed `INSTASEND_OFFLINE_OFFER:...` string with gathered local network ICE candidates and displays a QR Code / Code string.
   - **Step 2 (Receiver Answer)**: The recipient pastes or scans the offer string and generates an `INSTASEND_OFFLINE_ANSWER:...` return code.
   - **Step 3 (P2P DataChannel)**: Once the return code is entered into the sender's device, direct RAM-to-RAM DTLS 1.2 encrypted WebRTC data streaming commences locally.

---

## 9. Summary of Useful Build Commands

```bash
# Build web frontend and sync with Android native project
npm run build:android

# Open Android project in Android Studio IDE
npm run cap:open

# Sync Capacitor assets only
npm run cap:sync

# View ADB logs during live testing
adb logcat | grep "InstaSend"
```

---

## 10. Automated GitHub Actions CI/CD Build & Release

InstaSend includes an automated **GitHub Actions CI/CD workflow** located at `.github/workflows/android-release.yml`. Every time code is committed and pushed to the repository branch (`main`, `master`, or `develop`), GitHub Actions automatically:

1. **Sets up Node.js & JDK 17**: Configures the build environment with Node.js and Eclipse Temurin JDK 17 for Gradle.
2. **Installs Dependencies & Builds Web App**: Installs `npm` modules and executes `npm run build` to compile the Vite React frontend.
3. **Sets up Android SDK & Capacitor**: Configures Android build tools and syncs web assets with the Capacitor Android project shell (`npx cap sync android`).
4. **Compiles Debug APK with Gradle**: Executes `./gradlew assembleDebug` in the `./android` directory to compile the native Android binary (`app-debug.apk`).
5. **Generates Changelog & GitHub Release**: Extracts the 5 most recent commit messages as update notes and automatically creates a new GitHub Release tagged with a unique timestamp (`v1.0.<timestamp>`), attaching the compiled APK binary for instant downloading.

### Triggering a Release Build:
Simply commit and push your changes to `main`:
```bash
git add .
git commit -m "feat: Add new offline transfer feature"
git push origin main
```
Navigate to your GitHub repository's **Releases** tab to download the freshly compiled Android APK binary complete with commit change notes.
