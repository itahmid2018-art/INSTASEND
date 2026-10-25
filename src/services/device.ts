import { DeviceInfo } from '../types.ts';

export function getLocalDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown OS';
  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // Detect OS
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  else if (/Android/i.test(userAgent)) {
    os = 'Android';
    type = 'mobile';
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    os = /iPad/i.test(userAgent) ? 'iPadOS' : 'iOS';
    type = /iPad/i.test(userAgent) ? 'tablet' : 'mobile';
  }

  // Detect Browser
  if (/Edg/i.test(userAgent)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox|FxiOS/i.test(userAgent)) browser = 'Firefox';
  else if (/Safari/i.test(userAgent)) browser = 'Safari';
  else if (/Opera|OPR/i.test(userAgent)) browser = 'Opera';

  // Check screen width for tablet/mobile detection
  if (window.innerWidth <= 768 && type === 'desktop') {
    type = 'mobile';
  }

  // Custom device nickname in localStorage
  let name = localStorage.getItem('hexasend_device_name');
  if (!name) {
    const randomAdjectives = ['Swift', 'Neon', 'Hyper', 'Cyber', 'Sonic', 'Aero', 'Quantum', 'Vivid'];
    const randomNouns = ['Falcon', 'Orion', 'Pulse', 'Vertex', 'Nova', 'Comet', 'Apex', 'Matrix'];
    const adj = randomAdjectives[Math.floor(Math.random() * randomAdjectives.length)];
    const noun = randomNouns[Math.floor(Math.random() * randomNouns.length)];
    name = `${adj} ${noun} (${os})`;
    localStorage.setItem('hexasend_device_name', name);
  }

  return {
    name,
    browser,
    os,
    type
  };
}

export function setCustomDeviceName(name: string): void {
  localStorage.setItem('hexasend_device_name', name.trim());
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return 'Calculating...';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Compute SHA-256 hash using Web Crypto API
export async function computeSHA256(blobOrBuffer: Blob | ArrayBuffer): Promise<string> {
  const buffer = blobOrBuffer instanceof Blob ? await blobOrBuffer.arrayBuffer() : blobOrBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
