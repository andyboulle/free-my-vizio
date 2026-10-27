import os from 'node:os';
import path from 'node:path';

export function resolveDataDir(): string {
  return process.env.FMV_DATA_DIR || path.join(os.homedir(), '.free-my-vizio');
}
export const configPath = (dir = resolveDataDir()) => path.join(dir, 'config.json');
export const secretsPath = (dir = resolveDataDir()) => path.join(dir, 'secrets.json');
export const cachePath = (dir = resolveDataDir()) => path.join(dir, 'cache');
