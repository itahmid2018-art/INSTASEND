export interface NetworkInfo {
  success: boolean;
  lanIp: string;
  addresses: string[];
  port: number;
  hostname?: string;
}

let cachedNetworkInfo: NetworkInfo | null = null;
let networkInfoPromise: Promise<NetworkInfo | null> | null = null;

export async function fetchNetworkInfo(): Promise<NetworkInfo | null> {
  if (cachedNetworkInfo) return cachedNetworkInfo;
  if (networkInfoPromise) return networkInfoPromise;

  networkInfoPromise = fetch('/api/network-info')
    .then(res => res.json())
    .then((data: NetworkInfo) => {
      cachedNetworkInfo = data;
      return data;
    })
    .catch(err => {
      console.warn('Failed to fetch network info:', err);
      return null;
    });

  return networkInfoPromise;
}

export function getCachedNetworkInfo(): NetworkInfo | null {
  return cachedNetworkInfo;
}

/**
 * Builds the best share URL for a given room code.
 * If the current client is on localhost / 127.0.0.1, it swaps in the LAN IP
 * so other devices on the same local network (phones, tablets, PCs) can connect.
 * Optionally appends #secret=<secretCode> for 1-click unlock URLs.
 */
export function buildShareUrl(
  roomCode: string, 
  lanIpOverride?: string, 
  secretCode?: string, 
  includeSecret = true
): string {
  const cleanCode = (roomCode || '').replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
  const currentHostname = window.location.hostname;
  const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

  const lanIp = lanIpOverride || cachedNetworkInfo?.lanIp;
  let url = '';

  if (isLocalhost && lanIp && lanIp !== '127.0.0.1') {
    const port = window.location.port ? `:${window.location.port}` : (cachedNetworkInfo?.port ? `:${cachedNetworkInfo.port}` : '');
    url = `${window.location.protocol}//${lanIp}${port}/?code=${cleanCode}`;
  } else {
    url = `${window.location.origin}/?code=${cleanCode}`;
  }

  if (secretCode && includeSecret) {
    url += `#secret=${encodeURIComponent(secretCode)}`;
  }

  return url;
}
