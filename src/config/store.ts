import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { configPath, resolveDataDir, secretsPath } from './paths.ts';
import { DEFAULT_CONFIG, migrateConfig, type Config, type Secrets, validateConfig } from './schema.ts';
import { log } from '../util/log.ts';
export const generateToken = () => crypto.randomBytes(32).toString('base64url');
export function ensureDataDir(dir = resolveDataDir()): void { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); }
function atomic(file: string, value: unknown, mode = 0o600): void {
  ensureDataDir(path.dirname(file)); const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode }); fs.chmodSync(tmp, mode); fs.renameSync(tmp, file);
}
export function loadConfig(dir = resolveDataDir()): Config {
  ensureDataDir(dir); const file = configPath(dir);
  if (!fs.existsSync(file)) { saveConfig(DEFAULT_CONFIG, dir); return structuredClone(DEFAULT_CONFIG); }
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8')); const migrated = migrateConfig(parsed); const check = validateConfig(migrated);
  if (!check.ok) throw new Error(`Invalid config: ${check.errors.join('; ')}`); return migrated;
}
export function saveConfig(config: Config, dir = resolveDataDir()): void { const check = validateConfig(config); if (!check.ok) throw new Error(`Invalid config: ${check.errors.join('; ')}`); atomic(configPath(dir), config); }
export function loadSecrets(dir = resolveDataDir()): Secrets {
  ensureDataDir(dir); const file = secretsPath(dir);
  if (!fs.existsSync(file)) { const s: Secrets = { adminToken: generateToken(), tvUiToken: generateToken(), tvPairingDeviceId: `fmv-${crypto.randomBytes(8).toString('hex')}` }; saveSecrets(s, dir); log.registerSecret(s.adminToken); log.registerSecret(s.tvUiToken); return s; }
  const s = JSON.parse(fs.readFileSync(file, 'utf8')) as Secrets; for (const v of Object.values(s)) if (typeof v === 'string') log.registerSecret(v); return s;
}
export function saveSecrets(secrets: Secrets, dir = resolveDataDir()): void { atomic(secretsPath(dir), secrets, 0o600); for (const v of Object.values(secrets)) if (typeof v === 'string') log.registerSecret(v); }
