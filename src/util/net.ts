import os from 'node:os';
export function pickLanAddress(tvHost: string): string {
  const interfaces = Object.values(os.networkInterfaces()).flat().filter((x): x is os.NetworkInterfaceInfo => Boolean(x && x.family === 'IPv4' && !x.internal));
  const prefix = tvHost.split('.').slice(0, 3).join('.');
  return interfaces.find(x => x.address.split('.').slice(0, 3).join('.') === prefix)?.address ?? interfaces[0]?.address ?? '127.0.0.1';
}
